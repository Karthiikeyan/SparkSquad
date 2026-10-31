import * as Clipboard from 'expo-clipboard';
import { requestPermissionsAsync, saveToLibraryAsync } from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import {
  Avatar,
  Button,
  ErrorState,
  Pressable,
  SkeletonCard,
  Text,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { colors, fonts } from '../../../theme/tokens';
import { buildBoard, currentRuns, restChecker, type BoardMember } from '../model';
import type { SquadSource } from '../source';
import { useSquad } from '../useSquad';
import { inviteLink } from './InviteScreen';

const CARD_BG = '#000000';
const MAX_AVATARS = 10;

/** "Divya 12, Kiran 12, Arun 8": top three current runs (ties by name). */
export function longestStreaks(
  src: SquadSource,
  today: string,
  limit = 3,
): { name: string; n: number }[] {
  const runs = currentRuns(src.checkins, today, restChecker(src));
  const names = new Map(src.members.map((m) => [m.userId, m.name.split(' ')[0] ?? m.name]));
  return [...runs.entries()]
    .filter(([id, n]) => n > 0 && names.has(id))
    .map(([id, n]) => ({ name: names.get(id)!, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function CardAvatar({ m }: { m: BoardMember }) {
  return (
    <Avatar
      name={m.name}
      id={m.id}
      color={m.avatarColor}
      size={40}
      fontSize={12}
      checked={m.checked}
      ringGap={CARD_BG}
      style={m.checked ? undefined : styles.dim}
      decorative
    />
  );
}

/** C13: 9:16 card made on the phone (view-shot): squad, day, big count, avatars, streaks, code. */
export function ShareCardScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const squad = useSquad(id);
  const shot = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/today'));
  const top = (
    <View style={styles.top}>
      <Text variant="headline" accessibilityRole="header">
        {t('share.title')}
      </Text>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('share.done')}
        hitSlop={12}
      >
        <Text style={styles.done}>{t('share.done')}</Text>
      </Pressable>
    </View>
  );

  if (squad.isPending) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        {top}
        <SkeletonCard />
      </View>
    );
  }
  const src = squad.data;
  if (!src?.challenge) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        {top}
        <ErrorState message={t('squad.notFound')} />
      </View>
    );
  }
  const board = buildBoard(src, new Date());
  const shown = board.grid.slice(0, MAX_AVATARS);
  const extra = board.grid.length - shown.length;
  const streaks = longestStreaks(src, board.today);
  const code = src.squad.inviteCode;

  const capture = () => captureRef(shot, { format: 'png', quality: 1, result: 'tmpfile' });
  const share = async () => {
    setBusy('share');
    try {
      const uri = await capture();
      track('share_card', { action: 'share' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.whatsapp') });
    } catch {
      toast.show({ message: t('share.failed'), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) {
        toast.show({ message: t('share.saveDenied'), kind: 'error' });
        return;
      }
      await saveToLibraryAsync(await capture());
      track('share_card', { action: 'save' });
      toast.show({ message: t('share.saved'), kind: 'success' });
    } catch {
      toast.show({ message: t('share.failed'), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      {top}
      <View accessible accessibilityRole="image" accessibilityLabel={t('share.preview')}>
        <ViewShot ref={shot} style={styles.card}>
          <View style={[styles.circle, styles.circleOuter]} />
          <View style={[styles.circle, styles.circleInner]} />
          <Text variant="footnote" color="label2">
            {src.squad.name}
          </Text>
          <Text variant="bodyMedium" style={styles.day}>
            {t('share.dayOf', { n: board.dayNumber, title: src.challenge.title })}
          </Text>
          <Text style={styles.count} tabular>
            {String(board.checkedCount)}
            <Text style={[styles.count, { color: colors.faint }]}>{`/${board.grid.length}`}</Text>
          </Text>
          <Text style={styles.showed}>{t('share.showedUp')}</Text>
          <View style={styles.grid}>
            {shown.map((m) => (
              <View key={m.id} style={styles.cell}>
                <CardAvatar m={m} />
              </View>
            ))}
            {extra > 0 ? (
              <View style={styles.cell}>
                <View style={styles.more}>
                  <Text variant="footnoteSemibold" color="label2">{`+${extra}`}</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={styles.spacer} />
          {streaks.length ? (
            <View style={styles.streaks}>
              <Text variant="caption" color="label2">
                {t('share.longest')}
              </Text>
              <Text variant="body" tabular>
                {streaks.map((s) => t('share.streakItem', { name: s.name, n: s.n })).join(', ')}
              </Text>
            </View>
          ) : null}
          <View style={styles.footerRow}>
            <Text style={styles.wordmark}>{t('share.wordmark')}</Text>
            {code ? (
              <Text variant="caption" color="label2">
                {t('share.joinWith')}
                <Text variant="caption" style={styles.code}>
                  {code}
                </Text>
              </Text>
            ) : null}
          </View>
        </ViewShot>
      </View>
      <View style={styles.flex} />
      <Button
        label={t('share.whatsapp')}
        onPress={() => void share()}
        loading={busy === 'share'}
        disabled={busy !== null}
      />
      <View style={styles.row}>
        <Button
          label={t('share.save')}
          variant="secondary"
          size="md"
          style={styles.flex}
          onPress={() => void save()}
          loading={busy === 'save'}
          disabled={busy !== null}
        />
        {code ? (
          <Button
            label={t('share.copyLink')}
            variant="secondary"
            size="md"
            style={styles.flex}
            onPress={() => {
              void Clipboard.setStringAsync(inviteLink(code));
              toast.show({ message: t('invite.copied'), kind: 'success' });
            }}
          />
        ) : null}
      </View>
      <Text variant="caption" color="label3" align="center" style={styles.note}>
        {t('share.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0C', paddingHorizontal: 16 },
  top: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  done: { fontFamily: fonts.sans, fontSize: 17, color: colors.accent },
  card: {
    alignSelf: 'center',
    width: 300,
    height: 533,
    borderRadius: 24,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface3,
    paddingVertical: 24,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderWidth: 1 },
  circleOuter: {
    width: 360,
    height: 360,
    borderRadius: 180,
    right: -170,
    top: -150,
    borderColor: 'rgba(255,178,36,0.22)',
  },
  circleInner: {
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -120,
    top: -100,
    borderColor: 'rgba(255,178,36,0.3)',
  },
  day: { marginTop: 2 },
  count: {
    marginTop: 36,
    fontFamily: fonts.display,
    fontSize: 88,
    lineHeight: 92,
    letterSpacing: -2,
    color: colors.accent,
  },
  showed: {
    fontFamily: fonts.displaySemibold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.label,
    marginTop: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 26 },
  cell: { width: '20%', alignItems: 'center' },
  dim: { opacity: 0.45 },
  more: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
  streaks: { gap: 6 },
  footerRow: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: { fontFamily: fonts.display, fontSize: 17, color: colors.label },
  code: { color: colors.label, fontFamily: fonts.sansSemibold },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  note: { marginTop: 10 },
});
