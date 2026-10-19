'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Assignment, CalItem, Exam, StudySession } from '@/lib/types';
import { cn, isTurnedIn } from '@/lib/utils';
import { PageHeader, Select } from '@/components/ui';
import { CalendarView } from '@/components/calendar-view';
import { AssignmentForm, ExamForm, SessionForm } from '@/components/forms';
import { AssignmentDetail } from '@/components/assignment-detail';

type Kind = CalItem['kind'];

export default function CalendarPage() {
  const { assignments, exams, sessions, courses, put } = useStore((s) => ({
    assignments: s.assignments, exams: s.exams, sessions: s.sessions,
    courses: s.courses, put: s.put,
  }));
  const [kinds, setKinds] = useState<Record<Kind, boolean>>({ assignment: true, exam: true, session: true });
  const [fCourse, setFCourse] = useState('all');
  const [openAId, setOpenAId] = useState<string | null>(null);
  const [editA, setEditA] = useState<Assignment | null>(null);
  const [editE, setEditE] = useState<Exam | null>(null);
  const [editS, setEditS] = useState<StudySession | null>(null);

  const openA = assignments.find((x) => x.id === openAId) ?? null;
  const color = (courseId: string) => courses.find((c) => c.id === courseId)?.color ?? '#5B5BD6';

  const items: CalItem[] = useMemo(() => {
    const out: CalItem[] = [];
    if (kinds.assignment)
      for (const a of assignments)
        out.push({ id: a.id, kind: 'assignment', title: a.title, date: a.dueDate, color: color(a.courseId), courseId: a.courseId, done: isTurnedIn(a) });
    if (kinds.exam)
      for (const e of exams)
        out.push({ id: e.id, kind: 'exam', title: e.name, date: e.date, color: color(e.courseId), courseId: e.courseId, done: e.status === 'completed' });
    if (kinds.session)
      for (const s of sessions)
        out.push({ id: s.id, kind: 'session', title: s.topic, date: s.date, color: color(s.courseId), courseId: s.courseId, done: s.done });
    return fCourse === 'all' ? out : out.filter((i) => i.courseId === fCourse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, exams, sessions, kinds, fCourse, courses]);

  const openItem = (it: CalItem) => {
    if (it.kind === 'assignment') setOpenAId(it.id);
    else if (it.kind === 'exam') setEditE(exams.find((e) => e.id === it.id) ?? null);
    else setEditS(sessions.find((s) => s.id === it.id) ?? null);
  };

  const moveItem = (it: CalItem, day: Date) => {
    const reslot = (iso: string) => {
      const old = new Date(iso);
      const next = new Date(day);
      next.setHours(old.getHours(), old.getMinutes(), 0, 0);
      return next.toISOString();
    };
    if (it.kind === 'assignment') {
      const a = assignments.find((x) => x.id === it.id);
      if (a) put('assignments', { ...a, dueDate: reslot(a.dueDate) });
    } else if (it.kind === 'exam') {
      const e = exams.find((x) => x.id === it.id);
      if (e) put('exams', { ...e, date: reslot(e.date) });
    } else {
      const s = sessions.find((x) => x.id === it.id);
      if (s) put('sessions', { ...s, date: reslot(s.date) });
    }
  };

  const [addDate, setAddDate] = useState<string | null>(null);

  const KIND_META: { kind: Kind; label: string; icon: string }[] = [
    { kind: 'assignment', label: 'Assignments', icon: '✓' },
    { kind: 'exam', label: 'Exams', icon: '★' },
    { kind: 'session', label: 'Study', icon: '◷' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Calendar" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {KIND_META.map((k) => (
            <button
              key={k.kind}
              onClick={() => setKinds((prev) => ({ ...prev, [k.kind]: !prev[k.kind] }))}
              aria-pressed={kinds[k.kind]}
              className={cn(
                'h-9 rounded-full border px-3.5 text-[13px] font-bold transition active:scale-95',
                kinds[k.kind]
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground/60',
              )}
            >
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} aria-label="Course" className="h-9 w-32 text-xs">
          <option value="all">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </Select>
      </div>

      <CalendarView
        items={items}
        onOpen={openItem}
        onMove={moveItem}
        addLabel="Plan study session"
        onAddAt={(day) => {
          const at = new Date(day);
          at.setHours(18, 0, 0, 0);
          setAddDate(at.toISOString());
        }}
      />

      {openA && <AssignmentDetail assignment={openA} onClose={() => setOpenAId(null)} />}
      <AssignmentForm open={!!editA} onClose={() => setEditA(null)} assignment={editA} />
      <ExamForm open={!!editE} onClose={() => setEditE(null)} exam={editE} />
      <SessionForm open={!!editS} onClose={() => setEditS(null)} session={editS} />
      <SessionForm open={!!addDate} onClose={() => setAddDate(null)} defaultDate={addDate ?? undefined} />
    </div>
  );
}
