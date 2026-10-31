import type * as Shared from '@sparksquad/shared';
import type { ConfigResponse } from '@sparksquad/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ToastProvider } from '../../../components/ui';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ router: mockRouter }));

jest.mock('../../auth/SessionProvider', () => ({
  useSession: () => ({ setMe: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't close over imports
  useMe: () => require('../../../test/fixtures').me(),
}));

const mockEndpoints = { plusInterest: jest.fn(), me: jest.fn() };
jest.mock('../../../lib/api/endpoints', () => ({ endpoints: mockEndpoints }));

function mockConfig(): ConfigResponse {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- used from a hoisted jest.mock factory
  const { TIER_LIMITS } = require('@sparksquad/shared') as typeof Shared;
  return {
    minAppVersion: '0.0.0',
    limits: TIER_LIMITS,
    features: { paymentsEnabled: false, emailOtp: true, google: true, apple: true },
    contactEmail: 'help@example.com',
    prices: {
      plusMonthly: '₹99',
      plusYearly: '₹799',
      squadProMonthly: null,
      squadProYearly: null,
    },
  };
}
jest.mock('../../system/useConfig', () => ({
  useConfig: () => ({ data: mockConfig(), isPending: false }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- imported after the mocks
const { PlusPaywallScreen } = require('../PlusPaywallScreen') as {
  PlusPaywallScreen: () => ReactElement;
};

function wrap(ui: ReactElement) {
  // gcTime Infinity: no cache-GC timers left running after the test.
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('Plus paywall (F9) with payments off', () => {
  it('shows the comparison and config prices with yearly selected', async () => {
    await render(wrap(<PlusPaywallScreen />));
    expect(screen.getByText('SparkSquad Plus')).toBeTruthy();
    expect(screen.getByLabelText('Squads you’re in: Free 3, Plus 10')).toBeTruthy();
    const yearly = screen.getByRole('radio', { name: /Yearly, save 33%, ₹799, About ₹67 a month/ });
    expect(yearly.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('radio', { name: /Monthly, ₹99/ }));
    expect(screen.getByRole('radio', { name: /Monthly/ }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.queryByRole('button', { name: 'Restore purchase' })).toBeNull();
  });

  it('records interest instead of buying', async () => {
    mockEndpoints.plusInterest.mockResolvedValue({ ok: true });
    await render(wrap(<PlusPaywallScreen />));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Plus is coming soon. Get notified' }),
    );
    await waitFor(() => expect(mockEndpoints.plusInterest).toHaveBeenCalledWith('plus'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Thanks. We’ll let you know when Plus is ready.' }),
      ).toBeTruthy(),
    );
  });

  it('links to Squad Pro and closes', async () => {
    await render(wrap(<PlusPaywallScreen />));
    await fireEvent.press(screen.getByRole('button', { name: 'Running a cohort? See Squad Pro' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/paywall/squad-pro');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
