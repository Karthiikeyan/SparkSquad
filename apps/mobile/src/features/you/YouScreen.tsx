import { limitsFor, type LocalDate } from '@sparksquad/shared';
import { router } from 'expo-router';
import { ChevronRight, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Card,
  ErrorState,
  GroupedList,
  Heatmap,
  IconButton,
  ListRow,
  Pressable,
  Screen,
  SkeletonCard,
  StatTile,
  Text,
  useToast,
} from '../../components/ui';
import { t } from '../../i18n';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { useRefresh } from '../system/useRefresh';
import { todayFor } from '../today/model';
import {
  badgeRows,
  badgeStrip,
  heatmapLevels,
  heatmapStart,
  HEATMAP_WEEKS,
  recapText,
  shownUpPercent,
  weekStats,
} from './model';
import { RecapCard } from './RecapCard';
import { BadgeTile } from './BadgeEmblem';
import { useYou } from './useYou';

const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long' });

/** F1: profile header, stats, 18-week heatmap, badges, plan row and the weekly recap. */
export function YouScreen() {
  const me = useMe();
  const toast = useToast();
  const you = useYou();
  const { refreshing, onRefresh } = useRefresh();
  const today = todayFor(me, new Date());

  const header = (
    <View style={styles.head}>
      <Avatar name={me.displayName} id={me.id} color={me.avatarColor} size={56} decorative />
      <Pressable
        noScale
        style={styles.flex}
        onPress={() => router.push('/you/edit')}
        accessibilityRole="button"
        accessibilityHint={t('you.edit')}
      >
        <Text variant="title2" style={styles.name} numberOfLines={1} accessibilityRole="header">
          {me.displayName}
        </Text>
        <Text variant="footnote" color="label2" numberOfLines={1}>
          {sinceLine(you.data?.squadCount ?? 0, me.createdAt)}
        </Text>
      </Pressable>
      <IconButton
        icon={Settings}
        accessibilityLabel={t('you.settings')}
        onPress={() => router.push('/settings')}
        size={44}
        background="surface"
        testID="open-settings"
      />
    </View>
  );

  let body;
  if (you.isPending) body = <SkeletonCard />;
  else if (you.isError) body = <ErrorState onRetry={() => void you.refetch()} />;
  else {
    const d = you.data;
    const levels = heatmapLevels(d.checkins, today);
    const windowCount = d.checkins.filter((c) => c.localDate >= firstHeatDay(today)).length;
    const shown = shownUpPercent(d.checkins, today, me.createdAt.slice(0, 10));
    const rows = badgeRows(d.badges, d.best, d.checkins.length);
    const strip = badgeStrip(rows);
    const limits = limitsFor(me.plan);
    const isPlus = me.plan === 'plus';
    body = (
      <>
        <View style={styles.stats}>
          <StatTile value={String(d.current)} label={t('you.dayStreak')} accent />
          <StatTile value={String(d.best)} label={t('you.bestStreak')} />
          <StatTile value={`${shown}%`} label={t('you.shownUp')} />
        </View>

        <Card variant="section" style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="bodySemibold" accessibilityRole="header">
              {t('you.weeks')}
            </Text>
            <Text variant="footnote" color="label2">
              {windowCount === 1 ? t('you.checkinsOne') : t('you.checkins', { n: windowCount })}
            </Text>
          </View>
          <Heatmap levels={levels} weeks={HEATMAP_WEEKS} checkinCount={windowCount} />
        </Card>

        <Card variant="section" style={styles.section}>
          <Pressable
            noScale
            onPress={() => router.push('/you/badges')}
            accessibilityRole="button"
            accessibilityLabel={t('you.seeAllBadges')}
            style={styles.sectionHead}
          >
            <Text variant="bodySemibold">{t('you.badges')}</Text>
            <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
          </Pressable>
          <View style={styles.badges}>
            {strip.map((b) => (
              <BadgeTile
                key={b.badge}
                badge={b.badge}
                earned={b.earned}
                label={
                  b.earned || b.toGo === null
                    ? b.label
                    : t(b.group === 'streaks' ? 'you.toGo' : 'you.toGoCheckins', { n: b.toGo })
                }
              />
            ))}
          </View>
        </Card>

        <Pressable
          noScale
          onPress={() => router.push(isPlus ? '/settings/billing' : '/paywall/plus')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
          testID="plan-row"
        >
          <View style={styles.flex}>
            <Text variant="bodyMedium">{isPlus ? t('you.plusPlan') : t('you.freePlan')}</Text>
            <Text variant="footnote" color="label2">
              {t(isPlus ? 'you.plusUsage' : 'you.freeUsage', {
                n: d.squadCount,
                max: limits.squadsJoined,
              })}
            </Text>
          </View>
          <Text variant="bodySemibold" color="accent">
            {isPlus ? t('you.manage') : t('you.seePlus')}
          </Text>
        </Pressable>

        <RecapCard
          summary={recapText(weekStats(d.checkins, today, d.current))}
          today={today}
          canRewrite={isPlus}
          onError={(message) => toast.show({ message, kind: 'error' })}
        />

        <GroupedList>
          <ListRow title={t('you.history')} chevron onPress={() => router.push('/you/history')} />
          <ListRow
            title={t('you.seeAllBadges')}
            chevron
            onPress={() => router.push('/you/badges')}
          />
          <ListRow title={t('you.edit')} chevron onPress={() => router.push('/you/edit')} />
        </GroupedList>
      </>
    );
  }

  return (
    <Screen withTabBar refreshing={refreshing} onRefresh={onRefresh}>
      {header}
      {body}
    </Screen>
  );
}

function firstHeatDay(today: string): string {
  return heatmapStart(today as LocalDate);
}

export function sinceLine(squads: number, createdAt: string): string {
  const month = monthFmt.format(new Date(createdAt));
  if (squads === 0) return t('you.sinceNone', { month });
  if (squads === 1) return t('you.sinceOne', { month });
  return t('you.since', { n: squads, month });
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 24 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 20 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  section: { marginBottom: 12 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 24,
  },
  badges: { flexDirection: 'row', gap: 8 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  pressed: { opacity: 0.7 },
});
