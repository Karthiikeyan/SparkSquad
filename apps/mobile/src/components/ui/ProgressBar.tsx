import { StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors } from '../../theme/tokens';

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  accessibilityLabel?: string;
}

/** 6 px bar on `surface3` with an accent fill. */
export function ProgressBar({ value, accessibilityLabel }: ProgressBarProps) {
  const v = clamp01(value);
  const percent = Math.round(v * 100);
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('progress.label', { percent })}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

export interface PhaseBarProps {
  total: number;
  /** 1-based current phase. */
  current: number;
  /** 0..1 progress through the current phase. */
  progress: number;
}

/** One segment per plan phase; past phases full, current partly filled. */
export function PhaseBar({ total, current, progress }: PhaseBarProps) {
  const count = Math.max(1, total);
  return (
    <View
      style={styles.phases}
      accessible
      accessibilityLabel={t('phaseBar.label', { current, total: count })}
    >
      {Array.from({ length: count }, (_, i) => {
        const fill = i + 1 < current ? 1 : i + 1 === current ? clamp01(progress) : 0;
        return (
          <View key={i} style={styles.segment}>
            <View style={[styles.segmentFill, { width: `${Math.round(fill * 100)}%` }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  phases: { flexDirection: 'row', gap: 4 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
  segmentFill: { height: 4, backgroundColor: colors.accent },
});
