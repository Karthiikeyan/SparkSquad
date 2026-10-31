import { StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, fonts, radius } from '../../theme/tokens';
import { Text } from './Text';

export interface StatTileProps {
  value: string;
  label: string;
  accent?: boolean;
}

/** Big Bricolage number over a small caption (Profile). */
export function StatTile({ value, label, accent }: StatTileProps) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label}`}>
      <Text
        style={[styles.value, { color: accent ? colors.accent : colors.label }]}
        tabular
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text variant="footnote" color="label2" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export const HEAT_FILLS = [
  colors.heatEmpty,
  'rgba(255,178,36,0.35)',
  'rgba(255,178,36,0.65)',
  colors.accent,
] as const;

export interface HeatmapProps {
  /** Levels 0..3, column-major (week by week, Monday first); length = weeks × 7. */
  levels: readonly number[];
  weeks?: number;
  checkinCount: number;
}

/** 18 weeks × 7 days, 4 levels of accent opacity. */
export function Heatmap({ levels, weeks = 18, checkinCount }: HeatmapProps) {
  return (
    <View>
      <View
        style={styles.grid}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('heatmap.label', { weeks, count: checkinCount })}
      >
        {Array.from({ length: weeks }, (_, w) => (
          <View key={w} style={styles.column}>
            {Array.from({ length: 7 }, (_, d) => {
              const lvl = Math.max(0, Math.min(3, levels[w * 7 + d] ?? 0));
              return <View key={d} style={[styles.cell, { backgroundColor: HEAT_FILLS[lvl] }]} />;
            })}
          </View>
        ))}
      </View>
      <View
        style={styles.legend}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text variant="tab" color="label2">
          {t('heatmap.less')}
        </Text>
        {HEAT_FILLS.map((fill) => (
          <View key={fill} style={[styles.legendCell, { backgroundColor: fill }]} />
        ))}
        <Text variant="tab" color="label2">
          {t('heatmap.more')}
        </Text>
      </View>
    </View>
  );
}

export interface BadgeProps {
  /** Short glyph inside the circle (e.g. "7"). */
  glyph: string;
  label: string;
  earned: boolean;
}

/** Earned = soft amber disc; locked = dashed outline with progress copy. */
export function Badge({ glyph, label, earned }: BadgeProps) {
  return (
    <View style={styles.badge} accessible accessibilityLabel={label}>
      <BadgeDisc glyph={glyph} earned={earned} />
      <Text
        variant="caption"
        align="center"
        style={{ color: earned ? colors.onControl : colors.label2 }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

/** Just the 48 px disc (decorative; the row around it carries the label). */
export function BadgeDisc({ glyph, earned }: Pick<BadgeProps, 'glyph' | 'earned'>) {
  return (
    <View
      style={[styles.badgeDisc, earned ? styles.badgeEarned : styles.badgeLocked]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.badgeGlyph, { color: earned ? colors.accent : colors.label3 }]} tabular>
        {glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    padding: 14,
    gap: 2,
  },
  value: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  grid: { flexDirection: 'row', gap: 3 },
  column: { flex: 1, gap: 3 },
  cell: { height: 14, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  legendCell: { width: 10, height: 10, borderRadius: 3 },
  badge: { flex: 1, alignItems: 'center', gap: 6 },
  badgeDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEarned: { backgroundColor: colors.accentSoft },
  badgeLocked: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.strong },
  badgeGlyph: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
});
