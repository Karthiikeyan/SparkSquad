import { Stack } from 'expo-router';
import { hasRequiredProfile } from '../features/auth/routing';
import { useSession } from '../features/auth/SessionProvider';
import { AppBackground } from '../features/push/AppBackground';
import { colors } from '../theme/tokens';

/**
 * Route groups guarded by session state. When a guard flips (sign-in, onboarding done,
 * sign-out) Expo Router sends the user back to `index`, which decides where to go next.
 */
export function RootNavigator() {
  const { status, me, onboarded } = useSession();
  const signedIn = status === 'signedIn' && !!me;
  const ready = signedIn && onboarded && hasRequiredProfile(me);
  return (
    <>
      {ready ? <AppBackground /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="settings/legal/[doc]" />

        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !ready}>
          <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
        </Stack.Protected>

        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="checkin/[challengeId]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
          <Stack.Screen
            name="checkin/success"
            options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="squad/[id]/index" />
          <Stack.Screen name="squad/[id]/leaderboard" />
          <Stack.Screen name="squad/[id]/plan/index" />
          <Stack.Screen name="squad/[id]/plan/day/[n]" />
          <Stack.Screen name="squad/[id]/members" />
          <Stack.Screen name="squad/[id]/requests" />
          <Stack.Screen name="squad/[id]/invite" />
          <Stack.Screen name="squad/[id]/settings" />
          <Stack.Screen
            name="squad/[id]/share"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="squad/[id]/history/[challengeId]" />
          <Stack.Screen name="checkins/[id]" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="join/index" />
          <Stack.Screen name="invite/[code]" />
          <Stack.Screen name="squad/[id]/preview" />
          <Stack.Screen name="create" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="discover/search" options={{ animation: 'fade' }} />
          <Stack.Screen name="settings/ai" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/integrations" />
          <Stack.Screen name="settings/billing" />
          <Stack.Screen name="settings/blocked" />
          <Stack.Screen name="settings/export" />
          <Stack.Screen name="settings/delete" />
          <Stack.Screen name="settings/help" />
          <Stack.Screen name="you/edit" />
          <Stack.Screen name="you/badges" />
          <Stack.Screen name="you/history" />
          <Stack.Screen name="paywall/plus" options={{ presentation: 'modal' }} />
          <Stack.Screen name="paywall/squad-pro" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
