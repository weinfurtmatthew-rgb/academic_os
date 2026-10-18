'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, ExternalLink, FileDown, Link2, Mail, MapPin, Paperclip, Pencil, Phone, Play, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DAYS, type Assignment, type Course, type Exam, type Lecture, type Resource } from '@/lib/types';
import { cn, courseGrade, fmtDate, hexToRgba, letterGrade, readFileAsDataURL, uid } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Input, Progress, Stat, Tabs } from '@/components/ui';
import { AssignmentRow, ExamCard } from '@/components/shared';
import { AssignmentForm, CourseForm, ExamForm, LectureForm } from '@/components/forms';
import { AssignmentDetail } from '@/components/assignment-detail';

type Tab = 'assignments' | 'lectures' | 'exams' | 'notes' | 'resources';

export function CourseDetail({ course, onBack }: { course: Course; onBack: () => void }) {
  const router = useRouter();
  const { assignments, lectures, exams, notes, put, setUI } = useStore((s) => ({
    assignments: s.assignments, lectures: s.lectures, exams: s.exams, notes: s.notes,
    put: s.put, setUI: s.setUI,
  }));
  const [tab, setTab] = useState<Tab>('assignments');
  const [editCourse, setEditCourse] = useState(false);
  const [editA, setEditA] = useState<Assignment | null>(null);
  const [openAId, setOpenAId] = useState<string | null>(null);
  const [addA, setAddA] = useState(false);
  const [editE, setEditE] = useState<Exam | null>(null);
  const [addE, setAddE] = useState(false);
  const [editL, setEditL] = useState<Lecture | null>(null);
  const [addL, setAddL] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const mine = useMemo(
    () => ({
      assignments: assignments.filter((a) => a.courseId === course.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      lectures: lectures.filter((l) => l.courseId === course.id).sort((a, b) => b.date.localeCompare(a.date)),
      exams: exams.filter((e) => e.courseId === course.id).sort((a, b) => a.date.localeCompare(b.date)),
      notes: notes.filter((n) => n.courseId === course.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }),
    [assignments, lectures, exams, notes, course.id],
  );

  const openA = assignments.find((x) => x.id === openAId) ?? null;
  const grade = courseGrade(course.id, assignments, exams);
  const done = mine.assignments.filter((a) => a.status === 'completed').length;
  const progress = mine.assignments.length ? Math.round((done / mine.assignments.length) * 100) : 0;

  const addLink = () => {
    if (!linkUrl.trim()) return;
    const r: Resource = {
      id: uid(), kind: 'link',
      title: linkTitle.trim() || linkUrl.trim(),
      url: /^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`,
    };
    put('courses', { ...course, resources: [...course.resources, r] });
    setLinkTitle('');
    setLinkUrl('');
  };

  const addFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      alert('Files up to 4 MB can be stored offline. Try a smaller file.');
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    const r: Resource = { id: uid(), kind: 'file', title: file.name, dataUrl };
    put('courses', { ...course, resources: [...course.resources, r] });
  };

  const removeResource = (id: string) =>
    put('courses', { ...course, resources: course.resources.filter((r) => r.id !== id) });

  const openNote = (id: string) => {
    setUI({ focus: { type: 'note', id } });
    router.push('/notes/');
  };

  const newNote = () => {
    const id = uid();
    put('notes', {
      id, title: '', courseId: course.id, lectureId: null, content: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    openNote(id);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* header */}
      <div>
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All courses
        </button>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: course.color }} />
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-20 blur-2xl"
            style={{ background: course.color }}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className="inline-block rounded-lg px-2 py-0.5 text-xs font-extrabold"
                style={{ background: hexToRgba(course.color, 0.15), color: course.color }}
              >
                {course.code}
              </span>
              <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{course.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.instructor || 'No instructor'} · {course.credits} credits{course.semester ? ` · ${course.semester}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => { setUI({ selectedCourseId: null }); router.push('/study/'); }}>
                <Play className="h-4 w-4" /> Study
              </Button>
              <Button variant="outline" onClick={() => setEditCourse(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </div>
          </div>

          {(course.email || course.phone || course.office || course.officeHours || course.schedule.length > 0) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(course.email || course.phone || course.office || course.officeHours) && (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Instructor contact</p>
                  <div className="space-y-1 text-sm">
                    {course.email && (
                      <a href={`mailto:${course.email}`} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
                        <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{course.email}</span>
                      </a>
                    )}
                    {course.phone && (
                      <a href={`tel:${course.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5 shrink-0" /> {course.phone}
                      </a>
                    )}
                    {course.office && (
                      <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /> {course.office}</p>
                    )}
                    {course.officeHours && (
                      <p className="flex items-start gap-1.5 text-muted-foreground"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{course.officeHours}</span></p>
                    )}
                  </div>
                </div>
              )}
              {course.schedule.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Weekly schedule</p>
                  <div className="space-y-1">
                    {course.schedule.map((m) => (
                      <p key={m.id} className="flex items-center gap-1.5 text-sm">
                        <span className="inline-flex h-5 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold" style={{ background: hexToRgba(course.color, 0.14), color: course.color }}>
                          {DAYS[m.day].short}
                        </span>
                        <span className="font-medium">{m.start}–{m.end}</span>
                        {m.location && <span className="truncate text-muted-foreground">· {m.location}</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Current grade" value={grade === null ? '—' : `${grade}%`} sub={grade === null ? 'no grades yet' : letterGrade(grade)} accent />
            <Stat label="Assignments" value={mine.assignments.length} sub={`${done} completed`} />
            <Stat label="Exams" value={mine.exams.length} />
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Progress</p>
              <p className="mt-1 font-display text-xl font-extrabold">{progress}%</p>
              <Progress value={progress} color={course.color} className="mt-2" />
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'assignments', label: `Assignments (${mine.assignments.length})` },
          { value: 'lectures', label: `Lectures (${mine.lectures.length})` },
          { value: 'exams', label: `Exams (${mine.exams.length})` },
          { value: 'notes', label: `Notes (${mine.notes.length})` },
          { value: 'resources', label: `Resources (${course.resources.length})` },
        ]}
      />

      {tab === 'assignments' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button onClick={() => setAddA(true)}><Plus className="h-4 w-4" /> Assignment</Button>
          </div>
          {mine.assignments.map((a) => (
            <AssignmentRow key={a.id} a={a} showCourse={false} onOpen={() => setOpenAId(a.id)} />
          ))}
          {mine.assignments.length === 0 && (
            <EmptyState title="No assignments yet" body="Track problem sets, essays and projects for this course." action={<Button onClick={() => setAddA(true)}><Plus className="h-4 w-4" /> Add assignment</Button>} />
          )}
        </div>
      )}

      {tab === 'lectures' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button onClick={() => setAddL(true)}><Plus className="h-4 w-4" /> Lecture</Button>
          </div>
          {mine.lectures.map((l) => (
            <div
              key={l.id}
              onClick={() => {
                setUI({ focus: { type: 'lecture', id: l.id } });
                router.push('/lectures/');
              }}
              className="cursor-pointer rounded-xl border border-border bg-card px-3.5 py-3 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{l.title}</p>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{fmtDate(l.date)}</span>
              </div>
              {l.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{l.summary}</p>}
              {l.attachments.length > 0 && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Paperclip className="h-3 w-3" /> {l.attachments.length} attachment{l.attachments.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          ))}
          {mine.lectures.length === 0 && (
            <EmptyState title="No lectures yet" body="Log lectures with summaries, rich notes and attached slides." action={<Button onClick={() => setAddL(true)}><Plus className="h-4 w-4" /> Add lecture</Button>} />
          )}
        </div>
      )}

      {tab === 'exams' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setAddE(true)}><Plus className="h-4 w-4" /> Exam</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.exams.map((e) => (
              <ExamCard key={e.id} exam={e} onOpen={() => setEditE(e)} />
            ))}
          </div>
          {mine.exams.length === 0 && (
            <EmptyState title="No exams yet" body="Add midterms and finals with their weight to power grade projections." action={<Button onClick={() => setAddE(true)}><Plus className="h-4 w-4" /> Add exam</Button>} />
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button onClick={newNote}><Plus className="h-4 w-4" /> Note</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {mine.notes.map((n) => (
              <button
                key={n.id}
                onClick={() => openNote(n.id)}
                className="rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
              >
                <p className="truncate text-sm font-semibold">{n.title || 'Untitled note'}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.content.replace(/[#*`>|[\]$-]/g, ' ').trim() || 'Empty note'}</p>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground/70">Updated {fmtDate(n.updatedAt)}</p>
              </button>
            ))}
          </div>
          {mine.notes.length === 0 && (
            <EmptyState title="No notes yet" body="Capture ideas, summaries and cheat-sheets linked to this course." action={<Button onClick={newNote}><Plus className="h-4 w-4" /> New note</Button>} />
          )}
        </div>
      )}

      {tab === 'resources' && (
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-sm font-bold">Add a resource</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Title (optional)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="sm:max-w-[200px]" />
              <Input placeholder="https://… link to syllabus, slides, textbook" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <div className="flex gap-2">
                <Button type="button" onClick={addLink} disabled={!linkUrl.trim()}><Link2 className="h-4 w-4" /> Add link</Button>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Upload file</Button>
              </div>
              <input
                ref={fileRef} type="file" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addFile(f);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Files are stored on this device (max 4 MB each) and work fully offline.</p>
          </Card>
          <div className="space-y-2">
            {course.resources.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.kind === 'link' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success')}>
                  {r.kind === 'link' ? <Link2 className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</p>
                <Badge className="hidden bg-muted text-muted-foreground sm:inline-flex">{r.kind}</Badge>
                {r.kind === 'link' && r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open link">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {r.kind === 'file' && r.dataUrl && (
                  <a href={r.dataUrl} download={r.title} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Download file">
                    <FileDown className="h-4 w-4" />
                  </a>
                )}
                <button onClick={() => removeResource(r.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove resource">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {course.resources.length === 0 && (
              <EmptyState title="No resources yet" body="Keep the syllabus, slide decks and useful links one tap away." />
            )}
          </div>
        </div>
      )}

      {/* dialogs */}
      {openA && <AssignmentDetail assignment={openA} onClose={() => setOpenAId(null)} />}
      <CourseForm open={editCourse} onClose={() => setEditCourse(false)} course={course} />
      <AssignmentForm open={addA || !!editA} onClose={() => { setAddA(false); setEditA(null); }} assignment={editA} defaultCourseId={course.id} />
      <ExamForm open={addE || !!editE} onClose={() => { setAddE(false); setEditE(null); }} exam={editE} defaultCourseId={course.id} />
      <LectureForm
        open={addL || !!editL}
        onClose={() => { setAddL(false); setEditL(null); }}
        lecture={editL}
        defaultCourseId={course.id}
        onCreated={(id) => {
          setUI({ focus: { type: 'lecture', id } });
          router.push('/lectures/');
        }}
      />
    </div>
  );
}
