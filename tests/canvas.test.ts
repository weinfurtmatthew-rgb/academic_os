import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from '../src/lib/canvas/ics.ts';
import {
  NEW_COURSE, SKIP, assignmentIdFor, canvasFeedUrl, canvasItems, courseIdFor, guessCode, guessName, matchCourse, planImport,
} from '../src/lib/canvas/feed.ts';
import type { Assignment, Course } from '../src/lib/types.ts';

// shaped like a real Canvas user feed: CRLF, folded lines, escapes, an all-day item and a calendar event
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:icalendar-ruby',
  'BEGIN:VEVENT',
  'DTSTAMP:20261019T120000Z',
  'UID:event-assignment-501',
  'DTSTART:20261024T035900Z',
  'DTEND:20261024T035900Z',
  'SUMMARY:Problem set 5 [MATH 240 - Linear Algebra]',
  'DESCRIPTION:Sections 5.1\\, 5.2\\nShow your work\; no calculators.',
  'URL;VALUE=URI:https://school.instructure.com/courses/9/assignments/501',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-assignment-502',
  'DTSTART;VALUE=DATE:20261030',
  'SUMMARY:Reading response: a very long title that Canvas folds across',
  '  two lines [PSY 110 Intro to Cognitive Psychology]',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-calendar-event-77',
  'DTSTART:20261021T150000Z',
  'SUMMARY:Office hours [MATH 240 - Linear Algebra]',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-assignment-400',
  'DTSTART:20260901T035900Z',
  'SUMMARY:Old quiz [MATH 240 - Linear Algebra]',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const course = (id: string, code: string, name: string): Course => ({
  id, code, name, instructor: '', email: '', phone: '', office: '', officeHours: '', credits: 3, semester: '',
  color: '#5B5BD6', schedule: [], resources: [], createdAt: '2026-08-01T00:00:00Z',
});

