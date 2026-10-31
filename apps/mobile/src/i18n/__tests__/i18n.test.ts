import { ERROR_CODES } from '@sparksquad/shared';
import en from '../en.json';
import { formatNumber, interpolate, t, tMaybe } from '../index';

describe('i18n', () => {
  it('looks up nested keys and interpolates', () => {
    expect(t('tabs.today')).toBe('Today');
    expect(t('dayStrip.day', { n: 12, state: 'today' })).toBe('Day 12, today');
    expect(interpolate('{{a}} and {{b}}', { a: 1 })).toBe('1 and {{b}}');
  });

  it('returns the key for missing copy and undefined from tMaybe', () => {
    expect(tMaybe('errors.NOPE')).toBeUndefined();
    expect(t('nope.missing' as never)).toBe('nope.missing');
  });

  it('has friendly copy for every API error code', () => {
    const missing = ERROR_CODES.filter((code) => !(code in en.errors));
    expect(missing).toEqual([]);
  });

  it('never uses emoji in copy', () => {
    const text = JSON.stringify(en);
    expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);
  });

  it('has no mangled punctuation (apostrophes or ellipses turned into "?")', () => {
    const bad: string[] = [];
    (function walk(node: object, path: string) {
      for (const [k, v] of Object.entries(node)) {
        const p = path ? `${path}.${k}` : k;
        if (typeof v === 'string') {
          if (/\w\?\w|\}\}\?\w|\uFFFD/.test(v)) bad.push(p);
        } else if (v && typeof v === 'object') walk(v as object, p);
      }
    })(en, '');
    expect(bad).toEqual([]);
  });

  it('formats numbers with Indian grouping', () => {
    expect(formatNumber(10000)).toBe('10,000');
    expect(formatNumber(100000)).toBe('1,00,000');
  });
});
