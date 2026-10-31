import { router, useFocusEffect } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { formatLongDate } from '../../lib/format';
import { getPref, setPref } from '../../lib/prefs';
import { getRuntime } from '../../lib/runtime';
import { appEvents } from '../../lib/appEvents';
import { useMe } from '../auth/SessionProvider';
import { readDraft, toggleTask } from '../checkin/drafts';
import type { DraftValues } from '../checkin/submit';
import { markReadLocally } from '../notifications/data';
import { freezeNotice } from '../notifications/model';
import { useRefresh } from '../system/useRefresh';
import { ChallengeCard } from './ChallengeCard';
import { BellButton, StreakPill } from './HeaderActions';
import { timeZoneOf, type TodayCard } from './model';
import { useNotificationsList, useToday, useUnreadCount } from './useToday';

const draftKey = (c: TodayCard) => `${c.challenge.id}:${c.today}`;

function openCheckin(card: TodayCard, date?: string) {
  router.push({
    pathname: '/checkin/[challengeId]',
    params: date ? { challengeId: card.challenge.id, date } : { challengeId: card.challenge.id },
  });
}

/** B1–B3, B6, B7: Today tab. */
export function TodayScreen() {
  const me = useMe();
  const today = useToday();
  const unread = useUnreadCount();
  const inbox = useNotificationsList();
  const { refreshing, onRefresh } = useRefresh();
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [freezeDismissed, setFreezeDismissed] = useState(false);

  // Re-read drafts from storage when coming back from the check-in sheet.
  useFocusEffect(useCallback(() => setDrafts({}), []));

  const draftFor = (card: TodayCard) =>
    drafts[draftKey(card)] ?? readDraft(card.challenge.id, card.today, card.mine);

  const notice = useMemo(() => {
    if (freezeDismissed || !inbox.data || !today.data?.cards[0]) return null;
    return freezeNotice(
      inbox.data,
      today.data.cards[0].today,
      timeZoneOf(me),
      getPref('lastFreezeNoticeDate'),
    );
  }, [freezeDismissed, inbox.data, today.data, me]);

  const dismissFreeze = () => {
    if (!notice || !today.data?.cards[0]) return;
    setPref('lastFreezeNoticeDate', today.data.cards[0].today);
    setFreezeDismissed(true);
    const { db } = getRuntime();
    markReadLocally(db, [notice.id])
      .then(() => appEvents.emit('syncCompleted'))
      .catch(() => undefined);
    endpoints.markNotificationsRead([notice.id]).catch(() => undefined);
  };

  let body;
  if (today.isPending) {
    body = <SkeletonCard />;
  } else if (today.isError) {
    body = <ErrorState onRetry={() => void today.refetch()} />;
  } else if (today.data.cards.length === 0) {
    body = (
      <EmptyState
        icon={CalendarDays}
        message={t('empty.today')}
        actionLabel={t('today.join')}
        onAction={() => router.push('/join')}
        secondaryLabel={t('today.start')}
        onSecondary={() => router.push('/create/basics')}
      />
    );
  } else {
    body = (
      <View style={styles.cards}>
        {today.data.cards.map((card) => (
          <ChallengeCard
            key={card.challenge.id}
            card={card}
            draft={draftFor(card)}
            onToggle={(i) => {
              const task = card.day?.tasks[i];
              if (!task) return;
              setDrafts((cur) => ({
                ...cur,
                [draftKey(card)]: toggleTask(
                  card.challenge.id,
                  card.today,
                  draftFor(card),
                  i,
                  task,
                ),
              }));
            }}
            onCheckIn={(date) => openCheckin(card, date)}
            onOpenSquad={() =>
              router.push({ pathname: '/squad/[id]', params: { id: card.squad.id } })
            }
          />
        ))}
      </View>
    );
  }

  const freezeStreak =
    typeof notice?.payload.streak === 'number' ? notice.payload.streak : (today.data?.streak ?? 0);

  return (
    <Screen
      title={t('tabs.today')}
      subtitle={formatLongDate(new Date())}
      headerRight={
        <View style={styles.headerRight}>
          <StreakPill streak={today.data?.streak ?? 0} />
          <BellButton unread={unread.data ?? 0} />
        </View>
      }
      withTabBar
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {body}
      <BottomSheet
        visible={!!notice}
        onClose={dismissFreeze}
        accessibilityLabel={t('freeze.title')}
      >
        <View style={styles.sheet}>
          <Text variant="title2" accessibilityRole="header">
            {t('freeze.title')}
          </Text>
          <Text variant="callout" color="label2">
            {t('freeze.body', { n: freezeStreak })}
          </Text>
          <Button label={t('freeze.ok')} onPress={dismissFreeze} style={styles.sheetButton} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheet: { gap: 10, paddingBottom: 8 },
  sheetButton: { marginTop: 10 },
});
