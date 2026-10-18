import { create } from 'zustand';
import { observe, stamp } from './clock';
import { dbBulkDelete, dbBulkPut, dbClear, dbDelete, dbGetAll, dbPut, STORES, TOMBSTONES, type StoreName } from './db';
import { buildSampleData } from './sample-data';
import { planMerge, planSize, tombKey, type MergePlan, type Records, type Side } from './sync/merge';
import {
  SYNCED_SETTINGS,
  type Assignment, type Course, type Exam, type Flashcard, type FocusTarget, type Lecture, type Note,
  type PdfAnnotationDoc, type Settings, type StudySession, type Tombstone,
} from './types';

/** Fill in fields added after v1 so old saves keep working. */
function normalizeCourse(c: Course): Course {
  return { email: '', phone: '', office: '', officeHours: '', schedule: [], ...(c as Partial<Course>) } as Course;
}
function normalizeAssignment(a: Assignment): Assignment {
  return { submissionUrl: '', submissionNotes: '', attachments: [], ...(a as Partial<Assignment>) } as Assignment;
}
function normalizeSession(x: StudySession): StudySession {
  return { mood: null, ...(x as Partial<StudySession>) } as StudySession;
}
function normalizeCard(f: Flashcard): Flashcard {
  return { ease: 2.5, intervalDays: 0, reps: 0, lastReviewed: null, ...(f as Partial<Flashcard>) } as Flashcard;
}
const NORMALIZE: Partial<Record<StoreName, (x: never) => unknown>> = {
  courses: normalizeCourse, assignments: normalizeAssignment, sessions: normalizeSession, flashcards: normalizeCard,
};
const normalize = (store: StoreName, x: unknown) => (NORMALIZE[store] ? NORMALIZE[store]!(x as never) : x);

/** Keep only known stores and well-formed records from a backup or another device. */
export function sanitizeSide(records: unknown, tombstones: unknown): Side {
  const out: Records = {};
  const src = (records && typeof records === 'object' ? records : {}) as Record<string, unknown>;
  for (const store of STORES) {
    const list = src[store];
    if (Array.isArray(list)) out[store] = list.filter((r) => r && typeof r === 'object' && typeof r.id === 'string');
  }
  const tombs = (Array.isArray(tombstones) ? tombstones : []).filter(
    (t): t is Tombstone =>
      t && typeof t.id === 'string' && typeof t.deletedAt === 'string' && (STORES as readonly string[]).includes(t.store),
  ).map((t) => ({ key: tombKey(t.store, t.id), store: t.store, id: t.id, deletedAt: t.deletedAt }));
  return { records: out, tombstones: tombs };
}

const SETTINGS_KEY = 'academic-os-settings';

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  gpaScale: 4,
  semesterStart: '',
  semesterEnd: '',
};

type EntityOf = {
  courses: Course;
  assignments: Assignment;
  lectures: Lecture;
  exams: Exam;
  notes: Note;
  sessions: StudySession;
  flashcards: Flashcard;
  annotations: PdfAnnotationDoc;
};

export type QuickAddKind = 'assignment' | 'course' | 'exam' | 'session' | 'lecture';

interface UIState {
  quickAdd: QuickAddKind | null;
  searchOpen: boolean;
  navOpen: boolean;
  focus: FocusTarget;
  selectedCourseId: string | null;
}

interface AppState {
  hydrated: boolean;
  courses: Course[];
  assignments: Assignment[];
  lectures: Lecture[];
  exams: Exam[];
  notes: Note[];
  sessions: StudySession[];
  flashcards: Flashcard[];
  annotations: PdfAnnotationDoc[];
  /** Deletions, kept so sync and import don't bring records back. */
  tombstones: Tombstone[];
  settings: Settings;
  ui: UIState;

  hydrate: () => Promise<void>;
  put: <K extends StoreName>(store: K, item: EntityOf[K]) => void;
  remove: (store: StoreName, id: string) => void;
  deleteCourse: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setUI: (patch: Partial<UIState>) => void;
  exportJSON: () => string;
  importJSON: (raw: string) => { ok: boolean; error?: string; changed?: number };
  /** Everything sync compares: all records plus deletions. */
  localSide: () => Side;
  /** Apply a merge from another device or a backup, keeping the incoming stamps. */
  applyPlan: (plan: MergePlan) => void;
  /** Take synced settings if they changed more recently there. Returns true if anything changed. */
  mergeSettings: (remote: Partial<Settings> | undefined) => boolean;
  resetAll: () => Promise<void>;
  loadSample: () => void;
}

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full or unavailable */
  }
}

