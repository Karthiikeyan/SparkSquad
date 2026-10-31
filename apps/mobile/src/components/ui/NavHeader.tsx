import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, fonts, iconStroke } from '../../theme/tokens';
import { Text } from './Text';

export interface NavHeaderProps {
  /** Label next to the back chevron (the previous screen's name). */
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
}

/** 44 px bar: accent back chevron + label on the left, optional action on the right. */
export function NavHeader({ backLabel, onBack, right }: NavHeaderProps) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel ?? t('common.back')}
          hitSlop={{ top: 6, bottom: 6, right: 8 }}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={26} color={colors.accent} strokeWidth={iconStroke} />
          {backLabel ? <Text style={styles.backLabel}>{backLabel}</Text> : null}
        </Pressable>
      ) : (
        <View />
      )}
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, minHeight: 44 },
  backLabel: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 22, color: colors.accent },
});
