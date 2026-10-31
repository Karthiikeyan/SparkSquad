import '../src/lib/polyfills';
import '../global.css';

import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { AppProviders } from '../src/components/AppProviders';
import { RootNavigator } from '../src/components/RootNavigator';
import { initAnalytics } from '../src/lib/analytics';
import { setupQueryManagers } from '../src/lib/query/client';
import { fontAssets } from '../src/theme/fonts';

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
      <RootNavigator />
    </AppProviders>
  );
}
