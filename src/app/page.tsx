'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Flag, Flame, Play, Plus, Search, Sparkles, Star } from 'lucide-react';
import { useStore } from '@/lib/store';
import { lastSync } from '@/lib/sync/session';
import type { Assignment, ClassMeeting, Course, Exam, StudySession } from '@/lib/types';
import {
  addDays, cn, courseGrade, daysUntil, fmtDate, fmtTime, hoursBetween, isOverdue, isSameDay, isTurnedIn,
  letterGrade, overallGPA, relDue, startOfDay, startOfWeek, studyStreak, timeAgo, toDateKey,
} from '@/lib/utils';
import { Button, Card, CardHeader, PageHeader, Progress, Stat } from '@/components/ui';
import { ExamForm, SessionForm } from '@/components/forms';
import { AssignmentDetail } from '@/components/assignment-detail';

type ClassItem = { course: Course; meeting: ClassMeeting; start: Date; end: Date };
type Item =
  | { kind: 'class'; key: string; at: Date; c: ClassItem }
  | { kind: 'session'; key: string; at: Date; s: StudySession }
  | { kind: 'assignment'; key: string; at: Date; a: Assignment }
  | { kind: 'exam'; key: string; at: Date; e: Exam };

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

/** "10:00 AM" → ["10:00", "AM"]; 24-hour locales come back whole. */
function timeParts(d: Date): [string, string] {
  const s = fmtTime(d.toISOString());
  const m = s.match(/^(.*?)\s*([AaPp]\.?\s?[Mm]\.?)$/);
  return m ? [m[1], m[2].toUpperCase()] : [s, ''];
}

/** "in 40 min", "in 3h 20m", "tomorrow", "in 3 days". */
function untilLabel(d: Date, now: Date): string {
  const mins = Math.round((d.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  if (isSameDay(d, now)) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  const days = daysUntil(d.toISOString());
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** Class meetings on a given day, inside the semester dates when those are set. */
function classesOn(day: Date, courses: Course[], semStart: string, semEnd: string): ClassItem[] {
  const key = toDateKey(day);
  if ((semStart && key < semStart) || (semEnd && key > semEnd)) return [];
  const dow = (day.getDay() + 6) % 7; // Monday = 0, like ClassMeeting.day
  return courses
    .flatMap((course) => (course.schedule ?? []).filter((m) => m.day === dow).map((meeting) => ({
      course, meeting, start: at(day, meeting.start), end: at(day, meeting.end),
    })))
    .sort((x, y) => x.start.getTime() - y.start.getTime());
}

/* ------------------------------- row pieces -------------------------------- */

function CourseTag({ course }: { course?: Course }) {
  return course ? <span className="ink font-bold" style={{ '--ink': course.color } as CSSProperties}>{course.code}</span> : null;
}

function TimeCol({ d }: { d: Date }) {
  const [t, ampm] = timeParts(d);
  return (
    <span className="w-[52px] shrink-0 text-sm font-bold leading-tight tabular-nums">
      {t}
      {ampm && <span className="block text-xs font-medium text-muted-foreground">{ampm}</span>}
    </span>
  );
}

function Dot({ color }: { color?: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color ?? 'hsl(var(--muted-foreground))' }} />;
}

function Pill({ children, onClick, tone = 'primary' }: { children: ReactNode; onClick: () => void; tone?: 'primary' | 'success' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition-transform active:scale-95',
        tone === 'success'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-primary/12 text-primary',
      )}
    >
      {children}
    </button>
  );
}

function PriorityFlag({ a }: { a: Assignment }) {
  if (a.priority !== 'high' && a.priority !== 'critical') return null;
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1 text-xs font-extrabold capitalize',
      a.priority === 'critical' ? 'text-destructive' : 'text-orange-700 dark:text-orange-300',
    )}>
      <Flag className="h-3.5 w-3.5 fill-current" /> {a.priority}
    </span>
  );
}

