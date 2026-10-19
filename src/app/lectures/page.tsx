'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileDown, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Attachment, Lecture } from '@/lib/types';
import { fmtDate, fmtTime, hexToRgba, readFileAsDataURL, uid } from '@/lib/utils';
import { Button, Card, EmptyState, PageHeader, Select } from '@/components/ui';
import { LectureForm } from '@/components/forms';
import { MarkdownEditor } from '@/components/editor';

export default function LecturesPage() {
  const { lectures, courses, put, ui, setUI } = useStore((s) => ({
    lectures: s.lectures, courses: s.courses, put: s.put, ui: s.ui, setUI: s.setUI,
  }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [fCourse, setFCourse] = useState('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // arrive from search / quick-create
  useEffect(() => {
    if (ui.focus?.type === 'lecture') {
      setOpenId(ui.focus.id);
      setUI({ focus: null });
    }
  }, [ui.focus, setUI]);

  const open = lectures.find((l) => l.id === openId) ?? null;

  const grouped = useMemo(() => {
    const list = lectures
      .filter((l) => fCourse === 'all' || l.courseId === fCourse)
      .sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Lecture[]>();
    for (const l of list) {
      const key = new Date(l.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return Array.from(map.entries());
  }, [lectures, fCourse]);

  /* ------------------------------ detail view ------------------------------ */

  if (open) {
    const course = courses.find((c) => c.id === open.courseId);

    const attach = async (file: File) => {
      if (file.size > 4 * 1024 * 1024) {
        alert('Attachments up to 4 MB are stored offline. Try a smaller file.');
        return;
      }
      const a: Attachment = { id: uid(), name: file.name, type: file.type, dataUrl: await readFileAsDataURL(file) };
      put('lectures', { ...open, attachments: [...open.attachments, a] });
    };

    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All lectures
        </button>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {course && (
                <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-extrabold" style={{ background: hexToRgba(course.color, 0.14), color: course.color }}>
                  {course.code}
                </span>
              )}
              <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight sm:text-2xl">{open.title}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{fmtDate(open.date)} · {fmtTime(open.date)}</p>
            </div>
            <Button variant="outline" onClick={() => setEditMeta(true)}><Pencil className="h-4 w-4" /> Details</Button>
          </div>
          {open.summary && (
            <p className="mt-3 rounded-xl bg-highlighter/15 px-3.5 py-2.5 text-sm leading-relaxed">{open.summary}</p>
          )}
        </Card>

        {/* attachments */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Attachments <span className="text-muted-foreground">({open.attachments.length})</span></p>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4" /> Add image / PDF
            </Button>
            <input
              ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = '';
              }}
            />
          </div>
          {open.attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {open.attachments.map((a) => (
                <div key={a.id} className="group relative overflow-hidden rounded-xl border border-border bg-muted/40">
                  {a.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.dataUrl} alt={a.name} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Paperclip className="h-6 w-6" />
                      <span className="text-[10px] font-bold uppercase">{a.type.split('/')[1] || 'file'}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 border-t border-border bg-card px-2 py-1.5">
                    <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">{a.name}</p>
                    <a href={a.dataUrl} download={a.name} aria-label="Download" className="text-muted-foreground hover:text-foreground">
                      <FileDown className="h-3.5 w-3.5" />
                    </a>
                    <button
                      aria-label="Remove"
                      onClick={() => put('lectures', { ...open, attachments: open.attachments.filter((x) => x.id !== a.id) })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* rich notes */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-bold">Lecture notes</p>
          <MarkdownEditor
            value={open.notes}
            onChange={(v) => put('lectures', { ...open, notes: v })}
            minRows={14}
            placeholder={'# Key ideas\n\nUse headings, **bold**, tables, - [ ] checklists, $\\LaTeX$ math and [[Note links]]…'}
          />
        </Card>

        <LectureForm open={editMeta} onClose={() => setEditMeta(false)} lecture={open} />
      </div>
    );
  }

  /* ------------------------------- index view ------------------------------ */

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        eyebrow={`${lectures.length} logged`}
        title="Lectures"
        actions={<>
          <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} aria-label="Course" className="h-9 w-36 text-xs">
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </Select>
          {/* lectures aren't in the + sheet, so this stays on phones */}
          <Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Lecture</Button>
        </>}
      />

      {grouped.length === 0 && (
        <EmptyState
          title="No lectures yet"
          body="Log each lecture with a summary, rich notes, and attached slides or photos of the whiteboard."
          action={<Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add lecture</Button>}
        />
      )}

      {grouped.map(([month, list]) => (
        <section key={month}>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{month}</h2>
          <div className="space-y-2">
            {list.map((l) => {
              const course = courses.find((c) => c.id === l.courseId);
              return (
                <button
                  key={l.id}
                  onClick={() => setOpenId(l.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl font-display" style={{ background: hexToRgba(course?.color ?? '#888', 0.13), color: course?.color }}>
                    <span className="text-sm font-extrabold leading-none">{new Date(l.date).getDate()}</span>
                    <span className="text-[9px] font-bold uppercase">{new Date(l.date).toLocaleDateString(undefined, { month: 'short' })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {course?.code}{l.summary ? ` · ${l.summary}` : ''}
                    </span>
                  </span>
                  {l.attachments.length > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" /> {l.attachments.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <LectureForm open={add} onClose={() => setAdd(false)} onCreated={(id) => setOpenId(id)} />
    </div>
  );
}
