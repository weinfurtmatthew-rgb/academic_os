import type { Assignment, Course, Exam, StudySession } from './types';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------- dates ---------- */

export function toDateKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntil(iso: string): number {
  const ms = startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime();
  return Math.round(ms / 86400000);
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric' });
}

export function fmtFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function relDue(iso: string): string {
  const d = daysUntil(iso);
  if (d < -1) return `${-d} days overdue`;
  if (d === -1) return 'Due yesterday';
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d <= 7) return `Due in ${d} days`;
  return `Due ${fmtDate(iso)}`;
}

/** Short "how long ago" label: "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

/** Submitted or completed: nothing left to do before the deadline. */
export function isTurnedIn(a: Pick<Assignment, 'status'>): boolean {
  return a.status === 'submitted' || a.status === 'completed';
}

/** Past its due date and not yet turned in. */
export function isOverdue(a: Pick<Assignment, 'status' | 'dueDate'>): boolean {
  return !isTurnedIn(a) && daysUntil(a.dueDate) < 0;
}

/** Due-date label that respects status, so turned-in work never reads as overdue. */
export function assignmentDue(a: Pick<Assignment, 'status' | 'dueDate' | 'completedAt'>): string {
  if (a.status === 'completed') return a.completedAt ? `Done ${fmtDate(a.completedAt)}` : `Done · due ${fmtDate(a.dueDate)}`;
  if (a.status === 'submitted') return `Submitted · due ${fmtDate(a.dueDate)}`;
  return relDue(a.dueDate);
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

/* ---------- grades & GPA ---------- */

export function letterGrade(pct: number): string {
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 60) return 'D';
  return 'F';
}

export function percentToPoints(pct: number, scale: number): number {
  const four =
    pct >= 93 ? 4 : pct >= 90 ? 3.7 : pct >= 87 ? 3.3 : pct >= 83 ? 3 : pct >= 80 ? 2.7 :
    pct >= 77 ? 2.3 : pct >= 73 ? 2 : pct >= 70 ? 1.7 : pct >= 67 ? 1.3 : pct >= 63 ? 1 :
    pct >= 60 ? 0.7 : 0;
  return four * (scale / 4);
}

/**
 * Weighted course grade from graded items only.
 * Exams carry their own weight; graded assignments split the remaining weight equally.
 * Normalised by the total weight that has actually been graded.
 */
export function courseGrade(courseId: string, assignments: Assignment[], exams: Exam[]): number | null {
  const ex = exams.filter((e) => e.courseId === courseId);
  const as = assignments.filter((a) => a.courseId === courseId);
  const examWeight = Math.min(100, ex.reduce((s, e) => s + (e.weight || 0), 0));
  const assignWeight = Math.max(0, 100 - examWeight);
  const gradedAs = as.filter((a) => typeof a.grade === 'number');
  const perAssign = gradedAs.length > 0 ? assignWeight / as.length : 0;

  let earned = 0;
  let used = 0;
  for (const e of ex) {
    if (typeof e.grade === 'number') {
      earned += e.grade * (e.weight || 0);
      used += e.weight || 0;
    }
  }
  for (const a of gradedAs) {
    earned += (a.grade as number) * perAssign;
    used += perAssign;
  }
  if (used === 0) return null;
  return Math.round((earned / used) * 10) / 10;
}

export function overallGPA(courses: Course[], assignments: Assignment[], exams: Exam[], scale: number): number | null {
  let pts = 0;
  let credits = 0;
  for (const c of courses) {
    const g = courseGrade(c.id, assignments, exams);
    if (g === null) continue;
    const cr = c.credits || 0;
    pts += percentToPoints(g, scale) * cr;
    credits += cr;
  }
  if (credits === 0) return null;
  return Math.round((pts / credits) * 100) / 100;
}

export function semesterAverage(courses: Course[], assignments: Assignment[], exams: Exam[]): number | null {
  const grades = courses.map((c) => courseGrade(c.id, assignments, exams)).filter((g): g is number => g !== null);
  if (grades.length === 0) return null;
  return Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10;
}

/** Cumulative GPA at the end of each month that contains graded work. */
export function gpaTrend(
  courses: Course[], assignments: Assignment[], exams: Exam[], scale: number
): { label: string; value: number }[] {
  const dates: number[] = [];
  assignments.forEach((a) => typeof a.grade === 'number' && dates.push(new Date(a.dueDate).getTime()));
  exams.forEach((e) => typeof e.grade === 'number' && dates.push(new Date(e.date).getTime()));
  if (dates.length === 0) return [];

  const first = new Date(Math.min(...dates));
  const last = new Date(Math.max(...dates));
  const months: Date[] = [];
  const cur = new Date(first.getFullYear(), first.getMonth(), 1);
  while (cur <= last && months.length < 12) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  return months.map((m) => {
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59).getTime();
    const as = assignments.filter((a) => new Date(a.dueDate).getTime() <= end);
    const ex = exams.filter((e) => new Date(e.date).getTime() <= end);
    const g = overallGPA(courses, as, ex, scale) ?? 0;
    return { label: m.toLocaleDateString(undefined, { month: 'short' }), value: g };
  });
}

/* ---------- stats ---------- */

export function studyStreak(sessions: StudySession[]): number {
  const days = new Set(sessions.filter((s) => s.done).map((s) => toDateKey(s.date)));
  let streak = 0;
  const cursor = startOfDay(new Date());
  if (!days.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1); // today not yet logged is fine
  while (days.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function hoursBetween(sessions: StudySession[], from: Date, to: Date, doneOnly = true): number {
  const f = from.getTime();
  const t = to.getTime();
  const mins = sessions
    .filter((s) => (!doneOnly || s.done))
    .filter((s) => {
      const d = new Date(s.date).getTime();
      return d >= f && d < t;
    })
    .reduce((sum, s) => sum + (s.durationMin || 0), 0);
  return Math.round((mins / 60) * 10) / 10;
}

export function lastNDays(n: number): { date: Date; key: string; label: string }[] {
  const out: { date: Date; key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = startOfDay(addDays(new Date(), -i));
    out.push({ date: d, key: toDateKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) });
  }
  return out;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}
