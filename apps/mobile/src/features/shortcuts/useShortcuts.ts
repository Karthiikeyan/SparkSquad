import type * as QuickActionsModule from 'expo-quick-actions';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { t } from '../../i18n';

/** Long-press menu on the app icon. Android icons are built by the plugin in app.config.ts. */
export function shortcutItems() {
  const ios = Platform.OS === 'ios';
  return [
    {
      id: 'checkin',
      title: t('shortcuts.checkIn'),
      icon: ios ? 'taskCompleted' : 'shortcut_checkin',
      params: { href: '/checkin/next' },
    },
    {
      id: 'today',
      title: t('shortcuts.today'),
      icon: ios ? 'date' : 'shortcut_today',
      params: { href: '/today' },
    },
    {
      id: 'invite',
      title: t('shortcuts.invite'),
      icon: ios ? 'invitation' : 'shortcut_invite',
      params: { href: '/shortcut/invite' },
    },
  ];
}

/** Registers the shortcuts once signed in; signed-out phones have no use for them. */
export function useRegisterShortcuts(): void {
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
    const QuickActions = require('expo-quick-actions') as typeof QuickActionsModule;
    QuickActions.setItems(shortcutItems()).catch(() => undefined);
  }, []);
}