/** The tappable middle of a row: title over a muted detail line. */
function RowMain({ onClick, title, sub, done }: { onClick: () => void; title: ReactNode; sub: ReactNode; done?: boolean }) {
  return (
    <button onClick={onClick} className="flex min-w-0 flex-1 flex-col justify-center self-stretch py-2.5 text-left">
      <span className={cn('truncate text-base font-semibold', done && 'text-muted-foreground line-through')}>{title}</span>
      <span className="truncate text-[13px] text-muted-foreground">{sub}</span>
    </button>
  );
}

function CheckCircle({ a, onToggle }: { a: Assignment; onToggle: () => void }) {
  const done = isTurnedIn(a);
  return (
    <button
      aria-label={done ? `Mark ${a.title} not done` : `Mark ${a.title} done`}
      aria-pressed={done}
      onClick={onToggle}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
    >
      <span className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
        done ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground/45',
      )}>
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

/** Grouped list card; `inset` is where the row hairlines start. */
function Group({ children, inset }: { children: ReactNode; inset: number }) {
  return (
    <div className="list-group overflow-hidden rounded-[18px] bg-card shadow-soft ring-1 ring-border/60" style={{ '--inset': `${inset}px` } as CSSProperties}>
      {children}
    </div>
  );
}

function Section({ title, aside, tone, children }: { title: string; aside?: ReactNode; tone?: 'danger'; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className={cn('font-display text-[21px] font-bold', tone === 'danger' && 'text-destructive')}>{title}</h2>
        {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default function TodayPage() {
  const router = useRouter();
  const { courses, assignments, exams, sessions, settings, loadSample, setUI, put } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, exams: s.exams, sessions: s.sessions,
    settings: s.settings, loadSample: s.loadSample, setUI: s.setUI, put: s.put,
  }));
  const [openAId, setOpenAId] = useState<string | null>(null);
  const [editE, setEditE] = useState<Exam | null>(null);
  const [editS, setEditS] = useState<StudySession | null>(null);
  // checked off here: stays listed (struck through) so a mis-tap can be undone
  const [checked, setChecked] = useState<Record<string, Assignment['status']>>({});
  const [synced, setSynced] = useState<ReturnType<typeof lastSync>>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setSynced(lastSync()), []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const courseOf = (id: string) => courses.find((c) => c.id === id);

  const plan = useMemo(() => {
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 8); // after tomorrow, through the next 6 days
    const listed = (a: Assignment) => !isTurnedIn(a) || a.id in checked;

    // the one thing to deal with first: the soonest deadline or exam in the next three days
    const soon = addDays(now, 3).getTime();
    const candidates: Item[] = [
      ...assignments
        .filter((a) => !isTurnedIn(a) && !(a.id in checked) && new Date(a.dueDate) >= now && new Date(a.dueDate).getTime() <= soon)
        .map((a) => ({ kind: 'assignment' as const, key: a.id, at: new Date(a.dueDate), a })),
      ...exams
        .filter((e) => e.status !== 'completed' && new Date(e.date) >= now && new Date(e.date).getTime() <= soon)
        .map((e) => ({ kind: 'exam' as const, key: e.id, at: new Date(e.date), e })),
    ].sort((x, y) => x.at.getTime() - y.at.getTime());
    const upNext = candidates[0] ?? null;
    const notUpNext = (key: string) => key !== upNext?.key;

    const overdue = assignments
      .filter((a) => (isOverdue(a) || (a.id in checked && daysUntil(a.dueDate) < 0)))
      .sort((x, y) => x.dueDate.localeCompare(y.dueDate));

    const rest: Item[] = [
      ...classesOn(today, courses, settings.semesterStart, settings.semesterEnd)
        .filter((c) => c.end > now)
        .map((c) => ({ kind: 'class' as const, key: `${c.course.id}-${c.meeting.id}`, at: c.start, c })),
      ...sessions
        .filter((s) => !s.done && isSameDay(s.date, today))
        .map((s) => ({ kind: 'session' as const, key: s.id, at: new Date(s.date), s })),
      ...assignments
        .filter((a) => listed(a) && isSameDay(a.dueDate, today) && new Date(a.dueDate) >= now && notUpNext(a.id))
        .map((a) => ({ kind: 'assignment' as const, key: a.id, at: new Date(a.dueDate), a })),
      ...exams
        .filter((e) => e.status !== 'completed' && isSameDay(e.date, today) && new Date(e.date) >= now && notUpNext(e.id))
        .map((e) => ({ kind: 'exam' as const, key: e.id, at: new Date(e.date), e })),
    ].sort((x, y) => x.at.getTime() - y.at.getTime());

    const tomorrowItems: Item[] = [
      ...exams
        .filter((e) => e.status !== 'completed' && isSameDay(e.date, tomorrow) && notUpNext(e.id))
        .map((e) => ({ kind: 'exam' as const, key: e.id, at: new Date(e.date), e })),
      ...assignments
        .filter((a) => listed(a) && isSameDay(a.dueDate, tomorrow) && notUpNext(a.id))
        .map((a) => ({ kind: 'assignment' as const, key: a.id, at: new Date(a.dueDate), a })),
      ...sessions
        .filter((s) => !s.done && isSameDay(s.date, tomorrow))
        .map((s) => ({ kind: 'session' as const, key: s.id, at: new Date(s.date), s })),
    ].sort((x, y) => x.at.getTime() - y.at.getTime());
    const tomorrowClasses = classesOn(tomorrow, courses, settings.semesterStart, settings.semesterEnd);

    const later = addDays(today, 2);
    const week: Item[] = [
      ...assignments
        .filter((a) => listed(a) && new Date(a.dueDate) >= later && new Date(a.dueDate) < weekEnd && notUpNext(a.id))
        .map((a) => ({ kind: 'assignment' as const, key: a.id, at: new Date(a.dueDate), a })),
      ...exams
        .filter((e) => e.status !== 'completed' && new Date(e.date) >= later && new Date(e.date) < weekEnd && notUpNext(e.id))
        .map((e) => ({ kind: 'exam' as const, key: e.id, at: new Date(e.date), e })),
    ].sort((x, y) => x.at.getTime() - y.at.getTime());

    return { upNext, overdue, rest, tomorrow, tomorrowItems, tomorrowClasses, week };
  }, [now, courses, assignments, exams, sessions, settings.semesterStart, settings.semesterEnd, checked]);

  const stats = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = addDays(start, 7);
    const due = assignments.filter((a) => a.dueDate >= start.toISOString() && a.dueDate < end.toISOString());
    return {
      done: due.filter(isTurnedIn).length,
      total: due.length,
      hours: hoursBetween(sessions, start, end),
      gpa: overallGPA(courses, assignments, exams, settings.gpaScale),
      open: assignments.filter((a) => !isTurnedIn(a)).length,
    };
  }, [courses, assignments, exams, sessions, settings.gpaScale]);

  const streak = studyStreak(sessions);
  const openA = assignments.find((x) => x.id === openAId) ?? null;

  const toggle = (a: Assignment) => {
    if (a.id in checked) {
      put('assignments', { ...a, status: checked[a.id] });
      setChecked(({ [a.id]: _, ...rest }) => rest);
    } else {
      put('assignments', { ...a, status: 'completed' });
      setChecked((c) => ({ ...c, [a.id]: a.status }));
    }
  };
  const startSession = (s: StudySession) => {
    setUI({ focus: { type: 'session', id: s.id } });
    router.push('/study/');
  };

  if (courses.length === 0 && assignments.length === 0 && exams.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center animate-fade-in">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Sparkles className="h-8 w-8" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            Welcome to <span className="hl-underline">Academic OS</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Courses, assignments, exams, notes, grades and study plans — all in one offline-first workspace that lives on this device.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => setUI({ quickAdd: 'course' })}>
              <Plus className="h-4 w-4" /> Add your first course
            </Button>
            <Button variant="outline" onClick={loadSample}>
              <Sparkles className="h-4 w-4" /> Explore with sample data
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- rows ---------------------------------- */

  /** Timed row for today: time · course dot · what · action. */
  const timedRow = (it: Item) => {
    const base = 'flex min-h-[66px] items-center gap-3 pl-4 pr-3.5';
    if (it.kind === 'class') {
      const { course, meeting, start, end } = it.c;
      const live = start <= now && now < end;
      // the time column already says when; a countdown only helps once it's close
      const soon = start.getTime() - now.getTime() <= 3 * 3600000;
      return (
        <div key={it.key} className={base}>
          <TimeCol d={start} />
          <Dot color={course.color} />
          <RowMain
            onClick={() => { setUI({ selectedCourseId: course.id }); router.push('/courses/'); }}
            title={`${course.code} class`}
            sub={[`${fmtTime(start.toISOString())}–${fmtTime(end.toISOString())}`, meeting.location].filter(Boolean).join(' · ')}
          />
          {(live || soon) && (
            <span className={cn(
              'shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold',
              live ? 'bg-success/12 text-success' : 'bg-primary/12 text-primary',
            )}>
              {live ? 'Now' : untilLabel(start, now)}
            </span>
          )}
        </div>
      );
    }
    if (it.kind === 'session') {
      const c = courseOf(it.s.courseId);
      return (
        <div key={it.key} className={base}>
          <TimeCol d={it.at} />
          <Dot color={c?.color} />
          <RowMain onClick={() => setEditS(it.s)} title={it.s.topic} sub={<>Study · {c?.code ?? 'No course'} · {it.s.durationMin} min</>} />
          <Pill tone="success" onClick={() => startSession(it.s)}><Play className="h-3.5 w-3.5 fill-current" /> Start</Pill>
        </div>
      );
    }
    if (it.kind === 'exam') {
      const c = courseOf(it.e.courseId);
      return (
        <div key={it.key} className={base}>
          <TimeCol d={it.at} />
          <Dot color={c?.color} />
          <RowMain onClick={() => setEditE(it.e)} title={<>★ {it.e.name}</>} sub={<>Exam · {c?.code} · worth {it.e.weight}%</>} />
          <Pill onClick={() => router.push('/flashcards/')}>Review</Pill>
        </div>
      );
    }
    const c = courseOf(it.a.courseId);
    return (
      <div key={it.key} className={base}>
        <TimeCol d={it.at} />
        <Dot color={c?.color} />
        <RowMain onClick={() => setOpenAId(it.a.id)} title={it.a.title} sub={<>Due · {c?.code}</>} done={isTurnedIn(it.a)} />
        <CheckCircle a={it.a} onToggle={() => toggle(it.a)} />
      </div>
    );
  };

  /** Row for a later day: check · what · priority. Exams get a star tile and Review. */
  const dayRow = (it: Item, when: string) => {
    if (it.kind === 'exam') {
      return (
        <div key={it.key} className="flex min-h-[66px] items-center gap-2 pl-1.5 pr-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
              <Star className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
          </span>
          <RowMain onClick={() => setEditE(it.e)} title={it.e.name} sub={<><CourseTag course={courseOf(it.e.courseId)} /> · {when} · worth {it.e.weight}%</>} />
          <Pill onClick={() => router.push('/flashcards/')}>Review</Pill>
        </div>
      );
    }
    if (it.kind === 'session') {
      const c = courseOf(it.s.courseId);
      return (
        <div key={it.key} className="flex min-h-[64px] items-center gap-2 pl-1.5 pr-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center"><Dot color={c?.color} /></span>
          <RowMain onClick={() => setEditS(it.s)} title={it.s.topic} sub={<>Study · {c?.code ?? 'No course'} · {when} · {it.s.durationMin} min</>} />
        </div>
      );
    }
    if (it.kind !== 'assignment') return null;
    return (
      <div key={it.key} className="flex min-h-[64px] items-center gap-2 pl-1.5 pr-3.5">
        <CheckCircle a={it.a} onToggle={() => toggle(it.a)} />
        <RowMain onClick={() => setOpenAId(it.a.id)} title={it.a.title} sub={<><CourseTag course={courseOf(it.a.courseId)} /> · {when}</>} done={isTurnedIn(it.a)} />
        <PriorityFlag a={it.a} />
      </div>
    );
  };
  /* -------------------------------- up next -------------------------------- */

  const upNext = () => {
    const u = plan.upNext;
    if (!u || (u.kind !== 'assignment' && u.kind !== 'exam')) return null;
    const isExam = u.kind === 'exam';
    const courseId = isExam ? u.e.courseId : u.a.courseId;
    const c = courseOf(courseId);
    const due = untilLabel(u.at, now);
    const when = isSameDay(u.at, now) ? fmtTime(u.at.toISOString()) : `${fmtDate(u.at.toISOString(), { weekday: 'short' })} ${fmtTime(u.at.toISOString())}`;
    return (
      <section aria-label="Up next" className="flex flex-col gap-3.5 rounded-[22px] bg-card p-[18px] shadow-soft ring-1 ring-border/60">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-extrabold uppercase tracking-[0.02em] text-orange-700 dark:text-orange-300">
            Up next · {isExam ? 'exam' : 'due'} {due}
          </span>
          {c && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-extrabold">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.code}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold leading-tight tracking-tight">{isExam ? u.e.name : u.a.title}</p>
          <p className="mt-1 line-clamp-1 text-[15px] text-muted-foreground">
            {isExam ? `${when} · worth ${u.e.weight}%` : [`Due ${when}`, u.a.description.split('\n')[0]].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2.5">
          {isExam ? (
            <button onClick={() => router.push('/flashcards/')} className="h-[50px] flex-1 rounded-[15px] bg-primary text-base font-bold text-primary-foreground transition-transform active:scale-[0.98]">
              Review cards
            </button>
          ) : (
            <button
              onClick={() => put('assignments', { ...u.a, status: 'submitted' })}
              className="h-[50px] flex-1 rounded-[15px] bg-primary text-base font-bold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              Mark submitted
            </button>
          )}
          <button
            onClick={() => (isExam ? setEditE(u.e) : setOpenAId(u.a.id))}
            className="h-[50px] flex-1 rounded-[15px] bg-primary/12 text-base font-bold text-primary transition-transform active:scale-[0.98]"
          >
            Open
          </button>
        </div>
      </section>
    );
  };

  const dayWhen = (d: Date) => `${fmtDate(d.toISOString(), { weekday: 'short' })} ${fmtTime(d.toISOString())}`;
  const tc = plan.tomorrowClasses;
  const hasTomorrow = plan.tomorrowItems.length > 0 || tc.length > 0;

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-2xl space-y-[22px] lg:mx-0">
          <PageHeader
            eyebrow={fmtDate(now.toISOString(), { weekday: 'long', month: 'long', day: 'numeric' })}
            title="Today"
            actions={<>
              <button
                aria-label="Search"
                onClick={() => setUI({ searchOpen: true })}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft ring-1 ring-border/60 transition-transform active:scale-95 lg:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
              <Button variant="outline" className="hidden lg:inline-flex" onClick={() => setUI({ addOpen: true })}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </>}
          />

          {(streak > 0 || synced) && (
            <div className="-mt-2 flex flex-wrap gap-2">
              {streak > 0 && (
                <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-highlighter/35 px-3 text-[13px] font-bold text-[#5C4300] dark:bg-highlighter/15 dark:text-highlighter">
                  <Flame className="h-3.5 w-3.5" /> {streak}-day streak
                </span>
              )}
              {synced && (
                <Link href="/sync/" className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-semibold text-success ring-1 ring-border/60">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Synced with {synced.device} · {timeAgo(synced.at)}
                </Link>
              )}
            </div>
          )}

          {upNext()}

          {plan.overdue.length > 0 && (
            <Section title="Overdue" tone="danger">
              <Group inset={58}>
                {plan.overdue.map((a) => dayRow({ kind: 'assignment', key: a.id, at: new Date(a.dueDate), a }, relDue(a.dueDate)))}
              </Group>
            </Section>
          )}

          <Section title="Rest of today">
            {plan.rest.length > 0 ? (
              <Group inset={102}>
                {plan.rest.map(timedRow)}
              </Group>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-[18px] bg-card py-3 pl-4 pr-3.5 shadow-soft ring-1 ring-border/60">
                <p className="text-[15px] text-muted-foreground">Nothing else scheduled today.</p>
                <Pill onClick={() => setUI({ quickAdd: 'session' })}>Plan study</Pill>
              </div>
            )}
          </Section>

          {hasTomorrow && (
            <Section title="Tomorrow" aside={fmtDate(plan.tomorrow.toISOString(), { weekday: 'short', month: 'short', day: 'numeric' })}>
              <Group inset={58}>
                {plan.tomorrowItems.map((it) => dayRow(it, fmtTime(it.at.toISOString())))}
                {tc.length > 0 && (
                  <Link href="/schedule/" className="flex min-h-[52px] items-center gap-2 py-2.5 pl-1.5 pr-4 text-sm text-muted-foreground">
                    <span className="w-11 shrink-0 text-center font-extrabold text-foreground">{tc.length}</span>
                    <span className="min-w-0 flex-1 truncate">
                      class{tc.length === 1 ? '' : 'es'} · {tc.map((c) => `${c.course.code} at ${timeParts(c.start)[0]}`).join(', ')}
                    </span>
                  </Link>
                )}
              </Group>
            </Section>
          )}

          <Section title="This week">
            <Group inset={58}>
              {plan.week.map((it) => dayRow(it, dayWhen(it.at)))}
              {plan.week.length === 0 && (
                <p className="px-4 py-4 text-[15px] text-muted-foreground">Nothing else due in the next week.</p>
              )}
              <Link href="/assignments/" className="flex min-h-[50px] items-center justify-between px-4 text-[15px] font-bold text-primary">
                All tasks <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
              </Link>
            </Group>
          </Section>
        </div>

        {/* desktop side panel: the week at a glance */}
        <aside className="hidden space-y-4 lg:block">
          <Card className="p-4">
            <CardHeader eyebrow="This week" title="Progress" />
            <div className="space-y-4 pt-3">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-semibold">Due this week</span>
                  <span className="font-display text-lg font-extrabold">
                    {stats.done}<span className="text-sm font-semibold text-muted-foreground">/{stats.total}</span>
                  </span>
                </div>
                <Progress value={stats.total ? (stats.done / stats.total) * 100 : 0} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {stats.total === 0 ? 'Nothing due Monday–Sunday' : `${stats.done} of ${stats.total} turned in`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="GPA" value={stats.gpa === null ? '—' : stats.gpa.toFixed(2)} sub={`${settings.gpaScale}.0 scale`} accent />
                <Stat label="Studied" value={`${stats.hours.toFixed(1)}h`} sub="since Monday" />
              </div>
              <Link href="/analytics/" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                Full analytics <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </Card>

          <Card className="p-4">
            <CardHeader eyebrow={`${stats.open} open tasks`} title="Courses" action={<Link href="/courses/" className="text-sm font-bold text-primary">All</Link>} />
            <div className="list-group -mx-1 pt-1" style={{ '--inset': '28px' } as CSSProperties}>
              {courses.map((c) => {
                const g = courseGrade(c.id, assignments, exams);
                return (
                  <button
                    key={c.id}
                    onClick={() => { setUI({ selectedCourseId: c.id }); router.push('/courses/'); }}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-muted/50"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.code}</span>
                    </span>
                    <span className="font-display text-base font-extrabold">{g === null ? '—' : letterGrade(g)}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>

      {openA && <AssignmentDetail assignment={openA} onClose={() => setOpenAId(null)} />}
      <ExamForm open={!!editE} onClose={() => setEditE(null)} exam={editE} />
      <SessionForm open={!!editS} onClose={() => setEditS(null)} session={editS} />
    </div>
  );
}
