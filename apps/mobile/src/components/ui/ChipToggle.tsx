import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { colors, fonts, iconStroke } from '../../theme/tokens';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface ChipToggleProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `checkbox` for multi-select (interests), `radio` for single-select filters. */
  role?: 'checkbox' | 'radio' | 'button';
  icon?: LucideIcon;
  testID?: string;
}

/** Pill chip: selected = label background with black text (Discover). */
export function ChipToggle({
  label,
  selected,
  onPress,
  role = 'button',
  icon: Icon,
  testID,
}: ChipToggleProps) {
  const state = role === 'checkbox' || role === 'radio' ? { checked: selected } : { selected };
  const fg = selected ? '#000000' : colors.chipLabel;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={state}
      accessibilityLabel={label}
      hitSlop={{ top: 5, bottom: 5 }}
      style={[styles.chip, { backgroundColor: selected ? colors.label : colors.control }]}
    >
      {Icon ? <Icon size={15} color={fg} strokeWidth={iconStroke} /> : null}
      <Text
        style={{
          fontSize: 14,
          lineHeight: 18,
          fontFamily: selected ? fonts.sansSemibold : fonts.sans,
          color: fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
