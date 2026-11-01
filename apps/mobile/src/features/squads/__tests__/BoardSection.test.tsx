import { fireEvent, render, screen } from '@testing-library/react-native';
import { checkin, ME_ID } from '../../../test/fixtures';
import type { Board } from '../model';
import { BoardSection } from '../screens/BoardSection';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const board: Board = {
  today: '2026-10-31',
  state: 'running',
  dayNumber: 12,
  day: null,
  grid: [
    { id: 'U2', name: 'Divya', avatarColor: 1, checked: true, isMe: false },
    { id: ME_ID, name: 'Kiran Raj', avatarColor: 5, checked: false, isMe: true },
    { id: 'U3', name: 'Kavya', avatarColor: 2, checked: false, isMe: false },
    { id: 'U4', name: 'Vignesh', avatarColor: 3, checked: false, isMe: false },
  ],
  checkedCount: 1,
  stillToCheckIn: [
    { id: 'U3', name: 'Kavya', avatarColor: 2, checked: false, isMe: false, nudged: false },
    { id: 'U4', name: 'Vignesh', avatarColor: 3, checked: false, isMe: false, nudged: true },
  ],
  feed: [
    {
      checkin: checkin('K2', 'C1', 'U2', '2026-10-31', {
        note: 'Two pointers finally made sense.',
        reactionCount: 4,
        hasPhoto: true,
        createdAt: '2026-10-31T02:12:00.000Z',
      }),
      author: { id: 'U2', name: 'Divya', avatarColor: 1, checked: true, isMe: false },
      pending: false,
      tasksTotal: 3,
      tasksDone: 3,
    },
  ],
};

describe('BoardSection (C2)', () => {
  it('shows the count, nudges and feed actions', async () => {
    const onNudge = jest.fn();
    const onFire = jest.fn();
    await render(<BoardSection board={board} onNudge={onNudge} onFire={onFire} />);
    expect(screen.getByLabelText('1 of 4 showed up today')).toBeTruthy();
    expect(screen.getByLabelText('Divya, checked in today')).toBeTruthy();
    expect(screen.getByLabelText('You, not checked in yet')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Nudge Kavya' }));
    expect(onNudge).toHaveBeenCalledWith({ id: 'U3', name: 'Kavya' });
    expect(screen.getByRole('button', { name: 'Nudged' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });

    expect(screen.getByText('Two pointers finally made sense.')).toBeTruthy();
    expect(screen.getByText('Added proof')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fire, 4 reactions' }));
    expect(onFire).toHaveBeenCalledWith('K2');
    await fireEvent.press(screen.getByRole('button', { name: 'Comment' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/checkins/[id]', params: { id: 'K2' } });
  });

  it('nudges everyone still waiting in one tap, skipping those already nudged', async () => {
    const onNudgeAll = jest.fn();
    const waiting = [
      ...board.stillToCheckIn,
      { id: 'U5', name: 'Arun', avatarColor: 4, checked: false, isMe: false, nudged: false },
    ];
    await render(
      <BoardSection
        board={{ ...board, stillToCheckIn: waiting }}
        onNudge={jest.fn()}
        onNudgeAll={onNudgeAll}
        onFire={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('nudge-all'));
    expect(onNudgeAll).toHaveBeenCalledWith([
      { id: 'U3', name: 'Kavya' },
      { id: 'U5', name: 'Arun' },
    ]);
  });

  it('hides Nudge everyone when one tap would only reach one person', async () => {
    await render(
      <BoardSection board={board} onNudge={jest.fn()} onNudgeAll={jest.fn()} onFire={jest.fn()} />,
    );
    expect(screen.queryByTestId('nudge-all')).toBeNull();
  });

  it('celebrates only when the whole squad is in', async () => {
    const full = {
      ...board,
      state: 'running' as const,
      checkedCount: board.grid.length,
      stillToCheckIn: [],
    };
    const { rerender } = await render(
      <BoardSection board={full} onNudge={jest.fn()} onFire={jest.fn()} />,
    );
    expect(screen.getByText('Everyone showed up')).toBeTruthy();
    await rerender(
      <BoardSection board={{ ...full, checkedCount: 1 }} onNudge={jest.fn()} onFire={jest.fn()} />,
    );
    expect(screen.queryByText('Everyone showed up')).toBeNull();
  });

  it('explains when no challenge is running', async () => {
    await render(
      <BoardSection board={{ ...board, state: 'none' }} onNudge={jest.fn()} onFire={jest.fn()} />,
    );
    expect(screen.getByText(/No challenge running/)).toBeTruthy();
  });
});
