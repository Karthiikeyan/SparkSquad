import { isValidTimeZone } from '@sparksquad/shared';
import * as Haptics from 'expo-haptics';
import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui';
import { t } from '../../i18n';
import { track } from '../../lib/analytics';
import { getRuntime, refresh } from '../../lib/runtime';
import { useMe } from '../auth/SessionProvider';
import { globalStreak, pendingCards, predictedStreak, type TodayCard } from '../today/model';
import { useToday } from '../today/useToday';
import { clearDraft } from './drafts';
import { allDoneDraft, submitCheckin } from './submit';

/** Step challenges fill in from the phone's step count, so they always go through the sheet. */
export function quickCards(cards: readonly TodayCard[]): TodayCard[] {
  return pendingCards(cards).filter((c) => c.kind === 'tasks' && (c.day?.tasks.length ?? 0) > 0);
}

/** Long-press on the centre button: confirm, then mark every waiting task done. */
export function useQuickCheckin(): () => void {
  const me = useMe();
  const today = useToday();
  const toast = useToast();
  const busy = useRef(false);

  const run = useCallback(
    async (cards: TodayCard[]) => {
      if (busy.current || !today.data) return;
      busy.current = true;
      try {
        const { db, outbox } = getRuntime();
        const before = globalStreak(today.data.source.streaks);
        const tz = getCalendars()[0]?.timeZone;
        let countsDone = false;
        let last = null as Awaited<ReturnType<typeof submitCheckin>>['checkin'] | null;
        for (const card of cards) {
          const tasks = card.day?.tasks ?? [];
          const res = await submitCheckin({
            db,
            outbox,
            userId: me.id,
            timezone: tz && isValidTimeZone(tz) ? tz : me.timezone,
            challengeId: card.challenge.id,
            localDate: card.today,
            dayNumber: card.dayNumber,
            tasks,
            draft: allDoneDraft(tasks),
            note: null,
            honestMiss: false,
            hasPhoto: false,
            partialCounts: card.squad.partialCounts,
            existing: null,
          });
          clearDraft(card.challenge.id, card.today);
          countsDone = countsDone || res.countsDone;
          last = res.checkin;
        }
        track('checkin_quick', { challenges: cards.length });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        refresh().catch(() => undefined);
        const first = cards[0];
        if (cards.length === 1 && first && last) {
          router.push({
            pathname: '/checkin/success',
            params: {
              challengeId: first.challenge.id,
              date: first.today,
              n: String(first.dayNumber),
              status: last.status,
              streak: String(predictedStreak(before, first.today, countsDone)),
              counts: countsDone ? '1' : '0',
              since: last.updatedAt,
            },
          });
        } else {
          toast.show({ message: t('quickCheckin.doneMany', { n: cards.length }) });
        }
      } catch {
        toast.show({ message: t('checkin.saveFailed'), kind: 'error' });
      } finally {
        busy.current = false;
      }
    },
    [me.id, me.timezone, today.data, toast],
  );

  return useCallback(() => {
    const cards = quickCards(today.data?.cards ?? []);
    if (cards.length === 0) {
      toast.show({ message: t('quickCheckin.nothing') });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const tasks = cards.reduce((n, c) => n + (c.day?.tasks.length ?? 0), 0);
    const body =
      cards.length === 1
        ? t('quickCheckin.bodyOne', { n: tasks, title: cards[0]!.challenge.title })
        : t('quickCheckin.bodyMany', { n: tasks, count: cards.length });
    Alert.alert(t('quickCheckin.title'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('quickCheckin.confirm'), onPress: () => void run(cards) },
    ]);
  }, [today.data, toast, run]);
}