export const useStore = create<AppState>((set, get) => ({
  hydrated: false,
  courses: [],
  assignments: [],
  lectures: [],
  exams: [],
  notes: [],
  sessions: [],
  flashcards: [],
  annotations: [],
  tombstones: [],
  settings: DEFAULT_SETTINGS,
  ui: { quickAdd: null, searchOpen: false, navOpen: false, focus: null, selectedCourseId: null },

  hydrate: async () => {
    if (get().hydrated) return;
    const [courses, assignments, lectures, exams, notes, sessions, flashcards, annotations, tombstones] = await Promise.all([
      dbGetAll<Course>('courses'),
      dbGetAll<Assignment>('assignments'),
      dbGetAll<Lecture>('lectures'),
      dbGetAll<Exam>('exams'),
      dbGetAll<Note>('notes'),
      dbGetAll<StudySession>('sessions'),
      dbGetAll<Flashcard>('flashcards'),
      dbGetAll<PdfAnnotationDoc>('annotations'),
      dbGetAll<Tombstone>(TOMBSTONES),
    ]);
    set({
      courses: courses.map(normalizeCourse),
      assignments: assignments.map(normalizeAssignment),
      lectures, exams, notes,
      sessions: sessions.map(normalizeSession),
      flashcards: flashcards.map(normalizeCard),
      annotations, tombstones,
      settings: loadSettings(), hydrated: true,
    });
  },

  put: (store, item) => {
    const record: Record<string, unknown> = { ...(item as object) } as Record<string, unknown>;
    if (store === 'assignments') {
      const a = record as unknown as Assignment;
      if (a.status === 'completed' && !a.completedAt) a.completedAt = new Date().toISOString();
      if (a.status !== 'completed') a.completedAt = null;
    }
    record.updatedAt = stamp();

    dbPut(store, record).catch(console.error); // auto-save
    set((s) => {
      const arr = s[store] as { id: string }[];
      const id = (record as { id: string }).id;
      const exists = arr.some((x) => x.id === id);
      const next = exists ? arr.map((x) => (x.id === id ? record : x)) : [...arr, record];
      return { [store]: next } as Partial<AppState>;
    });
  },

  remove: (store, id) => {
    dbDelete(store, id).catch(console.error);
    const t = recordDeletions([{ store, id }]);
    set((s) => ({ [store]: (s[store] as { id: string }[]).filter((x) => x.id !== id), tombstones: t(s.tombstones) }) as Partial<AppState>);
  },

  deleteCourse: (id) => {
    const s = get();
    const gone: { store: StoreName; id: string }[] = [{ store: 'courses', id }];
    const drop = <T extends { id: string; courseId?: string | null }>(store: StoreName, arr: T[]) => {
      const keep: T[] = [];
      for (const item of arr) {
        if (item.courseId === id) {
          dbDelete(store, item.id).catch(console.error);
          gone.push({ store, id: item.id });
        } else keep.push(item);
      }
      return keep;
    };
    const course = s.courses.find((c) => c.id === id);
    const annIds = new Set<string>([
      ...s.lectures.filter((l) => l.courseId === id).flatMap((l) => l.attachments.map((a) => a.id)),
      ...(course?.resources.map((r) => r.id) ?? []),
    ]);
    const annotations = s.annotations.filter((a) => {
      if (annIds.has(a.id)) {
        dbDelete('annotations', a.id).catch(console.error);
        gone.push({ store: 'annotations', id: a.id });
        return false;
      }
      return true;
    });
    dbDelete('courses', id).catch(console.error);
    const next = {
      courses: s.courses.filter((c) => c.id !== id),
      assignments: drop('assignments', s.assignments),
      lectures: drop('lectures', s.lectures),
      exams: drop('exams', s.exams),
      notes: drop('notes', s.notes),
      sessions: drop('sessions', s.sessions),
      flashcards: drop('flashcards', s.flashcards),
      annotations,
    };
    set({
      ...next,
      tombstones: recordDeletions(gone)(s.tombstones),
      ui: { ...s.ui, selectedCourseId: s.ui.selectedCourseId === id ? null : s.ui.selectedCourseId },
    });
  },

  setSettings: (patch) => {
    const synced = SYNCED_SETTINGS.some((k) => k in patch);
    const next = { ...get().settings, ...patch, ...(synced ? { updatedAt: stamp() } : {}) };
    saveSettings(next);
    set({ settings: next });
  },

  setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),

  exportJSON: () => {
    const s = get();
    return JSON.stringify(
      {
        app: 'academic-os',
        version: 2,
        exportedAt: new Date().toISOString(),
        settings: s.settings,
        data: {
          courses: s.courses,
          assignments: s.assignments,
          lectures: s.lectures,
          exams: s.exams,
          notes: s.notes,
          sessions: s.sessions,
          flashcards: s.flashcards,
          annotations: s.annotations,
        },
        tombstones: s.tombstones,
      },
      null,
      2
    );
  },

  // Merges rather than overwrites: anything changed here since the backup was made is kept.
  importJSON: (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Could not read that file as JSON.' };
    }
    const d = parsed?.data;
    if (!d || typeof d !== 'object') return { ok: false, error: 'Not an Academic OS backup file.' };
    const plan = planMerge(get().localSide(), sanitizeSide(d, parsed.tombstones));
    get().applyPlan(plan);
    const settingsChanged = get().mergeSettings(parsed.settings);
    return { ok: true, changed: planSize(plan) + (settingsChanged ? 1 : 0) };
  },

  localSide: () => {
    const s = get();
    const records: Records = {};
    for (const store of STORES) records[store] = s[store] as { id: string; updatedAt?: string }[];
    return { records, tombstones: s.tombstones };
  },

  applyPlan: (plan) => {
    const s = get();
    const patch: Record<string, unknown> = {};
    for (const store of STORES) {
      const incoming = (plan.put[store] ?? []).map((r) => normalize(store, r) as { id: string; updatedAt?: string });
      const dels = plan.del.filter((x) => x.store === store).map((x) => x.id);
      if (incoming.length === 0 && dels.length === 0) continue;
      dbBulkPut(store, incoming).catch(console.error);
      dbBulkDelete(store, dels).catch(console.error);
      incoming.forEach((r) => observe(r.updatedAt));
      const replaced = new Set([...incoming.map((r) => r.id), ...dels]);
      patch[store] = [...(s[store] as { id: string }[]).filter((x) => !replaced.has(x.id)), ...incoming];
    }
    if (plan.tombstones.length) {
      dbBulkPut(TOMBSTONES, plan.tombstones).catch(console.error);
      plan.tombstones.forEach((t) => observe(t.deletedAt));
      const keys = new Set(plan.tombstones.map((t) => t.key));
      patch.tombstones = [...s.tombstones.filter((t) => !keys.has(t.key)), ...plan.tombstones];
    }
    set(patch as Partial<AppState>);
  },

  mergeSettings: (remote) => {
    if (!remote || typeof remote !== 'object') return false;
    const local = get().settings;
    // backups from before change tracking carry no stamp: they still restore onto an unstamped device
    const newer = remote.updatedAt ? !local.updatedAt || remote.updatedAt > local.updatedAt : !local.updatedAt;
    if (!newer) return false;
    const picked: Partial<Settings> = {};
    for (const k of SYNCED_SETTINGS) if (remote[k] !== undefined) (picked as Record<string, unknown>)[k] = remote[k];
    if (Object.keys(picked).length === 0) return false;
    observe(remote.updatedAt);
    const settings = { ...local, ...picked, updatedAt: remote.updatedAt ?? local.updatedAt };
    saveSettings(settings);
    set({ settings });
    return SYNCED_SETTINGS.some((k) => settings[k] !== local[k]);
  },

  resetAll: async () => {
    await Promise.all([...STORES.map((s) => dbClear(s).catch(() => undefined)), dbClear(TOMBSTONES).catch(() => undefined)]);
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch { /* ignore */ }
    set({
      courses: [], assignments: [], lectures: [], exams: [], notes: [], sessions: [], flashcards: [], annotations: [],
      tombstones: [],
      settings: DEFAULT_SETTINGS,
      ui: { quickAdd: null, searchOpen: false, navOpen: false, focus: null, selectedCourseId: null },
    });
  },

  loadSample: () => {
    const d = buildSampleData();
    const patch: Record<string, unknown> = {};
    for (const store of Object.keys(d) as StoreName[]) {
      const items = (d[store] as object[]).map((x) => ({ ...x, updatedAt: stamp() }));
      dbBulkPut(store, items).catch(console.error);
      patch[store] = [...(get()[store] as object[]), ...items];
    }
    set(patch as Partial<AppState>);
  },
}));

/** Persist deletion records; returns an updater for the in-memory list. */
function recordDeletions(items: { store: StoreName; id: string }[]) {
  const deletedAt = stamp();
  const tombs: Tombstone[] = items.map(({ store, id }) => ({ key: tombKey(store, id), store, id, deletedAt }));
  dbBulkPut(TOMBSTONES, tombs).catch(console.error);
  const keys = new Set(tombs.map((t) => t.key));
  return (prev: Tombstone[]) => [...prev.filter((t) => !keys.has(t.key)), ...tombs];
}
