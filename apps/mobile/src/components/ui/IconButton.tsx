import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, iconStroke, type ColorToken } from '../../theme/tokens';
import { Pressable } from './Pressable';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Required: icon-only buttons need a spoken label. */
  accessibilityLabel: string;
  onPress?: () => void;
  size?: 36 | 44;
  /** Background token; `transparent` for bare header icons. */
  background?: ColorToken | 'transparent';
  color?: ColorToken;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  size = 44,
  background = 'surface',
  color = 'label',
  disabled,
  style,
  testID,
}: IconButtonProps) {
  const pad = size < 44 ? (44 - size) / 2 : 0;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={pad ? { top: pad, bottom: pad, left: pad, right: pad } : undefined}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background === 'transparent' ? 'transparent' : colors[background],
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon size={size === 36 ? 18 : 20} color={colors[color]} strokeWidth={iconStroke} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
