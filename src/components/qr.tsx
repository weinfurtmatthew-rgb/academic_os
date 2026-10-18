'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CameraOff } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { cn } from '@/lib/utils';

/* --------------------------------- display --------------------------------- */

/** A QR code as crisp SVG. Always black on white, even in dark mode, so cameras can read it. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { path, size } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        let run = 1;
        while (c + run < n && qr.isDark(r, c + run)) run++;
        d += `M${c} ${r}h${run}v1h-${run}z`;
        c += run - 1;
      }
    }
    return { path: d, size: n };
  }, [value]);

  const quiet = 4;
  const box = size + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
      shapeRendering="crispEdges"
      className={cn('aspect-square rounded-2xl bg-white', className)}
    >
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

/* --------------------------------- scanning -------------------------------- */

type Detect = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

/** The browser's own detector where it has one (Chrome on Android); otherwise jsQR, loaded on demand. */
async function makeDetector(): Promise<Detect> {
  const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (BD) {
    try {
      const formats = await BD.getSupportedFormats?.();
      if (!formats || formats.includes('qr_code')) {
        const detector = new BD({ formats: ['qr_code'] });
        return async (v) => (await detector.detect(v))[0]?.rawValue ?? null;
      }
    } catch {
      /* fall through to jsQR */
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (v) => {
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(v, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera access is blocked. Allow it in your browser’s site settings, or paste a code instead.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device. Paste a code instead.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return 'Couldn’t start the camera. Paste a code instead.';
}

/**
 * Live camera view that reports QR codes it reads. `onResult` returns false to keep scanning
 * (e.g. it was the wrong kind of code).
 */
export function QrScanner({ onResult }: { onResult: (text: string) => boolean | void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [error, setError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('The camera isn’t available in this browser. Paste a code instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e) {
        if (!stopped) setError(cameraError(e));
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      // laptop webcams face the user; mirror the preview so moving the phone feels natural
      setMirrored(stream.getVideoTracks()[0]?.getSettings().facingMode !== 'environment');
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      // jsQR is fetched on first use, so a first-ever scan while offline can't load it
      const detect = await makeDetector().catch(() => null);
      if (!detect) {
        stream.getTracks().forEach((t) => t.stop());
        if (!stopped) setError('Couldn’t load the scanner. Connect to the internet once, or paste a code instead.');
        return;
      }

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          const text = await detect(video).catch(() => null);
          if (stopped) return;
          if (text && onResultRef.current(text) !== false) return;
        }
        timer = setTimeout(tick, 120);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center">
        <CameraOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className={cn('h-full w-full object-cover', mirrored && '-scale-x-100')} />
      <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-[3px] border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
    </div>
  );
}
