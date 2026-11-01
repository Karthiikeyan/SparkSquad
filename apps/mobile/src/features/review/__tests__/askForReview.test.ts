import { clearPrefs, setPref } from '../../../lib/prefs';
import { shouldAskForReview } from '../askForReview';

const NOW = new Date('2026-11-01T10:00:00Z');

describe('store rating prompt', () => {
  beforeEach(() => clearPrefs());

  it('waits for a 7-day streak', () => {
    expect(shouldAskForReview(6, NOW)).toBe(false);
    expect(shouldAskForReview(7, NOW)).toBe(true);
    expect(shouldAskForReview(40, NOW)).toBe(true);
  });

  it('does not ask again for 120 days', () => {
    setPref('reviewAskedAt', '2026-10-01T10:00:00Z');
    expect(shouldAskForReview(30, NOW)).toBe(false);
    setPref('reviewAskedAt', '2026-07-01T10:00:00Z');
    expect(shouldAskForReview(30, NOW)).toBe(true);
  });
});
