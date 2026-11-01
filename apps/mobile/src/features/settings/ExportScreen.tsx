import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Download, Upload, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../components/ui/Dialog';
import { Button, NavHeader, Screen, Text, useToast } from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage, isNetworkError } from '../../lib/api/errors';
import { useOnline } from '../../lib/hooks/useOnline';
import { getPref, setPref } from '../../lib/prefs';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { clearVerifyCache } from '../verify/prefill';
import {
  diffImport,
  IMPORT_MAX_BYTES,
  isEmptyImport,
  parseExportFile,
  type ImportPlan,
} from './importData';
import { useMePatch } from './useMePatch';

/** Downloads the signed export into the cache and opens the share sheet to save it. */
export async function downloadExport(url: string, now = new Date()): Promise<string> {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `sparksquad-export-${now.toISOString().slice(0, 10)}.json`);
  const file = await File.downloadFileAsync(url, target, { idempotent: true });
  return file.uri;
}

function Section({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon size={20} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        <Text variant="headline" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
      </View>
      <Text variant="body" color="label2" style={styles.body}>
        {body}
      </Text>
      {children}
    </View>
  );
}

/** F13: server builds a JSON export; the phone saves it, and can restore settings from it. */
export function ExportScreen() {
  const me = useMe();
  const patch = useMePatch();
  const online = useOnline();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
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

  const apply = async (plan: ImportPlan) => {
    setImporting(true);
    try {
      if (Object.keys(plan.profile).length > 0 && !(await patch(plan.profile))) return;
      const saved = { ...(getPref('integrations') ?? {}) };
      for (const { provider, handle } of plan.integrations) {
        await endpoints.setIntegration(provider, handle);
        saved[provider] = handle;
      }
      setPref('integrations', saved);
      clearVerifyCache();
      toast.show({ message: t('exportData.importDone'), kind: 'success' });
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      const asset = res.canceled ? null : res.assets[0];
      if (!asset) return;
      const file = new File(asset.uri);
      const parsed = file.size <= IMPORT_MAX_BYTES ? parseExportFile(await file.text()) : null;
      if (!parsed) {
        toast.show({ message: t('exportData.importInvalid'), kind: 'error' });
        return;
      }
      const plan = diffImport(parsed, me, getPref('integrations') ?? {});
      if (isEmptyImport(plan)) {
        toast.show({ message: t('exportData.importNothing'), kind: 'success' });
        return;
      }
      const lines = [
        Object.keys(plan.profile).length > 0
          ? t('exportData.importSettings', { n: Object.keys(plan.profile).length })
          : null,
        plan.integrations.length > 0
          ? t('exportData.importAccounts', {
              names: plan.integrations.map((i) => t(`integrations.name_${i.provider}`)).join(', '),
            })
          : null,
        t('exportData.importKept'),
      ].filter((x): x is string => !!x);
      Alert.alert(t('exportData.importConfirm'), lines.join('\n\n'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('exportData.importApply'), onPress: () => void apply(plan) },
      ]);
    } catch {
      toast.show({ message: t('exportData.importInvalid'), kind: 'error' });
    }
  };

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('exportData.title')}
      </Text>
      {!online ? (
        <Text variant="footnote" color="label2" style={styles.offline}>
          {t('errors.NETWORK')}
        </Text>
      ) : null}
      <Section icon={Download} title={t('exportData.exportTitle')} body={t('exportData.body')}>
        <Button
          label={t('exportData.button')}
          size="md"
          onPress={() => void make()}
          loading={busy}
          disabled={!online}
          testID="export-make"
        />
        {uri ? (
          <Button
            label={t('exportData.share')}
            variant="secondary"
            size="md"
            onPress={() => void share(uri)}
            style={styles.again}
          />
        ) : null}
      </Section>
      <Section icon={Upload} title={t('exportData.importTitle')} body={t('exportData.importBody')}>
        <Button
          label={t('exportData.importButton')}
          variant="secondary"
          size="md"
          onPress={() => void pick()}
          loading={importing}
          disabled={!online}
          testID="import-pick"
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  flex: { flex: 1 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { lineHeight: 22, marginBottom: 14 },
  offline: { marginBottom: 12 },
  again: { marginTop: 10 },
});
