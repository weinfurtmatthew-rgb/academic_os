'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CalendarClock, Check, CheckCircle2, Clock, ExternalLink, FileDown, FileText,
  Flag, GraduationCap, Hourglass, LinkIcon, Paperclip, Pencil, Trash2, Upload, X,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { ASSIGNMENT_STATUSES, type Assignment, type AssignmentStatus, type Attachment } from '@/lib/types';
import { cn, fmtDate, fmtTime, hexToRgba, isOverdue, isTurnedIn, letterGrade, readFileAsDataURL, relDue, uid } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import { PriorityBadge } from '@/components/shared';
import { AssignmentForm } from '@/components/forms';
import { PdfAnnotator, type AnnotatableFile } from '@/components/pdf-annotator';

/** Full-screen detail view for a single assignment. */
export function AssignmentDetail({
  assignment: a,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const { courses, put, remove } = useStore((s) => ({ courses: s.courses, put: s.put, remove: s.remove }));
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [annotate, setAnnotate] = useState<AnnotatableFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const course = courses.find((c) => c.id === a.courseId);
  const accent = course?.color ?? 'hsl(var(--primary))';
  const overdue = isOverdue(a);
  const done = a.status === 'completed';
  const submitted = a.status === 'submitted';

  // Escape backs out of a pending delete, then closes; nested dialogs handle their own Escape.
  useEffect(() => {
    if (edit || annotate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmDel) setConfirmDel(false);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [edit, annotate, confirmDel, onClose]);

  const setStatus = (status: AssignmentStatus) => put('assignments', { ...a, status });

  const addFiles = async (files: FileList) => {
    setUploading(true);
    const next: Attachment[] = [...a.attachments];
    for (const file of Array.from(files)) {
      if (file.size > 4 * 1024 * 1024) {
        alert(`"${file.name}" is over 4 MB. Store larger files elsewhere and link to them instead.`);
        continue;
      }
      next.push({ id: uid(), name: file.name, type: file.type, dataUrl: await readFileAsDataURL(file) });
    }
    put('assignments', { ...a, attachments: next });
    setUploading(false);
  };

  const removeAttachment = (id: string) =>
    put('assignments', { ...a, attachments: a.attachments.filter((x) => x.id !== id) });

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in">
      {/* ------------------------------- top bar ------------------------------- */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2.5 sm:px-5">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close assignment">
          <X className="h-5 w-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{a.title}</p>
        <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
          <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span>
        </Button>
        <Button
          variant={confirmDel ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => {
            if (confirmDel) {
              remove('assignments', a.id);
              onClose();
            } else setConfirmDel(true);
          }}
          className={cn(!confirmDel && 'text-destructive hover:bg-destructive/10')}
        >
          <Trash2 className="h-4 w-4" /> {confirmDel && 'Confirm'}
        </Button>
      </div>

      {/* -------------------------------- body --------------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-7">
          {/* header */}
          <div>
            {course && (
              <span
                className="inline-block rounded-lg px-2 py-0.5 text-xs font-extrabold"
                style={{ background: hexToRgba(course.color, 0.14), color: course.color }}
              >
                {course.code} · {course.name}
              </span>
            )}
            <h1 className={cn('mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl', done && 'text-muted-foreground line-through')}>
              {a.title}
            </h1>
            <p className={cn('mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold', overdue ? 'text-destructive' : 'text-muted-foreground')}>
              <CalendarClock className="h-4 w-4" />
              Due {fmtDate(a.dueDate)} at {fmtTime(a.dueDate)}{!isTurnedIn(a) && ` · ${relDue(a.dueDate)}`}
            </p>
          </div>

          {/* status switcher */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ASSIGNMENT_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-extrabold transition-colors',
                  a.status === s.value
                    ? 'border-transparent text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
                style={a.status === s.value ? { background: accent, borderColor: accent } : undefined}
              >
                {a.status === s.value && <Check className="h-3.5 w-3.5" />}
                {s.label}
              </button>
            ))}
          </div>

          {/* quick facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={Flag} label="Priority" value={<PriorityBadge priority={a.priority} />} />
            <Fact icon={Hourglass} label="Estimated" value={`${a.estimatedHours} h`} />
            <Fact
              icon={Clock}
              label={done ? 'Completed' : submitted ? 'Submitted' : 'Time left'}
              value={
                done ? (a.completedAt ? fmtDate(a.completedAt) : '—')
                : submitted ? (a.grade === null ? 'Awaiting grade' : 'Graded')
                : overdue ? 'Overdue' : relDue(a.dueDate)
              }
              tone={overdue ? 'danger' : undefined}
            />
            <Fact
              icon={GraduationCap}
              label="Grade"
              value={a.grade === null ? '—' : `${a.grade}% · ${letterGrade(a.grade)}`}
              tone={a.grade !== null ? 'good' : undefined}
            />
          </div>

          {/* ---------------------------- turning it in --------------------------- */}
          <Panel title="Turning it in" icon={Upload}>
            {a.submissionUrl ? (
              <a
                href={a.submissionUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-colors"
                style={{ borderColor: hexToRgba(accent, 0.35), background: hexToRgba(accent, 0.06) }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: accent, color: '#fff' }}>
                  <LinkIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold">Open submission page</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.submissionUrl}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </a>
            ) : (
              <InlineLinkAdder onSave={(url) => put('assignments', { ...a, submissionUrl: url })} />
            )}

            {a.submissionNotes ? (
              <div className="mt-2.5 rounded-xl bg-highlighter/15 px-3.5 py-2.5">
                <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Instructions</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.submissionNotes}</p>
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-muted-foreground">
                No submission instructions yet — add them under Edit (file format, naming, what to include).
              </p>
            )}

            {a.submissionUrl && !isTurnedIn(a) && (
              <Button
                className="mt-3 w-full sm:w-auto"
                onClick={() => put('assignments', { ...a, status: 'submitted' })}
                variant="outline"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark as submitted
              </Button>
            )}
          </Panel>

          {/* ------------------------------ description --------------------------- */}
          <Panel title="Details" icon={FileText}>
            {a.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description yet.</p>
            )}
          </Panel>

          {/* ------------------------------ attachments --------------------------- */}
          <Panel
            title={`Files (${a.attachments.length})`}
            icon={Paperclip}
            action={
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Paperclip className="h-4 w-4" /> {uploading ? 'Adding…' : 'Add file'}
              </Button>
            }
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {a.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Attach your draft, rubric, or the finished file so everything lives with the assignment. Stored on this
                device, up to 4 MB each.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {a.attachments.map((f) => {
                  const isPdf = f.type === 'application/pdf';
                  const isImg = f.type.startsWith('image/');
                  return (
                    <div key={f.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-2">
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.dataUrl} alt={f.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{f.name}</p>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {f.type.split('/')[1]?.slice(0, 12) || 'file'}
                        </p>
                      </div>
                      {isPdf && (
                        <button
                          onClick={() => setAnnotate({ id: f.id, name: f.name, dataUrl: f.dataUrl })}
                          aria-label="Annotate PDF"
                          title="Annotate"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <a
                        href={f.dataUrl}
                        download={f.name}
                        aria-label="Download"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => removeAttachment(f.id)}
                        aria-label="Remove file"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <AssignmentForm open={edit} onClose={() => setEdit(false)} assignment={a} />
      {annotate && <PdfAnnotator file={annotate} onClose={() => setAnnotate(null)} />}
    </div>
  );
}

/* -------------------------------- helpers --------------------------------- */

function Fact({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Flag; label: string; value: React.ReactNode; tone?: 'danger' | 'good';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div
        className={cn(
          'mt-1 font-display text-sm font-extrabold',
          tone === 'danger' && 'text-destructive',
          tone === 'good' && 'text-success',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title, icon: Icon, action, children,
}: {
  title: string; icon: typeof Flag; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Lets you paste a submission link without opening the edit dialog. */
function InlineLinkAdder({ onSave }: { onSave: (url: string) => void }) {
  const [val, setVal] = useState('');
  const save = () => {
    const v = val.trim();
    if (!v) return;
    onSave(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    setVal('');
  };
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        Add the link where you turn this in, so it’s one tap away when you’re ready to submit.
      </p>
      <div className="flex gap-2">
        <Input
          type="url"
          inputMode="url"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Paste Canvas / Gradescope link"
        />
        <Button onClick={save} disabled={!val.trim()}>
          <LinkIcon className="h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}
