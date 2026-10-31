import type { MeDTO } from '@sparksquad/shared';
import { me as meFixture } from '../../../test/fixtures';
import {
  afterNotificationsStep,
  hasRequiredProfile,
  isEmail,
  normalizeOtp,
  resolveRoute,
  suggestUsername,
  type RouteState,
} from '../routing';

const complete: MeDTO = meFixture();
const base: RouteState = {
  status: 'signedIn',
  me: complete,
  onboarded: true,
  pendingRoute: null,
  pendingInvite: null,
};

describe('resolveRoute', () => {
  it('waits while the session loads and sends signed-out users to Welcome', () => {
    expect(resolveRoute({ ...base, status: 'loading' })).toEqual({ kind: 'wait' });
    expect(resolveRoute({ ...base, status: 'signedOut', me: null })).toEqual({
      kind: 'redirect',
      href: '/welcome',
    });
  });

  it('shows an error when signed in but the profile could not load', () => {
    expect(resolveRoute({ ...base, me: null })).toEqual({ kind: 'error' });
  });

  it('gates on consent, then profile, then the rest of onboarding', () => {
    const noConsent = { ...complete, ageConfirmedAt: null };
    const noTerms = { ...complete, termsAcceptedAt: null };
    const noUsername = { ...complete, username: null };
    expect(resolveRoute({ ...base, me: noConsent, onboarded: false })).toMatchObject({
      href: '/consent',
    });
    expect(resolveRoute({ ...base, me: noTerms })).toMatchObject({ href: '/consent' });
    expect(resolveRoute({ ...base, me: noUsername, onboarded: false })).toMatchObject({
      href: '/profile',
    });
    expect(resolveRoute({ ...base, onboarded: false })).toMatchObject({ href: '/interests' });
  });

  it('honours the A10 choice, then a pending invite, then Today', () => {
    expect(resolveRoute({ ...base, pendingRoute: '/join', pendingInvite: 'ABC234' })).toMatchObject(
      {
        href: '/join',
      },
    );
    expect(resolveRoute({ ...base, pendingInvite: 'ABC234' })).toMatchObject({
      href: '/invite/ABC234',
    });
    expect(resolveRoute(base)).toMatchObject({ href: '/today' });
  });

  it('never skips consent even with an invite waiting', () => {
    expect(
      resolveRoute({ ...base, me: { ...complete, ageConfirmedAt: null }, pendingInvite: 'ABC234' }),
    ).toMatchObject({ href: '/consent' });
  });
});

describe('onboarding helpers', () => {
  it('knows when the profile is complete', () => {
    expect(hasRequiredProfile(complete)).toBe(true);
    expect(hasRequiredProfile({ ...complete, username: null })).toBe(false);
  });

  it('skips A10 when an invite is waiting', () => {
    expect(afterNotificationsStep('ABC234')).toBe('finish');
    expect(afterNotificationsStep(null)).toBe('start');
  });

  it('validates emails loosely', () => {
    expect(isEmail(' kiran@example.com ')).toBe(true);
    expect(isEmail('kiran@example')).toBe(false);
    expect(isEmail('kiran example.com')).toBe(false);
  });

  it('normalises pasted codes', () => {
    expect(normalizeOtp('Your code: 123 456')).toBe('123456');
    expect(normalizeOtp('1234567890')).toBe('123456');
    expect(normalizeOtp('abc')).toBe('');
  });

  it('suggests a valid username from the display name', () => {
    expect(suggestUsername('Kiran Raj')).toBe('kiran_raj');
    expect(suggestUsername('  Dévi  ')).toBe('devi');
    expect(suggestUsername('Al')).toBe('');
    expect(suggestUsername('A very long display name indeed')).toBe('a_very_long_display');
  });
});
