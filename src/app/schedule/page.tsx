'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DAYS, type ClassMeeting, type Course } from '@/lib/types';
import { cn, hexToRgba } from '@/lib/utils';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';

interface Meeting extends ClassMeeting {
  course: Course;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmt = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const todayIdx = () => (new Date().getDay() + 6) % 7;

export default function SchedulePage() {
  const router = useRouter();
  const { courses, setUI } = useStore((s) => ({ courses: s.courses, setUI: s.setUI }));
  const [mobileDay, setMobileDay] = useState(todayIdx());
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const t = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);

  const meetings: Meeting[] = useMemo(
    () => courses.flatMap((c) => (c.schedule ?? []).map((m) => ({ ...m, course: c }))),
    [courses],
  );

  const { startH, endH, showWeekend } = useMemo(() => {
    if (meetings.length === 0) return { startH: 8, endH: 18, showWeekend: false };
    const s = Math.min(...meetings.map((m) => Math.floor(toMin(m.start) / 60)));
    const e = Math.max(...meetings.map((m) => Math.ceil(toMin(m.end) / 60)));
    return {
      startH: Math.max(0, Math.min(s, 9)),
      endH: Math.min(24, Math.max(e, 17)),
      showWeekend: meetings.some((m) => m.day >= 5),
    };
  }, [meetings]);

  const days = showWeekend ? DAYS : DAYS.slice(0, 5);
  const HOUR_PX = 56;
  const gridH = (endH - startH) * HOUR_PX;
  const tIdx = todayIdx();

  const openCourse = (id: string) => {
    setUI({ selectedCourseId: id });
    router.push('/courses/');
  };

  const Block = ({ m }: { m: Meeting }) => {
    const top = ((toMin(m.start) - startH * 60) / 60) * HOUR_PX;
    const h = Math.max(28, ((toMin(m.end) - toMin(m.start)) / 60) * HOUR_PX);
    return (
      <button
        onClick={() => openCourse(m.course.id)}
        title={`${m.course.code} · ${fmt(m.start)}–${fmt(m.end)}${m.location ? ` · ${m.location}` : ''}`}
        className="absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left shadow-sm transition-transform hover:z-10 hover:scale-[1.02]"
        style={{ top, height: h, background: hexToRgba(m.course.color, 0.16), borderColor: m.course.color }}
      >
        <p className="truncate text-[11px] font-extrabold leading-tight" style={{ color: m.course.color }}>{m.course.code}</p>
        <p className="truncate text-[10px] font-semibold text-foreground/80">{fmt(m.start)}–{fmt(m.end)}</p>
        {h > 52 && m.location && <p className="truncate text-[10px] text-muted-foreground">{m.location}</p>}
      </button>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Class schedule"
        actions={
          <Button variant="outline" onClick={() => router.push('/courses/')}>
            <CalendarPlus className="h-4 w-4" /> Edit in courses
          </Button>
        }
      />

      {meetings.length === 0 ? (
        <EmptyState
          title="No class times yet"
          body="Open a course → Edit → “Weekly class schedule” to add lecture, lab and seminar times. They’ll appear here and on the dashboard."
          action={<Button onClick={() => router.push('/courses/')}><CalendarPlus className="h-4 w-4" /> Go to courses</Button>}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div className="border-b border-border bg-muted/50" />
              {days.map((d) => (
                <div
                  key={d.value}
                  className={cn(
                    'border-b border-l border-border bg-muted/50 px-2 py-2 text-center text-[11px] font-extrabold uppercase tracking-wide',
                    d.value === tIdx ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {d.short}
                  {d.value === tIdx && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
                </div>
              ))}

              <div className="relative" style={{ height: gridH }}>
                {Array.from({ length: endH - startH }, (_, i) => (
                  <div key={i} className="absolute right-1.5 -translate-y-1/2 text-[10px] font-bold text-muted-foreground" style={{ top: (i + (i === 0 ? 0.08 : 0)) * HOUR_PX }}>
                    {new Date(0, 0, 0, startH + i).toLocaleTimeString(undefined, { hour: 'numeric' })}
                  </div>
                ))}
              </div>

              {days.map((d) => (
                <div key={d.value} className={cn('relative border-l border-border', d.value === tIdx && 'bg-primary/[0.035]')} style={{ height: gridH }}>
                  {Array.from({ length: endH - startH }, (_, i) => (
                    <div key={i} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: i * HOUR_PX }} />
                  ))}
                  {d.value === tIdx && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                    <div className="absolute inset-x-0 z-10 h-px bg-destructive" style={{ top: ((nowMin - startH * 60) / 60) * HOUR_PX }}>
                      <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-destructive" />
                    </div>
                  )}
                  {meetings.filter((m) => m.day === d.value).map((m) => (
                    <Block key={m.id} m={m} />
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <div className="md:hidden">
            <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
              {DAYS.map((d) => {
                const count = meetings.filter((m) => m.day === d.value).length;
                return (
                  <button
                    key={d.value}
                    onClick={() => setMobileDay(d.value)}
                    className={cn(
                      'flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors',
                      mobileDay === d.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {d.short}
                    <span className={cn('text-[9px] font-bold', count === 0 && 'opacity-40')}>{count} class{count === 1 ? '' : 'es'}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {meetings
                .filter((m) => m.day === mobileDay)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openCourse(m.course.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left"
                  >
                    <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: m.course.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        <span style={{ color: m.course.color }}>{m.course.code}</span> · {m.course.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {fmt(m.start)}–{fmt(m.end)}
                        {m.location && (
                          <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{m.location}</span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              {meetings.filter((m) => m.day === mobileDay).length === 0 && (
                <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No classes on {DAYS[mobileDay].label} 🎉
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
