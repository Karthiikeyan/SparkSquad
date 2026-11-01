import { router } from 'expo-router';
import { CheckCheck, Flame, Trophy, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  BadgeDisc,
  ErrorState,
  NavHeader,
  ProgressBar,
  Screen,
  SectionLabel,
  SkeletonCard,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { colors, fonts, radius } from '../../theme/tokens';
import { badgeRows, nextBadge, type BadgeGroup, type BadgeRow } from './model';
import { useYou } from './useYou';

export const BADGE_GROUP_ICON: Record<BadgeGroup, LucideIcon> = {
  streaks: Flame,
  checkins: CheckCheck,
  milestones: Trophy,
};

const GROUPS: readonly { group: BadgeGroup; label: () => string }[] = [
  { group: 'streaks', label: () => t('badgesScreen.groupStreaks') },
  { group: 'checkins', label: () => t('badgesScreen.groupCheckins') },
  { group: 'milestones', label: () => t('badgesScreen.groupMilestones') },
];

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "Earned 7 Oct 2026", "9 of 21 days", or the rule for one-off milestones. */
export function badgeDetail(row: BadgeRow): string {
  if (row.earned) {
    return t('badgesScreen.earnedOn', { date: dateFmt.format(new Date(row.earnedAt ?? '')) });
  }
  if (row.target === null) {
    return t(`badgesScreen.${row.badge as 'first_checkin' | 'challenge_complete'}`);
  }
  return t(row.group === 'streaks' ? 'badgesScreen.progress' : 'badgesScreen.progressCount', {
    n: row.current,
    target: row.target,
  });
}

/** F3: summary with "up next", then every badge grouped by family. */
export function BadgesScreen() {
  const you = useYou();

  let body;
  if (you.isPending) body = <SkeletonCard />;
  else if (you.isError) body = <ErrorState onRetry={() => void you.refetch()} />;
  else {
    const rows = badgeRows(you.data.badges, you.data.best, you.data.checkins.length);
    const earnedCount = rows.filter((r) => r.earned).length;
    const next = nextBadge(rows);
    body = (
      <>
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.summaryCount} tabular>
              {earnedCount}
              <Text variant="headline" color="label2">{` / ${rows.length}`}</Text>
            </Text>
            <Text variant="footnote" color="label2">
              {t('badgesScreen.summary', { n: earnedCount, total: rows.length })}
            </Text>
          </View>
          <ProgressBar value={earnedCount / rows.length} />
          {next ? (
            <View
              style={styles.next}
              accessible
              accessibilityLabel={`${t('badgesScreen.next')}: ${next.label}, ${badgeDetail(next)}`}
            >
              <BadgeDisc
                glyph={next.glyph}
                earned={false}
                icon={BADGE_GROUP_ICON[next.group]}
                size={52}
              />
              <View style={styles.texts}>
                <Text variant="caption" color="accent">
                  {t('badgesScreen.next')}
                </Text>
                <Text variant="bodySemibold">{next.label}</Text>
                <Text variant="footnote" color="label2">
                  {next.toGo !== null
                    ? `${badgeDetail(next)} · ${t('badgesScreen.nextBody', { n: next.toGo })}`
                    : badgeDetail(next)}
                </Text>
                {next.target !== null ? <ProgressBar value={next.current / next.target} /> : null}
              </View>
            </View>
          ) : null}
        </View>

        {GROUPS.map(({ group, label }) => {
          const items = rows
            .filter((r) => r.group === group)
            .sort((a, b) => (a.target ?? 0) - (b.target ?? 0));
          if (items.length === 0) return null;
          return (
            <View key={group} style={styles.groupBlock}>
              <SectionLabel>{label()}</SectionLabel>
              <View style={styles.grid}>
                {items.map((r) => (
                  <Tile key={r.badge} row={r} />
                ))}
              </View>
            </View>
          );
        })}
      </>
    );
  }

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('badgesScreen.title')}
      </Text>
      {body}
    </Screen>
  );
}

function Tile({ row }: { row: BadgeRow }) {
  const detail = badgeDetail(row);
  const short =
    !row.earned && row.target !== null
      ? t('badgesScreen.short', { n: row.current, target: row.target })
      : detail;
  return (
    <View style={styles.cell}>
      <View
        style={[styles.tile, row.earned && styles.tileEarned]}
        accessible
        accessibilityLabel={
          row.earned
            ? `${row.label}, ${detail}`
            : t('badgesScreen.locked_label', { label: row.label, detail })
        }
      >
        <BadgeDisc
          glyph={row.glyph}
          earned={row.earned}
          tier={row.tier}
          icon={BADGE_GROUP_ICON[row.group]}
          size={56}
        />
        <Text variant="footnoteSemibold" align="center" numberOfLines={2}>
          {row.label}
        </Text>
        <Text variant="caption" color="label2" align="center" numberOfLines={2}>
          {short}
        </Text>
        {!row.earned && row.target !== null ? (
          <View style={styles.tileBar}>
            <ProgressBar value={row.current / row.target} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryCount: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.label },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingTop: 12,
  },
  texts: { flex: 1, gap: 3 },
  groupBlock: { marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '33.333%', padding: 5 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    minHeight: 150,
  },
  tileEarned: { backgroundColor: colors.surface2 },
  tileBar: { alignSelf: 'stretch', marginTop: 'auto' },
});
