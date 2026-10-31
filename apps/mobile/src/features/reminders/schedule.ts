import type * as NotificationTypes from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationPermission } from '../../lib/notifications';
import type { PlannedReminder } from './plan';

type NotificationsModule = typeof NotificationTypes;

function notifications(): NotificationsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  return require('expo-notifications') as NotificationsModule;
}

let lastSignature = '';

/** Replaces the phone's scheduled reminders with `planned` (skips work when nothing changed). */
export async function applyReminders(planned: readonly PlannedReminder[]): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if ((await notificationPermission()) !== 'granted') return;
  const signature = planned.map((p) => `${p.id}@${p.at.getTime()}:${p.body}`).join('|');
  if (signature === lastSignature) return;
  const n = notifications();
  await n.cancelAllScheduledNotificationsAsync();
  for (const p of planned) {
    await n.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, data: { type: p.kind } },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: 'default' },
    });
  }
  lastSignature = signature;
}

/** Sign-out: no reminders for a signed-out phone. */
export async function clearReminders(): Promise<void> {
  lastSignature = '';
  try {
    await notifications().cancelAllScheduledNotificationsAsync();
  } catch {
    // Native module unavailable (tests, web).
  }
}
