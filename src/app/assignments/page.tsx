'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  ASSIGNMENT_STATUSES, PRIORITIES,
  type Assignment, type CalItem, type Priority,
} from '@/lib/types';
import { assignmentDue, cn, daysUntil, fmtDate, isOverdue, isTurnedIn, relDue } from '@/lib/utils';
import { Button, EmptyState, PageHeader, Select, Tabs } from '@/components/ui';
import { AssignmentRow, PriorityBadge, StatusBadge } from '@/components/shared';
import { AssignmentForm } from '@/components/forms';
import { KanbanBoard } from '@/components/kanban';
import { AssignmentDetail } from '@/components/assignment-detail';
import { CalendarView } from '@/components/calendar-view';

type View = 'list' | 'board' | 'calendar' | 'timeline';
type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'month';

export default function AssignmentsPage() {
  const { assignments, courses, put, ui, setUI } = useStore((s) => ({
    assignments: s.assignments, courses: s.courses, put: s.put, ui: s.ui, setUI: s.setUI,
  }));
  const [view, setView] = useState<View>('list');
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<Assignment | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fCourse, setFCourse] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fPriority, setFPriority] = useState<'all' | Priority>('all');
  const [fDue, setFDue] = useState<DueFilter>('all');

  // open editor when arriving from global search
  useEffect(() => {
    if (ui.focus?.type === 'assignment') {
      const a = assignments.find((x) => x.id === ui.focus!.id);
      if (a) setOpenId(a.id);
      setUI({ focus: null });
    }
  }, [ui.focus, assignments, setUI]);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (fCourse !== 'all' && a.courseId !== fCourse) return false;
      if (fStatus !== 'all' && a.status !== fStatus) return false;
      if (fPriority !== 'all' && a.priority !== fPriority) return false;
      if (fDue !== 'all') {
        const d = daysUntil(a.dueDate);
        if (fDue === 'overdue' && !isOverdue(a)) return false;
        if (fDue === 'today' && d !== 0) return false;
        if (fDue === 'week' && (d < 0 || d > 7)) return false;
        if (fDue === 'month' && (d < 0 || d > 31)) return false;
      }
      return true;
    });
  }, [assignments, fCourse, fStatus, fPriority, fDue]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ac = isTurnedIn(a) ? 1 : 0;
        const bc = isTurnedIn(b) ? 1 : 0;
        if (ac !== bc) return ac - bc;
        return a.dueDate.localeCompare(b.dueDate);
      }),
    [filtered],
  );

  const calItems: CalItem[] = useMemo(
    () =>
      filtered.map((a) => ({
        id: a.id, kind: 'assignment', title: a.title, date: a.dueDate,
        color: courses.find((c) => c.id === a.courseId)?.color ?? '#5B5BD6',
        courseId: a.courseId, done: isTurnedIn(a),
      })),
    [filtered, courses],
  );

  // timeline groups
  const timeline = useMemo(() => {
    const groups: { label: string; items: Assignment[]; tone?: 'danger' | 'warn' }[] = [
      { label: 'Overdue', items: [], tone: 'danger' },
      { label: 'Today', items: [], tone: 'warn' },
      { label: 'This week', items: [] },
      { label: 'Later', items: [] },
      { label: 'Turned in', items: [] },
    ];
    for (const a of sorted) {
      if (isTurnedIn(a)) groups[4].items.push(a);
      else {
        const d = daysUntil(a.dueDate);
        if (d < 0) groups[0].items.push(a);
        else if (d === 0) groups[1].items.push(a);
        else if (d <= 7) groups[2].items.push(a);
        else groups[3].items.push(a);
      }
    }
    return groups.filter((g) => g.items.length > 0);
  }, [sorted]);

  const openAssignment = assignments.find((a) => a.id === openId) ?? null;
  const open = assignments.filter((a) => !isTurnedIn(a)).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        eyebrow={`${open} open · ${assignments.length} total`}
        title="Assignments"
        actions={<Button className="hidden md:inline-flex" onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Assignment</Button>}
      />

      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: 'list', label: 'List' },
          { value: 'board', label: 'Board' },
          { value: 'calendar', label: 'Calendar' },
          { value: 'timeline', label: 'Timeline' },
        ]}
      />

      {/* filters */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} className="h-9 text-xs sm:w-44">
          <option value="all">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </Select>
        <Select value={fDue} onChange={(e) => setFDue(e.target.value as DueFilter)} className="h-9 text-xs sm:w-36">
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Next 7 days</option>
          <option value="month">Next 31 days</option>
        </Select>
        <Select value={fPriority} onChange={(e) => setFPriority(e.target.value as 'all' | Priority)} className="h-9 text-xs sm:w-36">
          <option value="all">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-9 text-xs sm:w-36">
          <option value="all">Any status</option>
          {ASSIGNMENT_STATUSES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={assignments.length === 0 ? 'No assignments yet' : 'Nothing matches these filters'}
          body={assignments.length === 0 ? 'Add problem sets, essays, labs and projects to keep deadlines in check.' : 'Try widening the filters above.'}
          action={assignments.length === 0 ? <Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add assignment</Button> : undefined}
        />
      ) : (
        <>
          {view === 'list' && (
            <div className="space-y-2">
              {sorted.map((a) => (
                <AssignmentRow key={a.id} a={a} onOpen={() => setOpenId(a.id)} />
              ))}
            </div>
          )}

          {view === 'board' && <KanbanBoard assignments={filtered} onOpen={(a) => setOpenId(a.id)} />}

          {view === 'calendar' && (
            <CalendarView
              items={calItems}
              onOpen={(it) => {
                const a = assignments.find((x) => x.id === it.id);
                if (a) setOpenId(a.id);
              }}
              onMove={(it, day) => {
                const a = assignments.find((x) => x.id === it.id);
                if (!a) return;
                const old = new Date(a.dueDate);
                const next = new Date(day);
                next.setHours(old.getHours(), old.getMinutes(), 0, 0);
                put('assignments', { ...a, dueDate: next.toISOString() });
              }}
            />
          )}

          {view === 'timeline' && (
            <div className="space-y-5">
              {timeline.map((g) => (
                <section key={g.label}>
                  <h3
                    className={cn(
                      'mb-2 text-xs font-extrabold uppercase tracking-wider',
                      g.tone === 'danger' ? 'text-destructive' : g.tone === 'warn' ? 'text-orange-500' : 'text-muted-foreground',
                    )}
                  >
                    {g.label} · {g.items.length}
                  </h3>
                  <ol className="relative ml-1.5 space-y-2 border-l-2 border-dashed border-border pl-5">
                    {g.items.map((a) => {
                      const course = courses.find((c) => c.id === a.courseId);
                      return (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[25px] top-2.5 h-3 w-3 rounded-full border-[3px] border-background" style={{ background: course?.color ?? '#888' }} />
                          <button
                            onClick={() => setOpenId(a.id)}
                            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-all hover:-translate-y-px hover:shadow-sm"
                          >
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-sm font-semibold', a.status === 'completed' && 'text-muted-foreground line-through')}>{a.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {course?.code} · {isTurnedIn(a) ? assignmentDue(a) : `${fmtDate(a.dueDate)} · ${relDue(a.dueDate)}`}
                              </span>
                            </span>
                            <span className="flex shrink-0 gap-1.5">
                              <PriorityBadge priority={a.priority} />
                              <span className="hidden sm:inline-flex"><StatusBadge status={a.status} /></span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <AssignmentForm open={add || !!edit} onClose={() => { setAdd(false); setEdit(null); }} assignment={edit} />
      {openAssignment && <AssignmentDetail assignment={openAssignment} onClose={() => setOpenId(null)} />}
    </div>
  );
}
