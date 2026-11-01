import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import {
  BrandLockup,
  Button,
  ErrorState,
  Pressable,
  SkeletonCard,
  Text,
  useToast,
  WAVES,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { formatLocalDate } from '../../../lib/format';
import { colors, fonts } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { todayFor } from '../../today/model';
import { buildWeeklyRecap } from '../recap';
import { useSquad } from '../useSquad';

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue} tabular>
        {value}
      </Text>
      <Text variant="caption" color="label2">
        {label}
      </Text>
    </View>
  );
}

/** "This week in <squad>": a 9:16 card built on the phone, ready for WhatsApp. */
export function RecapScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const squad = useSquad(id);
  const shot = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/squads'));
  const top = (
    <View style={styles.top}>
      <Text variant="headline" accessibilityRole="header">
        {t('recapCard.screenTitle')}
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
  const pad = { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 };

  if (squad.isPending) {
    return (
      <View style={[styles.root, pad]}>
        {top}
        <SkeletonCard />
      </View>
    );
  }
  const src = squad.data;
  const recap = src ? buildWeeklyRecap(src, todayFor(me, new Date())) : null;
  if (!src || !recap) {
    return (
      <View style={[styles.root, pad]}>
        {top}
        <ErrorState message={t('squad.notFound')} />
      </View>
    );
  }

  const share = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(shot, { format: 'png', quality: 1, result: 'tmpfile' });
      track('share_card', { action: 'recap' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.whatsapp') });
    } catch {
      toast.show({ message: t('share.failed'), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, pad]}>
      {top}
      <View accessible accessibilityRole="image" accessibilityLabel={t('share.preview')}>
        <ViewShot ref={shot} style={styles.card}>
          <Image source={WAVES} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Text variant="footnote" color="label2">
            {t('recapCard.range', {
              from: formatLocalDate(recap.from),
              to: formatLocalDate(recap.to),
            })}
          </Text>
          <Text style={styles.title}>{t('recapCard.title', { squad: src.squad.name })}</Text>
          <Text style={styles.big} tabular>
            {String(recap.checkins)}
          </Text>
          <Text style={styles.bigLabel}>
            {recap.checkins === 1 ? t('recapCard.checkinsOne') : t('recapCard.checkins')}
          </Text>
          <View style={styles.facts}>
            <Fact
              value={`${recap.activeMembers}/${recap.totalMembers}`}
              label={t('recapCard.showedUp')}
            />
            <Fact value={String(recap.perfectDays)} label={t('recapCard.perfectDays')} />
          </View>
          <View style={styles.spacer} />
          {recap.top ? (
            <Text variant="body" style={styles.line}>
              {t('recapCard.top', { name: recap.top.name, n: recap.top.days })}
            </Text>
          ) : null}
          {recap.bestStreak ? (
            <Text variant="body" style={styles.line}>
              {t('recapCard.streak', { name: recap.bestStreak.name, n: recap.bestStreak.days })}
            </Text>
          ) : null}
          <View style={styles.footerRow}>
            <BrandLockup width={26} />
            {src.squad.inviteCode ? (
              <Text variant="caption" color="label2">
                {t('share.joinWith')}
                <Text variant="caption" style={styles.code}>
                  {src.squad.inviteCode}
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
        loading={busy}
        testID="recap-share"
      />
      <Text variant="caption" color="label3" align="center" style={styles.note}>
        {t('recapCard.note')}
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
    backgroundColor: '#000000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface3,
    paddingVertical: 24,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.label,
    marginTop: 4,
  },
  big: {
    marginTop: 28,
    fontFamily: fonts.display,
    fontSize: 88,
    lineHeight: 92,
    letterSpacing: -2,
    color: colors.accent,
  },
  bigLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.label,
  },
  facts: { flexDirection: 'row', gap: 24, marginTop: 20 },
  fact: { gap: 2 },
  factValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.label },
  spacer: { flex: 1 },
  line: { marginBottom: 4 },
  footerRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  code: { color: colors.label, fontFamily: fonts.sansSemibold },
  flex: { flex: 1 },
  note: { marginTop: 10 },
});
