import type { NotificationDTO } from '@sparksquad/shared';
import { router } from 'expo-router';
import { BellOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  NavHeader,
  Pressable,
  Screen,
  SectionedList,
  type ListSection,
  SkeletonCard,
  Text,
  useToast,
} from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { appEvents } from '../../lib/appEvents';
import { formatLocalDate, formatTime } from '../../lib/format';
import { getRuntime } from '../../lib/runtime';
import { colors } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { timeZoneOf, todayFor } from '../today/model';
import { useNotificationsList } from '../today/useToday';
import { useRefresh } from '../system/useRefresh';
import { markReadLocally } from './data';
import { groupByDay, notificationRoute, notificationText } from './model';

async function markRead(ids?: string[]): Promise<void> {
  await markReadLocally(getRuntime().db, ids);
  appEvents.emit('syncCompleted');
  await endpoints.markNotificationsRead(ids);
}

function Row({
  n,
  showTime,
  onPress,
}: {
  n: NotificationDTO;
  showTime: string;
  onPress: () => void;
}) {
  const text = notificationText(n);
  const unread = !n.readAt;
  return (
    <Pressable
      noScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unread ? `${t('inbox.unread')}, ${text}, ${showTime}` : `${text}, ${showTime}`
      }
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.dot, unread && styles.dotOn]} />
      <View style={styles.texts}>
        <Text variant={unread ? 'bodyMedium' : 'body'} color={unread ? 'label' : 'label2'}>
          {text}
        </Text>
        <Text variant="caption" color="label3" tabular>
          {showTime}
        </Text>
      </View>
    </Pressable>
  );
}

/** B8: nudges, approvals, announcements, milestones; Today / Earlier; mark all read. */
export function InboxScreen() {
  const me = useMe();
  const toast = useToast();
  const list = useNotificationsList();
  const { refreshing, onRefresh } = useRefresh();
  const [marking, setMarking] = useState(false);
  const tz = timeZoneOf(me);
  const today = todayFor(me, new Date());

  const hasUnread = (list.data ?? []).some((n) => !n.readAt);
  const markAll = async () => {
    setMarking(true);
    try {
      await markRead();
    } catch {
      toast.show({ message: t('inbox.markFailed'), kind: 'error' });
    } finally {
      setMarking(false);
    }
  };

  const open = (n: NotificationDTO) => {
    if (!n.readAt) markRead([n.id]).catch(() => undefined);
    router.navigate(notificationRoute(n) as never);
  };

  const title = (
    <Text variant="title1" accessibilityRole="header" style={styles.title}>
      {t('inbox.title')}
    </Text>
  );

  let state = null;
  let sections: ListSection<{ n: NotificationDTO; todayGroup: boolean }>[] = [];
  if (list.isPending) state = <SkeletonCard />;
  else if (list.isError) state = <ErrorState onRetry={() => void list.refetch()} />;
  else if (list.data.length === 0) state = <EmptyState icon={BellOff} message={t('inbox.empty')} />;
  else {
    const groups = groupByDay(list.data, today, tz);
    sections = [
      {
        key: 'today',
        title: t('inbox.today'),
        data: groups.today.map((n) => ({ n, todayGroup: true })),
      },
      {
        key: 'earlier',
        title: t('inbox.earlier'),
        data: groups.earlier.map((n) => ({ n, todayGroup: false })),
      },
    ];
  }
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz });

  return (
    <Screen
      scroll={false}
      header={
        <NavHeader
          backLabel={t('tabs.today')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          right={
            hasUnread ? (
              <Button
                label={t('inbox.markAll')}
                variant="ghost"
                size="sm"
                loading={marking}
                onPress={() => void markAll()}
              />
            ) : undefined
          }
        />
      }
    >
      <SectionedList
        sections={sections}
        keyOf={(x) => x.n.id}
        header={
          <>
            {title}
            {state}
          </>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderRow={({ n, todayGroup }) => (
          <Row
            n={n}
            showTime={
              todayGroup
                ? formatTime(new Date(n.createdAt))
                : formatLocalDate(dayFmt.format(new Date(n.createdAt)))
            }
            onPress={() => open(n)}
          />
        )}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  dotOn: { backgroundColor: colors.accent },
  texts: { flex: 1, gap: 2 },
});
