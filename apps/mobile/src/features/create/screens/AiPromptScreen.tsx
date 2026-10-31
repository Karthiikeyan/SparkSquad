import { buildPrompt } from '@sparksquad/shared';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ClipboardPaste, Copy } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, NavHeader, Screen, Text, TextField, useToast } from '../../../components/ui';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { colors, fonts, radius } from '../../../theme/tokens';
import { useCreateFlow } from '../flow';

/** Web entry points for each assistant (the native app opens if installed). */
export const AI_APPS = [
  { key: 'chatgpt', label: 'aiPrompt.chatgpt', url: 'https://chatgpt.com/' },
  { key: 'gemini', label: 'aiPrompt.gemini', url: 'https://gemini.google.com/app' },
  { key: 'claude', label: 'aiPrompt.claude', url: 'https://claude.ai/new' },
] as const;

/** D7: goal → copy prompt → open an assistant → paste the reply into Import (D5). */
export function AiPromptScreen() {
  const toast = useToast();
  const { flow, update } = useCreateFlow();
  const prompt = buildPrompt(flow.goal);

  const copy = async () => {
    await Clipboard.setStringAsync(prompt);
    track('ai_prompt_copy');
    toast.show({ message: t('aiPrompt.copied'), kind: 'success' });
  };
  const pasteReply = async () => {
    const value = await Clipboard.getStringAsync();
    if (!value.trim()) {
      toast.show({ message: t('importPlan.clipboardEmpty'), kind: 'info' });
      return;
    }
    update({ pasted: value });
    router.push('/create/import');
  };

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header">
        {t('aiPrompt.title')}
      </Text>
      <Text variant="body" color="label2" style={styles.body}>
        {t('aiPrompt.body')}
      </Text>

      <TextField
        label={t('aiPrompt.goalLabel')}
        placeholder={t('aiPrompt.goalPlaceholder')}
        value={flow.goal}
        onChangeText={(goal) => update({ goal })}
        maxLength={160}
        testID="ai-goal"
      />

      <Text style={styles.step}>{t('aiPrompt.copyLabel')}</Text>
      <View style={styles.card}>
        <View style={styles.promptBox}>
          <Text variant="footnote" style={styles.prompt} numberOfLines={7}>
            {prompt}
          </Text>
        </View>
        <Button
          label={t('aiPrompt.copy')}
          size="md"
          icon={<Copy size={18} color={colors.onAccent} />}
          onPress={() => void copy()}
          testID="copy-prompt"
        />
      </View>

      <Text style={styles.step}>{t('aiPrompt.openLabel')}</Text>
      <View style={styles.apps}>
        {AI_APPS.map((a) => (
          <Button
            key={a.key}
            label={t(a.label)}
            variant="secondary"
            size="md"
            accessibilityLabel={t('aiPrompt.openApp', { app: t(a.label) })}
            style={styles.flex}
            onPress={() => void Linking.openURL(a.url)}
          />
        ))}
      </View>

      <Text style={styles.step}>{t('aiPrompt.replyLabel')}</Text>
      <Button
        label={t('aiPrompt.pasteReply')}
        variant="soft"
        icon={<ClipboardPaste size={18} color={colors.accent} />}
        onPress={() => void pasteReply()}
        testID="paste-reply"
      />
      <Text variant="footnote" color="label3" align="center" style={styles.note}>
        {t('aiPrompt.note')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 6, marginBottom: 18 },
  step: {
    fontFamily: fonts.sansSemibold,
    fontSize: 13,
    color: colors.label,
    marginTop: 18,
    marginBottom: 6,
    marginHorizontal: 2,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.list, padding: 14, gap: 12 },
  promptBox: { maxHeight: 132, overflow: 'hidden' },
  prompt: { color: colors.chipLabel, lineHeight: 19 },
  apps: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  note: { marginTop: 20 },
});
