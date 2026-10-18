import { create } from 'zustand';
import { dbBulkPut, dbClear, dbDelete, dbGetAll, dbPut, STORES, type StoreName } from './db';
import { buildSampleData } from './sample-data';
import type {
  Assignment, Course, Exam, Flashcard, FocusTarget, Lecture, Note, PdfAnnotationDoc, Settings, StudySession,
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
  settings: Settings;
  ui: UIState;

  hydrate: () => Promise<void>;
  put: <K extends StoreName>(store: K, item: EntityOf[K]) => void;
  remove: (store: StoreName, id: string) => void;
  deleteCourse: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setUI: (patch: Partial<UIState>) => void;
  exportJSON: () => string;
  importJSON: (raw: string) => { ok: boolean; error?: string };
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
  settings: DEFAULT_SETTINGS,
  ui: { quickAdd: null, searchOpen: false, navOpen: false, focus: null, selectedCourseId: null },

  hydrate: async () => {
    if (get().hydrated) return;
    const [courses, assignments, lectures, exams, notes, sessions, flashcards, annotations] = await Promise.all([
      dbGetAll<Course>('courses'),
      dbGetAll<Assignment>('assignments'),
      dbGetAll<Lecture>('lectures'),
      dbGetAll<Exam>('exams'),
      dbGetAll<Note>('notes'),
      dbGetAll<StudySession>('sessions'),
      dbGetAll<Flashcard>('flashcards'),
      dbGetAll<PdfAnnotationDoc>('annotations'),
    ]);
    set({
      courses: courses.map(normalizeCourse),
      assignments: assignments.map(normalizeAssignment),
      lectures, exams, notes,
      sessions: sessions.map(normalizeSession),
      flashcards: flashcards.map(normalizeCard),
      annotations,
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
    if (store === 'notes') (record as unknown as Note).updatedAt = new Date().toISOString();

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
    set((s) => ({ [store]: (s[store] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<AppState>);
  },

  deleteCourse: (id) => {
    const s = get();
    const drop = <T extends { id: string; courseId?: string | null }>(store: StoreName, arr: T[]) => {
      const keep: T[] = [];
      for (const item of arr) {
        if (item.courseId === id) dbDelete(store, item.id).catch(console.error);
        else keep.push(item);
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
        return false;
      }
      return true;
    });
    dbDelete('courses', id).catch(console.error);
    set({
      courses: s.courses.filter((c) => c.id !== id),
      assignments: drop('assignments', s.assignments),
      lectures: drop('lectures', s.lectures),
      exams: drop('exams', s.exams),
      notes: drop('notes', s.notes),
      sessions: drop('sessions', s.sessions),
      flashcards: drop('flashcards', s.flashcards),
      annotations,
      ui: { ...s.ui, selectedCourseId: s.ui.selectedCourseId === id ? null : s.ui.selectedCourseId },
    });
  },

  setSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    saveSettings(next);
    set({ settings: next });
  },

  setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),

  exportJSON: () => {
    const s = get();
    return JSON.stringify(
      {
        app: 'academic-os',
        version: 1,
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
      },
      null,
      2
    );
  },

  importJSON: (raw) => {
    try {
      const parsed = JSON.parse(raw);
      const d = parsed?.data;
      if (!d || typeof d !== 'object') return { ok: false, error: 'Not an Academic OS backup file.' };
      const patch: Partial<AppState> = {};
      for (const store of STORES) {
        if (Array.isArray(d[store])) {
          dbBulkPut(store, d[store]).catch(console.error);
          const existing = get()[store] as { id: string }[];
          const incoming = d[store] as { id: string }[];
          const ids = new Set(incoming.map((x) => x.id));
          (patch as Record<string, unknown>)[store] = [...existing.filter((x) => !ids.has(x.id)), ...incoming];
        }
      }
      if (parsed.settings) {
        const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        saveSettings(settings);
        patch.settings = settings;
      }
      set(patch);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not read that file as JSON.' };
    }
  },

  resetAll: async () => {
    await Promise.all(STORES.map((s) => dbClear(s).catch(() => undefined)));
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch { /* ignore */ }
    set({
      courses: [], assignments: [], lectures: [], exams: [], notes: [], sessions: [],
      settings: DEFAULT_SETTINGS,
      ui: { quickAdd: null, searchOpen: false, navOpen: false, focus: null, selectedCourseId: null },
    });
  },

  loadSample: () => {
    const d = buildSampleData();
    (Object.keys(d) as StoreName[]).forEach((store) => dbBulkPut(store, d[store]).catch(console.error));
    set((s) => ({
      courses: [...s.courses, ...d.courses],
      assignments: [...s.assignments, ...d.assignments],
      lectures: [...s.lectures, ...d.lectures],
      exams: [...s.exams, ...d.exams],
      notes: [...s.notes, ...d.notes],
      sessions: [...s.sessions, ...d.sessions],
    }));
  },
}));
