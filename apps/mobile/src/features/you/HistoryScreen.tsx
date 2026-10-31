import { compareLocalDates, type LocalDate } from '@sparksquad/shared';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ErrorState,
  GroupedList,
  GroupFooter,
  IconButton,
  ListRow,
  NavHeader,
  Pressable,
  Screen,
  SkeletonCard,
  Text,
} from '../../components/ui';
import { HEAT_FILLS } from '../../components/ui/Stats';
import { t } from '../../i18n';
import { formatLocalDate } from '../../lib/format';
import { colors } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { todayFor } from '../today/model';
import { dayLevel, monthGrid, shiftMonth } from './model';
import { useYou } from './useYou';

const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
// 2024-01-01 was a Monday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1 + i)),
  ),
);

/** F4: month calendar of my check-ins; tap a day for that day's list. */
export function HistoryScreen() {
  const me = useMe();
  const you = useYou();
  const today = todayFor(me, new Date());
  const [ym, setYm] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState<LocalDate>(today);
  const grid = useMemo(() => monthGrid(ym.year, ym.month), [ym]);
  const isCurrentMonth = today.startsWith(`${ym.year}-${String(ym.month).padStart(2, '0')}`);

  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;
  const title = (
    <Text variant="title1" accessibilityRole="header" style={styles.title}>
      {t('historyScreen.title')}
    </Text>
  );

  if (you.isPending || you.isError) {
    return (
      <Screen header={header}>
        {title}
        {you.isPending ? <SkeletonCard /> : <ErrorState onRetry={() => void you.refetch()} />}
      </Screen>
    );
  }

  const all = you.data.checkins;
  const dayList = all.filter((c) => c.localDate === selected);
  const monthLabel = monthFmt.format(new Date(Date.UTC(ym.year, ym.month - 1, 15)));

  return (
    <Screen header={header}>
      {title}
      <View style={styles.card}>
        <View style={styles.monthRow}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel={t('historyScreen.prev')}
            onPress={() => setYm((v) => shiftMonth(v, -1))}
            background="transparent"
          />
          <Text variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite">
            {monthLabel}
          </Text>
          <IconButton
            icon={ChevronRight}
            accessibilityLabel={t('historyScreen.next')}
            onPress={() => setYm((v) => shiftMonth(v, 1))}
            disabled={isCurrentMonth}
            background="transparent"
          />
        </View>
        <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no">
          {WEEKDAYS.map((d, i) => (
            <Text key={i} variant="caption" color="label2" align="center" style={styles.cellW}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.map((day, i) => {
            if (!day) return <View key={`b${i}`} style={styles.cellW} />;
            const future = compareLocalDates(day, today) > 0;
            const level = dayLevel(all, day);
            const n = all.filter((c) => c.localDate === day).length;
            const isSel = day === selected;
            return (
              <View key={day} style={styles.cellW}>
                <Pressable
                  noScale
                  disabled={future}
                  onPress={() => setSelected(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel, disabled: future }}
                  accessibilityLabel={
                    n > 0
                      ? t('historyScreen.dayLabel', { date: formatLocalDate(day), n })
                      : t('historyScreen.dayLabelNone', { date: formatLocalDate(day) })
                  }
                  style={[
                    styles.cell,
                    { backgroundColor: level > 0 ? HEAT_FILLS[level] : 'transparent' },
                    isSel && styles.selected,
                  ]}
                >
                  <Text
                    variant="footnote"
                    tabular
                    style={{
                      color: future ? colors.label3 : level === 3 ? colors.onAccent : colors.label,
                    }}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <Text variant="headline" style={styles.dayTitle} accessibilityRole="header">
        {formatLocalDate(selected)}
      </Text>
      {dayList.length === 0 ? (
        <Text variant="body" color="label2">
          {t('historyScreen.empty')}
        </Text>
      ) : (
        <GroupedList>
          {dayList.map((c) => (
            <ListRow
              key={c.id}
              title={c.challengeTitle || c.squadName}
              subtitle={`${c.squadName ? `${c.squadName} · ` : ''}${t(`checkinDetail.status_${c.status}`)}`}
              chevron
              onPress={() => router.push({ pathname: '/checkins/[id]', params: { id: c.id } })}
            />
          ))}
        </GroupedList>
      )}
      <GroupFooter>{t('historyScreen.limited')}</GroupFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 12, marginBottom: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  week: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellW: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  cell: {
    width: '100%',
    maxWidth: 44,
    aspectRatio: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderWidth: 2, borderColor: colors.label },
  dayTitle: { marginBottom: 10 },
});
