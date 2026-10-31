import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  ErrorState,
  NavHeader,
  Screen,
  SkeletonCard,
  StatTile,
  Text,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { formatLocalDate } from '../../../lib/format';
import { colors, fonts, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';

/** C14: final consistency per member, squad completion, rolled-up stats. */
export function ChallengeHistoryScreen() {
  const { id = '', challengeId = '' } = useLocalSearchParams<{ id: string; challengeId: string }>();
  const me = useMe();
  const summary = useQuery({
    queryKey: ['history', id, challengeId],
    queryFn: () => endpoints.challengeSummary(id, challengeId),
    staleTime: Infinity,
  });
  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;
  if (summary.isPending)
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  if (summary.isError) {
    return (
      <Screen header={header}>
        <ErrorState message={errorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      </Screen>
    );
  }
  const { challenge, completion, members } = summary.data;
  return (
    <Screen header={header}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {challenge.title}
      </Text>
      {challenge.endedAt ? (
        <Text variant="body" color="label2" style={styles.meta}>
          {t('history.ended', { date: formatLocalDate(challenge.endedAt.slice(0, 10)) })}
        </Text>
      ) : null}
      <View style={styles.stats}>
        <StatTile value={`${completion}%`} label={t('history.completion')} accent />
      </View>
      {members.length === 0 ? (
        <Text variant="body" color="label2">
          {t('history.empty')}
        </Text>
      ) : (
        <View style={styles.group}>
          {members.map((m, i) => {
            const isMe = m.user.id === me.id;
            return (
              <View key={m.user.id} style={[styles.row, i > 0 && styles.separator]} accessible>
                <Avatar
                  name={m.user.displayName}
                  id={m.user.id}
                  color={m.user.avatarColor}
                  size={32}
                  decorative
                />
                <View style={styles.texts}>
                  <Text
                    variant={isMe ? 'bodySemibold' : 'bodyMedium'}
                    color={isMe ? 'accent' : 'label'}
                    numberOfLines={1}
                  >
                    {isMe ? t('squad.you') : m.user.displayName}
                  </Text>
                  <Text variant="caption" color="label2" tabular>
                    {`${t('history.days', { done: m.daysDone, elapsed: m.daysElapsed })}, ${t('history.best', { n: m.bestStreak })}`}
                  </Text>
                </View>
                <Text style={styles.score} tabular>{`${m.consistency}%`}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4 },
  meta: { marginBottom: 16 },
  stats: { flexDirection: 'row', marginBottom: 16 },
  group: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  texts: { flex: 1, gap: 1, minWidth: 0 },
  score: { fontFamily: fonts.displaySemibold, fontSize: 20, color: colors.label },
});
