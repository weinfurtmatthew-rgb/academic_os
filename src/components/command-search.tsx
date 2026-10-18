'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, CalendarClock, FileText, GraduationCap, Presentation, Search, Timer } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { FocusTarget } from '@/lib/types';
import { cn, fmtDate } from '@/lib/utils';

interface Hit {
  type: NonNullable<FocusTarget>['type'];
  id: string;
  title: string;
  sub: string;
  href: string;
  color?: string;
}

const ICONS: Record<Hit['type'], typeof Search> = {
  course: GraduationCap,
  assignment: CalendarClock,
  lecture: Presentation,
  exam: BookOpen,
  note: FileText,
  session: Timer,
};

export function CommandSearch() {
  const open = useStore((s) => s.ui.searchOpen);
  const setUI = useStore((s) => s.setUI);
  const { courses, assignments, lectures, exams, notes, sessions } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, lectures: s.lectures,
    exams: s.exams, notes: s.notes, sessions: s.sessions,
  }));
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const courseCode = (id: string | null) => courses.find((c) => c.id === id)?.code ?? '';
  const courseColor = (id: string | null) => courses.find((c) => c.id === id)?.color;

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const match = (...fields: (string | undefined | null)[]) =>
      fields.some((f) => f && f.toLowerCase().includes(needle));
    const out: Hit[] = [];

    for (const c of courses)
      if (match(c.name, c.code, c.instructor))
        out.push({ type: 'course', id: c.id, title: c.name, sub: `${c.code} · ${c.instructor || 'Course'}`, href: `/courses/`, color: c.color });
    for (const a of assignments)
      if (match(a.title, a.description))
        out.push({ type: 'assignment', id: a.id, title: a.title, sub: `${courseCode(a.courseId)} · due ${fmtDate(a.dueDate)}`, href: '/assignments/', color: courseColor(a.courseId) });
    for (const n of notes)
      if (match(n.title, n.content))
        out.push({ type: 'note', id: n.id, title: n.title || 'Untitled note', sub: `Note · updated ${fmtDate(n.updatedAt)}`, href: '/notes/', color: courseColor(n.courseId) });
    for (const l of lectures)
      if (match(l.title, l.summary, l.notes))
        out.push({ type: 'lecture', id: l.id, title: l.title, sub: `${courseCode(l.courseId)} · ${fmtDate(l.date)}`, href: '/lectures/', color: courseColor(l.courseId) });
    for (const e of exams)
      if (match(e.name))
        out.push({ type: 'exam', id: e.id, title: e.name, sub: `${courseCode(e.courseId)} · ${fmtDate(e.date)}`, href: '/exams/', color: courseColor(e.courseId) });
    for (const s of sessions)
      if (match(s.topic, s.notes))
        out.push({ type: 'session', id: s.id, title: s.topic, sub: `Study · ${courseCode(s.courseId)} · ${fmtDate(s.date)}`, href: '/planner/', color: courseColor(s.courseId) });

    return out.slice(0, 24);
  }, [q, courses, assignments, lectures, exams, notes, sessions]);

  useEffect(() => setSel(0), [hits.length]);

  const close = () => setUI({ searchOpen: false });

  const go = (h: Hit) => {
    close();
    if (h.type === 'course') setUI({ focus: null, selectedCourseId: h.id });
    else setUI({ focus: { type: h.type, id: h.id } });
    router.push(h.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && hits[sel]) {
      e.preventDefault();
      go(hits[sel]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-foreground/30 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search courses, assignments, notes, lectures, exams…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
            esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {q.trim() === '' && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Start typing to search everything in Academic OS.
            </p>
          )}
          {q.trim() !== '' && hits.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{q}”.</p>
          )}
          {hits.map((h, i) => {
            const Icon = ICONS[h.type];
            return (
              <button
                key={`${h.type}-${h.id}`}
                data-active={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => go(h)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  i === sel ? 'bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: h.color ? `${h.color}22` : 'hsl(var(--muted))', color: h.color ?? 'hsl(var(--muted-foreground))' }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{h.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
                </span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {h.type}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
