import { StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme/tokens';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface ChipToggleProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `checkbox` for multi-select (interests), `radio` for single-select filters. */
  role?: 'checkbox' | 'radio' | 'button';
  testID?: string;
}

/** Pill chip: selected = label background with black text (Discover). */
export function ChipToggle({ label, selected, onPress, role = 'button', testID }: ChipToggleProps) {
  const state = role === 'checkbox' || role === 'radio' ? { checked: selected } : { selected };
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
      <Text
        style={{
          fontSize: 14,
          lineHeight: 18,
          fontFamily: selected ? fonts.sansSemibold : fonts.sans,
          color: selected ? '#000000' : colors.chipLabel,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
