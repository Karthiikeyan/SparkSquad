import { Alert, Appearance } from 'react-native';
import { t } from '../../i18n';
import { setPref, type Prefs } from '../../lib/prefs';

/** Saves the theme and offers a restart (colours are fixed for the life of the JS bundle). */
export function changeTheme(next: Prefs['theme']): void {
  setPref('theme', next);
  Alert.alert(t('settingsMain.themeRestart'), undefined, [
    { text: t('settingsMain.themeLater'), style: 'cancel' },
    {
      text: t('settingsMain.themeRestartNow'),
      onPress: () => {
        try {
          // Clear our override so "Match phone" reads the phone's real setting after reload.
          Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
        } catch {
          // Not supported: the next cold start picks it up.
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module loads lazily
        const Updates = require('expo-updates') as { reloadAsync: () => Promise<void> };
        Updates.reloadAsync().catch(() => undefined);
      },
    },
  ]);
}
