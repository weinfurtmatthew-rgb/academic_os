'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import {
  addDays, courseGrade, gpaTrend, hoursBetween, lastNDays, startOfWeek, studyStreak, toDateKey,
} from '@/lib/utils';
import { Card, CardHeader, EmptyState, PageHeader, Stat } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';

export default function AnalyticsPage() {
  const { courses, assignments, exams, sessions, settings } = useStore((s) => ({
    courses: s.courses, assignments: s.assignments, exams: s.exams,
    sessions: s.sessions, settings: s.settings,
  }));

  const completed = assignments.filter((a) => a.status === 'completed').length;
  const rate = assignments.length ? Math.round((completed / assignments.length) * 100) : 0;
  const streak = studyStreak(sessions);
  const totalH = sessions.filter((s) => s.done).reduce((sum, s) => sum + s.durationMin, 0) / 60;

  /* daily study hours, last 14 days */
  const daily = useMemo(() => {
    const days = lastNDays(14);
    const byKey = new Map<string, number>();
    for (const s of sessions) {
      if (!s.done) continue;
      const k = toDateKey(s.date);
      byKey.set(k, (byKey.get(k) ?? 0) + s.durationMin / 60);
    }
    return days.map((d) => ({ label: d.label, value: Math.round((byKey.get(d.key) ?? 0) * 10) / 10 }));
  }, [sessions]);

  /* weekly study hours, last 8 weeks */
  const weekly = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    const thisWeek = startOfWeek(new Date());
    for (let i = 7; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i);
      const end = addDays(start, 7);
      out.push({
        label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: Math.round(hoursBetween(sessions, start, end) * 10) / 10,
      });
    }
    return out;
  }, [sessions]);

  /* tasks completed per week, last 8 weeks */
  const tasksWeekly = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    const thisWeek = startOfWeek(new Date());
    for (let i = 7; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i).toISOString();
      const end = addDays(thisWeek, -7 * i + 7).toISOString();
      out.push({
        label: new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: assignments.filter((a) => a.completedAt && a.completedAt >= start && a.completedAt < end).length,
      });
    }
    return out;
  }, [assignments]);

  const trend = useMemo(() => gpaTrend(courses, assignments, exams, settings.gpaScale), [courses, assignments, exams, settings.gpaScale]);

  const coursePerf = useMemo(
    () =>
      courses
        .map((c) => ({ label: c.code, value: courseGrade(c.id, assignments, exams) ?? 0, color: c.color, has: courseGrade(c.id, assignments, exams) !== null }))
        .filter((c) => c.has),
    [courses, assignments, exams],
  );

  const studyByCourse = useMemo(
    () =>
      courses
        .map((c) => ({
          label: c.code,
          color: c.color,
          value: Math.round((sessions.filter((s) => s.courseId === c.id && s.done).reduce((sum, s) => sum + s.durationMin, 0) / 60) * 10) / 10,
        }))
        .filter((c) => c.value > 0),
    [courses, sessions],
  );

  const empty = assignments.length === 0 && sessions.length === 0 && exams.length === 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Analytics" />

      {empty ? (
        <EmptyState
          title="Nothing to analyze yet"
          body="Complete assignments, log study sessions and enter grades — charts will light up as data flows in."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Tasks completed" value={completed} sub={`of ${assignments.length} total`} accent />
            <Stat label="Completion rate" value={`${rate}%`} />
            <Stat label="Study hours" value={totalH.toFixed(1)} sub="all time" />
            <Stat label="Current streak" value={`${streak}d`} sub="consecutive study days" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <CardHeader eyebrow="Last 14 days" title="Daily study hours" />
              <BarChart data={daily} unit="h" height={150} />
            </Card>
            <Card className="p-4">
              <CardHeader eyebrow="Last 8 weeks" title="Weekly study hours" />
              <BarChart data={weekly} unit="h" height={150} />
            </Card>
            <Card className="p-4">
              <CardHeader eyebrow="Last 8 weeks" title="Tasks completed per week" />
              <BarChart data={tasksWeekly} height={150} />
            </Card>
            <Card className="p-4">
              <CardHeader eyebrow="Cumulative" title="GPA trend" />
              {trend.length >= 2 ? (
                <LineChart points={trend.map((t) => t.value)} labels={trend.map((t) => t.label)} height={150} yMin={0} yMax={settings.gpaScale} format={(v) => v.toFixed(2)} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Enter grades across two or more months to see your GPA trend.</p>
              )}
            </Card>
            <Card className="p-4">
              <CardHeader eyebrow="Current standing" title="Course performance (%)" />
              {coursePerf.length > 0 ? (
                <BarChart data={coursePerf} unit="%" height={150} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No graded work yet.</p>
              )}
            </Card>
            <Card className="p-4">
              <CardHeader eyebrow="Where the time goes" title="Study hours by course" />
              {studyByCourse.length > 0 ? (
                <BarChart data={studyByCourse} unit="h" height={150} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Mark study sessions as completed to populate this chart.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
