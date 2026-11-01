import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/ui';
import { t } from '../../i18n';

/** Apple requires working Terms and Privacy links on every subscription purchase screen. */
export function PaywallLegal() {
  const open = (doc: 'terms' | 'privacy') =>
    router.push({ pathname: '/settings/legal/[doc]', params: { doc } });
  return (
    <View style={styles.row}>
      <Button
        label={t('settingsMain.terms')}
        variant="ghost"
        size="sm"
        onPress={() => open('terms')}
      />
      <Button
        label={t('settingsMain.privacy')}
        variant="ghost"
        size="sm"
        onPress={() => open('privacy')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
});
