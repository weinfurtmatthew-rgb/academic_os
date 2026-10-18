'use client';

import { useEffect, useState } from 'react';
import { Music2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components/ui';

const LS_KEY = 'academic-os-music-url';

/**
 * Turns any YouTube URL into an embeddable src.
 * Supports: watch?v=…, youtu.be/…, /live/…, /shorts/…, /embed/…,
 * playlist?list=…, and watch?v=…&list=… (video inside a playlist).
 */
export function toYouTubeEmbed(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, '');
    if (!/(^|\.)youtube\.com$|^youtu\.be$|^youtube-nocookie\.com$/.test(host)) return null;
    const base = 'https://www.youtube-nocookie.com/embed/';
    const list = url.searchParams.get('list');

    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else {
      id = url.searchParams.get('v');
      if (!id) {
        const m = url.pathname.match(/\/(live|shorts|embed)\/([\w-]{6,})/);
        if (m) id = m[2];
      }
    }

    if (id && list) return `${base}${id}?list=${encodeURIComponent(list)}`;
    if (id) return `${base}${id}`;
    if (list) return `${base}videoseries?list=${encodeURIComponent(list)}`;
    return null;
  } catch {
    return null;
  }
}

const PRESETS = [
  { label: 'lofi hip hop radio', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: 'deep focus playlist', url: 'https://www.youtube.com/playlist?list=PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo' },
];

/** Compact YouTube music card for the study screen. */
export function MusicPlayer({ className }: { className?: string }) {
  const [input, setInput] = useState('');
  const [embed, setEmbed] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        setInput(saved);
        setEmbed(toYouTubeEmbed(saved));
      }
    } catch { /* ignore */ }
  }, []);

  const load = (raw: string) => {
    const src = toYouTubeEmbed(raw);
    if (!src) {
      setError(true);
      return;
    }
    setError(false);
    setInput(raw);
    setEmbed(src);
    try { localStorage.setItem(LS_KEY, raw); } catch { /* ignore */ }
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-3.5 shadow-soft', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Music2 className="h-4 w-4 text-primary" /> Music
        </p>
        {embed && (
          <button
            onClick={() => { setEmbed(null); try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" /> remove
          </button>
        )}
      </div>

      {embed ? (
        <div className="mt-2.5 overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            src={embed}
            title="Study music"
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="mt-2.5 space-y-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) load(input); }}
          >
            <Input
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder="Paste a YouTube video, playlist or live URL"
              className="h-9 text-xs"
            />
            <Button type="submit" size="sm" disabled={!input.trim()}>Play</Button>
          </form>
          {error && <p className="text-[11px] font-semibold text-destructive">That doesn’t look like a YouTube link.</p>}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.url}
                onClick={() => load(p.url)}
                className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                ▶ {p.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground/70">
            Playback streams from YouTube, so it needs internet — everything else here keeps working offline.
          </p>
        </div>
      )}
    </div>
  );
}
