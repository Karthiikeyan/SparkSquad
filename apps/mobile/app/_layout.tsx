import '../src/lib/polyfills';
import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { AppProviders } from '../src/components/AppProviders';
import { initAnalytics } from '../src/lib/analytics';
import { setupQueryManagers } from '../src/lib/query/client';
import { fontAssets } from '../src/theme/fonts';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
initAnalytics();
setupQueryManagers();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const runtimeReady = useRef(false);
  const fontsReady = fontsLoaded || !!fontError;

  const hideSplashIfReady = useCallback(() => {
    if (fontsReady && runtimeReady.current) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);

  const onRuntimeReady = useCallback(() => {
    runtimeReady.current = true;
    hideSplashIfReady();
  }, [hideSplashIfReady]);

  useEffect(hideSplashIfReady, [hideSplashIfReady]);

  if (!fontsReady) return null;

  return (
    <AppProviders onReady={onRuntimeReady}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="checkin/[challengeId]"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack>
    </AppProviders>
  );
}
