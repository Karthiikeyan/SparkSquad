import { TEXT_LIMITS, type MeDTO } from '@sparksquad/shared';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export function needsConsent(me: Pick<MeDTO, 'ageConfirmedAt' | 'termsAcceptedAt'>): boolean {
  return !me.ageConfirmedAt || !me.termsAcceptedAt;
}

export function needsProfile(me: Pick<MeDTO, 'username'>): boolean {
  return !me.username;
}

/** Server-side facts that make an account usable (A5 + A6). */
export function hasRequiredProfile(me: MeDTO): boolean {
  return !needsConsent(me) && !needsProfile(me);
}

export interface RouteState {
  status: SessionStatus;
  me: MeDTO | null;
  onboarded: boolean;
  /** Where to go once onboarding finished (A10 choice). */
  pendingRoute: string | null;
  /** Invite code from a deep link. */
  pendingInvite: string | null;
}

export type RouteDecision =
  { kind: 'wait' } | { kind: 'error' } | { kind: 'redirect'; href: string };

/** Where the app should be, given the session. The single source of auth/onboarding routing. */
export function resolveRoute(s: RouteState): RouteDecision {
  if (s.status === 'loading') return { kind: 'wait' };
  if (s.status === 'signedOut') return { kind: 'redirect', href: '/welcome' };
  if (!s.me) return { kind: 'error' };
  if (needsConsent(s.me)) return { kind: 'redirect', href: '/consent' };
  if (needsProfile(s.me)) return { kind: 'redirect', href: '/profile' };
  if (!s.onboarded) return { kind: 'redirect', href: '/interests' };
  if (s.pendingRoute) return { kind: 'redirect', href: s.pendingRoute };
  if (s.pendingInvite) return { kind: 'redirect', href: `/invite/${s.pendingInvite}` };
  return { kind: 'redirect', href: '/today' };
}

/** Where A9 (notifications) continues: an invite skips A10 straight to the squad preview. */
export function afterNotificationsStep(pendingInvite: string | null): 'finish' | 'start' {
  return pendingInvite ? 'finish' : 'start';
}

/** Basic shape check before asking the server to email a code. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Keeps only digits, max 6 (handles pasted "123 456" or "Your code: 123456"). */
export function normalizeOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

/** A display-name based username suggestion: lowercase a–z, 0–9 and _, within the length limits. */
export function suggestUsername(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, TEXT_LIMITS.usernameMax)
    .replace(/_+$/g, '');
  return base.length >= TEXT_LIMITS.usernameMin ? base : '';
}
