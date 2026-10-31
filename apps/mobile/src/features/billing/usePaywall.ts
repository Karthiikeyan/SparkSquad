import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '../../components/ui';
import { t } from '../../i18n';
import { track } from '../../lib/analytics';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { useMe, useSession } from '../auth/SessionProvider';
import { syncSoon } from '../squads/actions';
import { useConfig } from '../system/useConfig';
import { pricesFromDisplay, yearlySavingPercent, type Period, type PlanPrices } from './model';
import { buy, loadOffers, paymentsAvailable, restore, type Offer } from './purchases';

export type Product = 'plus' | 'squad_pro';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The webhook updates the server a moment after the store; poll briefly. */
export async function waitFor(check: () => Promise<boolean>, tries = 10, everyMs = 2000) {
  for (let i = 0; i < tries; i++) {
    if (await check().catch(() => false)) return true;
    await wait(everyMs);
  }
  return false;
}

function storePrices(o: Offer | null): PlanPrices {
  const y = o?.yearly?.product ?? null;
  const m = o?.monthly?.product ?? null;
  return {
    yearly: y?.priceString ?? null,
    monthly: m?.priceString ?? null,
    yearlyPerMonth: y?.pricePerMonthString ?? null,
    savePercent: yearlySavingPercent(m?.price ?? null, y?.price ?? null),
  };
}

/**
 * Shared paywall state. Payments on: RevenueCat offerings, purchase and restore.
 * Payments off (pilot): prices from config, the button records interest.
 */
export function usePaywall(product: Product) {
  const me = useMe();
  const { setMe } = useSession();
  const toast = useToast();
  const config = useConfig();
  const live = paymentsAvailable(config.data?.features.paymentsEnabled);
  const offers = useQuery({
    queryKey: ['offers', me.id],
    queryFn: () => loadOffers(me.id),
    enabled: live,
    staleTime: 10 * 60_000,
  });
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [interested, setInterested] = useState(false);

  const offer = product === 'plus' ? (offers.data?.plus ?? null) : (offers.data?.squadPro ?? null);
  const p = config.data?.prices;
  const prices: PlanPrices = live
    ? storePrices(offer)
    : product === 'plus'
      ? pricesFromDisplay(p?.plusYearly ?? null, p?.plusMonthly ?? null)
      : pricesFromDisplay(p?.squadProYearly ?? null, p?.squadProMonthly ?? null);

  const refreshMe = async () => {
    const next = await endpoints.me();
    setMe(next);
    return next;
  };

  /** Returns true when the purchase (or interest) went through. */
  const start = async (period: Period, squadId?: string): Promise<boolean> => {
    setBusy('buy');
    try {
      if (!live) {
        await endpoints.plusInterest(product);
        track('plus_interest', { product });
        setInterested(true);
        toast.show({ message: t('paywall.soonDone'), kind: 'success' });
        return true;
      }
      const pkg = period === 'yearly' ? offer?.yearly : offer?.monthly;
      if (!pkg) {
        toast.show({ message: t('paywall.unavailable'), kind: 'error' });
        return false;
      }
      const result = await buy(me.id, pkg, squadId);
      if (result === 'cancelled') return false;
      track('purchase', { product, period });
      if (product === 'plus') await waitFor(async () => (await refreshMe()).plan === 'plus');
      else syncSoon();
      toast.show({ message: t('paywall.purchased'), kind: 'success' });
      return true;
    } catch (e) {
      toast.show({ message: live ? t('paywall.failed') : errorMessage(e), kind: 'error' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const restorePurchases = async () => {
    if (!live) return;
    setBusy('restore');
    try {
      const found = await restore(me.id);
      if (found) {
        await waitFor(async () => (await refreshMe()).plan === 'plus', 5);
        syncSoon();
      }
      toast.show({
        message: found ? t('paywall.restored') : t('paywall.nothingToRestore'),
        kind: found ? 'success' : 'info',
      });
    } catch {
      toast.show({ message: t('paywall.unavailable'), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return {
    live,
    loading: config.isPending || (live && offers.isPending),
    unavailable: live && (offers.isError || (offers.isSuccess && !offer)),
    prices,
    busy,
    interested,
    start,
    restore: restorePurchases,
  };
}
