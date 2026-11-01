import type * as StoreReview from 'expo-store-review';
import { getPref, setPref } from '../../lib/prefs';

export const REVIEW_MIN_STREAK = 7;
export const REVIEW_DELAY_MS = 1_500;
/** The stores limit how often the prompt really appears; this stops us wasting those chances. */
const REVIEW_GAP_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Someone on a real streak, right after a win, and not asked recently. */
export function shouldAskForReview(streak: number, now: Date = new Date()): boolean {
  if (streak < REVIEW_MIN_STREAK) return false;
  const last = getPref('reviewAskedAt');
  return !last || now.getTime() - new Date(last).getTime() >= REVIEW_GAP_DAYS * DAY_MS;
}

/** Shows the store's own rating sheet in the app. Both stores require using this as is. */
export async function askForReview(now: Date = new Date()): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
    const review = require('expo-store-review') as typeof StoreReview;
    if (!(await review.hasAction())) return;
    setPref('reviewAskedAt', now.toISOString());
    await review.requestReview();
  } catch {
    // A missed rating prompt is never worth bothering anyone about.
  }
}
