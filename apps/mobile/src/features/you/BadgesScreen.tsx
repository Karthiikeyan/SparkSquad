import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import {
  BottomSheet,
  BrandLockup,
  Button,
  ErrorState,
  NavHeader,
  Pressable,
  ProgressBar,
  Screen,
  SkeletonCard,
  Text,
  useToast,
} from '../../components/ui';
import { t, tMaybe } from '../../i18n';
import { track } from '../../lib/analytics';
import { colors, fonts, radius } from '../../theme/tokens';
import { BadgeEmblem } from './BadgeEmblem';
import { badgeRows, flameState, type BadgeRow } from './model';
import { useYou } from './useYou';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** What the badge means once earned; before that, how to get it or a hint at it. */
export function badgeDetail(row: BadgeRow): string {
  if (row.earned) return tMaybe(`badgeStories.${row.badge}`) ?? row.label;
  if (row.secret) return tMaybe(`badgeHints.${row.badge}`) ?? '';
  if (row.target === null) return tMaybe(`badgeStories.${row.badge}`) ?? row.label;
  return row.group === 'streaks'
    ? t('badgesScreen.stepRule', { n: row.target })
    : t('badgesScreen.countRule', { n: row.target });
}

function caption(row: BadgeRow): string {
  if (row.earned || row.target === null) return row.secret ? t('badgesScreen.secret') : '';
  return row.group === 'streaks'
    ? t('badgesScreen.streakDays', { n: row.target })
    : t('badgesScreen.checkinCount', { n: row.target });
}

function Emblem({ row, onPress }: { row: BadgeRow; onPress: () => void }) {
  const name = row.secret ? t('badgesScreen.secret') : row.label;
  const sub = caption(row);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${badgeDetail(row)}`}
      style={styles.emblem}
      testID={`badge-${row.badge}`}
    >
      <BadgeEmblem badge={row.badge} earned={row.earned} secret={row.secret} size={64} />
      <Text
        variant="footnoteSemibold"
        align="center"
        numberOfLines={1}
        color={row.earned ? 'label' : 'label2'}
      >
        {name}
      </Text>
      {sub && !row.secret ? (
        <Text variant="caption" color="label3" align="center" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Section({
  title,
  body,
  rows,
  onOpen,
  wrap,
}: {
  title: string;
  body: string;
  rows: readonly BadgeRow[];
  onOpen: (row: BadgeRow) => void;
  wrap?: boolean;
}) {
  const items = rows.map((r) => <Emblem key={r.badge} row={r} onPress={() => onOpen(r)} />);
  return (
    <View style={styles.section}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="footnote" color="label2" style={styles.sectionBody}>
        {body}
      </Text>
      {wrap ? (
        <View style={styles.grid}>{items}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          style={styles.bleed}
        >
          {items}
        </ScrollView>
      )}
    </View>
  );
}

/** Your flame now, how close the next form is, and the story of what you've earned. */
function FlameHero({ rows }: { rows: readonly BadgeRow[] }) {
  const { current, next } = flameState(rows);
  const shown = current ?? next;
  if (!shown) return null;
  const from = current?.target ?? 0;
  const span = next?.target ? next.target - from : 1;
  const reached = next ? next.current - from : 0;
  return (
    <View style={styles.hero} accessible>
      <BadgeEmblem badge={shown.badge} earned={!!current} size={112} />
      <Text style={styles.heroName}>{current ? current.label : t('badgesScreen.flameEmpty')}</Text>
      <Text variant="callout" color="label2" align="center">
        {current ? badgeDetail(current) : t('badgesScreen.flameEmptyBody')}
      </Text>
      {next && next.toGo !== null ? (
        <View style={styles.heroNext}>
          <ProgressBar value={Math.max(0, reached) / span} />
          <Text variant="footnote" color="label2" align="center">
            {t('badgesScreen.flameNext', { n: next.toGo, name: next.label })}
          </Text>
        </View>
      ) : (
        <Text variant="footnote" color="accent">
          {t('badgesScreen.flameTop')}
        </Text>
      )}
    </View>
  );
}

function DetailSheet({ row, onClose }: { row: BadgeRow | null; onClose: () => void }) {
  const toast = useToast();
  const shot = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState(false);
  // Keep showing the badge while the sheet slides away.
  const shown = useRef<BadgeRow | null>(null);
  if (row) shown.current = row;
  const r = shown.current;

  const share = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(shot, { format: 'png', quality: 1, result: 'tmpfile' });
      track('share_card', { action: 'badge' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: r ? t('badgesScreen.shareMessage', { name: r.label }) : undefined,
      });
    } catch {
      toast.show({ message: t('badgesScreen.shareFailed'), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={!!row}
      onClose={onClose}
      accessibilityLabel={r ? (r.secret ? t('badgesScreen.secret') : r.label) : ''}
    >
      {r ? (
        <View style={styles.sheet}>
          <ViewShot ref={shot} style={styles.shareCard}>
            <BadgeEmblem badge={r.badge} earned={r.earned} secret={r.secret} size={120} />
            <Text style={styles.heroName} accessibilityRole="header">
              {r.secret ? t('badgesScreen.secret') : r.label}
            </Text>
            <Text variant="callout" color="label2" align="center">
              {badgeDetail(r)}
            </Text>
            {r.earned && r.earnedAt ? (
              <Text variant="footnote" color="label3">
                {dateFmt.format(new Date(r.earnedAt))}
              </Text>
            ) : null}
            {r.earned ? (
              <View style={styles.lockup}>
                <BrandLockup width={24} />
              </View>
            ) : null}
          </ViewShot>
          {r.earned ? (
            <Button
              label={t('badgesScreen.share')}
              onPress={() => void share()}
              loading={busy}
              testID="badge-share"
            />
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** F3: the flame, the path and secret moments, instead of a wall of numbers. */
export function BadgesScreen() {
  const you = useYou();
  const [open, setOpen] = useState<BadgeRow | null>(null);

  let body;
  if (you.isPending) body = <SkeletonCard />;
  else if (you.isError) body = <ErrorState onRetry={() => void you.refetch()} />;
  else {
    const rows = badgeRows(you.data.badges, you.data.best, you.data.checkins.length);
    const line = (group: BadgeRow['group']) =>
      rows.filter((r) => r.group === group).sort((a, b) => (a.target ?? 0) - (b.target ?? 0));
    body = (
      <>
        <FlameHero rows={rows} />
        <Section
          title={t('badgesScreen.groupStreaks')}
          body={t('badgesScreen.groupStreaksBody')}
          rows={line('streaks')}
          onOpen={setOpen}
        />
        <Section
          title={t('badgesScreen.groupCheckins')}
          body={t('badgesScreen.groupCheckinsBody')}
          rows={line('checkins')}
          onOpen={setOpen}
        />
        <Section
          title={t('badgesScreen.groupMilestones')}
          body={t('badgesScreen.groupMilestonesBody')}
          rows={[
            ...line('milestones').filter((r) => r.earned),
            ...line('milestones').filter((r) => !r.earned),
          ]}
          onOpen={setOpen}
          wrap
        />
      </>
    );
  }

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('badgesScreen.title')}
      </Text>
      {body}
      <DetailSheet row={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  heroName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.label },
  heroNext: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  section: { marginTop: 24 },
  sectionBody: { marginTop: 2, marginBottom: 12 },
  bleed: { marginHorizontal: -16 },
  rail: { paddingHorizontal: 16, gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  emblem: { width: 88, alignItems: 'center', gap: 6, paddingVertical: 4 },
  sheet: { gap: 16, paddingBottom: 8 },
  shareCard: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  lockup: { marginTop: 10 },
});
