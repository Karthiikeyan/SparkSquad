import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme/tokens';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Unit name used in spoken labels ("Decrease minutes"). */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  testID?: string;
}

export function clampStep(value: number, delta: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value + delta));
}

/** − value + control on a `surface3` track (check-in sheet). */
export function Stepper({
  value,
  onChange,
  label,
  min = 0,
  max = 10_000,
  step = 1,
  testID,
}: StepperProps) {
  const dec = () => onChange(clampStep(value, -step, min, max));
  const inc = () => onChange(clampStep(value, step, min, max));
  return (
    <View
      testID={testID}
      style={styles.track}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ now: value, min, max }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') inc();
        if (e.nativeEvent.actionName === 'decrement') dec();
      }}
    >
      <Pressable
        onPress={dec}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={t('common.decrease', { label })}
        hitSlop={{ top: 2, bottom: 2, left: 2 }}
        style={styles.btn}
      >
        <Text style={[styles.sign, value <= min && styles.dim]}>−</Text>
      </Pressable>
      <Text style={styles.value} tabular>
        {String(value)}
      </Text>
      <Pressable
        onPress={inc}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={t('common.increase', { label })}
        hitSlop={{ top: 2, bottom: 2, right: 2 }}
        style={styles.btn}
      >
        <Text style={[styles.sign, value >= max && styles.dim]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface3,
    borderRadius: 12,
    height: 40,
  },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: 20, lineHeight: 24, color: colors.onControl, fontFamily: fonts.sans },
  dim: { opacity: 0.35 },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.sansSemibold,
    color: colors.label,
  },
});
