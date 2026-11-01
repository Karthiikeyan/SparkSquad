import { CalendarDays, Check, Compass, User, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, iconStroke, space } from '../../theme/tokens';
import { Text } from './Text';

export type TabName = 'today' | 'squads' | 'discover' | 'you';

const TABS: { name: TabName; icon: LucideIcon; label: () => string }[] = [
  { name: 'today', icon: CalendarDays, label: () => t('tabs.today') },
  { name: 'squads', icon: Users, label: () => t('tabs.squads') },
  { name: 'discover', icon: Compass, label: () => t('tabs.discover') },
  { name: 'you', icon: User, label: () => t('tabs.you') },
];

export interface TabBarProps {
  active: TabName;
  onNavigate: (tab: TabName) => void;
  onCheckIn: () => void;
  /** Long-press: mark everything waiting today as done (after a confirm). */
  onCheckInLong?: () => void;
  bottomInset: number;
}

/** 5 slots: Today, Squads, centre Check-in button (raised, accent), Discover, You. */
export function TabBar({ active, onNavigate, onCheckIn, onCheckInLong, bottomInset }: TabBarProps) {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const renderTab = (tab: (typeof TABS)[number]) => {
    const selected = tab.name === active;
    const color = selected ? colors.accent : colors.tabInactive;
    const Icon = tab.icon;
    return (
      <Pressable
        key={tab.name}
        testID={`tab-${tab.name}`}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={tab.label()}
        onPress={() => onNavigate(tab.name)}
        style={styles.tab}
      >
        <Icon size={24} color={color} strokeWidth={iconStroke} />
        <Text variant="tab" style={{ color }} maxFontSizeMultiplier={1.1}>
          {tab.label()}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { height: Math.max(space.tabBar, 50 + bottomInset), paddingBottom: bottomInset },
      ]}
    >
      {left.map(renderTab)}
      <View style={styles.centerSlot}>
        <Pressable
          testID="tab-checkin"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.checkIn')}
          accessibilityHint={onCheckInLong ? t('tabs.checkInHint') : undefined}
          accessibilityActions={onCheckInLong ? [{ name: 'longpress' }] : undefined}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'longpress') onCheckInLong?.();
          }}
          onPress={onCheckIn}
          onLongPress={onCheckInLong}
          delayLongPress={450}
          style={({ pressed }) => [
            styles.center,
            { backgroundColor: pressed ? colors.accentPressed : colors.accent },
          ]}
        >
          <Check size={26} color={colors.onAccent} strokeWidth={2.4} />
        </Pressable>
      </View>
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 6,
    backgroundColor: 'rgba(14,14,16,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 4, minHeight: 44 },
  centerSlot: { flex: 1, alignItems: 'center' },
  center: {
    width: 56,
    height: 56,
    marginTop: -14,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
