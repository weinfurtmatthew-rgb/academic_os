'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Note } from '@/lib/types';
import { cn, fmtDate, uid } from '@/lib/utils';
import { Button, EmptyState, Input, PageHeader, Select, Tabs } from '@/components/ui';
import { MarkdownEditor } from '@/components/editor';

type Scope = 'all' | 'course' | 'lecture';

export default function NotesPage() {
  const { notes, courses, lectures, put, remove, ui, setUI } = useStore((s) => ({
    notes: s.notes, courses: s.courses, lectures: s.lectures,
    put: s.put, remove: s.remove, ui: s.ui, setUI: s.setUI,
  }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [q, setQ] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (ui.focus?.type === 'note') {
      setOpenId(ui.focus.id);
      setUI({ focus: null });
    }
  }, [ui.focus, setUI]);

  useEffect(() => setConfirmDel(false), [openId]);

  const open = notes.find((n) => n.id === openId) ?? null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (scope === 'course' && !n.courseId) return false;
        if (scope === 'lecture' && !n.lectureId) return false;
        if (needle && !(`${n.title} ${n.content}`.toLowerCase().includes(needle))) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, scope, q]);

  const newNote = () => {
    const id = uid();
    put('notes', {
      id, title: '', courseId: null, lectureId: null, content: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setOpenId(id);
  };

  const preview = (n: Note) => n.content.replace(/[#*`>|[\]$_-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Empty note';

  const ListPane = (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="pl-9" />
        </div>
        <Button onClick={newNote} aria-label="New note"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New</span></Button>
      </div>
      <Tabs
        value={scope}
        onChange={setScope}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'course', label: 'Course' },
          { value: 'lecture', label: 'Lecture' },
        ]}
      />
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2 pr-0.5">
        {filtered.map((n) => {
          const course = courses.find((c) => c.id === n.courseId);
          return (
            <button
              key={n.id}
              onClick={() => setOpenId(n.id)}
              className={cn(
                'w-full rounded-xl border px-3.5 py-2.5 text-left transition-all',
                openId === n.id
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-card hover:-translate-y-px hover:border-primary/30 hover:shadow-sm',
              )}
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{n.title || 'Untitled note'}</p>
                {course && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: course.color }} />}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{preview(n)}</p>
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground/70">
                {course ? `${course.code} · ` : ''}{n.lectureId ? 'lecture · ' : ''}{fmtDate(n.updatedAt)}
              </p>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState
            title={notes.length === 0 ? 'No notes yet' : 'No matching notes'}
            body={notes.length === 0 ? 'Capture summaries, cheat-sheets and ideas with rich formatting, math and tables.' : 'Try a different search or filter.'}
            action={notes.length === 0 ? <Button onClick={newNote}><Plus className="h-4 w-4" /> First note</Button> : undefined}
          />
        )}
      </div>
    </div>
  );

  const EditorPane = open ? (
    <div className="flex h-full flex-col gap-3">
      <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft className="h-4 w-4" /> All notes
      </button>
      <input
        value={open.title}
        onChange={(e) => put('notes', { ...open, title: e.target.value })}
        placeholder="Untitled note"
        className="w-full bg-transparent font-display text-2xl font-extrabold tracking-tight outline-none placeholder:text-muted-foreground/40"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={open.courseId ?? ''}
          onChange={(e) => put('notes', { ...open, courseId: e.target.value || null, lectureId: null })}
          className="h-8 !w-auto min-w-[130px] text-xs"
        >
          <option value="">No course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </Select>
        <Select
          value={open.lectureId ?? ''}
          onChange={(e) => put('notes', { ...open, lectureId: e.target.value || null })}
          className="h-8 !w-auto min-w-[140px] text-xs"
          disabled={!open.courseId}
        >
          <option value="">No lecture</option>
          {lectures.filter((l) => l.courseId === open.courseId).map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </Select>
        <span className="ml-auto text-[11px] font-medium text-muted-foreground">Saved {fmtDate(open.updatedAt)} · autosaves</span>
        <Button
          variant={confirmDel ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => {
            if (confirmDel) {
              remove('notes', open.id);
              setOpenId(null);
            } else setConfirmDel(true);
          }}
          className={cn(!confirmDel && 'text-destructive hover:bg-destructive/10')}
        >
          <Trash2 className="h-4 w-4" /> {confirmDel ? 'Confirm' : ''}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          value={open.content}
          onChange={(v) => put('notes', { ...open, content: v })}
          minRows={16}
          placeholder={'Start writing…\n\n# Heading\n- [ ] checklist\n| tables | work |\n$\\int x\\,dx$ math, ```code``` and [[Internal links]]'}
        />
      </div>
    </div>
  ) : (
    <div className="hidden h-full items-center justify-center lg:flex">
      <div className="text-center text-muted-foreground">
        <FileText className="mx-auto h-10 w-10 opacity-30" />
        <p className="mt-3 text-sm font-medium">Select a note or create a new one</p>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in lg:h-[calc(100dvh-7rem)]">
      <div className="mb-3 lg:hidden">
        {!open && <PageHeader title="Notes" />}
      </div>
      {/* mobile: one pane at a time; desktop: split */}
      <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[320px,minmax(0,1fr)]">
        <div className={cn('h-full min-h-0', open && 'hidden lg:block')}>{ListPane}</div>
        <div className={cn('h-full min-h-0', !open && 'hidden lg:block')}>{EditorPane}</div>
      </div>
    </div>
  );
}
