import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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

/** Typed text → number in range; null when there is nothing usable (keep the old value). */
export function parseTyped(text: string, min: number, max: number): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  return Math.min(max, Math.max(min, Number(digits)));
}

const HOLD_TICK_MS = 110;
/** Holding + or − speeds up to ten steps a tick after this many ticks. */
const HOLD_FAST_AFTER = 8;

/** − value + control: tap the number to type it, hold a sign to run through values quickly. */
export function Stepper({
  value,
  onChange,
  label,
  min = 0,
  max = 10_000,
  step = 1,
  testID,
}: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = () => {
    if (hold.current) clearInterval(hold.current);
    hold.current = null;
  };
  useEffect(() => stopHold, []);

  const dec = () => onChange(clampStep(value, -step, min, max));
  const inc = () => onChange(clampStep(value, step, min, max));
  const startHold = (direction: 1 | -1) => {
    stopHold();
    let ticks = 0;
    hold.current = setInterval(() => {
      ticks += 1;
      const delta = direction * step * (ticks > HOLD_FAST_AFTER ? 10 : 1);
      latest.current.onChange(clampStep(latest.current.value, delta, min, max));
    }, HOLD_TICK_MS);
  };
  const commit = () => {
    if (draft === null) return;
    const next = parseTyped(draft, min, max);
    setDraft(null);
    if (next !== null && next !== value) onChange(next);
  };

  return (
    <View
      testID={testID}
      style={styles.track}
      accessible={draft === null}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={t('common.stepperHint')}
      accessibilityValue={{ now: value, min, max }}
      accessibilityActions={[
        { name: 'increment' },
        { name: 'decrement' },
        { name: 'activate', label: t('common.typeValue', { label }) },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') inc();
        if (e.nativeEvent.actionName === 'decrement') dec();
        if (e.nativeEvent.actionName === 'activate') setDraft(String(value));
      }}
    >
      <Pressable
        onPress={dec}
        onLongPress={() => startHold(-1)}
        onPressOut={stopHold}
        delayLongPress={350}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={t('common.decrease', { label })}
        hitSlop={{ top: 2, bottom: 2, left: 2 }}
        style={styles.btn}
      >
        <Text style={[styles.sign, value <= min && styles.dim]}>−</Text>
      </Pressable>
      {draft === null ? (
        <Pressable
          onPress={() => setDraft(String(value))}
          accessibilityRole="button"
          accessibilityLabel={t('common.typeValue', { label })}
          hitSlop={{ top: 2, bottom: 2 }}
          style={styles.valueTap}
        >
          <Text style={styles.value} tabular>
            {String(value)}
          </Text>
          <View style={styles.editLine} />
        </Pressable>
      ) : (
        <TextInput
          autoFocus
          selectTextOnFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={String(max).length}
          accessibilityLabel={t('common.typeValue', { label })}
          selectionColor={colors.accent}
          style={[styles.value, styles.input]}
          testID={testID ? `${testID}-input` : 'stepper-input'}
        />
      )}
      <Pressable
        onPress={inc}
        onLongPress={() => startHold(1)}
        onPressOut={stopHold}
        delayLongPress={350}
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
  valueTap: { minWidth: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  // Quiet underline: says "you can tap and type this".
  editLine: {
    width: 18,
    height: 1.5,
    borderRadius: 1,
    marginTop: 1,
    backgroundColor: colors.faint,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.sansSemibold,
    color: colors.label,
  },
  input: { minWidth: 56, height: 40, padding: 0 },
});
