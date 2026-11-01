import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ErrorState, LoadingScreen } from '../src/components/ui';
import { resolveRoute } from '../src/features/auth/routing';
import { useSession } from '../src/features/auth/SessionProvider';
import { t } from '../src/i18n';
import { colors } from '../src/theme/tokens';

/** Decides where the user belongs (A1): welcome, an onboarding step, an invite, or Today. */
export default function Index() {
  const session = useSession();
  const decision = resolveRoute(session);
  const { pendingRoute, pendingInvite, onboarded, clearPendingRoute, setPendingInvite } = session;

  // One-shot destinations are consumed once we've redirected to them.
  useEffect(() => {
    if (!onboarded || decision.kind !== 'redirect') return;
    if (pendingRoute && decision.href === pendingRoute) clearPendingRoute();
    else if (pendingInvite && decision.href === `/invite/${pendingInvite}`) setPendingInvite(null);
  }, [decision, onboarded, pendingRoute, pendingInvite, clearPendingRoute, setPendingInvite]);

  if (decision.kind === 'redirect') {
    // Typed routes can't know runtime strings; every href comes from resolveRoute.
    return <Redirect href={decision.href as never} />;
  }
  if (decision.kind === 'error') {
    return (
      <View style={styles.center}>
        <ErrorState message={t('session.loadFailed')} onRetry={session.retryMe} />
        <Button
          label={t('session.signOut')}
          variant="ghost"
          size="md"
          onPress={() => void session.signOut()}
        />
      </View>
    );
  }
  return <LoadingScreen />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 16 },
});
