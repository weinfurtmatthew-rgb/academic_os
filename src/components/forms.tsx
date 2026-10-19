'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  ASSIGNMENT_STATUSES, COURSE_COLORS, DAYS, EXAM_STATUSES, PRIORITIES,
  type Assignment, type ClassMeeting, type Course, type Exam, type Flashcard, type Lecture, type StudySession,
} from '@/lib/types';
import { cn, fromLocalInput, toLocalInput, uid } from '@/lib/utils';
import { Button, Dialog, FormRow, Input, Select, Textarea } from '@/components/ui';

/* ---------------------------------- shared --------------------------------- */

function CourseSelect({
  value, onChange, allowNone, id,
}: { value: string; onChange: (v: string) => void; allowNone?: boolean; id?: string }) {
  const courses = useStore((s) => s.courses);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">No course</option>}
      {!allowNone && courses.length === 0 && <option value="">— add a course first —</option>}
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} · {c.name}
        </option>
      ))}
    </Select>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 2500);
    return () => clearTimeout(t);
  }, [arm]);
  return (
    <Button
      type="button"
      variant={arm ? 'destructive' : 'ghost'}
      onClick={() => (arm ? onDelete() : setArm(true))}
      className={cn(!arm && 'text-destructive hover:bg-destructive/10')}
    >
      <Trash2 className="h-4 w-4" />
      {arm ? 'Confirm delete' : 'Delete'}
    </Button>
  );
}

function FooterBar({ onCancel, onDelete, saveLabel = 'Save' }: { onCancel: () => void; onDelete?: () => void; saveLabel?: string }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
      <div>{onDelete && <DeleteButton onDelete={onDelete} />}</div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{saveLabel}</Button>
      </div>
    </div>
  );
}

function nowLocal(offsetDays = 0, hour = 17): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/* ------------------------------- Course form ------------------------------- */

