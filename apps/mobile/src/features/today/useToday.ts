import { qk } from '../../lib/query/keys';
import { useLocalQuery } from '../../lib/query/useLocalQuery';
import { useMe } from '../auth/SessionProvider';
import { readNotifications, readUnreadCount } from '../notifications/data';
import { buildTodayCards, globalStreak, type TodayCard, type TodaySource } from './model';
import { readTodaySource } from './source';

export interface TodayData {
  cards: TodayCard[];
  streak: number;
  source: TodaySource;
}

/** Today's cards from the local store; refreshed after every sync and outbox change. */
export function useToday() {
  const me = useMe();
  return useLocalQuery<TodayData>([...qk.today, me.id, me.timezone], async (db) => {
    const source = await readTodaySource(db, me);
    return {
      cards: buildTodayCards(source, new Date()),
      streak: globalStreak(source.streaks)?.current ?? 0,
      source,
    };
  });
}

export function useNotificationsList() {
  return useLocalQuery(qk.notifications, readNotifications);
}

export function useUnreadCount() {
  return useLocalQuery([...qk.notifications, 'unread'], readUnreadCount);
}
