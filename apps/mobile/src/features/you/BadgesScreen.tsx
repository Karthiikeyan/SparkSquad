import { router } from 'expo-router';
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
import { colors, radius } from '../../theme/tokens';
import { badgeRows, type BadgeRow } from './model';
import { useYou } from './useYou';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** F3: every badge, earned first with the date, locked ones with progress. */
export function BadgesScreen() {
  const you = useYou();

  let body;
  if (you.isPending) body = <SkeletonCard />;
  else if (you.isError) body = <ErrorState onRetry={() => void you.refetch()} />;
  else {
    const rows = badgeRows(you.data.badges, you.data.best);
    const earned = rows.filter((r) => r.earned);
    const locked = rows.filter((r) => !r.earned);
    body = (
      <>
        {earned.length > 0 ? (
          <>
            <SectionLabel>{t('badgesScreen.earned')}</SectionLabel>
            <View style={styles.group}>
              {earned.map((r, i) => (
                <Row key={r.badge} row={r} first={i === 0} best={you.data.best} />
              ))}
            </View>
          </>
        ) : null}
        {locked.length > 0 ? (
          <>
            <SectionLabel>{t('badgesScreen.locked')}</SectionLabel>
            <View style={styles.group}>
              {locked.map((r, i) => (
                <Row key={r.badge} row={r} first={i === 0} best={you.data.best} />
              ))}
            </View>
          </>
        ) : null}
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

function Row({ row, first, best }: { row: BadgeRow; first: boolean; best: number }) {
  const detail = row.earned
    ? t('badgesScreen.earnedOn', { date: dateFmt.format(new Date(row.earnedAt ?? '')) })
    : row.target !== null
      ? t('badgesScreen.progress', { n: Math.min(best, row.target), target: row.target })
      : t(`badgesScreen.${row.badge as 'first_checkin' | 'challenge_complete'}`);
  return (
    <View
      style={[styles.row, !first && styles.separator]}
      accessible
      accessibilityLabel={`${row.label}, ${detail}`}
    >
      <BadgeDisc glyph={row.glyph} earned={row.earned} />
      <View style={styles.texts}>
        <Text variant="bodyMedium">{row.label}</Text>
        <Text variant="footnote" color="label2">
          {detail}
        </Text>
        {!row.earned && row.target !== null ? (
          <ProgressBar value={Math.min(best / row.target, 1)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  texts: { flex: 1, gap: 4 },
});
