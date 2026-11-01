import type { LucideIcon } from 'lucide-react-native';
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
  /** 1–3: soft disc, ringed disc, solid amber disc. */
  tier?: 1 | 2 | 3;
  /** Small corner icon naming the badge family (streak, check-ins, milestone). */
  icon?: LucideIcon;
}

/** Earned = amber disc by tier; locked = dashed outline with progress copy. */
export function Badge({ glyph, label, earned, tier, icon }: BadgeProps) {
  return (
    <View style={styles.badge} accessible accessibilityLabel={label}>
      <BadgeDisc glyph={glyph} earned={earned} tier={tier} icon={icon} />
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

/** Just the disc (decorative; the row around it carries the label). */
export function BadgeDisc({
  glyph,
  earned,
  tier = 1,
  icon: Icon,
  size = 48,
}: Pick<BadgeProps, 'glyph' | 'earned' | 'tier' | 'icon'> & { size?: number }) {
  const solid = earned && tier === 3;
  const glyphColor = !earned ? colors.label3 : solid ? colors.onAccent : colors.accent;
  return (
    <View
      style={[
        styles.badgeDisc,
        { width: size, height: size, borderRadius: size / 2 },
        !earned
          ? styles.badgeLocked
          : solid
            ? styles.badgeSolid
            : tier === 2
              ? styles.badgeRinged
              : styles.badgeEarned,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[
          styles.badgeGlyph,
          { color: glyphColor, fontSize: size * 0.38, lineHeight: size * 0.46 },
        ]}
        tabular
      >
        {glyph}
      </Text>
      {Icon ? (
        <View style={[styles.badgeIcon, { borderColor: colors.surface }]}>
          <Icon size={11} color={earned ? colors.accent : colors.label3} strokeWidth={2.2} />
        </View>
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEarned: { backgroundColor: colors.accentSoft },
  badgeRinged: { backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent },
  badgeSolid: { backgroundColor: colors.accent },
  badgeLocked: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.strong },
  badgeGlyph: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
  badgeIcon: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
