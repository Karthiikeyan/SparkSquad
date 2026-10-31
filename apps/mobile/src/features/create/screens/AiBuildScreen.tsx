import { buildPrompt, limitsFor } from '@sparksquad/shared';
import { router, useFocusEffect } from 'expo-router';
import { KeyRound, Send } from 'lucide-react-native';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  EmptyState,
  IconButton,
  NavHeader,
  OfflineBanner,
  Pressable,
  ProgressBar,
  Text,
  TextField,
} from '../../../components/ui';
import { openPlusPaywall } from '../../billing/paywallRoute';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { getAiKey, type AiProvider } from '../../../lib/aiKeys';
import { useOnline } from '../../../lib/hooks/useOnline';
import { getPref } from '../../../lib/prefs';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { AI_COMPANY, AiError, sendChat, type ChatMessage } from '../../ai/providers';
import {
  buildRepairMessage,
  dailyLimit,
  questionNumber,
  readReply,
  takeRequest,
} from '../../ai/session';
import { todayFor } from '../../today/model';
import { useCreateFlow } from '../flow';

type Phase = 'goal' | 'chat' | 'busy' | 'repairing' | 'failed';

const PROVIDER_LABEL: Record<
  AiProvider,
  'aiSettings.gemini' | 'aiSettings.openai' | 'aiSettings.anthropic'
> = {
  gemini: 'aiSettings.gemini',
  openai: 'aiSettings.openai',
  anthropic: 'aiSettings.anthropic',
};