test('parses events: unfolds lines, unescapes text, reads UTC and all-day dates', () => {
  const ev = parseIcs(FEED);
  assert.equal(ev.length, 4);
  assert.equal(ev[0].start, '2026-10-24T03:59:00.000Z');
  assert.equal(ev[0].description, 'Sections 5.1, 5.2\nShow your work; no calculators.');
  assert.equal(ev[0].url, 'https://school.instructure.com/courses/9/assignments/501');
  assert.match(ev[1].summary, /folds across two lines \[PSY 110/);
  assert.equal(ev[1].allDay, true);
  const due = new Date(ev[1].start);
  assert.deepEqual([due.getDate(), due.getHours(), due.getMinutes()], [30, 23, 59]);
});

test('keeps assignments only and splits out the course', () => {
  const items = canvasItems(parseIcs(FEED));
  assert.deepEqual(items.map((i) => i.canvasId), ['501', '502', '400']);
  assert.equal(items[0].title, 'Problem set 5');
  assert.equal(items[0].courseLabel, 'MATH 240 - Linear Algebra');
});

test('accepts only Canvas feed links', () => {
  assert.equal(
    canvasFeedUrl(' webcal://school.instructure.com/feeds/calendars/user_AbC123xyz.ics '),
    'https://school.instructure.com/feeds/calendars/user_AbC123xyz.ics',
  );
  assert.equal(canvasFeedUrl('https://canvas.uni.edu/feeds/calendars/user_Q9-z_.ics?x=1'), 'https://canvas.uni.edu/feeds/calendars/user_Q9-z_.ics');
  for (const bad of [
    'http://school.instructure.com/feeds/calendars/user_abc.ics',
    'https://school.instructure.com/courses/9',
    'https://127.0.0.1/feeds/calendars/user_abc.ics',
    'https://localhost/feeds/calendars/user_abc.ics',
    'https://school.instructure.com:8443/feeds/calendars/user_abc.ics',
    'https://evil.com/feeds/calendars/user_abc.ics/../../x',
    'not a url',
  ]) assert.equal(canvasFeedUrl(bad), null, bad);
});

test('matches courses by code, then name', () => {
  const cs = [course('m', 'MATH 240', 'Linear Algebra'), course('p', 'PSY-110', 'Intro to Cognitive Psychology'), course('e', 'ENG 150', 'Academic Writing')];
  assert.equal(matchCourse('MATH 240 - Linear Algebra', cs)?.id, 'm');
  assert.equal(matchCourse('PSY 110 Intro to Cognitive Psychology', cs)?.id, 'p');
  assert.equal(matchCourse('Fall 2026 Academic Writing (Sec 3)', cs)?.id, 'e');
  assert.equal(matchCourse('BIO 101 Cells', cs), null);
  assert.equal(guessCode('Fall 2026 Linear Algebra (MATH-240-01)'), 'MATH 240');
  assert.equal(guessName('MATH 240 - Linear Algebra'), 'Linear Algebra');
  assert.equal(guessName('Fall 2026 Linear Algebra (MATH-240-01)'), 'Fall 2026 Linear Algebra');
  assert.equal(guessName('BIO 101'), 'BIO 101');
});

test('plans an import: new, updated, skipped, deleted, past and unmapped', () => {
  const items = canvasItems(parseIcs(FEED));
  const math = course('m', 'MATH 240', 'Linear Algebra');
  const since = new Date('2026-10-19T00:00:00Z');
  const now = '2026-10-19T12:00:00Z';

  const first = planImport({ items, assignments: [], courses: [math], map: { 'MATH 240 - Linear Algebra': 'm' }, deletedIds: new Set(), since, now });
  assert.deepEqual(first.create.map((a) => a.id), [assignmentIdFor('501')]); // the September quiz is in the past
  assert.equal(first.create[0].courseId, 'm');
  assert.equal(first.create[0].status, 'not_started');
  assert.deepEqual(first.unmapped, ['PSY 110 Intro to Cognitive Psychology']);

  // the student made it theirs; Canvas then moved the deadline
  const mine: Assignment = { ...first.create[0], status: 'in_progress', priority: 'high', description: 'my notes' };
  const moved = items.map((i) => (i.canvasId === '501' ? { ...i, dueDate: '2026-10-26T03:59:00.000Z' } : i));
  const second = planImport({ items: moved, assignments: [mine], courses: [math], map: { 'MATH 240 - Linear Algebra': 'm', 'PSY 110 Intro to Cognitive Psychology': SKIP }, deletedIds: new Set(), since, now });
  assert.equal(second.create.length, 0);
  assert.equal(second.update.length, 1);
  assert.equal(second.update[0].dueDate, '2026-10-26T03:59:00.000Z');
  assert.equal(second.update[0].status, 'in_progress');
  assert.equal(second.update[0].priority, 'high');
  assert.equal(second.update[0].description, 'my notes');
  assert.deepEqual(second.unmapped, []);

  // nothing changed: nothing to do
  const same = planImport({ items, assignments: [mine], courses: [math], map: { 'MATH 240 - Linear Algebra': 'm' }, deletedIds: new Set(), since, now });
  assert.equal(same.update.length + same.create.length, 0);

  // deleted here: stays deleted
  const gone = planImport({ items, assignments: [], courses: [math], map: { 'MATH 240 - Linear Algebra': 'm' }, deletedIds: new Set([assignmentIdFor('501')]), since, now });
  assert.equal(gone.create.length, 0);
});

test('new courses get a stable id so two devices importing agree', () => {
  const items = canvasItems(parseIcs(FEED));
  const plan = planImport({
    items, assignments: [], courses: [], map: { 'PSY 110 Intro to Cognitive Psychology': NEW_COURSE, 'MATH 240 - Linear Algebra': SKIP },
    deletedIds: new Set(), since: new Date('2026-10-19T00:00:00Z'), now: '2026-10-19T12:00:00Z',
  });
  assert.deepEqual(plan.newCourses, [{ id: courseIdFor('PSY 110 Intro to Cognitive Psychology'), label: 'PSY 110 Intro to Cognitive Psychology' }]);
  assert.equal(plan.create[0].courseId, plan.newCourses[0].id);
});
