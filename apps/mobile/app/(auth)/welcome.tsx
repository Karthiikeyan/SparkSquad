import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Button, OfflineBanner, Text, useToast, WAVES } from '../../src/components/ui';
import { AppleLogo, GoogleLogo } from '../../src/features/auth/BrandLogos';
import { useSession } from '../../src/features/auth/SessionProvider';
import {
  appleAvailable,
  googleConfigured,
  signInWithApple,
  signInWithGoogle,
  type SignInOutcome,
} from '../../src/features/auth/signIn';
import { useConfig } from '../../src/features/system/useConfig';
import { t } from '../../src/i18n';
import { track } from '../../src/lib/analytics';
import { useOnline } from '../../src/lib/hooks/useOnline';
import { colors, fonts } from '../../src/theme/tokens';

type Provider = 'google' | 'apple';

/** A2: logo on the brand waves, pitch, Google / Apple / email, 18+ and terms line. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const online = useOnline();
  const { pendingInvite } = useSession();
  const config = useConfig();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);

  useEffect(() => {
    let alive = true;
    appleAvailable()
      .then((ok) => {
        if (alive) setApple(ok);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const features = config.data?.features;
  const showApple = !!features?.apple && apple;
  // App Store 4.8: on iPhone, Google may only appear next to Sign in with Apple.
  const showGoogle =
    !!features?.google && googleConfigured() && (Platform.OS !== 'ios' || showApple);

  const run = async (provider: Provider, fn: () => Promise<SignInOutcome>) => {
    setBusy(provider);
    try {
      const outcome = await fn();
      if (outcome === 'ok') track('sign_in', { method: provider });
      // On success the session guard moves us on; nothing else to do here.
    } catch {
      toast.show({ message: t('welcome.signInFailed'), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <Image source={WAVES} style={StyleSheet.absoluteFill} contentFit="cover" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {!online ? <OfflineBanner /> : null}
        <View style={styles.brand}>
          <BrandMark width={168} accessibilityLabel={t('brand.logo')} />
          <Text style={styles.name}>{t('brand.name')}</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('welcome.title')}
        </Text>
        <Text variant="callout" color="label2" style={styles.body}>
          {t('welcome.body')}
        </Text>
        {pendingInvite ? (
          <Text variant="footnote" color="accent" style={styles.invite}>
            {t('welcome.inviteWaiting')}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {showGoogle ? (
          <Button
            label={t('welcome.google')}
            icon={<GoogleLogo />}
            loading={busy === 'google'}
            disabled={busy !== null && busy !== 'google'}
            onPress={() => void run('google', signInWithGoogle)}
            style={styles.google}
            labelColor="#000000"
            testID="sign-in-google"
          />
        ) : null}
        {showApple ? (
          <Button
            label={t('welcome.apple')}
            icon={<AppleLogo color={colors.label} />}
            variant="secondary"
            loading={busy === 'apple'}
            disabled={busy !== null && busy !== 'apple'}
            onPress={() => void run('apple', signInWithApple)}
            testID="sign-in-apple"
          />
        ) : null}
        <Button
          label={t('welcome.email')}
          variant="ghost"
          size="md"
          disabled={busy !== null}
          onPress={() => router.push('/email')}
          testID="sign-in-email"
        />
      </View>
      <Text variant="caption" color="label3" align="center" style={styles.legal}>
        {t('welcome.legalPrefix')}
        <Text
          variant="caption"
          color="accent"
          accessibilityRole="link"
          onPress={() => router.push('/settings/legal/terms')}
        >
          {t('welcome.terms')}
        </Text>
        {t('welcome.legalJoin')}
        <Text
          variant="caption"
          color="accent"
          accessibilityRole="link"
          onPress={() => router.push('/settings/legal/privacy')}
        >
          {t('welcome.privacy')}
        </Text>
        {t('welcome.legalSuffix')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 14 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.label },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colors.label,
    marginTop: 40,
    marginBottom: 10,
  },
  body: { lineHeight: 23 },
  invite: { marginTop: 12 },
  actions: { gap: 10, paddingTop: 12 },
  google: { backgroundColor: colors.label },
  legal: { marginTop: 8, lineHeight: 17 },
});
