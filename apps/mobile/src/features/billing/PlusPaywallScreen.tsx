import { TIER_LIMITS } from '@sparksquad/shared';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, OfflineBanner, Pressable, Text } from '../../components/ui';
import { t } from '../../i18n';
import { useOnline } from '../../lib/hooks/useOnline';
import { colors, fonts, radius } from '../../theme/tokens';
import { useConfig } from '../system/useConfig';
import { comparisonRows, type Period, type PlanPrices } from './model';
import { usePaywall } from './usePaywall';

export function closePaywall() {
  if (router.canGoBack()) router.back();
  else router.replace('/you');
}

/** F9: Free vs Plus, yearly (default) or monthly, start, restore, Squad Pro link, cancel note. */
export function PlusPaywallScreen() {
  const insets = useSafeAreaInsets();
  const config = useConfig();
  const online = useOnline();
  const paywall = usePaywall('plus');
  const [period, setPeriod] = useState<Period>('yearly');
  const rows = comparisonRows(config.data?.limits ?? TIER_LIMITS);

  const startLabel = paywall.live
    ? t('paywall.start')
    : paywall.interested
      ? t('paywall.soonDone')
      : t('paywall.soon');

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
          testID="paywall-close"
        />
      </View>
      {!online ? <OfflineBanner /> : null}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {t('paywall.title')}
        </Text>
        <Text variant="callout" color="label2" style={styles.body}>
          {t('paywall.body')}
        </Text>

        <ComparisonTable rows={rows} />

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
          void paywall.start(period).then((ok) => {
            if (ok && paywall.live) closePaywall();
          })
        }
        loading={paywall.busy === 'buy'}
        disabled={!online || paywall.interested || paywall.unavailable || paywall.busy !== null}
        testID="paywall-start"
      />
      {paywall.unavailable ? (
        <Text variant="footnote" color="label2" align="center" style={styles.note}>
          {t('paywall.unavailable')}
        </Text>
      ) : null}
      <View style={styles.links}>
        {paywall.live ? (
          <Button
            label={t('paywall.restore')}
            variant="ghost"
            size="sm"
            onPress={() => void paywall.restore()}
            loading={paywall.busy === 'restore'}
          />
        ) : (
          <View />
        )}
        <Button
          label={t('paywall.squadPro')}
          variant="ghost"
          size="sm"
          onPress={() => router.replace('/paywall/squad-pro')}
        />
      </View>
      <Text variant="caption" color="label3" align="center">
        {t('paywall.cancelNote')}
      </Text>
    </View>
  );
}

export function ComparisonTable({
  rows,
}: {
  rows: { label: string; free: string; plus: string }[];
}) {
  return (
    <View style={styles.table}>
      <View
        style={styles.tr}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text variant="caption" color="label2" style={styles.th}>
          {' '}
        </Text>
        <Text variant="caption" color="label2" style={styles.td}>
          {t('paywall.free')}
        </Text>
        <Text variant="caption" color="accent" style={[styles.td, styles.semibold]}>
          {t('paywall.plus')}
        </Text>
      </View>
      {rows.map((r) => (
        <View
          key={r.label}
          style={[styles.tr, styles.rowSep]}
          accessible
          accessibilityLabel={`${r.label}: ${t('paywall.free')} ${r.free}, ${t('paywall.plus')} ${r.plus}`}
        >
          <Text variant="bodyMedium" style={styles.th}>
            {r.label}
          </Text>
          <Text variant="body" color="label2" style={styles.td}>
            {r.free}
          </Text>
          <Text variant="bodyMedium" style={styles.td}>
            {r.plus}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PeriodPicker({
  value,
  onChange,
  prices,
  loading,
}: {
  value: Period;
  onChange: (p: Period) => void;
  prices: PlanPrices;
  loading: boolean;
}) {
  const yearlyLabel = prices.savePercent
    ? t('paywall.yearlySave', { n: prices.savePercent })
    : t('paywall.yearly');
  const cards: { id: Period; label: string; price: string | null; sub: string }[] = [
    {
      id: 'yearly',
      label: yearlyLabel,
      price: prices.yearly,
      sub: prices.yearlyPerMonth ? t('paywall.perMonth', { price: prices.yearlyPerMonth }) : ' ',
    },
    {
      id: 'monthly',
      label: t('paywall.monthly'),
      price: prices.monthly,
      sub: t('paywall.billedMonthly'),
    },
  ];
  return (
    <View
      style={styles.periods}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('paywall.period')}
    >
      {cards.map((c) => {
        const on = value === c.id;
        const price = loading ? t('common.loading') : (c.price ?? t('paywall.priceSoon'));
        return (
          <Pressable
            key={c.id}
            noScale
            onPress={() => onChange(c.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${c.label}, ${price}, ${c.sub}`}
            style={[styles.period, on ? styles.periodOn : styles.periodOff]}
            testID={`period-${c.id}`}
          >
            <Text variant="footnoteSemibold" color={on ? 'accent' : 'label2'}>
              {c.label}
            </Text>
            <Text style={[styles.price, !c.price && styles.priceSoon]} tabular numberOfLines={1}>
              {price}
            </Text>
            <Text variant="caption" color="label2">
              {c.sub}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  top: { height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { paddingBottom: 16 },
  title: { marginBottom: 6 },
  body: { marginBottom: 18 },
  table: { backgroundColor: colors.surface, borderRadius: radius.list, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  th: { flex: 1.6, paddingRight: 8 },
  td: { flex: 1, paddingHorizontal: 4 },
  semibold: { fontFamily: fonts.sansSemibold },
  periods: { flexDirection: 'row', gap: 10, marginTop: 16 },
  period: { flex: 1, borderRadius: radius.list, gap: 2 },
  periodOn: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,178,36,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  periodOff: {
    borderWidth: 1,
    borderColor: colors.controlSelected,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  price: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.label },
  priceSoon: { fontSize: 18 },
  note: { marginTop: 8 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
