import type { Assignment, Course } from '../types';
import type { IcsEvent } from './ics';

/*
 * Turning a Canvas calendar feed into assignments. Pure, so it is unit-tested with plain Node
 * (tests/canvas.test.ts) and shared with the Cloudflare Worker that fetches the feed.
 */

/** Feed links look like https://school.instructure.com/feeds/calendars/user_AbC123.ics */
const FEED_PATH = /^\/feeds\/calendars\/user_[A-Za-z0-9_-]+\.ics$/;

/** The https URL for a pasted Canvas feed link (webcal:// accepted), or null if it isn't one. */
export function canvasFeedUrl(input: string): string | null {
  let raw = input.trim();
  if (/^webcals?:\/\//i.test(raw)) raw = raw.replace(/^webcals?:\/\//i, 'https://');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  // a real school host: not an IP address or localhost
  if (!u.hostname.includes('.') || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':')) return null;
  if (!FEED_PATH.test(u.pathname)) return null;
  return `https://${u.hostname}${u.pathname}`;
}

/** One Canvas assignment from the feed. */
export interface CanvasItem {
  /** Canvas assignment id, e.g. "12345". */
  canvasId: string;
  title: string;
  /** The course as Canvas names it in the event title's [brackets]. */
  courseLabel: string;
  dueDate: string;
  description: string;
  url: string;
}

/** Assignments only: Canvas also lists calendar events (office hours, reminders) we leave out. */
export function canvasItems(events: IcsEvent[]): CanvasItem[] {
  const out: CanvasItem[] = [];
  for (const e of events) {
    const id = e.uid.match(/^event-assignment-(\d+)$/)?.[1];
    if (!id) continue;
    const m = e.summary.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    out.push({
      canvasId: id,
      title: (m ? m[1] : e.summary).trim() || 'Untitled assignment',
      courseLabel: (m ? m[2] : 'Canvas').trim(),
      dueDate: e.start,
      description: e.description.slice(0, 4000),
      url: e.url,
    });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const CODE = /\b([A-Z]{2,5})[\s-]?(\d{2,4}[A-Z]?)\b(?:-\d{1,3}\b)?/;

/** A course code inside a Canvas course name: "MATH 240", "CS-201", "PSY110H". */
export function guessCode(label: string): string {
  const m = label.match(CODE);
  return m ? `${m[1]} ${m[2]}` : label.slice(0, 12).trim();
}

/** The Canvas course name without its code: "MATH 240 - Linear Algebra" → "Linear Algebra". */
export function guessName(label: string): string {
  const rest = label.replace(CODE, '').replace(/\(\s*\)|\[\s*\]/g, '').replace(/^[\s\-–—:|·,]+|[\s\-–—:|·,]+$/g, '').replace(/\s{2,}/g, ' ');
  return rest || label;
}

/** The existing course a Canvas course name most likely is, by code first, then by name. */
export function matchCourse(label: string, courses: Course[]): Course | null {
  const l = norm(label);
  const byCode = courses.find((c) => c.code && norm(c.code).length >= 3 && l.includes(norm(c.code)));
  if (byCode) return byCode;
  return courses.find((c) => c.name && norm(c.name).length >= 4 && (l.includes(norm(c.name)) || norm(c.name).includes(l))) ?? null;
}

export const assignmentIdFor = (canvasId: string) => `canvas-a-${canvasId}`;
export const courseIdFor = (label: string) => `canvas-c-${norm(label).slice(0, 40) || 'course'}`;

/** courseLabel → our course id, or SKIP to leave that course out. */
export type CourseMap = Record<string, string>;
export const SKIP = 'skip';
export const NEW_COURSE = 'new';

export interface ImportPlan {
  create: Assignment[];
  update: Assignment[];
  /** Courses to add because the map says NEW_COURSE. */
  newCourses: { id: string; label: string }[];
  /** Canvas courses the map doesn't cover yet. */
  unmapped: string[];
}

/**
 * What an import would change. Canvas owns title, due date and link; everything else (status,
 * priority, grade, notes) belongs to the student once the assignment is here. Only assignments due
 * from `since` on are added, so a first import doesn't fill Overdue with work already handed in.
 * Ones the student deleted here stay deleted.
 */
export function planImport(opts: {
  items: CanvasItem[];
  assignments: Assignment[];
  courses: Course[];
  map: CourseMap;
  deletedIds: Set<string>;
  since: Date;
  now: string;
}): ImportPlan {
  const { items, assignments, courses, map, deletedIds, since, now } = opts;
  const byId = new Map(assignments.map((a) => [a.id, a]));
  const courseIds = new Set(courses.map((c) => c.id));
  const plan: ImportPlan = { create: [], update: [], newCourses: [], unmapped: [] };
  const seenNew = new Set<string>();

  for (const it of items) {
    const target = map[it.courseLabel];
    if (target === undefined) {
      if (!plan.unmapped.includes(it.courseLabel)) plan.unmapped.push(it.courseLabel);
      continue;
    }
    if (target === SKIP) continue;
    let courseId = target;
    if (target === NEW_COURSE) {
      courseId = courseIdFor(it.courseLabel);
      if (!courseIds.has(courseId) && !seenNew.has(courseId)) {
        seenNew.add(courseId);
        plan.newCourses.push({ id: courseId, label: it.courseLabel });
      }
    } else if (!courseIds.has(courseId)) {
      // the mapped course was deleted here: treat as not mapped
      if (!plan.unmapped.includes(it.courseLabel)) plan.unmapped.push(it.courseLabel);
      continue;
    }

    const id = assignmentIdFor(it.canvasId);
    const existing = byId.get(id);
    if (existing) {
      if (existing.title !== it.title || existing.dueDate !== it.dueDate || existing.submissionUrl !== it.url) {
        plan.update.push({ ...existing, title: it.title, dueDate: it.dueDate, submissionUrl: it.url });
      }
      continue;
    }
    if (deletedIds.has(id) || new Date(it.dueDate) < since) continue;
    plan.create.push({
      id, courseId, title: it.title, description: it.description, dueDate: it.dueDate,
      priority: 'medium', status: 'not_started', estimatedHours: 1, grade: null, completedAt: null,
      submissionUrl: it.url, submissionNotes: '', attachments: [], createdAt: now,
    });
  }
  return plan;
}
