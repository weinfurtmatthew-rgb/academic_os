'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CloudDownload, RefreshCw, Unplug } from 'lucide-react';
import { useStore } from '@/lib/store';
import { canvasFeedUrl, matchCourse, NEW_COURSE, SKIP, type CanvasItem, type CourseMap } from '@/lib/canvas/feed';
import { fetchCanvasItems, importFromCanvas, lastCanvasCheck, type CanvasResult } from '@/lib/canvas/client';
import { cn, timeAgo } from '@/lib/utils';
import { Button, Input, PageHeader, Select } from '@/components/ui';

type Status = { k: 'idle' } | { k: 'busy'; what: string } | { k: 'error'; msg: string } | { k: 'done'; r: CanvasResult };

/** Connect a Canvas calendar feed and choose where each Canvas course's assignments go. */
export default function CanvasPage() {
  const { settings, setSettings, courses } = useStore((s) => ({ settings: s.settings, setSettings: s.setSettings, courses: s.courses }));
  const connected = settings.canvasFeedUrl || '';
  const [link, setLink] = useState(connected);
  const [items, setItems] = useState<CanvasItem[] | null>(null);
  const [map, setMap] = useState<CourseMap>(settings.canvasCourses ?? {});
  const [status, setStatus] = useState<Status>({ k: 'idle' });
  const [checked, setChecked] = useState<string | null>(null);

  useEffect(() => setChecked(lastCanvasCheck()), [status]);

  /** Read the feed and fill in a choice for every Canvas course it mentions. */
  const check = async (url: string) => {
    setStatus({ k: 'busy', what: 'Checking Canvas…' });
    try {
      const found = await fetchCanvasItems(url);
      setItems(found);
      setMap((m) => {
        const next = { ...(settings.canvasCourses ?? {}), ...m };
        for (const label of Array.from(new Set(found.map((i) => i.courseLabel)))) {
          if (next[label] === undefined) next[label] = matchCourse(label, courses)?.id ?? NEW_COURSE;
        }
        return next;
      });
      setStatus({ k: 'idle' });
    } catch (e) {
      setStatus({ k: 'error', msg: (e as Error).message });
    }
  };

  // connected already: show what's in the feed right away
  useEffect(() => {
    if (connected) check(connected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConnect = () => {
    const url = canvasFeedUrl(link);
    if (!url) {
      setStatus({ k: 'error', msg: 'That isn’t a Canvas calendar feed link. It should end in “.ics” and contain “/feeds/calendars/”.' });
      return;
    }
    setLink(url);
    check(url);
  };

  const runImport = async () => {
    const url = connected || canvasFeedUrl(link);
    if (!url || !items) return;
    setSettings({ canvasFeedUrl: url, canvasCourses: map });
    setStatus({ k: 'busy', what: 'Importing…' });
    try {
      const r = await importFromCanvas(url, map, items);
      setMap(r.map);
      setStatus({ k: 'done', r });
    } catch (e) {
      setStatus({ k: 'error', msg: (e as Error).message });
    }
  };

  const disconnect = () => {
    setSettings({ canvasFeedUrl: '', canvasCourses: {} });
    setItems(null);
    setMap({});
    setLink('');
    setStatus({ k: 'idle' });
  };

  /** Canvas courses in the feed, with how many assignments are still ahead in each. */
  const groups = useMemo(() => {
    if (!items) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const by = new Map<string, { total: number; upcoming: number }>();
    for (const it of items) {
      const g = by.get(it.courseLabel) ?? { total: 0, upcoming: 0 };
      g.total++;
      if (new Date(it.dueDate) >= today) g.upcoming++;
      by.set(it.courseLabel, g);
    }
    return Array.from(by.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const toImport = groups.filter(([label]) => map[label] && map[label] !== SKIP).reduce((n, [, g]) => n + g.upcoming, 0);
  const busy = status.k === 'busy';

  return (
    <div className="mx-auto max-w-xl space-y-5 animate-fade-in">
      <PageHeader
        eyebrow={connected ? (checked ? `Connected · checked ${timeAgo(checked)}` : 'Connected') : 'Import assignments'}
        title="Canvas"
      />

      {!connected && (
        <section className="space-y-4 rounded-[18px] bg-card p-4 shadow-soft ring-1 ring-border/60">
          <ol className="space-y-2 text-[15px] leading-snug">
            <li><b>1.</b> Open Canvas in a web browser (the Canvas app doesn’t show this link) and go to <b>Calendar</b>.</li>
            <li><b>2.</b> At the bottom of the right-hand column, click <b>Calendar Feed</b>.</li>
            <li><b>3.</b> Copy the link it shows and paste it here.</li>
          </ol>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startConnect()}
            placeholder="https://school.instructure.com/feeds/calendars/user_….ics"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Canvas calendar feed link"
          />
          <Button className="h-11 w-full text-[15px]" disabled={busy || !link.trim()} onClick={startConnect}>
            <CloudDownload className="h-4 w-4" /> {busy ? 'Checking…' : 'Check feed'}
          </Button>
          <p className="text-[13px] text-muted-foreground">
            Treat this link like a password: anyone who has it can see your Canvas calendar. It’s kept on your devices and only
            ever sent to Canvas.
          </p>
        </section>
      )}

      {status.k === 'error' && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-[15px] font-semibold text-destructive">{status.msg}</p>
      )}

      {status.k === 'done' && (
        <div role="status" className="flex items-start gap-3 rounded-xl bg-success/12 px-4 py-3 text-[15px]">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.6} />
          <div>
            <p className="font-bold">
              {status.r.added + status.r.updated === 0
                ? 'Everything is already up to date.'
                : [
                    status.r.added && `${status.r.added} assignment${status.r.added === 1 ? '' : 's'} added`,
                    status.r.updated && `${status.r.updated} updated`,
                  ].filter(Boolean).join(', ') + '.'}
            </p>
            <p className="text-muted-foreground">
              New Canvas assignments are added each time you open the app.{' '}
              <Link href="/assignments/" className="font-bold text-primary">See tasks</Link>
            </p>
          </div>
        </div>
      )}

      {items && (
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.03em] text-muted-foreground">Courses in Canvas</h2>
          {groups.length === 0 ? (
            <p className="rounded-[18px] bg-card px-4 py-4 text-[15px] text-muted-foreground ring-1 ring-border/60">
              This feed has no assignments yet.
            </p>
          ) : (
            <div className="list-group overflow-hidden rounded-[18px] bg-card shadow-soft ring-1 ring-border/60">
              {groups.map(([label, g]) => (
                <div key={label} className="space-y-2 px-4 py-3">
                  <div>
                    <p className="text-base font-semibold leading-snug">{label}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {g.upcoming} upcoming{g.total > g.upcoming ? ` · ${g.total - g.upcoming} past (not imported)` : ''}
                    </p>
                  </div>
                  <Select
                    aria-label={`Where ${label} goes`}
                    value={map[label] ?? NEW_COURSE}
                    onChange={(e) => setMap((m) => ({ ...m, [label]: e.target.value }))}
                    className="h-11"
                  >
                    {courses.map((c) => <option key={c.id} value={c.id}>Into {c.code} · {c.name}</option>)}
                    <option value={NEW_COURSE}>Add as a new course</option>
                    <option value={SKIP}>Don’t import</option>
                  </Select>
                </div>
              ))}
            </div>
          )}
          <p className="px-1 text-[13px] text-muted-foreground">
            Canvas keeps titles and due dates up to date. Status, priority, grades and notes stay yours, and anything you delete
            here stays deleted.
          </p>
        </section>
      )}

      {items && groups.length > 0 && (
        <Button className="h-12 w-full text-base" disabled={busy} onClick={runImport}>
          <CloudDownload className="h-5 w-5" />
          {busy ? status.what : connected ? 'Update now' : `Import ${toImport} assignment${toImport === 1 ? '' : 's'}`}
        </Button>
      )}

      {connected && (
        <div className={cn('flex gap-2', !items && 'pt-1')}>
          {!items && (
            <Button variant="outline" className="h-11 flex-1" disabled={busy} onClick={() => check(connected)}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          )}
          <Button variant="ghost" className="h-11 flex-1 text-destructive" onClick={disconnect}>
            <Unplug className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
