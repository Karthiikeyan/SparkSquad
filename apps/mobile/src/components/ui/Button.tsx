import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../../theme/tokens';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'destructive';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const VARIANT = {
  primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent },
  secondary: { bg: colors.control, pressed: colors.surface2, fg: colors.label },
  soft: { bg: colors.accentSoft, pressed: 'rgba(255,178,36,0.22)', fg: colors.accent },
  ghost: { bg: 'transparent', pressed: colors.control, fg: colors.accent },
  destructive: { bg: colors.control, pressed: colors.surface2, fg: colors.danger },
} as const;

const SIZE = {
  lg: { height: 52, radius: radius.input, font: fonts.sansSemibold, fontSize: 17, px: 20 },
  md: { height: 44, radius: radius.button, font: fonts.sansMedium, fontSize: 15, px: 18 },
  sm: { height: 34, radius: 17, font: fonts.sansSemibold, fontSize: 14, px: 16 },
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled,
  loading,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={
        s.height < 44 ? { top: (44 - s.height) / 2, bottom: (44 - s.height) / 2 } : undefined
      }
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          borderRadius: s.radius,
          paddingHorizontal: s.px,
          backgroundColor: pressed && !inactive ? v.pressed : v.bg,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            numberOfLines={1}
            style={{
              fontFamily: s.font,
              fontSize: s.fontSize,
              lineHeight: s.fontSize + 5,
              color: v.fg,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
