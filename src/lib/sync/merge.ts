import type { Tombstone } from '../types';

/*
 * Last-writer-wins merge for sync and backup import. Kept free of browser and app imports so the
 * rules can be unit-tested with plain Node (tests/sync-merge.test.ts).
 *
 * Rules, per record: the newest change wins. A deletion beats edits stamped before it; an edit
 * stamped after a deletion brings the record back. On a tie the holder keeps its own copy.
 * Records from before change tracking have no stamp and lose to any stamped change.
 */

/** Anything sync can merge: an id plus the stamp of its last change. */
export interface Stamped {
  id: string;
  updatedAt?: string;
}
export type Records = Record<string, Stamped[]>;
export interface Side {
  records: Records;
  tombstones: Tombstone[];
}
/** store → id → stamp ('' for records from before change tracking). */
export type Manifest = Record<string, Record<string, string>>;
export interface MergePlan {
  put: Records;
  del: { store: string; id: string }[];
  tombstones: Tombstone[];
}

export const tombKey = (store: string, id: string) => `${store}:${id}`;
const stampOf = (r: Stamped) => r.updatedAt ?? '';

export function manifestOf(records: Records): Manifest {
  const m: Manifest = {};
  for (const [store, list] of Object.entries(records)) {
    m[store] = {};
    for (const r of list) m[store][r.id] = stampOf(r);
  }
  return m;
}

/**
 * Does a holder with its own copy stamped `have` (undefined if it has none) and a deletion stamped
 * `deleted` (if any) take an incoming copy stamped `incoming`?
 */
export function accepts(incoming: string, have: string | undefined, deleted: string | undefined): boolean {
  if (deleted !== undefined && deleted >= incoming) return false;
  return have === undefined || incoming > have;
}

const deletionsByKey = (tombs: Tombstone[]) => new Map(tombs.map((t) => [t.key, t.deletedAt]));

/** The local records a peer would take, given the peer's manifest and deletions. */
export function recordsToSend(local: Records, peer: Manifest, peerTombs: Tombstone[]): Records {
  const peerDeleted = deletionsByKey(peerTombs);
  const out: Records = {};
  for (const [store, list] of Object.entries(local)) {
    const theirs = peer[store] ?? {};
    const send = list.filter((r) => accepts(stampOf(r), theirs[r.id], peerDeleted.get(tombKey(store, r.id))));
    if (send.length) out[store] = send;
  }
  return out;
}

/** What `local` has to change to absorb `remote`. */
export function planMerge(local: Side, remote: Side): MergePlan {
  const localDeleted = deletionsByKey(local.tombstones);
  const remoteDeleted = deletionsByKey(remote.tombstones);
  const localStamp = new Map<string, string>();
  for (const [store, list] of Object.entries(local.records)) {
    for (const r of list) localStamp.set(tombKey(store, r.id), stampOf(r));
  }

  const put: Records = {};
  const taken = new Set<string>();
  for (const [store, list] of Object.entries(remote.records)) {
    for (const r of list) {
      const key = tombKey(store, r.id);
      const s = stampOf(r);
      const ownDeletion = remoteDeleted.get(key); // a sender shouldn't hold both, but don't trust it
      if (ownDeletion !== undefined && ownDeletion >= s) continue;
      if (!accepts(s, localStamp.get(key), localDeleted.get(key))) continue;
      (put[store] ??= []).push(r);
      taken.add(key);
    }
  }

  const del: MergePlan['del'] = [];
  const tombstones: Tombstone[] = [];
  for (const t of remote.tombstones) {
    const known = localDeleted.get(t.key);
    if (known === undefined || t.deletedAt > known) tombstones.push(t);
    const have = localStamp.get(t.key);
    if (have !== undefined && t.deletedAt > have && !taken.has(t.key)) del.push({ store: t.store, id: t.id });
  }

  return { put, del, tombstones };
}

export function planSize(p: MergePlan): number {
  return Object.values(p.put).reduce((n, l) => n + l.length, 0) + p.del.length;
}
