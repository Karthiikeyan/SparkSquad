import { router, Tabs, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, useToast, type TabName } from '../../src/components/ui';
import { useQuickCheckin } from '../../src/features/checkin/quick';

const TAB_NAMES: readonly TabName[] = ['today', 'squads', 'discover', 'you'];

function isTab(name: string | undefined): name is TabName {
  return !!name && (TAB_NAMES as readonly string[]).includes(name);
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { setAboveTabBar } = useToast();
  const quickCheckin = useQuickCheckin();
  useFocusEffect(
    useCallback(() => {
      setAboveTabBar(true);
      return () => setAboveTabBar(false);
    }, [setAboveTabBar]),
  );
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, emitter, navigateToTab }) => {
        const current = state.routes[state.index]?.name;
        return (
          <TabBar
            active={isTab(current) ? current : 'today'}
            bottomInset={insets.bottom}
            onNavigate={(tab) => {
              const index = state.routes.findIndex((r) => r.name === tab);
              const route = state.routes[index];
              if (!route) return;
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (index !== state.index && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onCheckIn={() => router.push('/checkin/next')}
            onCheckInLong={quickCheckin}
          />
        );
      }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="squads" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
