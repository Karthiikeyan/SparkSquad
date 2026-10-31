import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../components/ui';
import { t } from '../../i18n';
import { colors, fonts, radius } from '../../theme/tokens';
import { normalizeOtp } from './routing';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
}

/**
 * Six boxes over one hidden input, so paste, SMS/email autofill (one-time-code) and
 * screen readers all work on a single field.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  editable = true,
  autoFocus,
}: OtpInputProps) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const digits = value.split('');
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false} style={styles.wrap}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length: 6 }, (_, i) => {
          const active = editable && i === Math.min(value.length, 5);
          return (
            <View key={i} style={[styles.box, active && styles.boxActive]}>
              <Text style={styles.digit} tabular>
                {digits[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        testID="otp-input"
        value={value}
        onChangeText={(text) => {
          const next = normalizeOtp(text);
          onChange(next);
          if (next.length === 6) onComplete?.(next);
        }}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={12}
        caretHidden
        accessibilityLabel={t('verify.label')}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxActive: { borderColor: colors.accent },
  digit: { fontFamily: fonts.displaySemibold, fontSize: 26, lineHeight: 32, color: colors.label },
  hidden: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent' },
});
