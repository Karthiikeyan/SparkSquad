import { and, eq } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, OfflineBanner, Pressable, Text } from '../../components/ui';
import { t } from '../../i18n';
import { useOnline } from '../../lib/hooks/useOnline';
import { parseJson } from '../../lib/db/helpers';
import { members, squads } from '../../lib/db/schema';
import { qk } from '../../lib/query/keys';
import { useLocalQuery } from '../../lib/query/useLocalQuery';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import type { Period } from './model';
import { closePaywall, PeriodPicker } from './PlusPaywallScreen';
import { usePaywall } from './usePaywall';

const FEATURES = [
  'paywall.proFeature1',
  'paywall.proFeature2',
  'paywall.proFeature3',
  'paywall.proFeature4',
] as const;

interface OwnedSquad {
  id: string;
  name: string;
  isPro: boolean;
}

/** F10: for owners; pick one squad, see what Pro adds, start (or register interest). */
export function SquadProPaywallScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { squadId } = useLocalSearchParams<{ squadId?: string }>();
  const online = useOnline();
  const paywall = usePaywall('squad_pro');
  const [period, setPeriod] = useState<Period>('yearly');
  const owned = useLocalQuery<OwnedSquad[]>([...qk.squads, 'owned', me.id], async (db) => {
    const rows = await db
      .select({ id: squads.id, data: squads.data })
      .from(members)
      .innerJoin(squads, eq(squads.id, members.squadId))
      .where(
        and(eq(members.userId, me.id), eq(members.role, 'owner'), eq(members.status, 'active')),
      )
      .all();
    return rows
      .map((r) => {
        const d = parseJson<{ name: string; isPro: boolean }>(r.data, { name: '', isPro: false });
        return { id: r.id, name: d.name, isPro: d.isPro };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const [picked, setPicked] = useState<string | null>(squadId ?? null);
  const choices = (owned.data ?? []).filter((s) => !s.isPro);

  useEffect(() => {
    if (!picked && choices[0]) setPicked(choices[0].id);
  }, [picked, choices]);

  const startLabel = paywall.live
    ? t('paywall.proStart')
    : paywall.interested
      ? t('paywall.soonDone')
      : t('paywall.proSoon');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <IconButton
          icon={X}
          size={36}
          background="control"
          color="onControl"
          accessibilityLabel={t('paywall.close')}
          onPress={closePaywall}
        />
      </View>
      {!online ? <OfflineBanner /> : null}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {t('paywall.proTitle')}
        </Text>
        <Text variant="callout" color="label2" style={styles.body}>
          {t('paywall.proBody')}
        </Text>
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.feature}>
              <Check size={18} color={colors.success} strokeWidth={iconStroke} />
              <Text variant="body" style={styles.flex}>
                {t(f)}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="footnote" color="label2" style={styles.pickLabel} accessibilityRole="header">
          {t('paywall.proPick')}
        </Text>
        {owned.isSuccess && choices.length === 0 ? (
          <View style={styles.none}>
            <Text variant="body" color="label2">
              {t('paywall.proNoSquads')}
            </Text>
            <Button
              label={t('squads.start')}
              variant="secondary"
              size="md"
              onPress={() => router.replace('/create/basics')}
            />
          </View>
        ) : (
          <View
            style={styles.list}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('paywall.proPick')}
          >
            {choices.map((s, i) => {
              const on = picked === s.id;
              return (
                <Pressable
                  key={s.id}
                  noScale
                  onPress={() => setPicked(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={s.name}
                  style={[styles.row, i > 0 && styles.sep]}
                >
                  <Text variant="body" style={styles.flex} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <PeriodPicker
          value={period}
          onChange={setPeriod}
          prices={paywall.prices}
          loading={paywall.loading}
        />
      </ScrollView>

      <Button
        label={startLabel}
        onPress={() =>
          void paywall.start(period, picked ?? undefined).then((ok) => {
            if (ok && paywall.live) closePaywall();
          })
        }
        loading={paywall.busy === 'buy'}
        disabled={
          !online || !picked || paywall.interested || paywall.unavailable || paywall.busy !== null
        }
        testID="pro-start"
      />
      {paywall.live ? (
        <Button
          label={t('paywall.restore')}
          variant="ghost"
          size="sm"
          onPress={() => void paywall.restore()}
          loading={paywall.busy === 'restore'}
          style={styles.restore}
        />
      ) : null}
      <Text variant="caption" color="label3" align="center" style={styles.note}>
        {t('paywall.cancelNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  top: { height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { paddingBottom: 16 },
  title: { marginBottom: 6 },
  body: { marginBottom: 18 },
  flex: { flex: 1 },
  features: { gap: 10, marginBottom: 20 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickLabel: { marginHorizontal: 16, marginBottom: 6 },
  none: { gap: 12, backgroundColor: colors.surface, borderRadius: radius.list, padding: 16 },
  list: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  restore: { alignSelf: 'center', marginTop: 8 },
  note: { marginTop: 8 },
});
