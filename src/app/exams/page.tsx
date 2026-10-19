'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Exam } from '@/lib/types';
import { daysUntil } from '@/lib/utils';
import { Button, EmptyState, PageHeader, Select, Stat } from '@/components/ui';
import { ExamCard } from '@/components/shared';
import { ExamForm } from '@/components/forms';

export default function ExamsPage() {
  const { exams, courses, ui, setUI } = useStore((s) => ({
    exams: s.exams, courses: s.courses, ui: s.ui, setUI: s.setUI,
  }));
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<Exam | null>(null);
  const [fCourse, setFCourse] = useState('all');

  useEffect(() => {
    if (ui.focus?.type === 'exam') {
      const e = exams.find((x) => x.id === ui.focus!.id);
      if (e) setEdit(e);
      setUI({ focus: null });
    }
  }, [ui.focus, exams, setUI]);

  const filtered = exams.filter((e) => fCourse === 'all' || e.courseId === fCourse);

  const { upcoming, past } = useMemo(() => {
    const up = filtered
      .filter((e) => daysUntil(e.date) >= 0 && e.status !== 'completed')
      .sort((a, b) => a.date.localeCompare(b.date));
    const pa = filtered
      .filter((e) => daysUntil(e.date) < 0 || e.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming: up, past: pa };
  }, [filtered]);

  const next = upcoming[0];
  const ready = upcoming.filter((e) => e.status === 'ready').length;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        eyebrow={`${upcoming.length} upcoming`}
        title="Exams"
        actions={<>
          <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} aria-label="Course" className="h-9 w-36 text-xs">
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </Select>
          <Button className="hidden md:inline-flex" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Exam</Button>
        </>}
      />

      {exams.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Next exam" value={next ? `${daysUntil(next.date)}d` : '—'} sub={next ? next.name : 'nothing scheduled'} accent />
          <Stat label="Upcoming" value={upcoming.length} sub={`${ready} marked ready`} />
          <Stat label="Completed" value={filtered.filter((e) => e.status === 'completed').length} />
        </div>
      )}

      {filtered.length === 0 && (
        <EmptyState
          title="No exams tracked"
          body="Add midterms, finals and quizzes with their weight — countdowns and grade projections come free."
          action={<Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add exam</Button>}
        />
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Upcoming</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <ExamCard key={e.id} exam={e} onOpen={() => setEdit(e)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Past & completed</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <ExamCard key={e.id} exam={e} onOpen={() => setEdit(e)} />
            ))}
          </div>
        </section>
      )}

      <ExamForm open={add || !!edit} onClose={() => { setAdd(false); setEdit(null); }} exam={edit} />
    </div>
  );
}
