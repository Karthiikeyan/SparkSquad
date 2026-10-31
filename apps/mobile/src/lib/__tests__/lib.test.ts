jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('posthog-react-native', () => jest.fn());

import { compareVersions } from '../env';
import { formatLongDate, formatTime, maskSecret } from '../format';
import { sanitizeProps, scrubText } from '../analytics';
import { createLock } from '../db/helpers';

describe('analytics privacy', () => {
  it('drops sensitive keys and key-shaped values', () => {
    expect(
      sanitizeProps({
        screen: 'today',
        apiKey: 'x',
        token: 'y',
        email: 'a@b.c',
        note: 'private',
        provider: 'sk-abcdefghijklmnop',
        gemini: 'AIzaSyA1234567890abcdef',
        count: 3,
        skipped: undefined,
      }),
    ).toEqual({ screen: 'today', count: 3 });
  });

  it('scrubs secrets from free text', () => {
    expect(scrubText('failed with key sk-ant-api03-xyz and AIzaSyA1234567890abc')).toBe(
      'failed with key [redacted] and [redacted]',
    );
  });
});

describe('format helpers', () => {
  it('formats the Today header date', () => {
    expect(formatLongDate(new Date(2026, 9, 31, 12))).toBe('Saturday, 31 October');
  });

  it('formats times with AM/PM', () => {
    expect(formatTime(new Date(2026, 9, 31, 7, 42))).toMatch(/^7:42\s?AM$/);
  });

  it('masks secrets', () => {
    expect(maskSecret('AIzaSyA1234567893kQ')).toBe('AIza••••3kQ');
    expect(maskSecret('short')).toBe('••••');
  });
});

describe('compareVersions', () => {
  it('compares numerically', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });
});

describe('write lock', () => {
  it('runs tasks one at a time, even after a failure', async () => {
    const lock = createLock();
    const order: string[] = [];
    const slow = lock(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push('a');
    });
    const failing = lock(async () => {
      order.push('b');
      throw new Error('x');
    });
    const fast = lock(async () => {
      order.push('c');
    });
    await slow;
    await expect(failing).rejects.toThrow('x');
    await fast;
    expect(order).toEqual(['a', 'b', 'c']);
  });
});