/** D8: BYOK interview → JSON plan → shared parser → one repair round → Import preview (D5). */
export function AiBuildScreen() {
  const me = useMe();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { flow, update } = useCreateFlow();
  const provider: AiProvider = getPref('aiProvider') ?? 'gemini';
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('goal');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const today = todayFor(me, new Date());
  const allowed = limitsFor(me.plan).aiBuilder;

  // Re-read the key when returning from Settings › AI.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getAiKey(provider).then((k) => {
        if (alive) setKey(k);
      });
      return () => {
        alive = false;
      };
    }, [provider]),
  );

  const back = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;
  const shell = (children: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.pad}>{back}</View>
      {children}
    </View>
  );

  if (!allowed) {
    return shell(
      <EmptyState
        icon={KeyRound}
        message={`${t('aiBuild.plusTitle')}. ${t('aiBuild.plusBody')}`}
        actionLabel={t('aiBuild.usePrompt')}
        onAction={() => router.replace('/create/ai-prompt')}
        secondaryLabel={t('you.seePlus')}
        onSecondary={openPlusPaywall}
      />,
    );
  }
  if (key === undefined) return shell(null);
  if (!key) {
    return shell(
      <EmptyState
        icon={KeyRound}
        message={`${t('aiBuild.noKeyTitle')}. ${t('aiBuild.noKeyBody')}`}
        actionLabel={t('aiBuild.addKey')}
        onAction={() => router.push('/settings/ai')}
        secondaryLabel={t('aiBuild.usePrompt')}
        onSecondary={() => router.replace('/create/ai-prompt')}
      />,
    );
  }

  const call = async (history: ChatMessage[]): Promise<string | null> => {
    if (!takeRequest(today)) {
      setNotice(t('aiBuild.limit', { n: dailyLimit() }));
      setPhase('failed');
      return null;
    }
    try {
      return await sendChat(provider, key, history);
    } catch (e) {
      const reason = e instanceof AiError ? e.reason : 'server';
      setNotice(
        t('aiBuild.failed', {
          reason: t(
            reason === 'network'
              ? 'errors.NETWORK'
              : reason === 'rate'
                ? 'errors.RATE_LIMITED'
                : 'errors.UNKNOWN',
          ),
        }),
      );
      setPhase('failed');
      return null;
    }
  };

  const handle = async (history: ChatMessage[], repaired: boolean): Promise<void> => {
    const reply = await call(history);
    if (reply === null) return;
    const next = [...history, { role: 'assistant' as const, text: reply }];
    const outcome = readReply(reply);
    if (outcome.kind === 'message') {
      setMessages(next);
      setPhase('chat');
      return;
    }
    if (outcome.kind === 'plan') {
      track('ai_build_plan', { provider, repaired });
      update({ pasted: reply });
      setMessages(next);
      setPhase('chat');
      router.push('/create/import');
      return;
    }
    if (repaired) {
      setMessages(next);
      setNotice(t('aiBuild.invalid'));
      setPhase('failed');
      return;
    }
    setPhase('repairing');
    await handle([...next, { role: 'user', text: buildRepairMessage(outcome.errors) }], true);
  };

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setDraft('');
    setNotice(null);
    const history = [...messages, { role: 'user' as const, text: value }];
    setMessages(history);
    setPhase('busy');
    void handle(history, false);
  };

  const start = () => {
    setNotice(null);
    const history: ChatMessage[] = [{ role: 'user', text: buildPrompt(flow.goal, { byok: true }) }];
    setMessages(history);
    setPhase('busy');
    void handle(history, false);
  };

  if (phase === 'goal') {
    return shell(
      <View style={[styles.pad, styles.goal]}>
        <Text variant="title1" accessibilityRole="header">
          {t('aiBuild.goalTitle')}
        </Text>
        <TextField
          placeholder={t('aiBuild.goalPlaceholder')}
          accessibilityLabel={t('aiBuild.goalTitle')}
          value={flow.goal}
          onChangeText={(goal) => update({ goal })}
          maxLength={160}
        />
        <Button
          label={t('aiBuild.start')}
          onPress={start}
          disabled={!flow.goal.trim()}
          testID="ai-start"
        />
        <Text variant="caption" color="label3" align="center">
          {t('aiBuild.privacy', { company: AI_COMPANY[provider] })}
        </Text>
      </View>,
    );
  }

  const visible = messages.slice(1).filter((m) => !m.text.startsWith('repair:'));
  const assistantTurns = visible.filter((m) => m.role === 'assistant').length;
  const last = visible.at(-1);
  const choices = phase === 'chat' && last?.role === 'assistant' ? readReplyChoices(last.text) : [];
  const status =
    phase === 'busy'
      ? t('aiBuild.thinking')
      : phase === 'repairing'
        ? t('aiBuild.repairing')
        : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.pad, styles.head]}>
          <NavHeader
            backLabel={t('common.back')}
            onBack={() => router.back()}
            right={
              <Pressable
                onPress={() => router.push('/settings/ai')}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                style={styles.keyChip}
              >
                <KeyRound size={12} color={colors.chipLabel} strokeWidth={iconStroke} />
                <Text variant="caption" style={styles.keyChipText}>
                  {t('aiBuild.keyChip', { provider: t(PROVIDER_LABEL[provider]) })}
                </Text>
              </Pressable>
            }
          />
          <View style={styles.progressRow}>
            <Text variant="caption" color="label2">
              {t('aiBuild.progress', { n: questionNumber(assistantTurns) })}
            </Text>
            <Text variant="caption" color="label2" numberOfLines={1} style={styles.goalLine}>
              {flow.goal}
            </Text>
          </View>
          <ProgressBar
            value={questionNumber(assistantTurns) / 6}
            accessibilityLabel={t('aiBuild.progressLabel')}
          />
          {!online ? <OfflineBanner /> : null}
        </View>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.log}
          accessibilityLabel={t('aiBuild.log')}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {visible.map((m, i) => (
            <Text
              key={i}
              variant="body"
              style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}
            >
              {m.text}
            </Text>
          ))}
          {choices.length ? (
            <View style={styles.choices}>
              {choices.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => send(c)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="button"
                  style={styles.choice}
                >
                  <Text variant="body">{c}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {status ? (
            <Text variant="footnote" color="label3" accessibilityLiveRegion="polite">
              {status}
            </Text>
          ) : null}
          {notice ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text variant="footnote">{notice}</Text>
              <View style={styles.noticeRow}>
                <Button
                  label={t('aiBuild.restart')}
                  variant="secondary"
                  size="sm"
                  onPress={() => setPhase('goal')}
                />
                <Button
                  label={t('aiBuild.usePrompt')}
                  variant="secondary"
                  size="sm"
                  onPress={() => router.replace('/create/ai-prompt')}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('aiBuild.answerPlaceholder')}
              placeholderTextColor={colors.label3}
              accessibilityLabel={t('aiBuild.answer')}
              editable={phase === 'chat'}
              onSubmitEditing={() => send(draft)}
              returnKeyType="send"
              style={styles.input}
              selectionColor={colors.accent}
            />
            <IconButton
              icon={Send}
              background="accent"
              color="onAccent"
              accessibilityLabel={t('aiBuild.send')}
              disabled={phase !== 'chat' || !draft.trim()}
              onPress={() => send(draft)}
            />
          </View>
          <Text variant="caption" color="label3" align="center" style={styles.privacy}>
            {t('aiBuild.privacy', { company: AI_COMPANY[provider] })}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function readReplyChoices(text: string): string[] {
  const outcome = readReply(text);
  return outcome.kind === 'message' ? outcome.choices : [];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 16 },
  goal: { gap: 16, marginTop: 12 },
  head: { gap: 6, paddingBottom: 8 },
  keyChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keyChipText: { color: colors.chipLabel, fontFamily: fonts.sansMedium },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  goalLine: { flexShrink: 1 },
  log: { paddingHorizontal: 16, paddingVertical: 18, gap: 10 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
  },
  mine: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    backgroundColor: colors.accent,
    color: colors.onAccent,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  choice: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.controlSelected,
    justifyContent: 'center',
  },
  notice: { backgroundColor: colors.surface, borderRadius: radius.list, padding: 12, gap: 10 },
  noticeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  inputBar: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.bgElevated,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.control,
    color: colors.label,
    paddingHorizontal: 16,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  privacy: { marginTop: 8 },
});
