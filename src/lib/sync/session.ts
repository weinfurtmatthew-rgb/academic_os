import { sanitizeSide, useStore } from '../store';
import { SYNCED_SETTINGS, type Settings, type Tombstone } from '../types';
import { manifestOf, planMerge, planSize, recordsToSend, type Manifest, type Records, type Stamped } from './merge';
import type { Wire } from './peer';

/*
 * One sync, run identically on both devices except for who speaks first:
 *   1. each sends `hello`: what it has (id + stamp per record), its deletions and synced settings.
 *      The device that showed the first code sends first; the other waits for it. A message sent
 *      the moment one side's channel opens can be dropped if the other side's isn't open yet, and
 *      receiving the first hello proves both are.
 *   2. each sends only the records the other would take, then `done` (both directions at once)
 *   3. each merges what it received, then sends `applied`; the sync counts once both have
 */

const PROTOCOL = 1;
const BATCH_CHARS = 200_000;
const LAST_SYNC_KEY = 'academic-os-last-sync';

interface Hello {
  t: 'hello';
  app: 'academic-os';
  protocol: number;
  device: string;
  manifest: Manifest;
  tombstones: Tombstone[];
  settings: Partial<Settings>;
}
type Msg =
  | Hello
  | { t: 'records'; store: string; items: Stamped[] }
  | { t: 'done' }
  | { t: 'applied' }
  | { t: 'abort'; reason: string };

export interface SyncProgress {
  stage: 'comparing' | 'transferring' | 'saving';
  sent: number;
  toSend: number;
  received: number;
}
export interface SyncResult {
  device: string;
  sent: number;
  received: number;
}

export function deviceName(): string {
  if (typeof navigator === 'undefined') return 'device';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return 'Linux computer';
  return 'device';
}

export function lastSync(): { at: string; device: string } | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const count = (r: Records) => Object.values(r).reduce((n, l) => n + l.length, 0);

async function next(wire: Wire): Promise<Msg> {
  const m = await wire.receive<Msg>();
  if (m.t === 'abort') {
    throw new Error(
      m.reason === 'version'
        ? 'The two devices are on different versions of Academic OS. Reload the app on both, then try again.'
        : 'The other device stopped the sync.',
    );
  }
  return m;
}

async function expect<K extends Msg['t']>(wire: Wire, t: K): Promise<Extract<Msg, { t: K }>> {
  const m = await next(wire);
  if (m.t !== t) throw new Error('The devices got out of step. Try syncing again.');
  return m as Extract<Msg, { t: K }>;
}

export async function runSync(wire: Wire, onProgress: (p: SyncProgress) => void): Promise<SyncResult> {
  const progress: SyncProgress = { stage: 'comparing', sent: 0, toSend: 0, received: 0 };
  const report = () => onProgress({ ...progress });
  report();

  const store = useStore.getState();
  const local = store.localSide();
  const settings: Partial<Settings> = { updatedAt: store.settings.updatedAt };
  for (const k of SYNCED_SETTINGS) (settings as Record<string, unknown>)[k] = store.settings[k];

  const mine: Hello = {
    t: 'hello', app: 'academic-os', protocol: PROTOCOL, device: deviceName(),
    manifest: manifestOf(local.records), tombstones: local.tombstones, settings,
  };
  let hello: Hello;
  if (wire.initiator) {
    await wire.send(mine);
    hello = await expect(wire, 'hello');
  } else {
    hello = await expect(wire, 'hello');
    await wire.send(mine);
  }
  if (hello.app !== 'academic-os' || hello.protocol !== PROTOCOL) {
    await wire.send({ t: 'abort', reason: 'version' }).catch(() => undefined);
    throw new Error('The two devices are on different versions of Academic OS. Reload the app on both, then try again.');
  }

  const outgoing = recordsToSend(local.records, hello.manifest, hello.tombstones);
  // deletions travel in `hello`; count the ones that remove something on the other device
  const deletions = local.tombstones.filter((t) => {
    const theirs = hello.manifest[t.store]?.[t.id];
    return theirs !== undefined && t.deletedAt > theirs;
  }).length;
  progress.stage = 'transferring';
  progress.toSend = count(outgoing);
  report();

  // Send and receive at the same time, so a large upload doesn't stall the other direction.
  const sending = (async () => {
    for (const [s, items] of Object.entries(outgoing)) {
      let batch: Stamped[] = [];
      let size = 0;
      const flush = async () => {
        if (!batch.length) return;
        await wire.send({ t: 'records', store: s, items: batch });
        progress.sent += batch.length;
        report();
        batch = [];
        size = 0;
      };
      for (const item of items) {
        const n = JSON.stringify(item).length;
        if (size + n > BATCH_CHARS) await flush();
        batch.push(item);
        size += n;
      }
      await flush();
    }
    await wire.send({ t: 'done' });
  })();
  sending.catch(() => undefined); // a dropped connection is reported by the receive loop below

  const received: Records = {};
  for (;;) {
    const m = await next(wire);
    if (m.t === 'done') break;
    if (m.t !== 'records' || !Array.isArray(m.items)) throw new Error('The devices got out of step. Try syncing again.');
    (received[m.store] ??= []).push(...m.items);
    progress.received += m.items.length;
    report();
  }
  await sending;

  progress.stage = 'saving';
  report();
  const now = useStore.getState();
  const plan = planMerge(now.localSide(), sanitizeSide(received, hello.tombstones));
  now.applyPlan(plan);
  const settingsChanged = useStore.getState().mergeSettings(hello.settings);
  await wire.send({ t: 'applied' });
  await expect(wire, 'applied');

  try {
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({ at: new Date().toISOString(), device: hello.device }));
  } catch {
    /* storage unavailable */
  }
  return { device: hello.device, sent: progress.toSend + deletions, received: planSize(plan) + (settingsChanged ? 1 : 0) };
}
