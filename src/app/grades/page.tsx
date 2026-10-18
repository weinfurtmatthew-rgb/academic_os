'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import {
  courseGrade, gpaTrend, hexToRgba, letterGrade, overallGPA, percentToPoints, semesterAverage,
} from '@/lib/utils';
import { Card, CardHeader, EmptyState, Input, Select } from '@/components/ui';
import { LineChart } from '@/components/charts';

export default function GradesPage() {
  const { courses, assignments, exams, settings, put, setSettings } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, exams: s.exams,
    settings: s.settings, put: s.put, setSettings: s.setSettings,
  }));

  const gpa = overallGPA(courses, assignments, exams, settings.gpaScale);
  const semAvg = semesterAverage(courses, assignments, exams);
  const trend = useMemo(() => gpaTrend(courses, assignments, exams, settings.gpaScale), [courses, assignments, exams, settings.gpaScale]);

  const graded = (courseId: string) => [
    ...exams.filter((e) => e.courseId === courseId && e.grade !== null).map((e) => ({ kind: 'exam' as const, item: e })),
    ...assignments.filter((a) => a.courseId === courseId && a.grade !== null).map((a) => ({ kind: 'assignment' as const, item: a })),
  ];

  const anyGrades = courses.some((c) => graded(c.id).length > 0);
  const totalCredits = courses.reduce((s, c) => s + c.credits, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Grades</h1>
          <p className="text-sm text-muted-foreground">weighted averages & GPA, updated live</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          GPA scale
          <Select
            value={String(settings.gpaScale)}
            onChange={(e) => setSettings({ gpaScale: Number(e.target.value) })}
            className="h-9 w-24 text-xs"
          >
            <option value="4">4.0</option>
            <option value="5">5.0</option>
            <option value="10">10.0</option>
          </Select>
        </label>
      </div>

      {/* GPA hero */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="relative overflow-hidden p-4 sm:col-span-1">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cumulative GPA</p>
          <p className="mt-1 font-display text-5xl font-extrabold tracking-tight text-primary">
            {gpa === null ? '—' : gpa.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">on a {settings.gpaScale}.0 scale · {totalCredits} credits</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Semester average</p>
          <p className="mt-1 font-display text-4xl font-extrabold tracking-tight">{semAvg === null ? '—' : `${semAvg}%`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{semAvg === null ? 'enter grades below' : letterGrade(semAvg)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">GPA trend</p>
          {trend.length >= 2 ? (
            <LineChart points={trend.map((t) => t.value)} labels={trend.map((t) => t.label)} height={92} yMin={0} yMax={settings.gpaScale} format={(v) => v.toFixed(2)} />
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Grades across 2+ months will draw your trend line here.</p>
          )}
        </Card>
      </div>

      {courses.length === 0 && (
        <EmptyState title="No courses yet" body="Add courses (with credits), then enter grades on assignments and exams — GPA is computed automatically." />
      )}

      {/* per-course breakdown with inline editing */}
      {courses.map((c) => {
        const g = courseGrade(c.id, assignments, exams);
        const rows = graded(c.id);
        const courseExams = exams.filter((e) => e.courseId === c.id);
        const courseAssignments = assignments.filter((a) => a.courseId === c.id);
        return (
          <Card key={c.id} className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3" style={{ background: hexToRgba(c.color, 0.06) }}>
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-1.5 rounded-full" style={{ background: c.color }} />
                <div>
                  <p className="text-sm font-extrabold">
                    <span style={{ color: c.color }}>{c.code}</span> · {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.credits} credits</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-extrabold">{g === null ? '—' : `${g}%`}</p>
                <p className="text-[11px] font-bold text-muted-foreground">
                  {g === null ? 'no grades yet' : `${letterGrade(g)} · ${percentToPoints(g, settings.gpaScale).toFixed(2)} pts`}
                </p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {courseExams.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-extrabold text-destructive">EXAM</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">weight {e.weight}%</span>
                  <Input
                    type="number" min={0} max={120} step={0.1}
                    value={e.grade ?? ''}
                    placeholder="—"
                    aria-label={`Grade for ${e.name}`}
                    onChange={(ev) => put('exams', { ...e, grade: ev.target.value === '' ? null : Number(ev.target.value) })}
                    className="no-spin h-8 w-20 shrink-0 text-center text-sm font-bold"
                  />
                </div>
              ))}
              {courseAssignments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">TASK</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</p>
                  <Input
                    type="number" min={0} max={120} step={0.1}
                    value={a.grade ?? ''}
                    placeholder="—"
                    aria-label={`Grade for ${a.title}`}
                    onChange={(ev) => put('assignments', { ...a, grade: ev.target.value === '' ? null : Number(ev.target.value) })}
                    className="no-spin h-8 w-20 shrink-0 text-center text-sm font-bold"
                  />
                </div>
              ))}
              {courseExams.length + courseAssignments.length === 0 && (
                <p className="px-4 py-4 text-sm text-muted-foreground">Add assignments or exams to this course to start grading.</p>
              )}
            </div>
            {rows.length > 0 && (
              <p className="border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
                Exams count at their set weight; graded assignments share the remaining weight equally.
              </p>
            )}
          </Card>
        );
      })}

      {courses.length > 0 && !anyGrades && (
        <p className="text-center text-sm text-muted-foreground">Type a percentage into any grade box above — everything recalculates instantly and saves automatically.</p>
      )}
    </div>
  );
}
