import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { isRetryable } from '../api/errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        networkMode: 'offlineFirst',
        retry: (failureCount, error) => isRetryable(error) && failureCount < 2,
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: false,
      },
    },
  });
}

let managersReady = false;

/** Wires TanStack Query to NetInfo and AppState (React Native has no window events). */
export function setupQueryManagers(): void {
  if (managersReady) return;
  managersReady = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (Platform.OS !== 'web') handleFocus(status === 'active');
    });
    return () => sub.remove();
  });
}
