import { fireEvent, render, screen } from '@testing-library/react-native';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import {
  AvatarRing,
  Button,
  ChipToggle,
  DayStrip,
  EmptyState,
  GroupedList,
  Heatmap,
  initialsFor,
  ListRow,
  PhaseBar,
  ProgressBar,
  SegmentedControl,
  Stepper,
  Switch,
  TabBar,
  TaskRow,
  TextField,
} from '../index';

describe('TaskRow', () => {
  it('is a checkbox with a spoken action and toggles', async () => {
    const onToggle = jest.fn();
    await render(
      <TaskRow title="Solve 2 problems" meta="1 of 2" done={false} onToggle={onToggle} />,
    );
    const box = screen.getByRole('checkbox', { name: 'Mark done: Solve 2 problems' });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(box);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 of 2')).toBeTruthy();
  });

  it('describes the done state', async () => {
    await render(<TaskRow title="Notes" done onToggle={() => undefined} />);
    expect(screen.getByRole('checkbox', { name: 'Mark not done: Notes' })).toBeTruthy();
  });
});

describe('Stepper', () => {
  function Harness() {
    const [v, setV] = useState(1);
    return <Stepper value={v} onChange={setV} label="minutes" min={0} max={2} />;
  }

  it('steps within bounds and labels both buttons', async () => {
    await render(<Harness />);
    const inc = screen.getByRole('button', { name: 'Increase minutes' });
    await fireEvent.press(inc);
    await fireEvent.press(inc);
    expect(screen.getByText('2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease minutes' }));
    expect(screen.getByText('1')).toBeTruthy();
  });
});

describe('SegmentedControl', () => {
  it('exposes tabs with selection and reports changes', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        accessibilityLabel="Squad sections"
        value="board"
        onChange={onChange}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'leaderboard', label: 'Leaderboard' },
          { value: 'plan', label: 'Plan' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Board' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByRole('tab', { name: 'Plan' }));
    expect(onChange).toHaveBeenCalledWith('plan');
  });

  it('uses radios in settings', async () => {
    await render(
      <SegmentedControl
        role="radiogroup"
        tone="surface"
        accessibilityLabel="Provider"
        value="gemini"
        onChange={() => undefined}
        options={[
          { value: 'gemini', label: 'Gemini' },
          { value: 'openai', label: 'OpenAI' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Gemini' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });
});

describe('Switch and ListRow', () => {
  it('exposes a switch role with checked state', async () => {
    const onChange = jest.fn();
    await render(
      <GroupedList>
        <ListRow title="Squad updates" toggle={{ value: true, onValueChange: onChange }} />
        <ListRow title="Daily reminder" value="8:00 PM" chevron onPress={() => undefined} />
      </GroupedList>,
    );
    const sw = screen.getByRole('switch', { name: 'Squad updates' });
    expect(sw.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Daily reminder, 8:00 PM' })).toBeTruthy();
  });

  it('standalone switch toggles', async () => {
    const onChange = jest.fn();
    await render(<Switch value={false} onValueChange={onChange} accessibilityLabel="Nudges" />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Nudges' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Avatar ring', () => {
  it('computes initials', async () => {
    expect(initialsFor('Kiran Raj')).toBe('KR');
    expect(initialsFor('Divya')).toBe('DI');
    expect(initialsFor('  ')).toBe('?');
  });

  it('labels grid members by check-in state, not colour alone', async () => {
    await render(
      <AvatarRing
        variant="grid"
        members={[
          { id: 'a', name: 'Divya', checked: true },
          { id: 'b', name: 'Kavya', checked: false },
        ]}
      />,
    );
    expect(screen.getByLabelText('Divya, checked in today')).toBeTruthy();
    expect(screen.getByLabelText('Kavya, not checked in yet')).toBeTruthy();
  });

  it('collapses overflow in the row variant', async () => {
    const members = Array.from({ length: 12 }, (_, i) => ({
      id: `u${i}`,
      name: `U ${i}`,
      checked: i < 6,
    }));
    await render(<AvatarRing members={members} max={9} accessibilityLabel="6 of 12 checked in" />);
    expect(screen.getByText('+3')).toBeTruthy();
    expect(screen.getByLabelText('6 of 12 checked in')).toBeTruthy();
  });
});

describe('DayStrip', () => {
  it('speaks each day state (missed is grey + labelled)', async () => {
    const onSelect = jest.fn();
    await render(
      <DayStrip
        onSelect={onSelect}
        days={[
          { n: 10, weekday: 'T', state: 'done' },
          { n: 11, weekday: 'F', state: 'missed' },
          { n: 12, weekday: 'S', state: 'today' },
          { n: 14, weekday: 'M', state: 'rest' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Day 11, missed' })).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Day 12, today' }).props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByRole('tab', { name: 'Day 14, review day' }));
    expect(onSelect).toHaveBeenCalledWith(14);
  });
});

describe('progress', () => {
  it('reports percent and phases', async () => {
    await render(
      <>
        <ProgressBar value={0.724} />
        <PhaseBar total={4} current={1} progress={0.79} />
      </>,
    );
    expect(screen.getByLabelText('72 percent')).toBeTruthy();
    expect(screen.getByLabelText('Phase 1 of 4')).toBeTruthy();
  });

  it('heatmap has one image label', async () => {
    await render(<Heatmap levels={Array(126).fill(1)} checkinCount={108} />);
    expect(
      screen.getByLabelText('Check-in activity for the last 18 weeks, 108 check-ins'),
    ).toBeTruthy();
  });
});

describe('Buttons, chips, empty state', () => {
  it('disables the button and blocks presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Check in" onPress={onPress} disabled />);
    const btn = screen.getByRole('button', { name: 'Check in' });
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('chips expose checked state for multi-select', async () => {
    const onPress = jest.fn();
    await render(<ChipToggle label="Career" selected role="checkbox" onPress={onPress} />);
    const chip = screen.getByRole('checkbox', { name: 'Career' });
    expect(chip.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });

  it('empty state has one sentence and one action', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        icon={Users}
        message="You’re not in a squad yet"
        actionLabel="Join"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Join' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('shows a counter and enforces the max length', async () => {
    await render(
      <TextField label="Note for your squad" value="Sliding window" counter={280} multiline />,
    );
    expect(screen.getByText('14 / 280')).toBeTruthy();
    expect(screen.getByLabelText('Note for your squad').props.maxLength).toBe(280);
  });
});

describe('TabBar', () => {
  it('has four tabs plus the centre check-in button', async () => {
    const onNavigate = jest.fn();
    const onCheckIn = jest.fn();
    await render(
      <TabBar active="today" onNavigate={onNavigate} onCheckIn={onCheckIn} bottomInset={34} />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Today' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByRole('tab', { name: 'Discover' }));
    expect(onNavigate).toHaveBeenCalledWith('discover');
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(onCheckIn).toHaveBeenCalled();
  });
});
