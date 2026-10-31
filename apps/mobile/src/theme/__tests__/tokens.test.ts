import { resolveTheme } from '../tokens';

describe('resolveTheme', () => {
  it('defaults to dark and follows the phone only when asked', () => {
    expect(resolveTheme(undefined, 'light')).toBe('dark');
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', null)).toBe('dark');
  });
});
