import type * as NotificationTypes from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { refresh } from '../../lib/runtime';
import { useMe } from '../auth/SessionProvider';
import { planReminders } from '../reminders/plan';
import { applyReminders } from '../reminders/schedule';
import { pendingCards } from '../today/model';
import { useToday } from '../today/useToday';

type NotificationsModule = typeof NotificationTypes;

function notifications(): NotificationsModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  return require('expo-notifications') as NotificationsModule;
}

/** Where a tapped notification (push or local) should open. */
export function routeForNotification(data: Record<string, unknown> | undefined): string {
  const type = typeof data?.type === 'string' ? data.type : '';
  const squadId = typeof data?.squadId === 'string' ? data.squadId : '';
  if (type === 'inbox') return '/notifications';
  if ((type === 'digest' || type === 'start') && squadId) return `/squad/${squadId}`;
  return '/today';
}

let handlerSet = false;

/** Show pushes while the app is open (banner + list, no badge), set once. */
function ensureForegroundHandler(n: NotificationsModule): void {
  if (handlerSet) return;
  handlerSet = true;
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Signed-in background duties: keep local reminders in step with today's state (B1, A8),
 * refresh when a push arrives (no sockets, Architecture §5.1), and route notification taps.
 */
export function AppBackground() {
  const me = useMe();
  const today = useToday();

  useEffect(() => {
    if (!today.data) return;
    const active = today.data.cards.filter(
      (c) => c.state === 'active' && c.day !== null && !c.day.rest,
    );
    const planned = planReminders({
      now: new Date(),
      reminderTime: me.reminderTime,
      activeTitles: active.map((c) => c.challenge.title),
      todayDone: active.length > 0 && pendingCards(active).length === 0,
      notifyMissedDay: me.notifyMissedDay,
      streak: today.data.streak,
      notifyStreakRisk: me.notifyStreakRisk,
      upcoming: today.data.cards
        .filter((c) => c.state === 'upcoming')
        .map((c) => ({
          title: c.challenge.title,
          startDate: c.challenge.startDate,
          squadId: c.squad.id,
        })),
      notifyChallengeStart: me.notifyChallengeStart,
    });
    const timer = setTimeout(() => {
      applyReminders(planned).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [
    today.data,
    me.reminderTime,
    me.notifyMissedDay,
    me.notifyStreakRisk,
    me.notifyChallengeStart,
  ]);

  useEffect(() => {
    const n = notifications();
    if (!n) return;
    ensureForegroundHandler(n);
    const received = n.addNotificationReceivedListener(() => {
      refresh().catch(() => undefined);
    });
    const responded = n.addNotificationResponseReceivedListener((response) => {
      refresh().catch(() => undefined);
      router.navigate(routeForNotification(response.notification.request.content.data) as never);
    });
    // Cold start from a notification tap (wait for the navigator to mount).
    const last = n.getLastNotificationResponse();
    let coldStart: ReturnType<typeof setTimeout> | undefined;
    if (last) {
      n.clearLastNotificationResponse();
      coldStart = setTimeout(() => {
        router.navigate(routeForNotification(last.notification.request.content.data) as never);
      }, 300);
    }
    return () => {
      if (coldStart) clearTimeout(coldStart);
      received.remove();
      responded.remove();
    };
  }, []);

  return null;
}
