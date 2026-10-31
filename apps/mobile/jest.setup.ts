/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require */
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// In-memory MMKV (the real one needs the native Nitro module).
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string | number | boolean>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const s = stores.get(id) ?? new Map<string, string | number | boolean>();
      stores.set(id, s);
      return {
        set: (k: string, v: string | number | boolean) => s.set(k, v),
        getString: (k: string) => {
          const v = s.get(k);
          return typeof v === 'string' ? v : undefined;
        },
        remove: (k: string) => s.delete(k),
        clearAll: () => s.clear(),
        contains: (k: string) => s.has(k),
        getAllKeys: () => [...s.keys()],
      };
    },
  };
});

// Analytics SDKs never load in unit tests (and are env-gated in the app anyway).
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('posthog-react-native', () =>
  jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    optIn: jest.fn(),
    optOut: jest.fn(),
  })),
);

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    SafeAreaView: ({ children }: { children: unknown }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
  };
});

// The Better Auth client is ESM and talks to the network; unit tests never sign in.
jest.mock('./src/lib/auth', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }),
    signOut: jest.fn(),
    getCookie: jest.fn(async () => ''),
  },
  authCookie: jest.fn(async () => ''),
}));

// FlashList measures its parent natively; give it a fixed viewport in tests.
require('@shopify/flash-list/jestSetup');
