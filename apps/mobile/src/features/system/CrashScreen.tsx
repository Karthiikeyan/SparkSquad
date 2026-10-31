import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState } from '../../components/ui';
import { t } from '../../i18n';
import { captureError } from '../../lib/analytics';
import { colors } from '../../theme/tokens';

/** G3: a render crash anywhere shows a calm full screen with retry instead of a red box. */
export function CrashScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    captureError(error);
  }, [error]);
  // No providers can be assumed here (the crash may be in them), so no safe-area hooks.
  return (
    <View style={styles.root}>
      <ErrorState title={t('crash.title')} message={t('crash.body')} onRetry={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    paddingVertical: 80,
    justifyContent: 'center',
  },
});
