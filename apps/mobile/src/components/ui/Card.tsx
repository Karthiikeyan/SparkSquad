import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/tokens';

export interface CardProps {
  children: ReactNode;
  /** `card` = 22 radius, 16 padding (challenge cards); `tile` = 16 radius (stat tiles, grids). */
  variant?: 'card' | 'tile' | 'section';
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ children, variant = 'card', gap, style, testID }: CardProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        variant === 'card' && styles.card,
        variant === 'tile' && styles.tile,
        variant === 'section' && styles.section,
        gap !== undefined && { gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface },
  card: { borderRadius: radius.card, padding: 16 },
  tile: { borderRadius: radius.list, padding: 14 },
  section: { borderRadius: radius.listLarge, padding: 16 },
});
