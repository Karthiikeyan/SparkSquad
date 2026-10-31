import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ToastProvider } from '../../../components/ui';
import { me as meFixture } from '../../../test/fixtures';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ router: mockRouter }));

const mockSession = {
  setMe: jest.fn(),
  signOut: jest.fn(),
  completeOnboarding: jest.fn(),
  pendingInvite: null as string | null,
};
jest.mock('../../auth/SessionProvider', () => ({
  useSession: () => mockSession,
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't close over imports
  useMe: () => require('../../../test/fixtures').me({ username: null }),
}));

const mockEndpoints = { consent: jest.fn(), updateMe: jest.fn() };
jest.mock('../../../lib/api/endpoints', () => ({ endpoints: mockEndpoints }));
jest.mock('../../../lib/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => 'granted'),
  registerPushToken: jest.fn(async () => undefined),
}));

// Route modules are imported after the mocks above.
/* eslint-disable @typescript-eslint/no-require-imports */
const Consent = require('../../../../app/(onboarding)/consent').default as () => ReactElement;
const JoinWithCode = require('../../../../app/join/index').default as () => ReactElement;
const NotificationsPrime = require('../../../../app/(onboarding)/notifications')
  .default as () => ReactElement;
/* eslint-enable @typescript-eslint/no-require-imports */

const wrap = (ui: ReactElement) => <ToastProvider>{ui}</ToastProvider>;

beforeEach(() => jest.clearAllMocks());

describe('Consent (A5)', () => {
  it('blocks until both boxes are checked, then records consent', async () => {
    const updated = meFixture({ username: null });
    mockEndpoints.consent.mockResolvedValue(updated);
    await render(wrap(<Consent />));
    const go = screen.getByRole('button', { name: 'Continue' });
    expect(go.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’m 18 or older' }));
    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState).toMatchObject(
      { disabled: true },
    );
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I agree to the Terms and Privacy Policy' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/profile'));
    expect(mockEndpoints.consent).toHaveBeenCalledTimes(1);
    expect(mockSession.setMe).toHaveBeenCalledWith(updated);
  });

  it('opens the terms in-app', async () => {
    await render(wrap(<Consent />));
    await fireEvent.press(screen.getByRole('button', { name: 'Read the Terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/legal/terms');
  });
});

describe('Join with code (E4)', () => {
  it('normalises the code and opens the invite preview', async () => {
    await render(wrap(<JoinWithCode />));
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'abc-234');
    await fireEvent.press(screen.getByRole('button', { name: 'Find squad' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/invite/[code]',
      params: { code: 'ABC234' },
    });
  });

  it('rejects codes with look-alike characters', async () => {
    await render(wrap(<JoinWithCode />));
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'ABC0O1');
    await fireEvent.press(screen.getByRole('button', { name: 'Find squad' }));
    expect(screen.getByText('Invite codes have 6 letters and numbers.')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('Notifications prime (A9)', () => {
  it('goes to A10 without an invite', async () => {
    mockSession.pendingInvite = null;
    await render(wrap(<NotificationsPrime />));
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/start');
    expect(mockSession.completeOnboarding).not.toHaveBeenCalled();
  });

  it('skips A10 when an invite is waiting', async () => {
    mockSession.pendingInvite = 'ABC234';
    await render(wrap(<NotificationsPrime />));
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
    await waitFor(() => expect(mockSession.completeOnboarding).toHaveBeenCalledWith());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