export function CourseForm({
  open, onClose, course,
}: { open: boolean; onClose: () => void; course?: Course | null }) {
  const put = useStore((s) => s.put);
  const deleteCourse = useStore((s) => s.deleteCourse);
  const router = useRouter();

  const blank = useMemo<Course>(
    () => ({
      id: uid(), name: '', code: '', instructor: '', email: '', phone: '', office: '', officeHours: '',
      credits: 3, semester: '', color: COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)],
      schedule: [], resources: [], createdAt: new Date().toISOString(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );
  const [f, setF] = useState<Course>(course ?? blank);
  useEffect(() => setF(course ?? blank), [course, blank]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const schedule = f.schedule
      .filter((m) => m.start && m.end)
      .map((m) => (m.start <= m.end ? m : { ...m, start: m.end, end: m.start }))
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    put('courses', { ...f, schedule, name: f.name.trim(), code: f.code.trim() || f.name.slice(0, 8).toUpperCase() });
    onClose();
  };

  const patchMeeting = (id: string, patch: Partial<ClassMeeting>) =>
    setF({ ...f, schedule: f.schedule.map((m) => (m.id === id ? { ...m, ...patch } : m)) });

  const addMeeting = () =>
    setF({
      ...f,
      schedule: [...f.schedule, { id: uid(), day: f.schedule.length % 5, start: '10:00', end: '11:15', location: '' }],
    });

  return (
    <Dialog open={open} onClose={onClose} title={course ? 'Edit course' : 'New course'} wide>
      <form onSubmit={submit} className="space-y-4">
        <FormRow label="Course name">
          <Input autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Data Structures & Algorithms" />
        </FormRow>
        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Code">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CS 201" />
          </FormRow>
          <FormRow label="Credits">
            <Input
              type="number" min={0} max={30} step={0.5} value={f.credits}
              onChange={(e) => setF({ ...f, credits: Number(e.target.value) || 0 })}
            />
          </FormRow>
          <FormRow label="Semester">
            <Input value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value })} placeholder="Fall 2026" />
          </FormRow>
        </div>

        <fieldset className="rounded-xl border border-border p-3.5">
          <legend className="px-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Instructor & contact</legend>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Instructor">
                <Input value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} placeholder="Prof. Ada Lovelace" />
              </FormRow>
              <FormRow label="Email">
                <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="lovelace@university.edu" />
              </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Phone">
                <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(555) 012-3456" />
              </FormRow>
              <FormRow label="Office">
                <Input value={f.office} onChange={(e) => setF({ ...f, office: e.target.value })} placeholder="SCI 412" />
              </FormRow>
            </div>
            <FormRow label="Office hours">
              <Input value={f.officeHours} onChange={(e) => setF({ ...f, officeHours: e.target.value })} placeholder="Tue & Thu 14:00–16:00, or by appointment" />
            </FormRow>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-border p-3.5">
          <legend className="px-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Weekly class schedule</legend>
          <div className="space-y-2">
            {f.schedule.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr,1fr] items-center gap-2 rounded-xl bg-muted/50 p-2 sm:grid-cols-[110px,96px,96px,1fr,32px]">
                <Select value={String(m.day)} onChange={(e) => patchMeeting(m.id, { day: Number(e.target.value) })} className="h-9 text-xs">
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </Select>
                <Input type="time" value={m.start} onChange={(e) => patchMeeting(m.id, { start: e.target.value })} className="h-9 text-xs" aria-label="Start time" />
                <Input type="time" value={m.end} onChange={(e) => patchMeeting(m.id, { end: e.target.value })} className="h-9 text-xs" aria-label="End time" />
                <Input value={m.location} onChange={(e) => patchMeeting(m.id, { location: e.target.value })} className="h-9 text-xs" placeholder="Room / building" />
                <Button
                  type="button" variant="ghost" size="icon" aria-label="Remove meeting"
                  className="h-9 w-8 justify-self-end text-muted-foreground hover:text-destructive"
                  onClick={() => setF({ ...f, schedule: f.schedule.filter((x) => x.id !== m.id) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addMeeting}>
              <Plus className="h-4 w-4" /> Add class meeting
            </Button>
            {f.schedule.length === 0 && (
              <p className="text-[11px] text-muted-foreground">e.g. Mon &amp; Wed 10:00–11:15 in SCI 204 — shows up on the Schedule page and dashboard.</p>
            )}
          </div>
        </fieldset>

        <FormRow label="Color label">
          <div className="flex flex-wrap gap-2">
            {COURSE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`color ${c}`}
                onClick={() => setF({ ...f, color: c })}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                  f.color === c ? 'border-foreground ring-2 ring-ring ring-offset-2 ring-offset-card' : 'border-transparent',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </FormRow>
        <FooterBar
          onCancel={onClose}
          onDelete={
            course
              ? () => {
                  deleteCourse(course.id);
                  onClose();
                  router.push('/courses/');
                }
              : undefined
          }
        />
      </form>
    </Dialog>
  );
}

/* ----------------------------- Assignment form ----------------------------- */

