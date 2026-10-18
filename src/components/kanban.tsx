'use client';

import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { useStore } from '@/lib/store';
import { ASSIGNMENT_STATUSES, type Assignment, type AssignmentStatus } from '@/lib/types';
import { cn, hexToRgba, relDue } from '@/lib/utils';
import { Badge, Select } from '@/components/ui';
import { PriorityBadge } from '@/components/shared';

export function KanbanBoard({
  assignments,
  onOpen,
}: {
  assignments: Assignment[];
  onOpen: (a: Assignment) => void;
}) {
  const put = useStore((s) => s.put);
  const courses = useStore((s) => s.courses);
  const [overCol, setOverCol] = useState<AssignmentStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const byCourse = (id: string) => courses.find((c) => c.id === id);

  const moveTo = (a: Assignment, status: AssignmentStatus) => {
    if (a.status !== status) put('assignments', { ...a, status });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[760px] grid-cols-4 gap-3">
        {ASSIGNMENT_STATUSES.map((col) => {
          const items = assignments
            .filter((a) => a.status === col.value)
            .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
          return (
            <div
              key={col.value}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.value);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.value ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                const id = e.dataTransfer.getData('text/assignment');
                const a = assignments.find((x) => x.id === id);
                if (a) moveTo(a, col.value);
              }}
              className={cn(
                'flex min-h-[260px] flex-col rounded-2xl border border-border bg-muted/40 p-2 transition-colors',
                overCol === col.value && 'border-primary/60 bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{col.label}</span>
                <Badge className="bg-card text-muted-foreground">{items.length}</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-2 pt-1">
                {items.map((a) => {
                  const course = byCourse(a.courseId);
                  return (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/assignment', a.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(a.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => onOpen(a)}
                      className={cn(
                        'group cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                        dragId === a.id && 'opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-semibold leading-snug', a.status === 'completed' && 'text-muted-foreground line-through')}>
                            {a.title}
                          </p>
                          {course && (
                            <span
                              className="mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ background: hexToRgba(course.color, 0.15), color: course.color }}
                            >
                              {course.code}
                            </span>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <PriorityBadge priority={a.priority} />
                            <span className="text-[11px] font-medium text-muted-foreground">{relDue(a.dueDate)}</span>
                          </div>
                          {/* touch fallback: move without dragging */}
                          <div className="mt-2 sm:hidden" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={a.status}
                              className="h-8 px-2 py-1 text-xs"
                              onChange={(e) => moveTo(a, e.target.value as AssignmentStatus)}
                            >
                              {ASSIGNMENT_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 py-6 text-xs text-muted-foreground/60">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
