'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalItem } from '@/lib/types';
import { addDays, cn, fmtTime, hexToRgba, isSameDay, startOfDay, startOfWeek, toDateKey } from '@/lib/utils';
import { Button } from '@/components/ui';

export type CalView = 'day' | 'week' | 'month';

const KIND_ICON: Record<CalItem['kind'], string> = {
  assignment: '✓',
  exam: '★',
  session: '◷',
};

function Chip({
  item, draggable, onOpen, onDragStart, compact,
}: {
  item: CalItem; draggable: boolean; compact?: boolean;
  onOpen: (i: CalItem) => void; onDragStart: (e: React.DragEvent, i: CalItem) => void;
}) {
  return (
    <button
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, item)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      title={`${item.title} · ${fmtTime(item.date)}`}
      className={cn(
        'flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight transition-transform hover:scale-[1.02]',
        item.done && 'opacity-50 line-through',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      style={{ background: hexToRgba(item.color, 0.16), color: item.color }}
    >
      <span aria-hidden className="shrink-0">{KIND_ICON[item.kind]}</span>
      <span className="truncate">{item.title}</span>
      {!compact && <span className="ml-auto shrink-0 font-normal opacity-80">{fmtTime(item.date)}</span>}
    </button>
  );
}

export function CalendarView({
  items, onMove, onOpen, onAddAt, initialView = 'month', enableDrag = true,
}: {
  items: CalItem[];
  onMove?: (item: CalItem, newDate: Date) => void;
  onOpen: (item: CalItem) => void;
  onAddAt?: (date: Date) => void;
  initialView?: CalView;
  enableDrag?: boolean;
}) {
  const [view, setView] = useState<CalView>(initialView);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [overKey, setOverKey] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) {
      const k = toDateKey(it.date);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    for (const arr of Array.from(map.values())) arr.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [items]);

  const step = (dir: 1 | -1) => {
    const c = new Date(cursor);
    if (view === 'day') c.setDate(c.getDate() + dir);
    else if (view === 'week') c.setDate(c.getDate() + dir * 7);
    else c.setMonth(c.getMonth() + dir, 1);
    setCursor(c);
  };

  const heading =
    view === 'month'
      ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${startOfWeek(cursor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const canDrag = enableDrag && Boolean(onMove);

  const dragStart = (e: React.DragEvent, it: CalItem) => {
    if (!canDrag) return;
    e.dataTransfer.setData('text/calitem', JSON.stringify({ id: it.id, kind: it.kind }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const dropOn = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setOverKey(null);
    if (!onMove) return;
    const raw = e.dataTransfer.getData('text/calitem');
    if (!raw) return;
    try {
      const { id, kind } = JSON.parse(raw) as { id: string; kind: CalItem['kind'] };
      const it = items.find((x) => x.id === id && x.kind === kind);
      if (it) onMove(it, day);
    } catch {
      /* ignore malformed payloads */
    }
  };

  const dayCellProps = (day: Date) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDrag) return;
      e.preventDefault();
      setOverKey(toDateKey(day));
    },
    onDragLeave: () => setOverKey((k) => (k === toDateKey(day) ? null : k)),
    onDrop: (e: React.DragEvent) => dropOn(e, day),
  });

  /* ---------------------------------- month --------------------------------- */

  const monthGrid = () => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const weeks: Date[][] = [];
    let d = gridStart;
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let i = 0; i < 7; i++) {
        row.push(d);
        d = addDays(d, 1);
      }
      weeks.push(row);
      if (d.getMonth() !== cursor.getMonth() && w >= 4) break;
    }
    return weeks;
  };

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="px-2.5" onClick={() => setCursor(startOfDay(new Date()))}>
            Today
          </Button>
        </div>
        <h3 className="order-first w-full font-display text-base font-bold sm:order-none sm:w-auto">{heading}</h3>
        <div className="flex rounded-xl border border-border bg-muted p-0.5">
          {(['day', 'week', 'month'] as CalView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-[10px] px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          {monthGrid().map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {row.map((day) => {
                const k = toDateKey(day);
                const dayItems = byDay.get(k) ?? [];
                const faded = day.getMonth() !== cursor.getMonth();
                const today = isSameDay(day, new Date());
                return (
                  <div
                    key={k}
                    {...dayCellProps(day)}
                    onClick={() => onAddAt?.(day)}
                    className={cn(
                      'min-h-[84px] border-r border-border p-1 last:border-r-0 sm:min-h-[104px] sm:p-1.5',
                      faded && 'bg-muted/30',
                      overKey === k && 'bg-primary/8 ring-2 ring-inset ring-primary/50',
                      onAddAt && 'cursor-pointer hover:bg-muted/40',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        today ? 'bg-primary text-primary-foreground' : faded ? 'text-muted-foreground/50' : 'text-muted-foreground',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayItems.slice(0, 3).map((it) => (
                        <Chip key={`${it.kind}-${it.id}`} item={it} compact draggable={canDrag} onOpen={onOpen} onDragStart={dragStart} />
                      ))}
                      {dayItems.length > 3 && (
                        <p className="px-1 text-[10px] font-semibold text-muted-foreground">+{dayItems.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === 'week' && (
        <div className="grid gap-2 sm:grid-cols-7 sm:gap-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border sm:bg-card">
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)).map((day) => {
            const k = toDateKey(day);
            const dayItems = byDay.get(k) ?? [];
            const today = isSameDay(day, new Date());
            return (
              <div
                key={k}
                {...dayCellProps(day)}
                onClick={() => onAddAt?.(day)}
                className={cn(
                  'rounded-2xl border border-border bg-card p-2 sm:min-h-[260px] sm:rounded-none sm:border-0 sm:border-r sm:last:border-r-0',
                  overKey === k && 'bg-primary/8 ring-2 ring-inset ring-primary/50',
                  onAddAt && 'cursor-pointer hover:bg-muted/30',
                )}
              >
                <p className={cn('mb-1.5 text-xs font-bold', today ? 'text-primary' : 'text-muted-foreground')}>
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                  <span className={cn('ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full', today && 'bg-primary text-primary-foreground')}>
                    {day.getDate()}
                  </span>
                </p>
                <div className="space-y-1">
                  {dayItems.map((it) => (
                    <Chip key={`${it.kind}-${it.id}`} item={it} draggable={canDrag} onOpen={onOpen} onDragStart={dragStart} />
                  ))}
                  {dayItems.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground/50">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <div
          {...dayCellProps(cursor)}
          className={cn(
            'min-h-[280px] rounded-2xl border border-border bg-card p-3',
            overKey === toDateKey(cursor) && 'ring-2 ring-inset ring-primary/50',
          )}
        >
          {(byDay.get(toDateKey(cursor)) ?? []).map((it) => (
            <div key={`${it.kind}-${it.id}`} className="mb-1.5">
              <Chip item={it} draggable={canDrag} onOpen={onOpen} onDragStart={dragStart} />
            </div>
          ))}
          {(byDay.get(toDateKey(cursor)) ?? []).length === 0 && (
            <button
              onClick={() => onAddAt?.(cursor)}
              className="flex h-full min-h-[240px] w-full items-center justify-center text-sm text-muted-foreground/60 hover:text-muted-foreground"
            >
              Nothing scheduled{onAddAt ? ' — tap to add' : ''}
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70">
        ✓ assignment · ★ exam · ◷ study session{canDrag ? ' — drag items between days to reschedule' : ''}
      </p>
    </div>
  );
}
