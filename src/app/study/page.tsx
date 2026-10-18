'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock, Coffee, FileText, Flame, Highlighter, Layers, Maximize2,
  Pause, Play, Plus, Square, Timer,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { StudySession } from '@/lib/types';
import { cn, daysUntil, fmtTime, hexToRgba, isSameDay, isTurnedIn, relDue, studyStreak, uid } from '@/lib/utils';
import { isDue } from '@/lib/srs';
import { Button, Card, Dialog, EmptyState, Input, Progress, Select, Stat } from '@/components/ui';
import { SessionRow } from '@/components/shared';
import { SessionForm } from '@/components/forms';
import { MarkdownEditor } from '@/components/editor';
import { MusicPlayer } from '@/components/youtube-player';
import { PdfAnnotator, type AnnotatableFile } from '@/components/pdf-annotator';

const ACTIVE_KEY = 'academic-os-active-study';

interface ActiveStudy {
  sessionId: string;
  startedAt: number;
  pausedAccum: number;
  pausedAt: number | null;
}

function loadActive(): ActiveStudy | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveStudy) : null;
  } catch {
    return null;
  }
}

function saveActive(a: ActiveStudy | null) {
  try {
    if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
}

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
};

const MOODS = ['😴', '😐', '🙂', '😄', '🤩'];

