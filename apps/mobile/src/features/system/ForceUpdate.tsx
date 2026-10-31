import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react-native';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { compareVersions, env } from '../../lib/env';
import { qk } from '../../lib/query/keys';
import { colors, iconStroke } from '../../theme/tokens';

const ANDROID_STORE = 'market://details?id=com.sparktribe.sparksquad';
const ANDROID_WEB = 'https://play.google.com/store/apps/details?id=com.sparktribe.sparksquad';

function storeUrl(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_IOS_STORE_URL || 'https://apps.apple.com/search?term=SparkSquad';
  }
  return ANDROID_STORE;
}

/** True when the server's minimum version is newer than this build (G2). */
export function useMinVersionCheck(): boolean {
  const { data } = useQuery({
    queryKey: qk.config,
    queryFn: endpoints.config,
    staleTime: 60 * 60_000,
    retry: false,
  });
  return !!data && compareVersions(env.appVersion, data.minAppVersion) < 0;
}

/** Blocking screen shown when this app version can no longer sync (G2). */
export function ForceUpdateScreen() {
  const insets = useSafeAreaInsets();
  const open = () => {
    Linking.openURL(storeUrl()).catch(() => {
      if (Platform.OS === 'android') Linking.openURL(ANDROID_WEB).catch(() => undefined);
    });
  };
  return (
    <View style={[styles.root, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.body}>
        <View style={styles.tile}>
          <RefreshCw size={28} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        <Text variant="title1" align="center" accessibilityRole="header">
          {t('forceUpdate.title')}
        </Text>
        <Text variant="callout" color="label2" align="center">
          {t('forceUpdate.body')}
        </Text>
      </View>
      <Button label={t('forceUpdate.button')} onPress={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  body: { flex: 1, alignItems: 'center', gap: 14 },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
