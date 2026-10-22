import { useStore } from '../store';
import { COURSE_COLORS, type Course } from '../types';
import { startOfDay } from '../utils';
import { parseIcs } from './ics';
import { NEW_COURSE, canvasItems, courseIdFor, guessCode, guessName, matchCourse, planImport, type CanvasItem, type CourseMap } from './feed';

const CHECKED_KEY = 'academic-os-canvas-checked';

/** Fetch and read the feed through the app's Worker (Canvas blocks reading it from the browser). */
export async function fetchCanvasItems(feedUrl: string): Promise<CanvasItem[]> {
  let res: Response;
  try {
    res = await fetch(`/api/canvas-feed?url=${encodeURIComponent(feedUrl)}`, { cache: 'no-store' });
  } catch {
    throw new Error('You’re offline. Canvas will be checked again when you’re back online.');
  }
  const type = res.headers.get('content-type') ?? '';
  // no Worker here (GitHub Pages, next dev): the request falls through to an HTML page
  if (type.includes('text/html')) throw new Error('Canvas import needs the Cloudflare version of the app.');
  const body = await res.text();
  if (!res.ok) throw new Error(body || `Canvas check failed (${res.status})`);
  return canvasItems(parseIcs(body));
}

export function lastCanvasCheck(): string | null {
  try {
    return localStorage.getItem(CHECKED_KEY);
  } catch {
    return null;
  }
}

/** The map with any Canvas courses it doesn't cover filled in by a confident match, or nothing. */
export function suggestMap(items: CanvasItem[], courses: Course[], map: CourseMap): CourseMap {
  const next = { ...map };
  for (const label of Array.from(new Set(items.map((i) => i.courseLabel)))) {
    if (next[label] !== undefined) continue;
    const c = matchCourse(label, courses);
    if (c) next[label] = c.id;
  }
  return next;
}

export interface CanvasResult {
  added: number;
  updated: number;
  newCourses: number;
  /** Canvas courses still waiting for the student to say where they go. */
  unmapped: string[];
  /** The course map as saved: "new course" choices now point at the course that was made. */
  map: CourseMap;
}

/** Bring Canvas assignments in for every mapped course. Reads and writes the store directly. */
export async function importFromCanvas(feedUrl: string, map: CourseMap, items?: CanvasItem[]): Promise<CanvasResult> {
  const feed = items ?? (await fetchCanvasItems(feedUrl));
  const s = useStore.getState();
  const now = new Date().toISOString();
  const plan = planImport({
    items: feed,
    assignments: s.assignments,
    courses: s.courses,
    map,
    deletedIds: new Set(s.tombstones.filter((t) => t.store === 'assignments').map((t) => t.id)),
    since: startOfDay(new Date()),
    now,
  });

  const used = new Set(s.courses.map((c) => c.color));
  for (const nc of plan.newCourses) {
    const color = COURSE_COLORS.find((c) => !used.has(c)) ?? COURSE_COLORS[used.size % COURSE_COLORS.length];
    used.add(color);
    s.put('courses', {
      id: nc.id, name: guessName(nc.label), code: guessCode(nc.label), instructor: '', email: '', phone: '', office: '',
      officeHours: '', credits: 3, semester: '', color, schedule: [], resources: [], createdAt: now,
    });
  }
  for (const a of [...plan.create, ...plan.update]) s.put('assignments', a);

  // once a new course exists, the map points at it, so the choice reads "Into BIO 101" from now on
  const resolved: CourseMap = {};
  for (const [label, target] of Object.entries(map)) resolved[label] = target === NEW_COURSE ? courseIdFor(label) : target;
  if (JSON.stringify(resolved) !== JSON.stringify(s.settings.canvasCourses ?? {})) s.setSettings({ canvasCourses: resolved });

  try {
    localStorage.setItem(CHECKED_KEY, now);
  } catch {
    /* storage unavailable */
  }
  return { added: plan.create.length, updated: plan.update.length, newCourses: plan.newCourses.length, unmapped: plan.unmapped, map: resolved };
}

/** Background refresh when the app opens: quiet, at most every few hours, never throws. */
export async function refreshCanvasQuietly(maxAgeHours = 3): Promise<void> {
  const { settings, courses } = useStore.getState();
  const url = settings.canvasFeedUrl;
  if (!url || typeof navigator !== 'undefined' && !navigator.onLine) return;
  const last = lastCanvasCheck();
  if (last && Date.now() - new Date(last).getTime() < maxAgeHours * 3600000) return;
  try {
    const items = await fetchCanvasItems(url);
    const map = settings.canvasCourses ?? {};
    const next = suggestMap(items, courses, map);
    await importFromCanvas(url, next, items);
  } catch {
    /* the Canvas page shows errors when the student checks by hand */
  }
}
