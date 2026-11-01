import * as Haptics from 'expo-haptics';
import { CalendarDays, Check, Compass, User, Users, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { colors, iconStroke, tabBarHeight } from '../../theme/tokens';
import { Text } from './Text';

export type TabName = 'today' | 'squads' | 'discover' | 'you';

const TABS: { name: TabName; icon: LucideIcon; label: () => string }[] = [
  { name: 'today', icon: CalendarDays, label: () => t('tabs.today') },
  { name: 'squads', icon: Users, label: () => t('tabs.squads') },
  { name: 'discover', icon: Compass, label: () => t('tabs.discover') },
  { name: 'you', icon: User, label: () => t('tabs.you') },
];

/** Slot of each tab in the five-slot row (the middle one is the check-in button). */
const SLOT: Record<TabName, number> = { today: 0, squads: 1, discover: 3, you: 4 };
const SLOTS = 5;
const PILL_WIDTH = 52;

export interface TabBarProps {
  active: TabName;
  onNavigate: (tab: TabName) => void;
  onCheckIn: () => void;
  /** Long-press: mark everything waiting today as done (after a confirm). */
  onCheckInLong?: () => void;
  bottomInset: number;
}

function TabItem({
  tab,
  selected,
  onPress,
}: {
  tab: (typeof TABS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      lift.setValue(selected ? 1 : 0);
      return;
    }
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      speed: 22,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [selected, lift, reduced]);
  const color = selected ? colors.accent : colors.tabInactive;
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const Icon = tab.icon;
  return (
    <Pressable
      testID={`tab-${tab.name}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={tab.label()}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        <Icon size={23} color={color} strokeWidth={iconStroke} />
      </Animated.View>
      <Text variant="tab" style={{ color }} maxFontSizeMultiplier={1.1}>
        {tab.label()}
      </Text>
    </Pressable>
  );
}

/**
 * 5 slots: Today, Squads, centre Check-in button (raised, accent), Discover, You. An amber pill
 * glides to the active tab. The height follows the phone's own bottom inset, so the bar sits right
 * on gesture, three-button and home-indicator phones alike.
 */
export function TabBar({ active, onNavigate, onCheckIn, onCheckInLong, bottomInset }: TabBarProps) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(SLOT[active])).current;

  useEffect(() => {
    if (reduced) {
      x.setValue(SLOT[active]);
      return;
    }
    Animated.spring(x, {
      toValue: SLOT[active],
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [active, x, reduced]);

  const slot = width / SLOTS;
  const inset = (slot - PILL_WIDTH) / 2;
  const pillX = x.interpolate({
    inputRange: [0, SLOTS - 1],
    outputRange: [inset, slot * (SLOTS - 1) + inset],
  });
  const press = (tab: TabName) => {
    if (tab !== active) Haptics.selectionAsync().catch(() => undefined);
    onNavigate(tab);
  };
  const renderTab = (tab: (typeof TABS)[number]) => (
    <TabItem
      key={tab.name}
      tab={tab}
      selected={tab.name === active}
      onPress={() => press(tab.name)}
    />
  );
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.bar, { height: tabBarHeight(bottomInset), paddingBottom: bottomInset }]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { transform: [{ translateX: pillX }] }]}
        />
      ) : null}
      {TABS.slice(0, 2).map(renderTab)}
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
            {
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Check size={26} color={colors.onAccent} strokeWidth={2.4} />
        </Pressable>
      </View>
      {TABS.slice(2).map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 6,
    backgroundColor: colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  pill: {
    position: 'absolute',
    top: 6,
    left: 0,
    width: PILL_WIDTH,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 44 },
  iconWrap: { height: 28, alignItems: 'center', justifyContent: 'center' },
  centerSlot: { flex: 1, alignItems: 'center' },
  center: {
    width: 56,
    height: 56,
    marginTop: -20,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bgElevated,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
