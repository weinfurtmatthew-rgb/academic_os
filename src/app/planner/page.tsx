'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { CalItem, StudySession } from '@/lib/types';
import {
  addDays, cn, fmtDate, hoursBetween, isSameDay, startOfDay, startOfWeek, studyStreak, toDateKey,
} from '@/lib/utils';
import { Button, EmptyState, PageHeader, Stat, Tabs } from '@/components/ui';
import { SessionRow } from '@/components/shared';
import { SessionForm } from '@/components/forms';
import { CalendarView } from '@/components/calendar-view';

type View = 'daily' | 'weekly' | 'monthly';

export default function PlannerPage() {
  const { sessions, courses, put, ui, setUI } = useStore((s) => ({
    sessions: s.sessions, courses: s.courses, put: s.put, ui: s.ui, setUI: s.setUI,
  }));
  const [view, setView] = useState<View>('weekly');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [add, setAdd] = useState(false);
  const [addDate, setAddDate] = useState<string | undefined>(undefined);
  const [edit, setEdit] = useState<StudySession | null>(null);

  useEffect(() => {
    if (ui.focus?.type === 'session') {
      const s = sessions.find((x) => x.id === ui.focus!.id);
      if (s) setEdit(s);
      setUI({ focus: null });
    }
  }, [ui.focus, sessions, setUI]);

  const totalH = useMemo(() => sessions.filter((s) => s.done).reduce((sum, s) => sum + s.durationMin, 0) / 60, [sessions]);
  const weekH = useMemo(() => hoursBetween(sessions, startOfWeek(new Date()), addDays(startOfWeek(new Date()), 7)), [sessions]);
  const streak = useMemo(() => studyStreak(sessions), [sessions]);

  const planAt = (d: Date) => {
    const at = new Date(d);
    at.setHours(18, 0, 0, 0);
    setAddDate(at.toISOString());
    setAdd(true);
  };

  /* --------------------------------- daily ---------------------------------- */
  const daily = sessions.filter((s) => isSameDay(s.date, cursor)).sort((a, b) => a.date.localeCompare(b.date));
  const dailyMin = daily.filter((s) => s.done).reduce((sum, s) => sum + s.durationMin, 0);

  /* --------------------------------- weekly --------------------------------- */
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));

  /* -------------------------------- monthly --------------------------------- */
  const calItems: CalItem[] = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id, kind: 'session', title: `${s.topic} · ${s.durationMin}m`, date: s.date,
        color: courses.find((c) => c.id === s.courseId)?.color ?? '#10B981',
        courseId: s.courseId, done: s.done,
      })),
    [sessions, courses],
  );

  const step = (dir: 1 | -1) => {
    const c = new Date(cursor);
    if (view === 'daily') c.setDate(c.getDate() + dir);
    else c.setDate(c.getDate() + dir * 7);
    setCursor(c);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        eyebrow={`${sessions.length} sessions planned`}
        title="Study planner"
        actions={<Button className="hidden md:inline-flex" onClick={() => { setAddDate(undefined); setAdd(true); }}><Plus className="h-4 w-4" /> Session</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total studied" value={`${totalH.toFixed(1)}h`} sub="all time" accent />
        <Stat label="This week" value={`${weekH.toFixed(1)}h`} sub="completed sessions" />
        <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Streak</p>
          <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-extrabold">
            <Flame className={cn('h-5 w-5', streak > 0 ? 'text-orange-500' : 'text-muted-foreground/40')} />
            {streak} day{streak === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ]}
      />

      {view !== 'monthly' && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" className="px-2.5" onClick={() => setCursor(startOfDay(new Date()))}>Today</Button>
          <h2 className="ml-1 font-display text-base font-bold">
            {view === 'daily'
              ? cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
              : `Week of ${startOfWeek(cursor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
          </h2>
        </div>
      )}

      {view === 'daily' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{(dailyMin / 60).toFixed(1)}h completed this day</p>
          {daily.map((s) => (
            <SessionRow key={s.id} s={s} onOpen={() => setEdit(s)} />
          ))}
          {daily.length === 0 && (
            <EmptyState
              title="No sessions this day"
              body="Block focused time for a course and topic — consistency beats cramming."
              action={<Button variant="outline" onClick={() => planAt(cursor)}><Plus className="h-4 w-4" /> Plan for this day</Button>}
            />
          )}
        </div>
      )}

      {view === 'weekly' && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-2">
          {weekDays.map((day) => {
            const list = sessions.filter((s) => isSameDay(s.date, day)).sort((a, b) => a.date.localeCompare(b.date));
            const min = list.filter((s) => s.done).reduce((sum, s) => sum + s.durationMin, 0);
            const today = isSameDay(day, new Date());
            return (
              <div key={toDateKey(day)} className={cn('flex flex-col rounded-2xl border bg-card p-2.5', today ? 'border-primary/50' : 'border-border')}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className={cn('text-xs font-extrabold', today ? 'text-primary' : 'text-muted-foreground')}>
                    {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                  </p>
                  <span className="text-[10px] font-bold text-muted-foreground">{min > 0 ? `${(min / 60).toFixed(1)}h` : ''}</span>
                </div>
                <div className="flex-1 space-y-1.5">
                  {list.map((s) => {
                    const course = courses.find((c) => c.id === s.courseId);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setEdit(s)}
                        className={cn('block w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold leading-tight', s.done && 'opacity-50 line-through')}
                        style={{ background: `${course?.color ?? '#888'}1f`, color: course?.color }}
                      >
                        {s.topic}
                        <span className="block font-normal opacity-80">{s.durationMin}m</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => planAt(day)} className="mt-1.5 rounded-lg border border-dashed border-border py-1 text-[11px] font-bold text-muted-foreground/70 hover:border-primary/40 hover:text-primary">
                  + add
                </button>
              </div>
            );
          })}
        </div>
      )}

      {view === 'monthly' && (
        <CalendarView
          items={calItems}
          initialView="month"
          onOpen={(it) => {
            const s = sessions.find((x) => x.id === it.id);
            if (s) setEdit(s);
          }}
          onAddAt={planAt}
          addLabel="Plan study session"
          onMove={(it, day) => {
            const s = sessions.find((x) => x.id === it.id);
            if (!s) return;
            const old = new Date(s.date);
            const next = new Date(day);
            next.setHours(old.getHours(), old.getMinutes(), 0, 0);
            put('sessions', { ...s, date: next.toISOString() });
          }}
        />
      )}

      <SessionForm
        open={add || !!edit}
        onClose={() => { setAdd(false); setEdit(null); setAddDate(undefined); }}
        session={edit}
        defaultDate={addDate}
      />
    </div>
  );
}
