import { TIER_LIMITS } from '@sparksquad/shared';
import {
  comparisonRows,
  perMonthDisplay,
  priceNumber,
  pricesFromDisplay,
  yearlySavingPercent,
} from '../model';

describe('paywall prices', () => {
  it('reads numbers out of display prices in common formats', () => {
    expect(priceNumber('₹799')).toBe(799);
    expect(priceNumber('$9.99')).toBe(9.99);
    expect(priceNumber('₹1,299')).toBe(1299);
    expect(priceNumber('1.299,00 €')).toBe(1299);
    expect(priceNumber('US$ 59.99/yr')).toBe(59.99);
    expect(priceNumber('soon')).toBeNull();
  });

  it('computes the yearly saving against twelve monthly payments', () => {
    expect(yearlySavingPercent(99, 799)).toBe(33);
    expect(yearlySavingPercent(99, 1188)).toBeNull();
    expect(yearlySavingPercent(null, 799)).toBeNull();
  });

  it('divides a yearly display price by 12 and keeps the currency text', () => {
    expect(perMonthDisplay('₹799')).toBe('₹67');
    expect(perMonthDisplay('$59.99')).toBe('$5.00');
  });

  it('builds the pilot prices from config strings, tolerating missing ones', () => {
    expect(pricesFromDisplay('₹799', '₹99')).toEqual({
      yearly: '₹799',
      monthly: '₹99',
      yearlyPerMonth: '₹67',
      savePercent: 33,
    });
    expect(pricesFromDisplay(null, null)).toEqual({
      yearly: null,
      monthly: null,
      yearlyPerMonth: null,
      savePercent: null,
    });
  });
});

describe('comparisonRows', () => {
  it('takes every number from the tier limits (design order)', () => {
    const rows = comparisonRows(TIER_LIMITS);
    expect(rows.map((r) => [r.label, r.free, r.plus])).toEqual([
      ['Squads you’re in', '3', '10'],
      ['Squads you own', '1', '5'],
      ['Photo proof', 'On your phone', 'Shared, 30 days'],
      ['Streak freezes', '2', '5'],
      ['Weekly recap', 'Summary', 'AI-written'],
    ]);
  });

  it('hides rows where Free and Plus are the same', () => {
    const rows = comparisonRows({
      ...TIER_LIMITS,
      free: { ...TIER_LIMITS.free, aiBuilder: false },
    });
    expect(rows.at(-1)).toEqual({ label: 'Plan builder', free: 'Copy prompt', plus: 'In the app' });
  });

  it('follows the config when limits change', () => {
    const rows = comparisonRows({
      ...TIER_LIMITS,
      free: { ...TIER_LIMITS.free, squadsJoined: 4 },
    });
    expect(rows[0]?.free).toBe('4');
  });
});
