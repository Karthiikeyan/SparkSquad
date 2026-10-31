import type * as NotificationTypes from 'expo-notifications';
import { Platform } from 'react-native';
import { endpoints } from './api/endpoints';
import { env } from './env';
import { getPref, removePref, setPref } from './prefs';

type NotificationsModule = typeof NotificationTypes;

/** Loaded lazily so tests and signed-out screens don't touch the native module. */
function notifications(): NotificationsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  return require('expo-notifications') as NotificationsModule;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function notificationPermission(): Promise<PermissionState> {
  try {
    const res = await notifications().getPermissionsAsync();
    if (res.granted) return 'granted';
    return res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  try {
    const n = notifications();
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync('default', {
        name: 'SparkSquad',
        importance: n.AndroidImportance.DEFAULT,
      });
    }
    const res = await n.requestPermissionsAsync();
    if (res.granted) return 'granted';
    return res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Registers this install's Expo push token with the API (only when permission is granted). */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if ((await notificationPermission()) !== 'granted') return;
  const projectId = env.easProjectId;
  if (!projectId) return;
  const { data: token } = await notifications().getExpoPushTokenAsync({ projectId });
  if (!token) return;
  await endpoints.registerPushToken(token, Platform.OS);
  setPref('pushToken', token);
}

/** Removes the token server-side before sign-out so this phone stops getting pushes. */
export async function unregisterPushToken(): Promise<void> {
  const token = getPref('pushToken');
  if (!token) return;
  try {
    await endpoints.removePushToken(token);
  } catch {
    // The server drops dead tokens when Expo reports them; nothing else to do.
  }
  removePref('pushToken');
}
