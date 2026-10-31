import { Directory, File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, NavHeader, Screen, Text, useToast } from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage, isNetworkError } from '../../lib/api/errors';
import { useOnline } from '../../lib/hooks/useOnline';

/** Downloads the signed export into the cache and opens the share sheet to save it. */
export async function downloadExport(url: string, now = new Date()): Promise<string> {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `sparksquad-export-${now.toISOString().slice(0, 10)}.json`);
  const file = await File.downloadFileAsync(url, target, { idempotent: true });
  return file.uri;
}

/** F13: server builds a JSON export; the phone downloads it and offers the share sheet. */
export function ExportScreen() {
  const online = useOnline();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [uri, setUri] = useState<string | null>(null);

  const share = async (fileUri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: t('exportData.share'),
        UTI: 'public.json',
      });
    }
  };

  const make = async () => {
    setBusy(true);
    try {
      const { url } = await endpoints.exportData();
      const fileUri = await downloadExport(url);
      setUri(fileUri);
      toast.show({ message: t('exportData.ready'), kind: 'success' });
      await share(fileUri);
    } catch (e) {
      toast.show({
        message: isNetworkError(e) ? errorMessage(e) : t('exportData.failed'),
        kind: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('exportData.title')}
      </Text>
      <Card variant="section" style={styles.card}>
        <Text variant="body" color="label2" style={styles.body}>
          {t('exportData.body')}
        </Text>
      </Card>
      {!online ? (
        <Text variant="footnote" color="label2" style={styles.offline}>
          {t('errors.NETWORK')}
        </Text>
      ) : null}
      <Button
        label={t('exportData.button')}
        onPress={() => void make()}
        loading={busy}
        disabled={!online}
        testID="export-make"
      />
      {uri ? (
        <Button
          label={t('exportData.share')}
          variant="secondary"
          onPress={() => void share(uri)}
          style={styles.again}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  card: { marginBottom: 20 },
  body: { lineHeight: 22 },
  offline: { marginBottom: 12 },
  again: { marginTop: 10 },
});
