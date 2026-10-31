import '../src/lib/polyfills';
import '../global.css';

import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Appearance } from 'react-native';
import { AppProviders } from '../src/components/AppProviders';
import { RootNavigator } from '../src/components/RootNavigator';
import { initAnalytics } from '../src/lib/analytics';
import { setupQueryManagers } from '../src/lib/query/client';
import { fontAssets } from '../src/theme/fonts';
import { themeName, themePref } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
initAnalytics();
setupQueryManagers();
// Native pieces (alerts, pickers, keyboard) follow the app's theme unless it follows the phone.
if (themePref !== 'system') {
  try {
    Appearance.setColorScheme(themeName);
  } catch {
    // Older native runtimes: they follow the phone.
  }
}

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
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </AppProviders>
  );
}
