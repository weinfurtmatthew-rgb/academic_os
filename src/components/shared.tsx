'use client';

import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  ASSIGNMENT_STATUSES, EXAM_STATUSES,
  type Assignment, type AssignmentStatus, type Exam, type ExamStatus, type Priority, type StudySession,
} from '@/lib/types';
import { cn, daysUntil, fmtDate, fmtTime, hexToRgba, relDue } from '@/lib/utils';
import { Badge } from '@/components/ui';

/* --------------------------------- badges ---------------------------------- */

export const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  critical: 'bg-destructive/12 text-destructive',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={cn('capitalize', PRIORITY_STYLE[priority])}>{priority}</Badge>;
}

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/12 text-primary',
  submitted: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  completed: 'bg-success/12 text-success',
};

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const label = ASSIGNMENT_STATUSES.find((s) => s.value === status)?.label ?? status;
  return <Badge className={STATUS_STYLE[status]}>{label}</Badge>;
}

const EXAM_STYLE: Record<ExamStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  studying: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  ready: 'bg-success/12 text-success',
  completed: 'bg-primary/12 text-primary',
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const label = EXAM_STATUSES.find((s) => s.value === status)?.label ?? status;
  return <Badge className={EXAM_STYLE[status]}>{label}</Badge>;
}

export const EXAM_PROGRESS: Record<ExamStatus, number> = {
  not_started: 0,
  studying: 50,
  ready: 90,
  completed: 100,
};

/* ------------------------------ assignment row ----------------------------- */

export function AssignmentRow({
  a, onOpen, showCourse = true,
}: { a: Assignment; onOpen: () => void; showCourse?: boolean }) {
  const put = useStore((s) => s.put);
  const course = useStore((s) => s.courses.find((c) => c.id === a.courseId));
  const overdue = a.status !== 'completed' && daysUntil(a.dueDate) < 0;
  const done = a.status === 'completed';

  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
    >
      <button
        aria-label={done ? 'Mark as not completed' : 'Mark as completed'}
        onClick={(e) => {
          e.stopPropagation();
          put('assignments', { ...a, status: done ? 'in_progress' : 'completed' });
        }}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground/40 hover:border-success',
        )}
      >
        {done && <CheckCircle2 className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', done && 'text-muted-foreground line-through')}>{a.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {showCourse && course && (
            <span className="font-bold" style={{ color: course.color }}>{course.code}</span>
          )}
          <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-destructive')}>
            <CalendarClock className="h-3 w-3" />
            {relDue(a.dueDate)} · {fmtDate(a.dueDate)}
          </span>
          {a.grade !== null && <span className="font-semibold text-foreground">{a.grade}%</span>}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <PriorityBadge priority={a.priority} />
        <StatusBadge status={a.status} />
      </div>
      <div className="shrink-0 sm:hidden">
        <PriorityBadge priority={a.priority} />
      </div>
    </div>
  );
}

/* --------------------------------- exam card -------------------------------- */

export function ExamCard({ exam, onOpen }: { exam: Exam; onOpen: () => void }) {
  const course = useStore((s) => s.courses.find((c) => c.id === exam.courseId));
  const d = daysUntil(exam.date);
  const past = d < 0 || exam.status === 'completed';
  const urgent = !past && d <= 3;

  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: course?.color ?? 'hsl(var(--primary))' }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{exam.name}</p>
          {course && (
            <span
              className="mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: hexToRgba(course.color, 0.15), color: course.color }}
            >
              {course.code}
            </span>
          )}
        </div>
        <div className={cn('text-right', urgent && 'text-destructive')}>
          <p className="font-display text-2xl font-extrabold leading-none">{past ? '—' : d}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {past ? 'done' : d === 1 ? 'day left' : 'days left'}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {fmtDate(exam.date)} · {fmtTime(exam.date)} · worth {exam.weight}%
        {exam.grade !== null && <span className="ml-1 font-semibold text-foreground">· scored {exam.grade}%</span>}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${EXAM_PROGRESS[exam.status]}%` }}
          />
        </div>
        <ExamStatusBadge status={exam.status} />
      </div>
    </div>
  );
}

/* ------------------------------- session row -------------------------------- */

export function SessionRow({ s, onOpen }: { s: StudySession; onOpen: () => void }) {
  const put = useStore((st) => st.put);
  const course = useStore((st) => st.courses.find((c) => c.id === s.courseId));
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
    >
      <input
        type="checkbox"
        checked={s.done}
        aria-label="Session completed"
        onClick={(e) => e.stopPropagation()}
        onChange={() => put('sessions', { ...s, done: !s.done })}
        className="h-4 w-4 shrink-0 accent-[hsl(var(--success))]"
      />
      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ background: course?.color ?? 'hsl(var(--muted-foreground))' }}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', s.done && 'text-muted-foreground line-through')}>{s.topic}</p>
        <p className="text-xs text-muted-foreground">
          {course?.code ?? 'Course'} · {fmtTime(s.date)} · {s.durationMin} min
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{fmtDate(s.date)}</span>
    </div>
  );
}
