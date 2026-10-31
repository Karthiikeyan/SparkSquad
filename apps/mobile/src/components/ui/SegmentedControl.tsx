import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../../theme/tokens';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** `tablist` for section switchers (Board/Leaderboard/Plan), `radiogroup` for settings. */
  role?: 'tablist' | 'radiogroup';
  /** `surface` = Settings variant (surface2 track, strong pill, 34 tall). */
  tone?: 'default' | 'surface';
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  role = 'tablist',
  tone = 'default',
  style,
}: SegmentedControlProps<T>) {
  const surface = tone === 'surface';
  return (
    <View
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        surface ? { backgroundColor: colors.surface2, height: 34 } : null,
        style,
      ]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            noScale
            onPress={() => onChange(o.value)}
            accessibilityRole={role === 'tablist' ? 'tab' : 'radio'}
            accessibilityState={role === 'tablist' ? { selected } : { checked: selected }}
            accessibilityLabel={o.label}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[
              styles.segment,
              selected && {
                backgroundColor: surface ? colors.strong : colors.controlSelected,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: selected ? colors.label : colors.chipLabel,
                  fontFamily: selected
                    ? fonts.sansSemibold
                    : surface
                      ? fonts.sans
                      : fonts.sansMedium,
                },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.control,
    borderRadius: radius.segment,
    padding: 2,
    height: 36,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.segmentPill,
    height: '100%',
  },
  label: { fontSize: 13, lineHeight: 18 },
});
