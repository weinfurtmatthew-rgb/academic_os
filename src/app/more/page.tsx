'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, BookOpen, CalendarRange, ChevronRight, CloudDownload, FileText, Layers, Percent, Presentation, RefreshCw,
  Search, Settings, Timer, Play,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { isDue } from '@/lib/srs';
import { lastSync } from '@/lib/sync/session';
import { cn, daysUntil, overallGPA, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/ui';

type Row = { href: string; label: string; icon: typeof Play; tile: string; value?: string; badge?: boolean };

/** Phone home for everything that isn't one of the four main tabs. */
export default function MorePage() {
  const { courses, assignments, exams, lectures, notes, sessions, flashcards, settings, setUI } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, exams: s.exams, lectures: s.lectures, notes: s.notes,
    sessions: s.sessions, flashcards: s.flashcards, settings: s.settings, setUI: s.setUI,
  }));
  const [synced, setSynced] = useState<ReturnType<typeof lastSync>>(null);
  useEffect(() => setSynced(lastSync()), []);

  const groups = useMemo(() => {
    const due = flashcards.filter((f) => isDue(f)).length;
    const planned = sessions.filter((s) => !s.done && daysUntil(s.date) >= 0).length;
    const upcoming = exams.filter((e) => e.status !== 'completed' && daysUntil(e.date) >= 0).length;
    const gpa = overallGPA(courses, assignments, exams, settings.gpaScale);
    const g: { title: string; rows: Row[] }[] = [
      {
        title: 'Study',
        rows: [
          { href: '/study/', label: 'Study timer', icon: Play, tile: 'bg-[#5B5BD6]' },
          { href: '/flashcards/', label: 'Flashcards', icon: Layers, tile: 'bg-[#047857]', value: due ? `${due} due` : undefined, badge: due > 0 },
          { href: '/planner/', label: 'Study planner', icon: Timer, tile: 'bg-[#C2410C]', value: planned ? `${planned} planned` : undefined },
        ],
      },
      {
        title: 'Coursework',
        rows: [
          { href: '/exams/', label: 'Exams', icon: BookOpen, tile: 'bg-[#E11D48]', value: upcoming ? `${upcoming} upcoming` : undefined },
          { href: '/lectures/', label: 'Lectures', icon: Presentation, tile: 'bg-[#7C3AED]', value: lectures.length ? String(lectures.length) : undefined },
          { href: '/notes/', label: 'Notes', icon: FileText, tile: 'bg-[#2563EB]', value: notes.length ? String(notes.length) : undefined },
          { href: '/schedule/', label: 'Class schedule', icon: CalendarRange, tile: 'bg-[#0F766E]' },
          { href: '/canvas/', label: 'Canvas import', icon: CloudDownload, tile: 'bg-[#D9480F]', value: settings.canvasFeedUrl ? 'Connected' : 'Set up' },
        ],
      },
      {
        title: 'Progress',
        rows: [
          { href: '/grades/', label: 'Grades', icon: Percent, tile: 'bg-[#C026D3]', value: gpa === null ? undefined : `GPA ${gpa.toFixed(2)}` },
          { href: '/analytics/', label: 'Analytics', icon: BarChart3, tile: 'bg-[#0E7490]' },
        ],
      },
      {
        title: 'This device',
        rows: [
          { href: '/sync/', label: 'Sync devices', icon: RefreshCw, tile: 'bg-[#5B5BD6]', value: synced ? timeAgo(synced.at) : undefined },
          { href: '/settings/', label: 'Settings', icon: Settings, tile: 'bg-[#4A4D66]' },
        ],
      },
    ];
    return g;
  }, [courses, assignments, exams, lectures, notes, sessions, flashcards, settings.gpaScale, settings.canvasFeedUrl, synced]);

  return (
    <div className="mx-auto max-w-xl space-y-5 animate-fade-in">
      <PageHeader title="More" />

      <button
        onClick={() => setUI({ searchOpen: true })}
        className="flex h-11 w-full items-center gap-2 rounded-xl bg-muted px-3 text-left text-[17px] text-muted-foreground transition active:bg-muted/70"
      >
        <Search className="h-[18px] w-[18px] shrink-0" />
        Search everything
      </button>

      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.03em] text-muted-foreground">{g.title}</h2>
          <div className="overflow-hidden rounded-[18px] bg-card shadow-soft ring-1 ring-border/60">
            {g.rows.map((r, i) => (
              <Link
                key={r.href}
                href={r.href}
                className="relative flex min-h-[54px] items-center gap-3 px-3.5 transition-colors active:bg-muted/70 md:hover:bg-muted/50"
              >
                {i > 0 && <span aria-hidden className="absolute left-[56px] right-0 top-0 h-px bg-border" />}
                <span className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white', r.tile)}>
                  <r.icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-base font-semibold">{r.label}</span>
                {r.value && (
                  <span
                    className={cn(
                      r.badge
                        ? 'rounded-lg bg-primary/12 px-2 py-1 text-[13px] font-extrabold text-primary'
                        : 'text-[15px] text-muted-foreground',
                    )}
                  >
                    {r.value}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={2.6} />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-[13px] text-muted-foreground">Works offline · your data stays on your devices</p>
    </div>
  );
}
