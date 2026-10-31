import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { avatarColor, avatarIndexFor, colors, fonts } from '../../theme/tokens';
import { Text } from './Text';

export type AvatarSize = 28 | 32 | 40 | 48 | 56;

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const FONT: Record<AvatarSize, number> = { 28: 10.5, 32: 11, 40: 14, 48: 16, 56: 18 };

export interface AvatarProps {
  name: string;
  /** 0..11 palette index; falls back to a hash of `id`. */
  color?: number | null;
  id?: string;
  size?: AvatarSize;
  /** Amber ring when the member checked in today (2 px gap + 2 px accent). */
  checked?: boolean;
  dimmed?: boolean;
  /** Overrides the initials (e.g. "Y" for You). */
  label?: string;
  /** Colour behind the ring gap; match the surface the avatar sits on. */
  ringGap?: string;
  /** Hide from screen readers when a parent already describes the group. */
  decorative?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  name,
  color,
  id,
  size = 32,
  checked,
  dimmed,
  label,
  ringGap = colors.surface,
  decorative,
  accessibilityLabel,
  style,
}: AvatarProps) {
  const index = color ?? (id ? avatarIndexFor(id) : 0);
  return (
    <View
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : (accessibilityLabel ?? name)}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(index),
          opacity: dimmed ? 0.55 : 1,
        },
        style,
      ]}
    >
      {checked ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { inset: -4, borderRadius: size / 2 + 4, borderColor: colors.accent },
            ]}
          />
          <View
            pointerEvents="none"
            style={[styles.ring, { inset: -2, borderRadius: size / 2 + 2, borderColor: ringGap }]}
          />
        </>
      ) : null}
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: FONT[size],
          lineHeight: FONT[size] + 4,
          color: colors.avatarLabel,
        }}
        maxFontSizeMultiplier={1}
      >
        {label ?? initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
});
