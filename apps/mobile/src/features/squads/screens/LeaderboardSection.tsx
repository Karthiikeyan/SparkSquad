import type { LeaderboardEntryDTO } from '@sparksquad/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, ChipToggle, ErrorState, Skeleton, Text } from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { qk } from '../../../lib/query/keys';
import { colors, fonts, radius } from '../../../theme/tokens';

type Range = 'challenge' | 'week';

/** Show tasks only where they break a tie (design: "12 of 12 days, 36 tasks"). */
export function needsTasks(
  entries: readonly LeaderboardEntryDTO[],
  e: LeaderboardEntryDTO,
): boolean {
  const ratio = (x: LeaderboardEntryDTO) => (x.daysElapsed ? x.daysDone / x.daysElapsed : 0);
  return entries.some((o) => o !== e && ratio(o) === ratio(e));
}

/** C3: This challenge / This week, explainer, ranked rows with "You" highlighted. */
export function LeaderboardSection({ challengeId }: { challengeId: string }) {
  const [range, setRange] = useState<Range>('challenge');
  const query = useQuery({
    queryKey: qk.leaderboard(challengeId, range),
    queryFn: () => endpoints.leaderboard(challengeId, range),
    staleTime: 60_000,
  });

  let body;
  if (query.isPending) {
    body = (
      <View style={styles.list}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton height={20} />
          </View>
        ))}
      </View>
    );
  } else if (query.isError) {
    body = <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  } else if (query.data.entries.length === 0) {
    body = (
      <Text variant="body" color="label2">
        {t('leaderboard.empty')}
      </Text>
    );
  } else {
    const entries = query.data.entries;
    body = (
      <View style={styles.list} accessibilityRole="list">
        {entries.map((e, i) => {
          const sub = needsTasks(entries, e)
            ? t('leaderboard.daysTasks', {
                done: e.daysDone,
                elapsed: e.daysElapsed,
                tasks: e.tasksDone,
              })
            : t('leaderboard.days', { done: e.daysDone, elapsed: e.daysElapsed });
          const name = e.isMe ? t('leaderboard.you') : e.user.displayName;
          return (
            <View
              key={e.user.id}
              style={[styles.row, i > 0 && !e.isMe && styles.separator, e.isMe && styles.me]}
              accessible
              accessibilityLabel={t('leaderboard.rank', {
                rank: e.rank,
                name,
                score: e.score,
                sub,
              })}
            >
              <Text style={styles.rank} tabular>
                {String(e.rank)}
              </Text>
              <Avatar
                name={e.user.displayName}
                id={e.user.id}
                color={e.user.avatarColor}
                label={e.isMe ? 'Y' : undefined}
                size={32}
                decorative
              />
              <View style={styles.texts}>
                <Text
                  variant={e.isMe ? 'bodySemibold' : 'bodyMedium'}
                  color={e.isMe ? 'accent' : 'label'}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <Text variant="caption" color="label2" tabular>
                  {sub}
                </Text>
              </View>
              <Text style={styles.score} tabular>{`${e.score}%`}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('leaderboard.range')}
      >
        <ChipToggle
          label={t('leaderboard.challenge')}
          role="radio"
          selected={range === 'challenge'}
          onPress={() => setRange('challenge')}
        />
        <ChipToggle
          label={t('leaderboard.week')}
          role="radio"
          selected={range === 'week'}
          onPress={() => setRange('week')}
        />
      </View>
      <Text variant="footnote" color="label2" style={styles.explain}>
        {t('leaderboard.explain')}
      </Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  explain: { marginBottom: 12, marginLeft: 2 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  skeletonRow: { height: 52, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  me: { backgroundColor: 'rgba(255,178,36,0.12)', marginHorizontal: -16, paddingHorizontal: 16 },
  rank: {
    width: 20,
    textAlign: 'right',
    fontFamily: fonts.sansSemibold,
    fontSize: 15,
    color: colors.label2,
  },
  texts: { flex: 1, minWidth: 0, gap: 1 },
  score: { fontFamily: fonts.displaySemibold, fontSize: 20, lineHeight: 24, color: colors.label },
});
