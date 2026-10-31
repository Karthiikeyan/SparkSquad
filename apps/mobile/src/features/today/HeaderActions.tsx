import { router } from 'expo-router';
import { Bell, Flame } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../components/ui';
import { t } from '../../i18n';
import { colors, fonts, iconStroke } from '../../theme/tokens';

/** Amber streak pill → You tab (design Main header). */
export function StreakPill({ streak }: { streak: number }) {
  return (
    <Pressable
      onPress={() => router.navigate('/you')}
      accessibilityRole="button"
      accessibilityLabel={t('today.streak', { n: streak })}
      hitSlop={{ top: 4, bottom: 4 }}
      style={styles.pill}
      testID="streak-pill"
    >
      <Flame size={18} color={colors.accent} strokeWidth={iconStroke} />
      <Text style={styles.pillText} tabular>
        {String(streak)}
      </Text>
    </Pressable>
  );
}

/** Bell with an unread dot (colour plus count in the label, never colour alone). */
export function BellButton({ unread }: { unread: number }) {
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? t('today.bellUnread', { n: unread }) : t('today.bell')}
      style={styles.bell}
      testID="bell"
    >
      <Bell size={20} color={colors.label} strokeWidth={iconStroke} />
      {unread > 0 ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
  },
  pillText: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 20, color: colors.accent },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
