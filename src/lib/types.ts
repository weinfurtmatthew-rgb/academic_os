export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type AssignmentStatus = 'not_started' | 'in_progress' | 'submitted' | 'completed';
export type ExamStatus = 'not_started' | 'studying' | 'ready' | 'completed';
export type Theme = 'light' | 'dark' | 'system';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

export interface Resource {
  id: string;
  title: string;
  kind: 'link' | 'file';
  url?: string;
  dataUrl?: string;
}

/** A recurring weekly class meeting (lecture, lab, seminar…). */
export interface ClassMeeting {
  id: string;
  day: number; // 0 = Monday … 6 = Sunday
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM"
  location: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  instructor: string;
  email: string;
  phone: string;
  office: string;
  officeHours: string;
  credits: number;
  semester: string;
  color: string;
  schedule: ClassMeeting[];
  resources: Resource[];
  createdAt: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string; // ISO
  priority: Priority;
  status: AssignmentStatus;
  estimatedHours: number;
  grade: number | null; // percent
  completedAt: string | null;
  /** Where this gets turned in (Canvas/Gradescope/portal URL). */
  submissionUrl: string;
  /** Free-text submission requirements: format, file naming, where to upload. */
  submissionNotes: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt?: string;
}

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  date: string; // ISO
  summary: string;
  notes: string; // markdown
  attachments: Attachment[];
  updatedAt?: string;
}

export interface Exam {
  id: string;
  courseId: string;
  name: string;
  date: string; // ISO
  weight: number; // percent of final grade
  status: ExamStatus;
  grade: number | null; // percent
  updatedAt?: string;
}

export interface Note {
  id: string;
  title: string;
  courseId: string | null;
  lectureId: string | null;
  content: string; // markdown
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  courseId: string;
  topic: string;
  date: string; // ISO
  durationMin: number;
  notes: string;
  done: boolean;
  mood: number | null; // 1-5, logged when a study session ends
  updatedAt?: string;
}

export interface Settings {
  theme: Theme;
  gpaScale: number; // 4 | 5 | 10
  semesterStart: string; // yyyy-mm-dd
  semesterEnd: string;
  /** Canvas calendar feed link (https://…/feeds/calendars/user_….ics), when connected. */
  canvasFeedUrl?: string;
  /** Canvas course name → course id here, or 'new' / 'skip'. */
  canvasCourses?: Record<string, string>;
  /** When a synced setting last changed. Theme is per-device and doesn't count. */
  updatedAt?: string;
}

/** Settings copied between devices; the rest (theme) stay per-device. */
export const SYNCED_SETTINGS = ['gpaScale', 'semesterStart', 'semesterEnd', 'canvasFeedUrl', 'canvasCourses'] as const;

/** Remembers a deletion so sync and import don't bring the record back. */
export interface Tombstone {
  key: string; // `${store}:${id}`
  store: string;
  id: string;
  deletedAt: string;
}

/** Spaced-repetition flashcard (SM-2-lite). */
export interface Flashcard {
  id: string;
  courseId: string | null;
  noteId: string | null;
  front: string; // markdown
  back: string; // markdown
  ease: number; // ≥1.3, default 2.5
  intervalDays: number;
  reps: number;
  due: string; // ISO — when the card is next due for review
  lastReviewed: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** One freehand / highlighter stroke on a PDF page (normalized 0-1 coords). */
export interface PdfStroke {
  tool: 'pen' | 'highlighter';
  color: string;
  size: number; // fraction of page width
  pts: number[]; // [x1,y1,x2,y2,…] normalized
}

export interface PdfTextNote {
  id: string;
  x: number; // normalized
  y: number;
  text: string;
}

/** All annotations for one PDF attachment (keyed by the attachment/resource id). */
export interface PdfAnnotationDoc {
  id: string; // attachment or resource id
  title: string;
  strokes: Record<string, PdfStroke[]>; // page number -> strokes
  texts: Record<string, PdfTextNote[]>; // page number -> sticky notes
  updatedAt: string;
}

export type FocusTarget = {
  type: 'course' | 'assignment' | 'lecture' | 'exam' | 'note' | 'session';
  id: string;
} | null;

export interface CalItem {
  id: string;
  kind: 'assignment' | 'exam' | 'session';
  title: string;
  date: string;
  color: string;
  courseId: string;
  done?: boolean;
}

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const ASSIGNMENT_STATUSES: { value: AssignmentStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'completed', label: 'Completed' },
];

export const EXAM_STATUSES: { value: ExamStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'studying', label: 'Studying' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
];

export const COURSE_COLORS = [
  '#5B5BD6', '#8B5CF6', '#D946EF', '#F43F5E', '#F97316', '#F5B935',
  '#84CC16', '#10B981', '#14B8A6', '#0EA5E9', '#3B82F6', '#64748B',
];

export const DAYS: { value: number; label: string; short: string }[] = [
  { value: 0, label: 'Monday', short: 'Mon' },
  { value: 1, label: 'Tuesday', short: 'Tue' },
  { value: 2, label: 'Wednesday', short: 'Wed' },
  { value: 3, label: 'Thursday', short: 'Thu' },
  { value: 4, label: 'Friday', short: 'Fri' },
  { value: 5, label: 'Saturday', short: 'Sat' },
  { value: 6, label: 'Sunday', short: 'Sun' },
];
