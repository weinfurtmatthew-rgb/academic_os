'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Flashcard } from '@/lib/types';
import { cn, fmtDate, uid } from '@/lib/utils';
import { GRADES, gradeCard, isDue, isLearned, type ReviewGrade } from '@/lib/srs';
import { Button, Card, Dialog, EmptyState, FormRow, Select, Stat, Textarea } from '@/components/ui';
import { Markdown } from '@/components/markdown';

export default function FlashcardsPage() {
  const { flashcards, courses, put, remove } = useStore((s) => ({
    flashcards: s.flashcards, courses: s.courses, put: s.put, remove: s.remove,
  }));
  const [fCourse, setFCourse] = useState('all');
  const [edit, setEdit] = useState<Flashcard | null>(null);
  const [add, setAdd] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const filtered = useMemo(
    () => flashcards.filter((f) => fCourse === 'all' || f.courseId === fCourse),
    [flashcards, fCourse],
  );

  const due = useMemo(
    () => filtered.filter((f) => isDue(f)).sort((a, b) => a.due.localeCompare(b.due)),
    [filtered],
  );
  const current = due[0] ?? null;

  useEffect(() => setFlipped(false), [current?.id]);
  useEffect(() => setReviewed(0), [fCourse]);

  const grade = (g: ReviewGrade) => {
    if (!current) return;
    put('flashcards', gradeCard(current, g));
    setReviewed((r) => r + 1);
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        grade(GRADES[Number(e.key) - 1].value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, flipped]);

  const courseOf = (id: string | null) => courses.find((c) => c.id === id);
  const learned = filtered.filter(isLearned).length;
  const sortedAll = [...filtered].sort((a, b) => a.due.localeCompare(b.due));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Flashcards</h1>
          <p className="text-sm text-muted-foreground">spaced repetition — review what’s due, daily</p>
        </div>
        <div className="flex gap-2">
          <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} className="h-9 w-36 text-xs">
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </Select>
          <Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Card</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Due now" value={due.length} sub={reviewed > 0 ? `${reviewed} reviewed today` : 'tap a grade to schedule'} accent />
        <Stat label="Total cards" value={filtered.length} />
        <Stat label="Learned" value={learned} sub="2-week+ intervals" />
      </div>

      {current ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              Review · {due.length} due
            </p>
            {courseOf(current.courseId) && (
              <span className="text-xs font-extrabold" style={{ color: courseOf(current.courseId)!.color }}>
                {courseOf(current.courseId)!.code}
              </span>
            )}
          </div>

          <button
            onClick={() => setFlipped((f) => !f)}
            className="block w-full px-5 py-8 text-left transition-colors hover:bg-muted/20 sm:px-8"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Front</p>
            <div className="md mt-1.5 text-base"><Markdown content={current.front} /></div>
            {flipped && (
              <div className="mt-5 border-t border-dashed border-border pt-4 animate-fade-in">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Back</p>
                <div className="md mt-1.5 text-base"><Markdown content={current.back} /></div>
              </div>
            )}
            {!flipped && (
              <p className="mt-6 text-center text-xs font-semibold text-muted-foreground/70">
                tap to reveal · <kbd className="rounded border border-border bg-muted px-1">space</kbd>
              </p>
            )}
          </button>

          {flipped && (
            <div className="grid grid-cols-4 gap-2 border-t border-border bg-muted/30 p-3">
              {GRADES.map((g, i) => (
                <button
                  key={g.value}
                  onClick={() => grade(g.value)}
                  className={cn(
                    'flex flex-col items-center rounded-xl border py-2.5 text-sm font-extrabold transition-all hover:-translate-y-0.5',
                    i === 0 && 'border-destructive/40 bg-destructive/8 text-destructive',
                    i === 1 && 'border-orange-400/40 bg-orange-500/8 text-orange-500',
                    i === 2 && 'border-primary/40 bg-primary/8 text-primary',
                    i === 3 && 'border-success/40 bg-success/8 text-success',
                  )}
                >
                  {g.label}
                  <span className="text-[10px] font-semibold opacity-70">{g.hint(current)} · {g.key}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <Layers className="mx-auto h-9 w-9 text-success" />
          <p className="mt-2 font-display text-lg font-extrabold">
            {filtered.length === 0 ? 'No cards yet' : 'All caught up! 🎉'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {filtered.length === 0
              ? 'Turn key facts, formulas and definitions into cards — math and markdown work on both sides.'
              : reviewed > 0
                ? `Nice — ${reviewed} card${reviewed === 1 ? '' : 's'} reviewed. Come back when the next batch is due.`
                : 'Nothing due right now. New and lapsed cards appear here automatically.'}
          </p>
          {filtered.length === 0 && (
            <Button className="mt-4" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> First card</Button>
          )}
        </Card>
      )}

      {sortedAll.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">All cards · {sortedAll.length}</h2>
          <div className="space-y-1.5">
            {sortedAll.map((f) => {
              const c = courseOf(f.courseId);
              const dueNow = isDue(f);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: c?.color ?? 'hsl(var(--muted-foreground))' }} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{f.front.replace(/[#*`$\\]/g, '')}</p>
                  <span className={cn('hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold sm:inline-flex', dueNow ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {dueNow ? 'due now' : `due ${fmtDate(f.due)}`}
                  </span>
                  <button onClick={() => setEdit(f)} aria-label="Edit card" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove('flashcards', f.id)} aria-label="Delete card" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <CardForm
        open={add || !!edit}
        onClose={() => { setAdd(false); setEdit(null); }}
        card={edit}
        defaultCourseId={fCourse !== 'all' ? fCourse : undefined}
      />
    </div>
  );
}

/* --------------------------------- card form -------------------------------- */

function CardForm({
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
