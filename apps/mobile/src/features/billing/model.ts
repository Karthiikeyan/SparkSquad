import type { TierLimits, UserPlan } from '@sparksquad/shared';
import { t } from '../../i18n';

export interface ComparisonRow {
  label: string;
  free: string;
  plus: string;
}

/** Free vs Plus table (Plus design), built from the tier limits so numbers never drift. */
export function comparisonRows(limits: Record<UserPlan, TierLimits>): ComparisonRow[] {
  const { free, plus } = limits;
  const photo = (l: TierLimits): string =>
    l.photoUpload
      ? t('paywall.rowPhotosPlus', { n: l.photoRetentionDays })
      : t('paywall.rowPhotosFree');
  const builder = (l: TierLimits): string =>
    t(l.aiBuilder ? 'paywall.rowBuilderPlus' : 'paywall.rowBuilderFree');
  return [
    {
      label: t('paywall.rowSquads'),
      free: String(free.squadsJoined),
      plus: String(plus.squadsJoined),
    },
    {
      label: t('paywall.rowOwned'),
      free: String(free.squadsOwned),
      plus: String(plus.squadsOwned),
    },
    { label: t('paywall.rowPhotos'), free: photo(free), plus: photo(plus) },
    {
      label: t('paywall.rowFreezes'),
      free: String(free.freezesBanked),
      plus: String(plus.freezesBanked),
    },
    {
      label: t('paywall.rowRecap'),
      free: t('paywall.rowRecapFree'),
      plus: t('paywall.rowRecapPlus'),
    },
    { label: t('paywall.rowBuilder'), free: builder(free), plus: builder(plus) },
  ];
}

/** First number in a display price ("₹799", "$9.99", "1.299,00 €") as a JS number. */
export function priceNumber(display: string): number | null {
  const m = display.match(/\d[\d.,\s]*/);
  if (!m) return null;
  let s = m[0].replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  // Whichever separator comes last with 1–2 digits after it is the decimal point.
  const dec = lastComma > lastDot ? ',' : '.';
  const idx = Math.max(lastComma, lastDot);
  if (idx >= 0 && s.length - idx - 1 <= 2) {
    const thousands = dec === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(dec, '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "save 33%" for yearly vs twelve monthly payments; null when it isn't a saving. */
export function yearlySavingPercent(monthly: number | null, yearly: number | null): number | null {
  if (!monthly || !yearly) return null;
  const pct = Math.round((1 - yearly / (monthly * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** A display price divided by 12, keeping its currency text ("₹799" → "₹67"). */
export function perMonthDisplay(yearlyDisplay: string): string | null {
  const m = yearlyDisplay.match(/\d[\d.,\s]*\d|\d/);
  const n = priceNumber(yearlyDisplay);
  if (!m || n === null) return null;
  const monthly = n / 12;
  const text = Number.isInteger(n) ? String(Math.round(monthly)) : monthly.toFixed(2);
  return yearlyDisplay.replace(m[0], text);
}

export type Period = 'yearly' | 'monthly';

export interface PlanPrices {
  yearly: string | null;
  monthly: string | null;
  /** Yearly price per month, from the store when available. */
  yearlyPerMonth: string | null;
  savePercent: number | null;
}

export function pricesFromDisplay(yearly: string | null, monthly: string | null): PlanPrices {
  return {
    yearly,
    monthly,
    yearlyPerMonth: yearly ? perMonthDisplay(yearly) : null,
    savePercent: yearlySavingPercent(
      monthly ? priceNumber(monthly) : null,
      yearly ? priceNumber(yearly) : null,
    ),
  };
}
