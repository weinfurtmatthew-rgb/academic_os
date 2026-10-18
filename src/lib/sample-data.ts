import type { Assignment, Course, Exam, Flashcard, Lecture, Note, PdfAnnotationDoc, StudySession } from './types';
import { addDays, uid } from './utils';

function at(daysFromNow: number, hour = 12): string {
  const d = addDays(new Date(), daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function buildSampleData() {
  const now = new Date().toISOString();
  const cs: Course = { id: uid(), name: 'Data Structures & Algorithms', code: 'CS 201', instructor: 'Dr. Okafor', email: 'okafor@example.edu', phone: '(555) 014-2201', office: 'SCI 412', officeHours: 'Tue & Thu 14:00–16:00, or by appointment', credits: 4, semester: 'Fall 2026', color: '#5B5BD6', schedule: [{ id: uid(), day: 0, start: '10:00', end: '11:15', location: 'SCI 204' }, { id: uid(), day: 2, start: '10:00', end: '11:15', location: 'SCI 204' }, { id: uid(), day: 4, start: '14:00', end: '15:50', location: 'LAB 3 (lab)' }], resources: [{ id: uid(), title: 'Course syllabus', kind: 'link', url: 'https://example.edu/cs201' }], createdAt: now };
  const math: Course = { id: uid(), name: 'Linear Algebra', code: 'MATH 240', instructor: 'Prof. Ben-Ami', email: 'benami@example.edu', phone: '', office: 'MATH 117', officeHours: 'Mon 13:00–15:00', credits: 3, semester: 'Fall 2026', color: '#10B981', schedule: [{ id: uid(), day: 1, start: '09:00', end: '10:15', location: 'MATH 100' }, { id: uid(), day: 3, start: '09:00', end: '10:15', location: 'MATH 100' }], resources: [], createdAt: now };
  const psych: Course = { id: uid(), name: 'Intro to Cognitive Psychology', code: 'PSY 110', instructor: 'Dr. Reyes', email: 'reyes@example.edu', phone: '', office: 'PSY 220B', officeHours: 'Wed 11:30–13:00', credits: 3, semester: 'Fall 2026', color: '#F97316', schedule: [{ id: uid(), day: 1, start: '13:00', end: '14:15', location: 'HUM AUD' }, { id: uid(), day: 3, start: '13:00', end: '14:15', location: 'HUM AUD' }], resources: [], createdAt: now };
  const writing: Course = { id: uid(), name: 'Academic Writing', code: 'ENG 150', instructor: 'M. Laurent', email: 'laurent@example.edu', phone: '', office: 'ENG 8', officeHours: 'By appointment (email first)', credits: 2, semester: 'Fall 2026', color: '#D946EF', schedule: [{ id: uid(), day: 4, start: '10:00', end: '11:50', location: 'ENG 12 (workshop)' }], resources: [], createdAt: now };
  const courses = [cs, math, psych, writing];

  const assignments: Assignment[] = [
    { id: uid(), courseId: cs.id, title: 'Problem set 4 — heaps', description: 'Implement a binary heap and answer the analysis questions.', dueDate: at(0, 23), priority: 'high', status: 'in_progress', estimatedHours: 4, grade: null, completedAt: null, submissionUrl: 'https://canvas.instructure.com/courses/1/assignments/4', submissionNotes: 'Upload a single PDF named LASTNAME_ps4.pdf plus heap.py. Show all work — code alone gets no credit.', attachments: [], createdAt: now },
    { id: uid(), courseId: cs.id, title: 'Graph traversal lab', description: 'BFS/DFS lab with visualisation.', dueDate: at(5, 17), priority: 'medium', status: 'not_started', estimatedHours: 3, grade: null, completedAt: null, submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: cs.id, title: 'Problem set 3 — sorting', description: '', dueDate: at(-7, 23), priority: 'medium', status: 'completed', estimatedHours: 4, grade: 92, completedAt: at(-7, 20), submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: math.id, title: 'Eigenvalues worksheet', description: 'Sections 5.1–5.3.', dueDate: at(2, 9), priority: 'medium', status: 'not_started', estimatedHours: 2, grade: null, completedAt: null, submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: math.id, title: 'Proof portfolio 2', description: '', dueDate: at(-10, 17), priority: 'high', status: 'completed', estimatedHours: 5, grade: 86, completedAt: at(-11, 18), submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: psych.id, title: 'Memory lab write-up', description: 'APA format, 1500 words.', dueDate: at(4, 23), priority: 'high', status: 'in_progress', estimatedHours: 6, grade: null, completedAt: null, submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: psych.id, title: 'Reading response — attention', description: '', dueDate: at(-3, 12), priority: 'low', status: 'completed', estimatedHours: 1, grade: 95, completedAt: at(-3, 10), submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: writing.id, title: 'Essay 2 draft', description: 'Argumentative essay, bring two copies to workshop.', dueDate: at(7, 10), priority: 'critical', status: 'not_started', estimatedHours: 8, grade: null, completedAt: null, submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
    { id: uid(), courseId: writing.id, title: 'Peer review notes', description: '', dueDate: at(-1, 10), priority: 'low', status: 'submitted', estimatedHours: 1, grade: null, completedAt: null, submissionUrl: '', submissionNotes: '', attachments: [], createdAt: now },
  ];

  const exams: Exam[] = [
    { id: uid(), courseId: cs.id, name: 'Midterm 2', date: at(9, 14), weight: 25, status: 'studying', grade: null },
    { id: uid(), courseId: math.id, name: 'Midterm', date: at(13, 9), weight: 30, status: 'not_started', grade: null },
    { id: uid(), courseId: psych.id, name: 'Quiz 3', date: at(3, 11), weight: 10, status: 'ready', grade: null },
    { id: uid(), courseId: cs.id, name: 'Midterm 1', date: at(-21, 14), weight: 25, status: 'completed', grade: 88 },
  ];

  const lectures: Lecture[] = [
    { id: uid(), courseId: cs.id, title: 'Lecture 12 — Priority queues', date: at(-1, 10), summary: 'Binary heaps, heapify, and heap sort.', notes: '## Key ideas\n\n- A **binary heap** is a complete binary tree stored in an array\n- Parent of `i` is `(i-1)/2`; children are `2i+1`, `2i+2`\n- `heapify` runs in $O(n)$, not $O(n \\log n)$\n\n- [ ] Re-derive the heapify bound\n- [x] Do the in-class exercise', attachments: [] },
    { id: uid(), courseId: math.id, title: 'Lecture 15 — Eigenvectors', date: at(-2, 9), summary: 'Geometric intuition for eigenvalues.', notes: 'For a matrix $A$, an eigenvector $v$ satisfies $Av = \\lambda v$.\n\n$$\\det(A - \\lambda I) = 0$$', attachments: [] },
    { id: uid(), courseId: psych.id, title: 'Lecture 9 — Working memory', date: at(-1, 13), summary: 'Baddeley model, capacity limits.', notes: '| Component | Role |\n| --- | --- |\n| Phonological loop | verbal info |\n| Visuospatial sketchpad | visual info |\n| Central executive | control |', attachments: [] },
  ];

  const notes: Note[] = [
    { id: uid(), title: 'Heap cheat sheet', courseId: cs.id, lectureId: null, content: '# Heaps\n\n- Insert: $O(\\log n)$\n- Extract-min: $O(\\log n)$\n- Build: $O(n)$\n\n```python\nimport heapq\nheapq.heappush(h, x)\n```\n\nSee also [[Exam strategy]].', createdAt: now, updatedAt: now },
    { id: uid(), title: 'Exam strategy', courseId: null, lectureId: null, content: '## Before every exam\n\n- [ ] Past papers under timed conditions\n- [ ] One-page summary sheet\n- [ ] Sleep 8 hours, no cramming after 22:00', createdAt: now, updatedAt: now },
    { id: uid(), title: 'Essay 2 outline', courseId: writing.id, lectureId: null, content: '1. Hook + thesis\n2. Counter-argument first\n3. Two supporting bodies\n4. Synthesis conclusion\n\n> Workshop feedback: tighten the thesis.', createdAt: now, updatedAt: now },
  ];

  const sessions: StudySession[] = [
    { id: uid(), courseId: cs.id, topic: 'Heaps problem set', date: at(0, 16), durationMin: 90, notes: '', done: false, mood: null },
    { id: uid(), courseId: psych.id, topic: 'Quiz 3 review', date: at(1, 18), durationMin: 60, notes: 'Chapters 5–6', done: false, mood: null },
    { id: uid(), courseId: math.id, topic: 'Eigenvalues practice', date: at(2, 15), durationMin: 75, notes: '', done: false, mood: null },
    { id: uid(), courseId: cs.id, topic: 'Graph algorithms', date: at(-1, 17), durationMin: 80, notes: '', done: true, mood: 4 },
    { id: uid(), courseId: writing.id, topic: 'Essay research', date: at(-2, 14), durationMin: 50, notes: '', done: true, mood: 4 },
    { id: uid(), courseId: math.id, topic: 'Problem drill', date: at(-3, 19), durationMin: 60, notes: '', done: true, mood: 4 },
    { id: uid(), courseId: psych.id, topic: 'Flashcards', date: at(-4, 12), durationMin: 30, notes: '', done: true, mood: 4 },
  ];

  const card = (courseId: string | null, front: string, back: string, dueDays: number): Flashcard => ({
    id: uid(), courseId, noteId: null, front, back,
    ease: 2.5, intervalDays: dueDays > 0 ? dueDays : 0, reps: dueDays > 0 ? 2 : 0,
    due: at(dueDays, 8), lastReviewed: dueDays > 0 ? at(-1, 8) : null, createdAt: now,
  });
  const flashcards: Flashcard[] = [
    card(cs.id, 'Time to **build** a binary heap from $n$ items?', '$O(n)$ — bottom-up heapify, *not* $O(n \\log n)$.', 0),
    card(cs.id, 'BFS uses which data structure?', 'A **queue** (FIFO). DFS uses a stack / recursion.', 0),
    card(cs.id, 'Heap: parent index of node $i$ (0-based array)?', '$\\lfloor (i-1)/2 \\rfloor$', 2),
    card(math.id, 'Definition of an **eigenvector**', 'Nonzero $v$ with $Av = \\lambda v$ for some scalar $\\lambda$ (the eigenvalue).', 0),
    card(math.id, 'Characteristic equation of $A$', '$$\\det(A - \\lambda I) = 0$$', 3),
    card(psych.id, 'Three components of Baddeley\'s working memory model', 'Phonological loop · visuospatial sketchpad · central executive.', 0),
    card(psych.id, 'Typical working-memory capacity', 'About **4 ± 1 chunks** (modern estimate; classic "7 ± 2").', 5),
    card(writing.id, 'Where should the counter-argument go in Essay 2?', 'Early — acknowledge it **before** the supporting bodies, then rebut.', 1),
  ];

  const annotations: PdfAnnotationDoc[] = [];

  return { courses, assignments, exams, lectures, notes, sessions, flashcards, annotations };
}
