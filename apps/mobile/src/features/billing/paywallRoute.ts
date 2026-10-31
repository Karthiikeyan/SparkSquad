import { router } from 'expo-router';
import { isPaywallError } from '../../lib/api/errors';

export function openPlusPaywall(): void {
  router.push('/paywall/plus');
}

/** Opens the Plus paywall for limit / Plus-only errors; returns whether it did. */
export function openPaywallFor(e: unknown): boolean {
  if (!isPaywallError(e)) return false;
  openPlusPaywall();
  return true;
}
