import type { PlanDay } from '@sparksquad/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { challenge, checkin, ME_ID, squad } from '../../../test/fixtures';
import { ChallengeCard } from '../ChallengeCard';
import type { TodayCard } from '../model';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

const day: PlanDay = {
  day: 12,
  title: 'Sliding window',
  rest: false,
  tasks: [
    { id: 'a', title: 'Solve 2 medium array problems', type: 'count', target: 2, unit: 'problems' },
    { id: 'b', title: 'Watch the lesson', type: 'minutes', target: 30 },
    { id: 'c', title: 'Write notes', type: 'check' },
  ],
};

function card(over: Partial<TodayCard> = {}): TodayCard {
  return {
    challenge: challenge('C1', 'S1'),
    squad: squad('S1', { name: 'Placement Squad 7' }),
    state: 'active',
    today: '2026-10-31',
    dayNumber: 12,
    day,
    mine: null,
    minePending: false,
    members: [
      { id: 'U2', name: 'Divya', avatarColor: 1, checked: true, isMe: false },
      { id: ME_ID, name: 'Kiran Raj', avatarColor: 5, checked: false, isMe: true },
    ],
    checkedCount: 1,
    kind: 'tasks',
    backfill: null,
    ...over,
  };
}

const noop = () => undefined;

describe('ChallengeCard', () => {
  it('shows day, ring summary, ticks and a progress button (B1)', async () => {
    const onToggle = jest.fn();
    const onCheckIn = jest.fn();
    await render(
      <ChallengeCard
        card={card()}
        draft={{ 2: true }}
        onToggle={onToggle}
        onCheckIn={onCheckIn}
        onOpenSquad={noop}
      />,
    );
    expect(screen.getByText('Day 12 of 60')).toBeTruthy();
    expect(screen.getByLabelText('1 of 2 checked in')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Mark not done: Write notes' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark done: Watch the lesson' }));
    expect(onToggle).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Check in (1 of 3 done)' }));
    expect(onCheckIn).toHaveBeenCalledWith();
  });

  it('says "All done" when every task is ticked', async () => {
    await render(
      <ChallengeCard
        card={card()}
        draft={{ 0: 2, 1: 30, 2: true }}
        onToggle={noop}
        onCheckIn={noop}
        onOpenSquad={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'All done. Check in now' })).toBeTruthy();
  });

  it('collapses after checking in, with edit and sync state (B3)', async () => {
    const mine = checkin('K1', 'C1', ME_ID, '2026-10-31', {
      createdAt: '2026-10-31T02:12:00.000Z',
    });
    const onCheckIn = jest.fn();
    await render(
      <ChallengeCard
        card={card({ mine, minePending: true })}
        draft={{}}
        onToggle={noop}
        onCheckIn={onCheckIn}
        onOpenSquad={noop}
      />,
    );
    expect(screen.getByText(/^Checked in at /)).toBeTruthy();
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit today’s check-in for DSA 60' }));
    expect(onCheckIn).toHaveBeenCalled();
  });

  it('shows a rest day and the backfill offer (B7)', async () => {
    const onCheckIn = jest.fn();
    await render(
      <ChallengeCard
        card={card({
          day: { ...day, rest: true, tasks: [] },
          backfill: { date: '2026-10-30', dayNumber: 11 },
        })}
        draft={{}}
        onToggle={noop}
        onCheckIn={onCheckIn}
        onOpenSquad={noop}
      />,
    );
    expect(screen.getByText('Rest day')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Check in for yesterday' }));
    expect(onCheckIn).toHaveBeenCalledWith('2026-10-30');
  });

  it('shows the start date for an upcoming challenge', async () => {
    await render(
      <ChallengeCard
        card={card({
          state: 'upcoming',
          challenge: { ...challenge('C1', 'S1'), startDate: '2026-11-03' },
        })}
        draft={{}}
        onToggle={noop}
        onCheckIn={noop}
        onOpenSquad={noop}
      />,
    );
    expect(screen.getByText('Starts Tuesday 3 November')).toBeTruthy();
  });
});
