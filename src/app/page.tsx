'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Flame, Plus, Sparkles, Timer } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Assignment, Exam, StudySession } from '@/lib/types';
import {
  addDays, cn, courseGrade, daysUntil, fmtDate, fmtTime, hexToRgba,
  hoursBetween, isSameDay, letterGrade, overallGPA, relDue, startOfWeek, studyStreak,
} from '@/lib/utils';
import { Button, Card, CardHeader, EmptyState, Progress, Stat } from '@/components/ui';
import { AssignmentRow, ExamStatusBadge, PriorityBadge, SessionRow } from '@/components/shared';
import { AssignmentForm, ExamForm, SessionForm } from '@/components/forms';
import { AssignmentDetail } from '@/components/assignment-detail';

export default function DashboardPage() {
  const router = useRouter();
  const { courses, assignments, exams, sessions, settings, loadSample, setUI } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, exams: s.exams, sessions: s.sessions,
    settings: s.settings, loadSample: s.loadSample, setUI: s.setUI,
  }));
  const [openAId, setOpenAId] = useState<string | null>(null);
  const [editA, setEditA] = useState<Assignment | null>(null);
  const [editE, setEditE] = useState<Exam | null>(null);
  const [editS, setEditS] = useState<StudySession | null>(null);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Burning the midnight oil' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const today = useMemo(() => {
    const dueToday = assignments
      .filter((a) => a.status !== 'completed' && isSameDay(a.dueDate, now))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const examsToday = exams.filter((e) => isSameDay(e.date, now));
    const sessionsToday = sessions
      .filter((s) => isSameDay(s.date, now))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { dueToday, examsToday, sessionsToday };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, exams, sessions]);

  const upcoming = useMemo(() => {
    const horizon = addDays(new Date(), 14).toISOString();
    const items = [
      ...assignments
        .filter((a) => a.status !== 'completed' && a.dueDate <= horizon)
        .map((a) => ({ kind: 'assignment' as const, date: a.dueDate, a })),
      ...exams
        .filter((e) => e.status !== 'completed' && e.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() && e.date <= horizon)
        .map((e) => ({ kind: 'exam' as const, date: e.date, e })),
    ];
    return items.sort((x, y) => x.date.localeCompare(y.date)).slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, exams]);

  const week = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = addDays(start, 7);
    const done = assignments.filter(
      (a) => a.completedAt && a.completedAt >= start.toISOString() && a.completedAt < end.toISOString(),
    ).length;
    const open = assignments.filter((a) => a.status !== 'completed' && a.dueDate >= start.toISOString() && a.dueDate < end.toISOString()).length;
    const hours = hoursBetween(sessions, start, end);
    return { done, open, hours, target: done + open };
  }, [assignments, sessions]);

  const openA = assignments.find((x) => x.id === openAId) ?? null;
  const gpa = overallGPA(courses, assignments, exams, settings.gpaScale);
  const streak = studyStreak(sessions);

  const empty = courses.length === 0 && assignments.length === 0 && exams.length === 0;

  if (empty) {
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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* greeting + stats */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{fmtDate(now.toISOString(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting} <span aria-hidden>👋</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-highlighter/30 px-3 py-1.5 text-xs font-extrabold">
              <Flame className="h-4 w-4 text-orange-500" /> {streak}-day streak
            </span>
          )}
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setUI({ quickAdd: 'assignment' })}>
            <Plus className="h-4 w-4" /> Quick add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="GPA" value={gpa === null ? '—' : gpa.toFixed(2)} sub={`${settings.gpaScale}.0 scale`} accent />
        <Stat label="Open tasks" value={assignments.filter((a) => a.status !== 'completed').length} sub={`${today.dueToday.length} due today`} />
        <Stat label="Courses" value={courses.length} />
        <Stat label="Study hrs this week" value={week.hours.toFixed(1)} sub={streak > 0 ? `${streak}-day streak` : 'log a session'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* today */}
        <Card className="p-4 lg:col-span-2">
          <CardHeader
            eyebrow="Today"
            title="On your plate"
            action={
              <Button variant="ghost" size="sm" onClick={() => setUI({ quickAdd: 'session' })}>
                <Timer className="h-4 w-4" /> Plan study
              </Button>
            }
          />
          <div className="space-y-2">
            {today.examsToday.map((e) => {
              const course = courses.find((c) => c.id === e.courseId);
              return (
                <button
                  key={e.id}
                  onClick={() => setEditE(e)}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 px-3.5 py-3 text-left"
                >
                  <span className="text-lg" aria-hidden>★</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{e.name} — today!</span>
                    <span className="block text-xs text-muted-foreground">
                      {course?.code} · {fmtTime(e.date)} · worth {e.weight}%
                    </span>
                  </span>
                  <ExamStatusBadge status={e.status} />
                </button>
              );
            })}
            {today.dueToday.map((a) => (
              <AssignmentRow key={a.id} a={a} onOpen={() => setOpenAId(a.id)} />
            ))}
            {today.sessionsToday.map((s) => (
              <SessionRow key={s.id} s={s} onOpen={() => setEditS(s)} />
            ))}
            {today.dueToday.length + today.examsToday.length + today.sessionsToday.length === 0 && (
              <EmptyState
                title="Nothing scheduled today"
                body="A clear day — get ahead on upcoming work or take a well-earned break."
                action={<Button variant="outline" onClick={() => setUI({ quickAdd: 'session' })}><Plus className="h-4 w-4" /> Plan a study session</Button>}
              />
            )}
          </div>
        </Card>

        {/* weekly progress */}
        <Card className="p-4">
          <CardHeader eyebrow="This week" title="Progress" />
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-semibold">Tasks completed</span>
                <span className="font-display text-lg font-extrabold">
                  {week.done}<span className="text-sm font-semibold text-muted-foreground">/{week.target}</span>
                </span>
              </div>
              <Progress value={week.target ? (week.done / week.target) * 100 : 0} />
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Study time</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{week.hours.toFixed(1)} h</p>
              <p className="text-xs text-muted-foreground">logged since Monday</p>
            </div>
            <Link href="/analytics/" className="group inline-flex items-center gap-1 text-sm font-bold text-primary">
              Full analytics <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* upcoming deadlines timeline */}
      <Card className="p-4">
        <CardHeader eyebrow="Next 14 days" title="Upcoming deadlines" action={<Link href="/calendar/" className="text-sm font-bold text-primary">Calendar →</Link>} />
        {upcoming.length === 0 ? (
          <EmptyState title="No deadlines in the next two weeks" body="Add assignments and exams to see them on your timeline." />
        ) : (
          <ol className="relative ml-2 space-y-3 border-l-2 border-dashed border-border pl-5">
            {upcoming.map((u) => {
              const course = courses.find((c) => c.id === (u.kind === 'assignment' ? u.a.courseId : u.e.courseId));
              const color = course?.color ?? '#888';
              const d = daysUntil(u.date);
              return (
                <li key={`${u.kind}-${u.kind === 'assignment' ? u.a.id : u.e.id}`} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-background" style={{ background: color }} />
                  <button
                    onClick={() => (u.kind === 'assignment' ? setOpenAId(u.a.id) : setEditE(u.e))}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className={cn('w-20 shrink-0 text-xs font-extrabold', d < 0 ? 'text-destructive' : d <= 2 ? 'text-orange-500' : 'text-muted-foreground')}>
                      {relDue(u.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {u.kind === 'exam' && <span aria-hidden>★ </span>}
                        {u.kind === 'assignment' ? u.a.title : u.e.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {course?.code} · {fmtDate(u.date)} {fmtTime(u.date)}
                      </span>
                    </span>
                    {u.kind === 'assignment' ? <PriorityBadge priority={u.a.priority} /> : <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">exam · {u.e.weight}%</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* course overview */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold tracking-tight">Courses</h2>
          <Link href="/courses/" className="text-sm font-bold text-primary">All courses →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {courses.slice(0, 4).map((c) => {
            const open = assignments.filter((a) => a.courseId === c.id && a.status !== 'completed').length;
            const g = courseGrade(c.id, assignments, exams);
            const nextExam = exams.filter((e) => e.courseId === c.id && daysUntil(e.date) >= 0 && e.status !== 'completed').sort((a, b) => a.date.localeCompare(b.date))[0];
            return (
              <button
                key={c.id}
                onClick={() => {
                  setUI({ selectedCourseId: c.id });
                  router.push('/courses/');
                }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                <span className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold" style={{ background: hexToRgba(c.color, 0.14), color: c.color }}>
                  {c.code}
                </span>
                <p className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug">{c.name}</p>
                <div className="mt-3 flex items-end justify-between text-xs text-muted-foreground">
                  <span>{open} open task{open === 1 ? '' : 's'}{nextExam ? ` · exam in ${daysUntil(nextExam.date)}d` : ''}</span>
                  <span className="font-display text-base font-extrabold text-foreground">{g === null ? '—' : letterGrade(g)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openA && <AssignmentDetail assignment={openA} onClose={() => setOpenAId(null)} />}
      <AssignmentForm open={!!editA} onClose={() => setEditA(null)} assignment={editA} />
      <ExamForm open={!!editE} onClose={() => setEditE(null)} exam={editE} />
      <SessionForm open={!!editS} onClose={() => setEditS(null)} session={editS} />
    </div>
  );
}