export default function StudyPage() {
  const router = useRouter();
  const {
    sessions, courses, notes, lectures, assignments, flashcards, put, ui, setUI,
  } = useStore((s) => ({
    sessions: s.sessions, courses: s.courses, notes: s.notes, lectures: s.lectures,
    assignments: s.assignments, flashcards: s.flashcards, put: s.put, ui: s.ui, setUI: s.setUI,
  }));

  const [active, setActive] = useState<ActiveStudy | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [noteId, setNoteId] = useState<string>('');
  const [endOpen, setEndOpen] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [plan, setPlan] = useState(false);
  const [annotate, setAnnotate] = useState<AnnotatableFile | null>(null);
  const [justFinished, setJustFinished] = useState<{ minutes: number; streak: number } | null>(null);
  const restored = useRef(false);

  const start = useCallback((s: StudySession) => {
    const a: ActiveStudy = { sessionId: s.id, startedAt: Date.now(), pausedAccum: 0, pausedAt: null };
    saveActive(a);
    setActive(a);
    setNow(Date.now());
    setMood(null);
    setJustFinished(null);
    const courseNotes = notes.filter((n) => n.courseId === s.courseId);
    setNoteId(courseNotes[0]?.id ?? '');
  }, [notes]);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const a = loadActive();
    if (a && sessions.some((s) => s.id === a.sessionId)) setActive(a);
    else if (a) saveActive(null);
  }, [sessions]);

  useEffect(() => {
    if (ui.focus?.type === 'session') {
      const s = sessions.find((x) => x.id === ui.focus!.id);
      if (s) start(s);
      setUI({ focus: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.focus, sessions]);

  useEffect(() => {
    if (!active || active.pausedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const session = useMemo(() => sessions.find((s) => s.id === active?.sessionId) ?? null, [sessions, active]);
  const course = courses.find((c) => c.id === session?.courseId);

  const elapsedMs = active ? (active.pausedAt ?? now) - active.startedAt - active.pausedAccum : 0;
  const plannedMs = (session?.durationMin ?? 0) * 60 * 1000;
  const pct = plannedMs > 0 ? Math.min(100, (elapsedMs / plannedMs) * 100) : 0;
  const paused = !!active?.pausedAt;

  const togglePause = () => {
    if (!active) return;
    const next: ActiveStudy = active.pausedAt
      ? { ...active, pausedAccum: active.pausedAccum + (Date.now() - active.pausedAt), pausedAt: null }
      : { ...active, pausedAt: Date.now() };
    saveActive(next);
    setActive(next);
    setNow(Date.now());
  };

  const finish = (save: boolean) => {
    if (!active || !session) return;
    if (save) {
      const minutes = Math.max(1, Math.round(elapsedMs / 60000));
      put('sessions', { ...session, done: true, durationMin: minutes, mood });
      setJustFinished({ minutes, streak: studyStreak([...sessions.filter((s) => s.id !== session.id), { ...session, done: true }]) });
    }
    saveActive(null);
    setActive(null);
    setEndOpen(false);
  };

  const note = notes.find((n) => n.id === noteId) ?? null;

  const related = useMemo(() => {
    if (!session) return { pdfs: [] as AnnotatableFile[], due: [] as typeof assignments, cards: 0 };
    const pdfs: AnnotatableFile[] = [];
    for (const l of lectures.filter((x) => x.courseId === session.courseId)) {
      for (const a of l.attachments) {
        if (a.type === 'application/pdf') pdfs.push({ id: a.id, name: a.name, dataUrl: a.dataUrl });
      }
    }
    const c = courses.find((x) => x.id === session.courseId);
    for (const r of c?.resources ?? []) {
      if (r.kind === 'file' && r.dataUrl?.startsWith('data:application/pdf')) {
        pdfs.push({ id: r.id, name: r.title, dataUrl: r.dataUrl });
      }
    }
    const due = assignments
      .filter((a) => a.courseId === session.courseId && !isTurnedIn(a))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    const cards = flashcards.filter((f) => f.courseId === session.courseId && isDue(f)).length;
    return { pdfs: pdfs.slice(0, 5), due, cards };
  }, [session, lectures, courses, assignments, flashcards]);

  /* ============================== PICKER VIEW ============================== */
  if (!active || !session) {
    const today = sessions.filter((s) => isSameDay(s.date, new Date()) && !s.done).sort((a, b) => a.date.localeCompare(b.date));
    const upNext = sessions.filter((s) => !s.done && !isSameDay(s.date, new Date()) && s.date > new Date().toISOString()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

    return (
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Study</h1>
          <p className="text-sm text-muted-foreground">pick a session, hit start, get to work</p>
        </div>

        {justFinished && (
          <Card className="border-success/40 bg-success/5 p-4">
            <p className="font-display text-lg font-extrabold">Session complete — {justFinished.minutes} min logged ✅</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-500" /> {justFinished.streak}-day study streak. Stats updated in Planner &amp; Analytics.
            </p>
          </Card>
        )}

        <QuickStart onStart={start} />

        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Today’s planned sessions</h2>
          <div className="space-y-2">
            {today.map((s) => (
              <SessionRow key={s.id} s={s} onOpen={() => start(s)} />
            ))}
            {today.length === 0 && (
              <EmptyState
                title="Nothing planned for today"
                body="Quick-start above, or plan ahead in the Study Planner."
                action={<Button variant="outline" onClick={() => setPlan(true)}><Plus className="h-4 w-4" /> Plan a session</Button>}
              />
            )}
          </div>
        </section>

        {upNext.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Coming up</h2>
            <div className="space-y-2">
              {upNext.map((s) => (
                <SessionRow key={s.id} s={s} onOpen={() => start(s)} />
              ))}
            </div>
          </section>
        )}

        <SessionForm open={plan} onClose={() => setPlan(false)} />
      </div>
    );
  }

  /* ============================== ACTIVE VIEW ============================== */
  const courseNotes = notes
    .filter((n) => n.courseId === session.courseId || n.courseId === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="relative overflow-hidden p-4">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: course?.color ?? 'hsl(var(--primary))' }} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {course && (
              <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-extrabold" style={{ background: hexToRgba(course.color, 0.14), color: course.color }}>
                {course.code}
              </span>
            )}
            <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight sm:text-2xl">{session.topic}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              planned {session.durationMin} min · started {fmtTime(new Date(active.startedAt).toISOString())}
              {paused && <span className="ml-1.5 font-bold text-orange-500">· on break</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={togglePause}>
              {paused ? <Play className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
              {paused ? 'Resume' : 'Break'}
            </Button>
            <Button
              variant="outline" size="sm" aria-label="Fullscreen"
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen().catch(() => {});
              }}
            >
              <Maximize2 className="h-4 w-4" /> Focus
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setEndOpen(true)}>
              <Square className="h-4 w-4" /> End session
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={pct} color={course?.color} className="flex-1" />
          <span className="text-xs font-bold text-muted-foreground">{Math.round(pct)}%</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr,330px]">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold">
              <FileText className="h-4 w-4 text-primary" /> Notes
            </p>
            <Select value={noteId} onChange={(e) => setNoteId(e.target.value)} className="h-8 !w-auto min-w-[170px] text-xs">
              <option value="">— pick a note —</option>
              {courseNotes.map((n) => (
                <option key={n.id} value={n.id}>{n.title || 'Untitled note'}</option>
              ))}
            </Select>
            <Button
              variant="outline" size="sm"
              onClick={() => {
                const id = uid();
                put('notes', {
                  id, title: session.topic, courseId: session.courseId, lectureId: null, content: '',
                  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                });
                setNoteId(id);
              }}
            >
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
          {note ? (
            <MarkdownEditor
              value={note.content}
              onChange={(v) => put('notes', { ...note, content: v })}
              minRows={16}
              placeholder={'Work through the material…\n\n# Heading, - [ ] checklist, $math$, ```code```, [[links]]'}
            />
          ) : (
            <EmptyState title="No note selected" body="Pick a note above or create a fresh one for this session." />
          )}
        </Card>

        <div className="space-y-4">
          <Card className={cn('p-5 text-center', paused && 'opacity-80')}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{paused ? 'On break' : 'Studying'}</p>
            <p className={cn('mt-1 font-display text-5xl font-extrabold tabular-nums tracking-tight', paused ? 'text-orange-500' : 'text-primary')}>
              {fmtClock(elapsedMs)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">of {session.durationMin} min planned</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={togglePause}>
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
            </div>
          </Card>

          <MusicPlayer />

          <Card className="p-3.5">
            <p className="text-sm font-bold">Energy check</p>
            <div className="mt-2 flex justify-between">
              {MOODS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setMood(i + 1)}
                  aria-label={`mood ${i + 1}`}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all hover:scale-110',
                    mood === i + 1 ? 'bg-highlighter/40 ring-2 ring-highlighter' : 'hover:bg-muted',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Saved with the session when you finish.</p>
          </Card>

          <Card className="p-3.5">
            <p className="text-sm font-bold">Related materials</p>
            <div className="mt-2 space-y-1.5">
              {related.pdfs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAnnotate(p)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-left text-xs font-semibold transition-colors hover:border-primary/40"
                >
                  <Highlighter className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] font-bold uppercase text-muted-foreground">annotate</span>
                </button>
              ))}
              {related.due.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-semibold">{a.title}</span>
                  <span className={cn('ml-auto shrink-0 font-bold', daysUntil(a.dueDate) <= 1 ? 'text-destructive' : 'text-muted-foreground')}>
                    {relDue(a.dueDate)}
                  </span>
                </div>
              ))}
              <button
                onClick={() => router.push('/flashcards/')}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-left text-xs font-semibold transition-colors hover:border-primary/40"
              >
                <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
                Flashcards
                <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                  {related.cards} due
                </span>
              </button>
              {related.pdfs.length + related.due.length === 0 && (
                <p className="px-1 py-1 text-[11px] text-muted-foreground">Lecture PDFs and open assignments for {course?.code ?? 'this course'} show up here.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={endOpen} onClose={() => setEndOpen(false)} title="End study session?">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Time studied" value={fmtClock(elapsedMs)} accent />
            <Stat label="Planned" value={`${session.durationMin} min`} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-muted-foreground">How was your focus?</p>
            <div className="flex justify-between">
              {MOODS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setMood(i + 1)}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all hover:scale-110',
                    mood === i + 1 ? 'bg-highlighter/40 ring-2 ring-highlighter' : 'hover:bg-muted',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => finish(false)} className="text-muted-foreground">Discard</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEndOpen(false)}>Keep going</Button>
              <Button onClick={() => finish(true)}><Timer className="h-4 w-4" /> Save &amp; finish</Button>
            </div>
          </div>
        </div>
      </Dialog>

      {annotate && <PdfAnnotator file={annotate} onClose={() => setAnnotate(null)} />}
    </div>
  );
}

/* ------------------------------- quick start ------------------------------- */

function QuickStart({ onStart }: { onStart: (s: StudySession) => void }) {
  const courses = useStore((s) => s.courses);
  const put = useStore((s) => s.put);
  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(50);

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !courseId) return;
    const s: StudySession = {
      id: uid(), courseId, topic: topic.trim(), date: new Date().toISOString(),
      durationMin: minutes, notes: '', done: false, mood: null,
    };
    put('sessions', s);
    setTopic('');
    onStart(s);
  };

  return (
    <Card className="relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
      <p className="font-display text-base font-extrabold">Quick start</p>
      <form onSubmit={go} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="h-10 sm:!w-44">
          {courses.length === 0 && <option value="">— add a course first —</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </Select>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What are you studying?" className="h-10 flex-1" />
        <Select value={String(minutes)} onChange={(e) => setMinutes(Number(e.target.value))} className="h-10 sm:!w-28">
          {[25, 50, 60, 90, 120].map((m) => (
            <option key={m} value={m}>{m} min</option>
          ))}
        </Select>
        <Button type="submit" disabled={!topic.trim() || !courseId} className="h-10">
          <Play className="h-4 w-4" /> Start
        </Button>
      </form>
    </Card>
  );
}
