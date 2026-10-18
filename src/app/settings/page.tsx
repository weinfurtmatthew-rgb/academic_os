'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Moon, RefreshCw, RotateCcw, Sparkles, Sun, SunMoon, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Theme } from '@/lib/types';
import { cn, downloadText, fmtDate } from '@/lib/utils';
import { lastSync } from '@/lib/sync/session';
import { Button, Card, CardHeader, Input } from '@/components/ui';

export default function SettingsPage() {
  const { settings, setSettings, exportJSON, importJSON, resetAll, loadSample, counts } = useStore((s) => ({
    settings: s.settings, setSettings: s.setSettings, exportJSON: s.exportJSON,
    importJSON: s.importJSON, resetAll: s.resetAll, loadSample: s.loadSample,
    counts: {
      courses: s.courses.length, assignments: s.assignments.length, lectures: s.lectures.length,
      exams: s.exams.length, notes: s.notes.length, sessions: s.sessions.length,
    },
  }));
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [synced, setSynced] = useState<ReturnType<typeof lastSync>>(null);
  useEffect(() => setSynced(lastSync()), []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: SunMoon },
  ];

  const doExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`academic-os-backup-${stamp}.json`, exportJSON());
    setMsg({ ok: true, text: 'Backup downloaded.' });
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = importJSON(String(reader.result ?? ''));
      setMsg(
        !res.ok ? { ok: false, text: res.error ?? 'Import failed.' }
        : res.changed ? { ok: true, text: `Backup merged — ${res.changed} change${res.changed === 1 ? '' : 's'} applied. Anything newer on this device was kept.` }
        : { ok: true, text: 'Nothing new in that backup — this device is already up to date.' },
      );
    };
    reader.readAsText(file);
  };

  const doReset = async () => {
    if (!window.confirm('Delete ALL Academic OS data on this device? This cannot be undone. Consider exporting a backup first.')) return;
    await resetAll();
    setMsg({ ok: true, text: 'All data cleared.' });
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">everything is stored locally on this device</p>
      </div>

      <Card className="p-4">
        <CardHeader eyebrow="Appearance" title="Theme" />
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setSettings({ theme: t.value })}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 py-3.5 text-sm font-bold transition-colors',
                settings.theme === t.value ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:border-primary/30',
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <CardHeader eyebrow="Academics" title="Grading & semester" />
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-bold text-muted-foreground">GPA scale</p>
            <div className="grid grid-cols-3 gap-2">
              {[4, 5, 10].map((sc) => (
                <button
                  key={sc}
                  onClick={() => setSettings({ gpaScale: sc })}
                  className={cn(
                    'rounded-xl border-2 py-2.5 font-display text-base font-extrabold transition-colors',
                    settings.gpaScale === sc ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:border-primary/30',
                  )}
                >
                  {sc}.0
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Semester start</span>
              <Input type="date" value={settings.semesterStart} onChange={(e) => setSettings({ semesterStart: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Semester end</span>
              <Input type="date" value={settings.semesterEnd} onChange={(e) => setSettings({ semesterEnd: e.target.value })} />
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <CardHeader eyebrow="Your devices" title="Sync" />
        <p className="mb-3 text-sm text-muted-foreground">
          Copy your changes between your phone and computer, directly over Wi-Fi. No account, and nothing is uploaded.
          {synced && ` Last synced with ${synced.device} on ${fmtDate(synced.at)}.`}
        </p>
        <Button onClick={() => router.push('/sync/')}><RefreshCw className="h-4 w-4" /> Sync devices</Button>
      </Card>

      <Card className="p-4">
        <CardHeader
          eyebrow="Your data"
          title="Backup & restore"
        />
        <p className="mb-3 text-sm text-muted-foreground">
          {total} items stored in this browser ({counts.courses} courses, {counts.assignments} assignments, {counts.notes} notes…).
          Export regularly — clearing browser data would erase everything.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport}><Download className="h-4 w-4" /> Export JSON</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import JSON</Button>
          <Button variant="outline" onClick={loadSample}><Sparkles className="h-4 w-4" /> Load sample data</Button>
          <input
            ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        {msg && (
          <p className={cn('mt-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold', msg.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
            {msg.text}
          </p>
        )}
      </Card>

      <Card className="border-destructive/30 p-4">
        <CardHeader eyebrow="Danger zone" title="Reset everything" />
        <p className="mb-3 text-sm text-muted-foreground">Permanently deletes all courses, assignments, notes, sessions and settings from this device.</p>
        <Button variant="destructive" onClick={doReset}><RotateCcw className="h-4 w-4" /> Reset all data</Button>
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground/70">
        Academic OS · offline-first PWA · no account, no cloud, no tracking
      </p>
    </div>
  );
}