export function AssignmentForm({
  open, onClose, assignment, defaultCourseId,
}: { open: boolean; onClose: () => void; assignment?: Assignment | null; defaultCourseId?: string }) {
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const courses = useStore((s) => s.courses);

  const blank = useMemo<Assignment>(
    () => ({
      id: uid(), courseId: defaultCourseId || courses[0]?.id || '', title: '', description: '',
      dueDate: nowLocal(3, 17), priority: 'medium', status: 'not_started',
      estimatedHours: 2, grade: null, completedAt: null,
      submissionUrl: '', submissionNotes: '', attachments: [],
      createdAt: new Date().toISOString(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, defaultCourseId],
  );
  const [f, setF] = useState<Assignment>(assignment ?? blank);
  useEffect(() => setF(assignment ?? blank), [assignment, blank]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.courseId) return;
    const url = f.submissionUrl.trim();
    put('assignments', {
      ...f,
      title: f.title.trim(),
      submissionUrl: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={assignment ? 'Edit assignment' : 'New assignment'}>
      <form onSubmit={submit} className="space-y-4">
        <FormRow label="Title">
          <Input autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Problem set 4" />
        </FormRow>
        <FormRow label="Course">
          <CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v })} />
        </FormRow>
        <FormRow label="Description">
          <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What needs to be done?" />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Due date">
            <Input
              type="datetime-local" required value={toLocalInput(f.dueDate)}
              onChange={(e) => e.target.value && setF({ ...f, dueDate: fromLocalInput(e.target.value) })}
            />
          </FormRow>
          <FormRow label="Estimated hours">
            <Input
              type="number" min={0} step={0.5} value={f.estimatedHours}
              onChange={(e) => setF({ ...f, estimatedHours: Number(e.target.value) || 0 })}
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Priority">
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Assignment['priority'] })}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Assignment['status'] })}>
              {ASSIGNMENT_STATUSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </FormRow>
        </div>
        <fieldset className="rounded-xl border border-border p-3.5">
          <legend className="px-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Turning it in</legend>
          <div className="space-y-3">
            <FormRow label="Submission link">
              <Input
                type="url"
                inputMode="url"
                value={f.submissionUrl}
                onChange={(e) => setF({ ...f, submissionUrl: e.target.value })}
                placeholder="Canvas, Gradescope or portal URL"
              />
            </FormRow>
            <FormRow label="Submission instructions">
              <Textarea
                rows={2}
                value={f.submissionNotes}
                onChange={(e) => setF({ ...f, submissionNotes: e.target.value })}
                placeholder="File format, naming, what to include…"
              />
            </FormRow>
          </div>
        </fieldset>
        <FormRow label="Grade received (%)">
          <Input
            type="number" min={0} max={120} step={0.1}
            value={f.grade ?? ''}
            placeholder="Not graded yet"
            onChange={(e) => setF({ ...f, grade: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </FormRow>
        <FooterBar
          onCancel={onClose}
          onDelete={assignment ? () => { remove('assignments', assignment.id); onClose(); } : undefined}
        />
      </form>
    </Dialog>
  );
}

/* -------------------------------- Exam form -------------------------------- */

export function ExamForm({
  open, onClose, exam, defaultCourseId,
}: { open: boolean; onClose: () => void; exam?: Exam | null; defaultCourseId?: string }) {
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const courses = useStore((s) => s.courses);

  const blank = useMemo<Exam>(
    () => ({
      id: uid(), courseId: defaultCourseId || courses[0]?.id || '', name: '',
      date: nowLocal(14, 9), weight: 25, status: 'not_started', grade: null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, defaultCourseId],
  );
  const [f, setF] = useState<Exam>(exam ?? blank);
  useEffect(() => setF(exam ?? blank), [exam, blank]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.courseId) return;
    put('exams', { ...f, name: f.name.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={exam ? 'Edit exam' : 'New exam'}>
      <form onSubmit={submit} className="space-y-4">
        <FormRow label="Exam name">
          <Input autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Midterm 1" />
        </FormRow>
        <FormRow label="Course">
          <CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v })} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Date & time">
            <Input
              type="datetime-local" required value={toLocalInput(f.date)}
              onChange={(e) => e.target.value && setF({ ...f, date: fromLocalInput(e.target.value) })}
            />
          </FormRow>
          <FormRow label="Weight (% of grade)">
            <Input
              type="number" min={0} max={100} value={f.weight}
              onChange={(e) => setF({ ...f, weight: Number(e.target.value) || 0 })}
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Study status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Exam['status'] })}>
              {EXAM_STATUSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Grade (%)">
            <Input
              type="number" min={0} max={120} step={0.1} value={f.grade ?? ''} placeholder="—"
              onChange={(e) => setF({ ...f, grade: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </FormRow>
        </div>
        <FooterBar
          onCancel={onClose}
          onDelete={exam ? () => { remove('exams', exam.id); onClose(); } : undefined}
        />
      </form>
    </Dialog>
  );
}

/* ----------------------------- Study session form -------------------------- */

export function SessionForm({
  open, onClose, session, defaultCourseId, defaultDate,
}: {
  open: boolean; onClose: () => void; session?: StudySession | null;
  defaultCourseId?: string; defaultDate?: string;
}) {
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const courses = useStore((s) => s.courses);

  const blank = useMemo<StudySession>(
    () => ({
      id: uid(), courseId: defaultCourseId || courses[0]?.id || '', topic: '',
      date: defaultDate || nowLocal(0, 19), durationMin: 60, notes: '', done: false, mood: null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, defaultCourseId, defaultDate],
  );
  const [f, setF] = useState<StudySession>(session ?? blank);
  useEffect(() => setF(session ?? blank), [session, blank]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.topic.trim() || !f.courseId) return;
    put('sessions', { ...f, topic: f.topic.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={session ? 'Edit study session' : 'Plan study session'}>
      <form onSubmit={submit} className="space-y-4">
        <FormRow label="Topic">
          <Input autoFocus required value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Graph traversal: BFS & DFS" />
        </FormRow>
        <FormRow label="Course">
          <CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v })} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Date & time">
            <Input
              type="datetime-local" required value={toLocalInput(f.date)}
              onChange={(e) => e.target.value && setF({ ...f, date: fromLocalInput(e.target.value) })}
            />
          </FormRow>
          <FormRow label="Duration (minutes)">
            <Input
              type="number" min={5} step={5} value={f.durationMin}
              onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) || 0 })}
            />
          </FormRow>
        </div>
        <FormRow label="Notes">
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Chapters, problem sets, flashcards…" />
        </FormRow>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium">
          <input
            type="checkbox" checked={f.done}
            onChange={(e) => setF({ ...f, done: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Mark as completed
        </label>
        <FooterBar
          onCancel={onClose}
          onDelete={session ? () => { remove('sessions', session.id); onClose(); } : undefined}
        />
      </form>
    </Dialog>
  );
}

/* ------------------------------- Lecture form ------------------------------ */
/* Full lecture editing (rich notes + attachments) lives in the lectures page;
   this dialog covers create + core fields and is reused there. */

export function LectureForm({
  open, onClose, lecture, defaultCourseId, onCreated,
}: {
  open: boolean; onClose: () => void; lecture?: Lecture | null;
  defaultCourseId?: string; onCreated?: (id: string) => void;
}) {
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const courses = useStore((s) => s.courses);

  const blank = useMemo<Lecture>(
    () => ({
      id: uid(), courseId: defaultCourseId || courses[0]?.id || '', title: '',
      date: nowLocal(0, 10), summary: '', notes: '', attachments: [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, defaultCourseId],
  );
  const [f, setF] = useState<Lecture>(lecture ?? blank);
  useEffect(() => setF(lecture ?? blank), [lecture, blank]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.courseId) return;
    const isNew = !lecture;
    put('lectures', { ...f, title: f.title.trim() });
    onClose();
    if (isNew && onCreated) onCreated(f.id);
  };

  return (
    <Dialog open={open} onClose={onClose} title={lecture ? 'Edit lecture' : 'New lecture'}>
      <form onSubmit={submit} className="space-y-4">
        <FormRow label="Lecture title">
          <Input autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Week 6 — Dynamic programming" />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Course">
            <CourseSelect value={f.courseId} onChange={(v) => setF({ ...f, courseId: v })} />
          </FormRow>
          <FormRow label="Date">
            <Input
              type="datetime-local" required value={toLocalInput(f.date)}
              onChange={(e) => e.target.value && setF({ ...f, date: fromLocalInput(e.target.value) })}
            />
          </FormRow>
        </div>
        <FormRow label="Summary">
          <Textarea rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="One-paragraph recap of the lecture" />
        </FormRow>
        {!lecture && (
          <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
            After saving you can open the lecture to write rich notes and attach images or PDFs.
          </p>
        )}
        <FooterBar
          onCancel={onClose}
          saveLabel={lecture ? 'Save' : 'Create lecture'}
          onDelete={lecture ? () => { remove('lectures', lecture.id); onClose(); } : undefined}
        />
      </form>
    </Dialog>
  );
}

/* ------------------------------ Flashcard form ----------------------------- */

export function FlashcardForm({
  open, onClose, card, defaultCourseId,
}: { open: boolean; onClose: () => void; card?: Flashcard | null; defaultCourseId?: string }) {
  const put = useStore((s) => s.put);
  const courses = useStore((s) => s.courses);
  const notes = useStore((s) => s.notes);

  const blank = useMemo<Flashcard>(
    () => ({
      id: uid(), courseId: defaultCourseId ?? courses[0]?.id ?? null, noteId: null,
      front: '', back: '', ease: 2.5, intervalDays: 0, reps: 0,
      due: new Date().toISOString(), lastReviewed: null, createdAt: new Date().toISOString(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, defaultCourseId],
  );
  const [f, setF] = useState<Flashcard>(card ?? blank);
  useEffect(() => setF(card ?? blank), [card, blank]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.front.trim() || !f.back.trim()) return;
    put('flashcards', { ...f, front: f.front.trim(), back: f.back.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={card ? 'Edit flashcard' : 'New flashcard'}>
      <form onSubmit={submit} className="space-y-4">
        <FormRow label="Front (question)">
          <Textarea
            autoFocus required rows={3} value={f.front}
            onChange={(e) => setF({ ...f, front: e.target.value })}
            placeholder={'Time to build a binary heap?  (markdown + $math$ work)'}
          />
        </FormRow>
        <FormRow label="Back (answer)">
          <Textarea
            required rows={3} value={f.back}
            onChange={(e) => setF({ ...f, back: e.target.value })}
            placeholder={'$O(n)$ — bottom-up heapify'}
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Course">
            <Select value={f.courseId ?? ''} onChange={(e) => setF({ ...f, courseId: e.target.value || null, noteId: null })}>
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Linked note (optional)">
            <Select value={f.noteId ?? ''} onChange={(e) => setF({ ...f, noteId: e.target.value || null })}>
              <option value="">None</option>
              {notes.filter((n) => !f.courseId || n.courseId === f.courseId).map((n) => (
                <option key={n.id} value={n.id}>{n.title || 'Untitled note'}</option>
              ))}
            </Select>
          </FormRow>
        </div>
        {card && (
          <button
            type="button"
            onClick={() => setF({ ...f, ease: 2.5, intervalDays: 0, reps: 0, due: new Date().toISOString(), lastReviewed: null })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset learning progress (due now)
          </button>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save card</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ----------------------------- Quick-add host ------------------------------ */
/* Mounted once in the app shell; opens whichever dialog ui.quickAdd asks for. */

export function QuickAddHost() {
  const quickAdd = useStore((s) => s.ui.quickAdd);
  const openCourseId = useStore((s) => s.ui.selectedCourseId);
  const setUI = useStore((s) => s.setUI);
  const router = useRouter();
  const pathname = usePathname();
  // adding from inside a course defaults to that course; closing leaves the course open
  const selectedCourseId = pathname.startsWith('/courses') ? openCourseId : null;
  const close = () => setUI({ quickAdd: null });

  return (
    <>
      <CourseForm open={quickAdd === 'course'} onClose={close} />
      <AssignmentForm open={quickAdd === 'assignment'} onClose={close} defaultCourseId={selectedCourseId || undefined} />
      <ExamForm open={quickAdd === 'exam'} onClose={close} defaultCourseId={selectedCourseId || undefined} />
      <SessionForm open={quickAdd === 'session'} onClose={close} defaultCourseId={selectedCourseId || undefined} />
      <FlashcardForm open={quickAdd === 'flashcard'} onClose={close} defaultCourseId={selectedCourseId || undefined} />
      <LectureForm
        open={quickAdd === 'lecture'}
        onClose={close}
        defaultCourseId={selectedCourseId || undefined}
        onCreated={(id) => {
          setUI({ focus: { type: 'lecture', id } });
          router.push('/lectures/');
        }}
      />
    </>
  );
}
