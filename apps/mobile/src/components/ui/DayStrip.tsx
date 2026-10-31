import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme/tokens';
import { Text } from './Text';

export type DayState = 'done' | 'missed' | 'today' | 'future' | 'rest';

export interface StripDay {
  n: number;
  /** One-letter weekday ("M"). */
  weekday: string;
  state: DayState;
}

export interface DayStripProps {
  days: readonly StripDay[];
  selected?: number;
  onSelect?: (n: number) => void;
}

/** 7-day strip: done = green dot, missed = grey dot (never red), today = accent fill, rest = dashed. */
export function DayStrip({ days, selected, onSelect }: DayStripProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={t('dayStrip.label')}>
      {days.map((d) => {
        const today = d.state === 'today';
        const isSelected = selected === undefined ? today : selected === d.n;
        const fg = today
          ? colors.onAccent
          : d.state === 'future' || d.state === 'rest'
            ? colors.label3
            : colors.label;
        const dot =
          d.state === 'done'
            ? colors.success
            : d.state === 'missed'
              ? colors.missed
              : 'transparent';
        return (
          <Pressable
            key={d.n}
            testID={`day-${d.n}`}
            onPress={onSelect ? () => onSelect(d.n) : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t('dayStrip.day', { n: d.n, state: t(`dayStrip.${d.state}`) })}
            style={[
              styles.tile,
              {
                backgroundColor: today
                  ? colors.accent
                  : isSelected
                    ? colors.controlSelected
                    : colors.surface,
              },
              d.state === 'rest' && styles.rest,
            ]}
          >
            <Text style={[styles.weekday, { color: fg }]}>{d.weekday}</Text>
            <Text style={[styles.num, { color: fg }]} tabular>
              {String(d.n)}
            </Text>
            <View style={[styles.dot, { backgroundColor: dot }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  rest: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.controlSelected },
  weekday: { fontSize: 11, lineHeight: 14, opacity: 0.75, fontFamily: fonts.sans },
  num: { fontFamily: fonts.displaySemibold, fontSize: 19, lineHeight: 23 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
