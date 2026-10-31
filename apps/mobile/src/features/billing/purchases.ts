import { Platform } from 'react-native';
import type PurchasesType from 'react-native-purchases';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { env } from '../../lib/env';

/** Entitlement and offering ids configured in RevenueCat (match the webhook, see SETUP.md). */
export const RC = {
  plusEntitlement: 'plus',
  squadProEntitlement: 'squad_pro',
  plusOffering: 'plus',
  squadProOffering: 'squad_pro',
} as const;

type Purchases = typeof PurchasesType;

function purchases(): Purchases {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  return (require('react-native-purchases') as { default: Purchases }).default;
}

function apiKey(): string | undefined {
  return Platform.OS === 'ios' ? env.revenuecatIosKey : env.revenuecatAndroidKey;
}

/** Real purchases need the server flag, the build flag and a store key. */
export function paymentsAvailable(serverFlag: boolean | undefined): boolean {
  return !!serverFlag && env.paymentsEnabled && !!apiKey();
}

let configuredFor: string | null = null;

/** Configures the SDK once and identifies the user so webhooks map to our user id. */
export async function ensurePurchases(userId: string): Promise<Purchases> {
  const P = purchases();
  const key = apiKey();
  if (!key) throw new Error('RevenueCat key missing');
  if (!(await P.isConfigured())) {
    P.configure({ apiKey: key, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await P.logIn(userId);
    configuredFor = userId;
  }
  return P;
}

export interface Offer {
  yearly: PurchasesPackage | null;
  monthly: PurchasesPackage | null;
}

function offer(o: PurchasesOffering | null | undefined): Offer | null {
  if (!o) return null;
  return { yearly: o.annual, monthly: o.monthly };
}

export async function loadOffers(
  userId: string,
): Promise<{ plus: Offer | null; squadPro: Offer | null }> {
  const P = await ensurePurchases(userId);
  const all = await P.getOfferings();
  return {
    plus: offer(all.all[RC.plusOffering] ?? all.current),
    squadPro: offer(all.all[RC.squadProOffering]),
  };
}

export type BuyResult = 'purchased' | 'cancelled';

const isCancel = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { userCancelled?: unknown }).userCancelled === true;

/** Buys a package; Squad Pro passes the squad id as the `squad_id` attribute first. */
export async function buy(
  userId: string,
  pkg: PurchasesPackage,
  squadId?: string,
): Promise<BuyResult> {
  const P = await ensurePurchases(userId);
  if (squadId) await P.setAttributes({ squad_id: squadId });
  try {
    await P.purchasePackage(pkg);
    return 'purchased';
  } catch (e) {
    if (isCancel(e)) return 'cancelled';
    throw e;
  }
}

const hasAny = (info: CustomerInfo) =>
  !!info.entitlements.active[RC.plusEntitlement] ||
  !!info.entitlements.active[RC.squadProEntitlement];

/** Restores store purchases; true when an entitlement came back. */
export async function restore(userId: string): Promise<boolean> {
  const P = await ensurePurchases(userId);
  return hasAny(await P.restorePurchases());
}

export interface SubscriptionInfo {
  managementUrl: string | null;
  willRenew: boolean | null;
  expiresAt: string | null;
}

export async function subscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const P = await ensurePurchases(userId);
  const info = await P.getCustomerInfo();
  const plus = info.entitlements.active[RC.plusEntitlement];
  return {
    managementUrl: info.managementURL,
    willRenew: plus ? plus.willRenew : null,
    expiresAt: plus?.expirationDate ?? null,
  };
}

/** Forget the user on sign-out (no-op when the SDK was never set up). */
export async function resetPurchases(): Promise<void> {
  if (!configuredFor) return;
  configuredFor = null;
  try {
    await purchases().logOut();
  } catch {
    // Anonymous or not configured: nothing to clear.
  }
}
