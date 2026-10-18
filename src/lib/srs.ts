import type { Flashcard } from './types';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export const GRADES: { value: ReviewGrade; label: string; key: string; hint: (c: Flashcard) => string }[] = [
  { value: 'again', label: 'Again', key: '1', hint: () => '10 min' },
  { value: 'hard', label: 'Hard', key: '2', hint: (c) => `${Math.max(1, Math.round(c.intervalDays * 1.2))} d` },
  { value: 'good', label: 'Good', key: '3', hint: (c) => `${c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.intervalDays * c.ease)} d` },
  { value: 'easy', label: 'Easy', key: '4', hint: (c) => `${c.reps === 0 ? 2 : Math.round(c.intervalDays * c.ease * 1.3)} d` },
];

/** SM-2-lite: returns the card updated with new ease / interval / due date. */
export function gradeCard(card: Flashcard, grade: ReviewGrade, now = new Date()): Flashcard {
  let { ease, intervalDays, reps } = card;

  if (grade === 'again') {
    ease = Math.max(1.3, ease - 0.2);
    reps = 0;
    intervalDays = 0;
    const due = new Date(now.getTime() + 10 * 60 * 1000);
    return { ...card, ease, intervalDays, reps, due: due.toISOString(), lastReviewed: now.toISOString() };
  }

  if (grade === 'hard') {
    ease = Math.max(1.3, ease - 0.15);
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
  } else if (grade === 'good') {
    intervalDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(1, Math.round(intervalDays * ease));
  } else {
    ease = Math.min(3.2, ease + 0.15);
    intervalDays = reps === 0 ? 2 : Math.max(2, Math.round(intervalDays * ease * 1.3));
  }
  reps += 1;

  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);
  due.setHours(4, 0, 0, 0);
  return { ...card, ease, intervalDays, reps, due: due.toISOString(), lastReviewed: now.toISOString() };
}

export function isDue(card: Flashcard, now = new Date()): boolean {
  return card.due <= now.toISOString();
}

/** "learned" = answered correctly enough times that it has a multi-week interval. */
export function isLearned(card: Flashcard): boolean {
  return card.reps >= 3 && card.intervalDays >= 14;
}
