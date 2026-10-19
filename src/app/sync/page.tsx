'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, Loader2, QrCode as QrIcon, ScanLine, Wifi } from 'lucide-react';
import { ConnectError, Peer } from '@/lib/sync/peer';
import { handshakeLink, parseHandshakeText, type HandshakeKind } from '@/lib/sync/handshake';
import { lastSync, runSync, type SyncProgress, type SyncResult } from '@/lib/sync/session';
import { fmtDate, fmtTime } from '@/lib/utils';
import { Button, Card, PageHeader, Progress, Textarea } from '@/components/ui';
import { QrCode, QrScanner } from '@/components/qr';

/** How long the second device waits for the first to scan its reply. */
const REPLY_WAIT_MS = 5 * 60_000;

type Stage =
  | { k: 'choose' }
  | { k: 'working'; text: string }
  | { k: 'show-offer'; link: string }
  | { k: 'scan'; expect: HandshakeKind }
  | { k: 'show-answer'; link: string }
  | { k: 'syncing'; progress: SyncProgress | null }
  | { k: 'done'; result: SyncResult }
  | { k: 'error'; title: string; message: string; network?: boolean };

export default function SyncPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ k: 'choose' });
  const [hint, setHint] = useState<string | null>(null);
  const [last, setLast] = useState<ReturnType<typeof lastSync>>(null);
  const peer = useRef<Peer | null>(null);
  // Each attempt gets an id; a cancelled attempt's late callbacks must not touch the screen.
  const attempt = useRef(0);

  const drop = () => {
    peer.current?.close();
    peer.current = null;
  };

  const begin = () => {
    drop();
    setHint(null);
    const id = ++attempt.current;
    return (s: Stage) => {
      if (attempt.current === id) setStage(s);
    };
  };

  const cancel = () => {
    begin();
    setStage({ k: 'choose' });
  };

  const fail = (show: (s: Stage) => void, e: unknown) => {
    drop();
    if (e instanceof ConnectError) {
      show({ k: 'error', title: 'Couldn’t connect', message: 'Your devices couldn’t reach each other.', network: true });
    } else {
      show({ k: 'error', title: 'Sync didn’t finish', message: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    }
  };

  const sync = async (p: Peer, show: (s: Stage) => void, waitMs?: number) => {
    const wire = await p.connected(waitMs);
    show({ k: 'syncing', progress: null });
    const result = await runSync(wire, (progress) => show({ k: 'syncing', progress }));
    show({ k: 'done', result });
    setLast(lastSync());
    peer.current = null;
    setTimeout(() => p.close(), 1000); // let the last message reach the other device
  };

  const start = async () => {
    const show = begin();
    show({ k: 'working', text: 'Creating a code…' });
    try {
      const { peer: p, code } = await Peer.start();
      peer.current = p;
      show({ k: 'show-offer', link: handshakeLink('offer', code) });
    } catch (e) {
      fail(show, e);
    }
  };

  const join = async (code: string) => {
    const show = begin();
    show({ k: 'working', text: 'Reading the code…' });
    try {
      const { peer: p, code: reply } = await Peer.join(code);
      peer.current = p;
      show({ k: 'show-answer', link: handshakeLink('answer', reply) });
      await sync(p, show, REPLY_WAIT_MS);
    } catch (e) {
      fail(show, e);
    }
  };

  const finish = async (code: string) => {
    const p = peer.current;
    const id = attempt.current;
    const show = (s: Stage) => attempt.current === id && setStage(s);
    if (!p) return;
    setHint(null);
    show({ k: 'working', text: 'Connecting…' });
    try {
      await p.finish(code);
      await sync(p, show);
    } catch (e) {
      fail(show, e);
    }
  };

  /** A scanned or pasted code. Returns false to keep the scanner running. */
  const takeCode = (text: string, expect: HandshakeKind): boolean => {
    const parsed = parseHandshakeText(text);
    if (!parsed) {
      setHint('That isn’t an Academic OS sync code.');
      return false;
    }
    if (parsed.kind !== expect) {
      setHint(
        expect === 'offer'
          ? 'That’s a reply code. Scan the code on the device where you tapped “Start here”.'
          : 'That’s the first code. Scan the reply code your other device is showing now.',
      );
      return false;
    }
    if (expect === 'offer') join(parsed.code);
    else finish(parsed.code);
    return true;
  };

  useEffect(() => {
    setLast(lastSync());
    // opened from a QR link scanned with the phone's own camera app
    const parsed = parseHandshakeText(window.location.hash);
    if (parsed) {
      history.replaceState(null, '', window.location.pathname);
      if (parsed.kind === 'offer') join(parsed.code);
      else
        setStage({
          k: 'error',
          title: 'That’s a reply code',
          message: 'Scan it from the device where you tapped “Start here”, using its “Scan reply code” button.',
        });
    }
    return drop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-4 animate-fade-in">
      <div>
        <PageHeader title="Sync devices" />
        <p className="mt-2 text-sm text-muted-foreground">
          Copy your changes between your phone and computer, directly over Wi-Fi. Nothing is uploaded anywhere.
        </p>
      </div>

      {stage.k === 'choose' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice icon={QrIcon} title="Start here" body="Show a code for your other device to scan." onClick={start} />
            <Choice
              icon={ScanLine}
              title="Scan a code"
              body="Use this if your other device is already showing one."
              onClick={() => setStage({ k: 'scan', expect: 'offer' })}
            />
          </div>
          <Card className="space-y-3 p-4 text-sm">
            <p className="font-display font-semibold">How it works</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>Open Sync on both devices and keep both screens on.</li>
              <li>Tap <b className="text-foreground">Start here</b> on one, and scan its code with the other.</li>
              <li>The other device then shows a reply code. Scan that with the first one.</li>
            </ol>
            <p className="text-muted-foreground">
              Both devices end up with everything. Where an item changed on both, the newer edit wins, and deleted
              items stay deleted.
            </p>
            <Tip />
          </Card>
          {last && (
            <p className="text-center text-xs text-muted-foreground">
              Last synced with {last.device} on {fmtDate(last.at)} at {fmtTime(last.at)}
            </p>
          )}
        </>
      )}

      {stage.k === 'working' && (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {stage.text}
        </Card>
      )}

      {stage.k === 'show-offer' && (
        <Card className="space-y-4 p-4 sm:p-5">
          <Step n={1} title="Scan this with your other device">
            On your other device, open Academic OS, go to <b>Settings → Sync devices</b>, and tap <b>Scan a code</b>.
          </Step>
          <QrCode value={stage.link} label="Sync code for your other device" className="mx-auto w-full max-w-[280px]" />
          <CopyCode text={stage.link} />
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">When your other device shows a reply code:</p>
            <Button className="w-full" onClick={() => setStage({ k: 'scan', expect: 'answer' })}>
              <ScanLine className="h-4 w-4" /> Scan reply code
            </Button>
          </div>
          <CancelButton onClick={cancel} />
        </Card>
      )}

      {stage.k === 'scan' && (
        <Card className="space-y-4 p-4 sm:p-5">
          {stage.expect === 'offer' ? (
            <Step title="Scan the code on your other device">
              Point your camera at the code your other device is showing.
            </Step>
          ) : (
            <Step n={2} title="Scan the reply code">
              Point this device’s camera at the reply code on your other device.
            </Step>
          )}
          <QrScanner onResult={(text) => takeCode(text, stage.expect)} />
          {hint && <p className="rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400">{hint}</p>}
          <PasteCode onSubmit={(text) => takeCode(text, stage.expect)} />
          <CancelButton onClick={cancel} />
        </Card>
      )}

      {stage.k === 'show-answer' && (
        <Card className="space-y-4 p-4 sm:p-5">
          <Step n={2} title="Show this reply code to your first device">
            On the device that showed the first code, tap <b>Scan reply code</b> and point its camera here. Keep this
            screen on.
          </Step>
          <QrCode value={stage.link} label="Reply code for your first device" className="mx-auto w-full max-w-[280px]" />
          <CopyCode text={stage.link} />
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Waiting for your other device…
          </p>
          <CancelButton onClick={cancel} />
        </Card>
      )}

      {stage.k === 'syncing' && (
        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-display font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Syncing…
          </p>
          <Progress
            value={
              !stage.progress || stage.progress.stage === 'comparing' ? 5
              : stage.progress.stage === 'saving' ? 100
              : stage.progress.toSend ? 10 + (stage.progress.sent / stage.progress.toSend) * 85 : 50
            }
          />
          <p className="text-sm text-muted-foreground">
            {!stage.progress || stage.progress.stage === 'comparing'
              ? 'Comparing your devices…'
              : stage.progress.stage === 'saving'
                ? 'Saving changes…'
                : `Sent ${stage.progress.sent} of ${stage.progress.toSend} · received ${stage.progress.received}`}
          </p>
          <p className="text-xs text-muted-foreground">Keep both screens on until this finishes.</p>
        </Card>
      )}

      {stage.k === 'done' && (
        <Card className="space-y-4 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Synced with {stage.result.device}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {stage.result.received === 0
                ? 'Nothing new came in'
                : `${stage.result.received} change${stage.result.received === 1 ? '' : 's'} received`}
              {' · '}
              {stage.result.sent} sent
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => router.push('/')}>Done</Button>
            <Button variant="outline" onClick={() => setStage({ k: 'choose' })}>
              Sync again
            </Button>
          </div>
        </Card>
      )}

      {stage.k === 'error' && (
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-semibold">{stage.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{stage.message}</p>
            </div>
          </div>
          {stage.network && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Keep Sync open on both devices until it finishes.</li>
              <li>Put both devices on the same Wi-Fi.</li>
              <li>On campus or public Wi-Fi, connect your computer to your phone’s hotspot and try again.</li>
            </ul>
          )}
          <Button className="w-full" onClick={cancel}>
            Try again
          </Button>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Choice({ icon: Icon, title, body, onClick }: { icon: typeof QrIcon; title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="font-display font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{body}</span>
    </button>
  );
}

function Step({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      {n && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step {n} of 2</p>}
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Tip() {
  return (
    <p className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
      <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
      Works best with both devices on the same Wi-Fi. Campus and public Wi-Fi often stop devices reaching each other;
      if it fails, connect your computer to your phone’s hotspot and try again.
    </p>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="w-full" onClick={onClick}>
      Cancel
    </Button>
  );
}

/** For devices that can't scan: show the code as text to copy. */
function CopyCode({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mx-auto block text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
        Can’t scan? Show as text
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <input readOnly value={text} aria-label="Sync code" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs" />
      <Button
        variant="outline"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

/** For devices that can't scan: paste a code copied from the other device. */
function PasteCode({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mx-auto block text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
        Can’t scan? Paste a code
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the code from your other device"
        aria-label="Sync code from your other device"
        className="min-h-[72px] font-mono text-xs"
      />
      <Button variant="outline" className="w-full" disabled={!value.trim()} onClick={() => onSubmit(value)}>
        Use this code
      </Button>
    </div>
  );
}
