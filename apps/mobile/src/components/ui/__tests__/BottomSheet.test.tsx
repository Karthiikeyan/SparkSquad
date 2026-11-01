import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BottomSheet, shouldDismiss } from '../BottomSheet';

describe('BottomSheet', () => {
  it('renders its content and closes when tapping outside', async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet visible onClose={onClose} accessibilityLabel="Check in">
        <Text>Inside</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Inside')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses on a long drag or a flick, and springs back otherwise', () => {
    expect(shouldDismiss(120, 0)).toBe(true);
    expect(shouldDismiss(40, 1.2)).toBe(true);
    expect(shouldDismiss(40, 0.2)).toBe(false);
    expect(shouldDismiss(10, 2)).toBe(false);
  });
});
