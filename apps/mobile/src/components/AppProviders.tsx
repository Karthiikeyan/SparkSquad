import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorState, ToastProvider } from '../components/ui';
import { SessionProvider } from '../features/auth/SessionProvider';
import { ForceUpdateScreen, useMinVersionCheck } from '../features/system/ForceUpdate';
import { t } from '../i18n';
import { captureError } from '../lib/analytics';
import { appEvents } from '../lib/appEvents';
import { createQueryClient } from '../lib/query/client';
import { qk } from '../lib/query/keys';
import { startBackgroundTriggers, startRuntime } from '../lib/runtime';
import { colors } from '../theme/tokens';

const queryClient = createQueryClient();

/** Re-reads local-store queries whenever a sync or the outbox changes data. */
function LocalInvalidation() {
  const client = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      void client.invalidateQueries({ queryKey: qk.local });
    };
    const offSync = appEvents.on('syncCompleted', invalidate);
    const offOutbox = appEvents.on('outboxChanged', invalidate);
    return () => {
      offSync();
      offOutbox();
    };
  }, [client]);
  return null;
}

function UpdateGate({ children }: { children: ReactNode }) {
  const [forced, setForced] = useState(false);
  const tooOld = useMinVersionCheck();
  useEffect(() => appEvents.on('updateRequired', () => setForced(true)), []);
  if (forced || tooOld) return <ForceUpdateScreen />;
  return <>{children}</>;
}

type RuntimeState = 'starting' | 'ready' | 'failed';

/** Opens the local DB and starts sync/outbox triggers before rendering the app. */
function RuntimeGate({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  const [state, setState] = useState<RuntimeState>('starting');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;
    startRuntime()
      .then(() => {
        if (!alive) return;
        stop = startBackgroundTriggers();
        setState('ready');
      })
      .catch((e: unknown) => {
        captureError(e);
        if (alive) setState('failed');
      });
    return () => {
      alive = false;
      stop?.();
    };
  }, [attempt]);

  useEffect(() => {
    if (state !== 'starting') onReady();
  }, [state, onReady]);

  if (state === 'starting') return null;
  if (state === 'failed') {
    return (
      <View style={styles.center}>
        <ErrorState
          title={t('maintenance.title')}
          message={t('errorState.body')}
          onRetry={() => {
            setState('starting');
            setAttempt((a) => a + 1);
          }}
        />
      </View>
    );
  }
  return <>{children}</>;
}

export function AppProviders({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <LocalInvalidation />
            <RuntimeGate onReady={onReady}>
              <UpdateGate>
                <SessionProvider>{children}</SessionProvider>
              </UpdateGate>
            </RuntimeGate>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
});
