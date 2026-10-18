'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn, courseGrade, hexToRgba, letterGrade } from '@/lib/utils';
import { Button, EmptyState, Progress } from '@/components/ui';
import { CourseForm } from '@/components/forms';
import { CourseDetail } from '@/components/course-detail';

export default function CoursesPage() {
  const { courses, assignments, exams, ui, setUI } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, exams: s.exams, ui: s.ui, setUI: s.setUI,
  }));
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [add, setAdd] = useState(false);

  // search palette / dashboard can preselect a course
  const selected = courses.find((c) => c.id === ui.selectedCourseId) ?? null;

  // focus target from search (course type)
  useEffect(() => {
    if (ui.focus?.type === 'course') {
      setUI({ selectedCourseId: ui.focus.id, focus: null });
    }
  }, [ui.focus, setUI]);

  if (selected) {
    return <CourseDetail course={selected} onBack={() => setUI({ selectedCourseId: null })} />;
  }

  const sorted = [...courses].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Courses</h1>
          <p className="text-sm text-muted-foreground">{courses.length} enrolled</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border bg-muted p-0.5">
            {([['grid', LayoutGrid], ['list', List]] as const).map(([v, Icon]) => (
              <button
                key={v}
                aria-label={`${v} view`}
                onClick={() => setView(v)}
                className={cn(
                  'flex h-8 w-9 items-center justify-center rounded-[10px] transition-colors',
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Course</Button>
        </div>
      </div>

      {courses.length === 0 && (
        <EmptyState
          title="No courses yet"
          body="Courses are the backbone of Academic OS — assignments, exams, notes and grades all hang off them."
          action={<Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add your first course</Button>}
        />
      )}

      {view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => {
            const mine = assignments.filter((a) => a.courseId === c.id);
            const done = mine.filter((a) => a.status === 'completed').length;
            const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
            const g = courseGrade(c.id, assignments, exams);
            return (
              <button
                key={c.id}
                onClick={() => setUI({ selectedCourseId: c.id })}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-block rounded-lg px-2 py-0.5 text-xs font-extrabold" style={{ background: hexToRgba(c.color, 0.14), color: c.color }}>
                    {c.code}
                  </span>
                  <span className="font-display text-lg font-extrabold">{g === null ? '—' : letterGrade(g)}</span>
                </div>
                <p className="mt-2 line-clamp-2 font-display text-base font-bold leading-snug">{c.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.instructor || 'No instructor'} · {c.credits} cr{c.semester ? ` · ${c.semester}` : ''}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Progress value={pct} color={c.color} className="flex-1" />
                  <span className="text-xs font-bold text-muted-foreground">{done}/{mine.length}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => {
            const open = assignments.filter((a) => a.courseId === c.id && a.status !== 'completed').length;
            const g = courseGrade(c.id, assignments, exams);
            return (
              <button
                key={c.id}
                onClick={() => setUI({ selectedCourseId: c.id })}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
              >
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    <span style={{ color: c.color }}>{c.code}</span> · {c.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.instructor || 'No instructor'} · {c.credits} credits · {open} open task{open === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="shrink-0 font-display text-base font-extrabold">{g === null ? '—' : `${g}%`}</span>
              </button>
            );
          })}
        </div>
      )}

      <CourseForm open={add} onClose={() => setAdd(false)} />
    </div>
  );
}
