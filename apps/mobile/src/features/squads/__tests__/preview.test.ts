import type { SquadPreviewDTO } from '@sparksquad/shared';
import { dateToReminder, formatReminder, reminderToDate } from '../../onboarding/time';
import { joinAction } from '../SquadPreview';

jest.mock('../../../lib/runtime', () => ({ refresh: jest.fn() }));
jest.mock('../../../lib/auth', () => ({ authClient: {}, authCookie: async () => '' }));

const preview = (over: Partial<SquadPreviewDTO> = {}): SquadPreviewDTO => ({
  id: 'S1',
  name: 'Placement Squad 7',
  description: '',
  rules: '',
  category: 'career',
  privacy: 'public',
  memberCount: 9,
  memberLimit: 100,
  owner: { id: 'U1', username: 'o', displayName: 'Owner', avatarColor: 0 },
  challenge: null,
  myStatus: null,
  ...over,
});

describe('joinAction', () => {
  it('joins public squads directly', () => {
    expect(joinAction(preview(), false)).toBe('join');
    expect(joinAction(preview({ myStatus: 'left' }), false)).toBe('join');
  });

  it('requests private squads only with the invite code', () => {
    expect(joinAction(preview({ privacy: 'private' }), true)).toBe('request');
    expect(joinAction(preview({ privacy: 'private' }), false)).toBe('closed');
  });

  it('reflects membership and pending requests', () => {
    expect(joinAction(preview({ myStatus: 'active' }), true)).toBe('member');
    expect(joinAction(preview({ myStatus: 'pending', privacy: 'private' }), true)).toBe('pending');
  });

  it('blocks rejoining a public squad after removal', () => {
    expect(joinAction(preview({ myStatus: 'removed' }), false)).toBe('closed');
  });
});

describe('reminder time helpers', () => {
  it('round-trips and formats', () => {
    expect(dateToReminder(reminderToDate('07:05'))).toBe('07:05');
    expect(dateToReminder(reminderToDate('nonsense'))).toBe('20:00');
    expect(formatReminder('20:00')).toBe('8:00 PM');
    expect(formatReminder('00:30')).toBe('12:30 AM');
    expect(formatReminder('12:00')).toBe('12:00 PM');
  });
});
