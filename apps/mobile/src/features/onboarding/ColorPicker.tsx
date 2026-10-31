import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { avatarColors, colors } from '../../theme/tokens';

export interface ColorPickerProps {
  value: number;
  onChange: (index: number) => void;
}

/** The 12 avatar colours as a radio group; selected = accent ring. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <View
      style={styles.grid}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('profile.colour')}
    >
      {avatarColors.map((c, i) => {
        const selected = i === value;
        return (
          <Pressable
            key={c}
            testID={`colour-${i}`}
            onPress={() => onChange(i)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t('profile.colourOption', { n: i + 1 })}
            style={styles.cell}
          >
            <View style={[styles.ring, selected && styles.ringOn]}>
              <View style={[styles.swatch, { backgroundColor: c }]} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  cell: { width: `${100 / 6}%`, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { borderColor: colors.accent },
  swatch: { width: 34, height: 34, borderRadius: 17 },
});
