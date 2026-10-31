import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { OtpInput } from '../OtpInput';

function Harness({ onComplete }: { onComplete: (c: string) => void }) {
  const [v, setV] = useState('');
  return <OtpInput value={v} onChange={setV} onComplete={onComplete} />;
}

describe('OtpInput', () => {
  it('accepts a pasted code with noise and completes once', async () => {
    const onComplete = jest.fn();
    await render(<Harness onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), 'Code: 482 913');
    expect(onComplete).toHaveBeenCalledWith('482913');
    for (const d of ['4', '8', '2', '9', '1', '3']) expect(screen.getByText(d)).toBeTruthy();
  });

  it('does not complete on a partial code', async () => {
    const onComplete = jest.fn();
    await render(<Harness onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
