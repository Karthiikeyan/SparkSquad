import { buildPrompt, parsePlan, type ParsePlanResult } from '@sparksquad/shared';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, NavHeader, Screen, Text, useToast } from '../../../components/ui';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { colors, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { todayFor } from '../../today/model';
import { PlanPreviewCard, StartDateRow } from '../components';
import { afterPlanRoute, defaultStartDate, useCreateFlow } from '../flow';

/** First lines of what was pasted, for the "Pasted text" box. */
export function pastedPreview(text: string, maxLines = 4): string {
  return text.split('\n').slice(0, maxLines).join('\n').slice(0, 300);
}

/** D5/D6: paste or pick a file, parse with the shared parser, preview or explain the error. */
export function ImportScreen() {
  const me = useMe();
  const toast = useToast();
  const { flow, update } = useCreateFlow();
  const today = todayFor(me, new Date());
  const [text, setText] = useState(flow.pasted);
  const [start, setStart] = useState(flow.startDate ?? defaultStartDate(today));
  const result: ParsePlanResult | null = useMemo(
    () => (text.trim() ? parsePlan(text) : null),
    [text],
  );

  const paste = async () => {
    const value = await Clipboard.getStringAsync();
    if (!value.trim()) {
      toast.show({ message: t('importPlan.clipboardEmpty'), kind: 'info' });
      return;
    }
    setText(value);
    update({ pasted: value });
  };
  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const value = await new File(res.assets[0].uri).text();
      setText(value);
      update({ pasted: value });
    } catch {
      toast.show({ message: t('importPlan.fileFailed'), kind: 'error' });
    }
  };
  const copyPrompt = async () => {
    await Clipboard.setStringAsync(buildPrompt(flow.goal));
    toast.show({ message: t('importPlan.copied'), kind: 'success' });
  };
  const importPlan = () => {
    if (!result?.ok) return;
    track('plan_import', { days: result.stats.days, fixes: result.fixes.length });
    update({
      plan: { plan: result.plan, fixes: result.fixes, stats: result.stats },
      startDate: start,
    });
    router.push(afterPlanRoute(flow));
  };

  return (
    <Screen
      header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}
      footer={
        result?.ok ? (
          <Button label={t('importPlan.import')} onPress={importPlan} testID="import-plan" />
        ) : undefined
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('importPlan.title')}
      </Text>
      <View style={styles.pasteBox}>
        <Text style={styles.mono} accessibilityLabel={t('importPlan.pasted')} numberOfLines={4}>
          {text ? pastedPreview(text) : t('importPlan.empty')}
        </Text>
        <View style={styles.row}>
          <Button
            label={text ? t('importPlan.pasteAgain') : t('importPlan.paste')}
            variant="secondary"
            size="sm"
            onPress={() => void paste()}
            testID="paste"
          />
          <Button
            label={t('importPlan.chooseFile')}
            variant="secondary"
            size="sm"
            onPress={() => void pickFile()}
          />
        </View>
      </View>

      {result?.ok ? (
        <>
          <View style={styles.gap}>
            <PlanPreviewCard plan={result.plan} stats={result.stats} fixes={result.fixes} />
          </View>
          <View style={styles.gap}>
            <StartDateRow value={start} today={today} onChange={setStart} />
          </View>
        </>
      ) : result ? (
        <View style={[styles.error, styles.gap]} accessibilityLiveRegion="polite">
          <View style={styles.errorHead}>
            <AlertCircle size={20} color={colors.accent} strokeWidth={iconStroke} />
            <Text variant="bodySemibold" style={styles.flex}>
              {t('importPlan.errorTitle')}
            </Text>
          </View>
          {result.errors.slice(0, 8).map((e, i) => (
            <Text key={i} variant="footnote" style={styles.errorLine}>
              {`• ${e}`}
            </Text>
          ))}
          <View style={styles.row}>
            <Button
              label={t('importPlan.copyPrompt')}
              variant="secondary"
              size="sm"
              onPress={() => void copyPrompt()}
            />
            <Button
              label={t('importPlan.pasteAgain')}
              variant="secondary"
              size="sm"
              onPress={() => void paste()}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 12 },
  flex: { flex: 1 },
  pasteBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  mono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17, color: colors.label2 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  gap: { marginTop: 12 },
  error: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 8 },
  errorHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorLine: { color: colors.onControl },
});
