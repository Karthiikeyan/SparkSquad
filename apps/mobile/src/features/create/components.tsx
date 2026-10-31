import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { addDays, type LocalDate, type Plan, type PlanStats } from '@sparksquad/shared';
import { router } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Pressable, Text } from '../../components/ui';
import { formatNumber, t } from '../../i18n';
import { formatLongDate } from '../../lib/format';
import { colors, fonts, iconStroke, radius, themeName } from '../../theme/tokens';

/** "Cancel · Step n of 3" with a 3-segment progress bar (design CreateSquad). */
export function CreateHeader({ step, onCancel }: { step: 1 | 2 | 3; onCancel?: () => void }) {
  return (
    <View>
      <View style={styles.headRow}>
        <RNPressable
          onPress={onCancel ?? (() => router.dismissTo('/today'))}
          accessibilityRole="button"
          accessibilityLabel={t('create.cancel')}
          hitSlop={10}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>{t('create.cancel')}</Text>
        </RNPressable>
        <Text variant="footnote" color="label2">
          {t('create.step', { n: step })}
        </Text>
        <View style={styles.cancel} />
      </View>
      <View
        style={styles.progress}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.segment, i <= step && styles.segmentOn]} />
        ))}
      </View>
    </View>
  );
}

/** LocalDate ↔ Date at local noon (no timezone drift). */
export function localDateToDate(d: LocalDate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, day ?? 1, 12);
}

export function dateToLocalDate(date: Date): LocalDate {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** "Starts  Monday, 3 November  ›" row with the native date picker (today … today + 90). */
export function StartDateRow({
  value,
  today,
  onChange,
}: {
  value: LocalDate;
  today: LocalDate;
  onChange: (d: LocalDate) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = formatLongDate(localDateToDate(value));
  const min = localDateToDate(today);
  const max = localDateToDate(addDays(today, 90));
  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: localDateToDate(value),
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onValueChange: (_e, date) => onChange(dateToLocalDate(date)),
      });
    } else setOpen(true);
  };
  return (
    <>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={t('planPreview.startsLabel', { date: label })}
        style={styles.dateRow}
        testID="start-date"
      >
        <Text variant="body" style={styles.flex}>
          {t('planPreview.starts')}
        </Text>
        <Text variant="body" color="label2">
          {label}
        </Text>
        <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
      </Pressable>
      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          accessibilityLabel={t('planPreview.starts')}
        >
          <DateTimePicker
            value={localDateToDate(value)}
            mode="date"
            display="inline"
            themeVariant={themeName}
            accentColor={colors.accent}
            minimumDate={min}
            maximumDate={max}
            onValueChange={(_e, date) => onChange(dateToLocalDate(date))}
          />
          <Button label={t('common.done')} onPress={() => setOpen(false)} style={styles.done} />
        </BottomSheet>
      ) : null}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue} tabular>
        {formatNumber(value)}
      </Text>
      <Text variant="caption" color="label2" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const PREVIEW_DAYS = 2;

/** D5 result card: title, goal, stats, "n items were fixed", first days / all days. */
export function PlanPreviewCard({
  plan,
  stats,
  fixes,
}: {
  plan: Plan;
  stats: PlanStats;
  fixes: readonly string[];
}) {
  const [showFixes, setShowFixes] = useState(true);
  const [all, setAll] = useState(false);
  const days = all ? plan.days : plan.days.slice(0, PREVIEW_DAYS);
  const Chevron = showFixes ? ChevronUp : ChevronDown;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.okTile}>
          <Check size={20} color={colors.success} strokeWidth={2.2} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          {plan.goal ? (
            <Text variant="footnote" color="label2">
              {t('planPreview.goal', { goal: plan.goal })}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.stats}>
        <Stat value={stats.days} label={t('planPreview.days')} />
        <Stat value={stats.tasks} label={t('planPreview.tasks')} />
        <Stat value={stats.restDays} label={t('planPreview.reviewDays')} />
        <Stat value={stats.phases} label={t('planPreview.phases')} />
      </View>
      {fixes.length ? (
        <View style={styles.fixes}>
          <RNPressable
            onPress={() => setShowFixes((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showFixes }}
            style={styles.fixesHead}
          >
            <Text variant="footnoteSemibold" color="accent" style={styles.flex}>
              {fixes.length === 1
                ? t('planPreview.fixedOne')
                : t('planPreview.fixed', { n: fixes.length })}
            </Text>
            <Chevron size={16} color={colors.accent} strokeWidth={iconStroke} />
          </RNPressable>
          {showFixes
            ? fixes.map((f, i) => (
                <Text key={i} variant="footnote" style={styles.fix}>
                  {`• ${f}`}
                </Text>
              ))
            : null}
        </View>
      ) : null}
      <View>
        {days.map((d) => (
          <View key={d.day} style={styles.dayRow}>
            <Text variant="body" style={styles.flex} numberOfLines={1}>
              <Text variant="body" color="label2" tabular>
                {`${t('planPreview.dayRow', { n: d.day })}  `}
              </Text>
              {d.rest ? t('planPreview.rest') : d.title}
            </Text>
            {!d.rest ? (
              <Text variant="body" color="label2">
                {d.tasks.length === 1
                  ? t('planPreview.taskCountOne')
                  : t('planPreview.taskCount', { n: d.tasks.length })}
              </Text>
            ) : null}
          </View>
        ))}
        {plan.days.length > PREVIEW_DAYS ? (
          <RNPressable
            onPress={() => setAll((v) => !v)}
            accessibilityRole="button"
            style={styles.seeAll}
          >
            <Text variant="body" color="accent">
              {all ? t('planPreview.seeLess') : t('planPreview.seeAll', { n: plan.days.length })}
            </Text>
          </RNPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: { minWidth: 52, minHeight: 44, justifyContent: 'center' },
  cancelText: { fontFamily: fonts.sans, fontSize: 17, color: colors.accent },
  progress: { flexDirection: 'row', gap: 4, marginTop: 4, marginBottom: 20 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surface3 },
  segmentOn: { backgroundColor: colors.accent },
  dateRow: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  done: { marginTop: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  okTile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(61,220,151,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.label,
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.displaySemibold,
    fontSize: 22,
    lineHeight: 26,
    color: colors.label,
  },
  fixes: {
    backgroundColor: 'rgba(255,178,36,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  fixesHead: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  fix: { color: colors.onControl },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  seeAll: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    minHeight: 44,
  },
});
