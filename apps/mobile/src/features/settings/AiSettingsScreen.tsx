import { AI_DEFAULTS } from '@sparksquad/shared';
import { router } from 'expo-router';
import { CheckCircle2, CircleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  Button,
  GroupedList,
  GroupFooter,
  ListRow,
  NavHeader,
  Screen,
  SectionLabel,
  SegmentedControl,
  Stepper,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { t, type TKey } from '../../i18n';
import { AI_PROVIDERS, getAiKey, removeAiKey, setAiKey, type AiProvider } from '../../lib/aiKeys';
import { maskSecret } from '../../lib/format';
import { getPref, setPref } from '../../lib/prefs';
import { colors, iconStroke } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { sendChat } from '../ai/providers';
import { dailyLimit, takeRequest } from '../ai/session';
import { todayFor } from '../today/model';

type Status = 'untested' | 'testing' | 'working' | 'failed';

const PROVIDER_LABEL: Record<AiProvider, TKey> = {
  gemini: 'aiSettings.gemini',
  openai: 'aiSettings.openai',
  anthropic: 'aiSettings.anthropic',
};

const HOW_TO: Record<AiProvider, TKey> = {
  gemini: 'aiSettings.howToGemini',
  openai: 'aiSettings.howToOpenai',
  anthropic: 'aiSettings.howToAnthropic',
};

/** F6: provider, key (masked, secure store only), test, daily limit, on-device status, remove. */
export function AiSettingsScreen() {
  const me = useMe();
  const toast = useToast();
  const [provider, setProvider] = useState<AiProvider>(getPref('aiProvider') ?? 'gemini');
  const [key, setKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('untested');
  const [limit, setLimit] = useState(dailyLimit());

  useEffect(() => {
    let alive = true;
    setStatus('untested');
    getAiKey(provider).then((k) => {
      if (!alive) return;
      setKey(k);
      setEditing(!k);
    });
    return () => {
      alive = false;
    };
  }, [provider]);

  const chooseProvider = (p: AiProvider) => {
    setProvider(p);
    setPref('aiProvider', p);
  };
  const save = async () => {
    if (!draft.trim()) return;
    await setAiKey(provider, draft);
    setKey(draft.trim());
    setDraft('');
    setEditing(false);
    setStatus('untested');
    toast.show({ message: t('aiSettings.saved'), kind: 'success' });
  };
  const test = async () => {
    if (!key) return;
    if (!takeRequest(todayFor(me, new Date()))) {
      toast.show({ message: t('aiBuild.limit', { n: dailyLimit() }), kind: 'error' });
      return;
    }
    setStatus('testing');
    try {
      await sendChat(provider, key, [{ role: 'user', text: 'Reply with the single word OK.' }]);
      setStatus('working');
    } catch {
      setStatus('failed');
    }
  };
  const remove = () =>
    Alert.alert(t('aiSettings.remove'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('aiSettings.remove'),
        style: 'destructive',
        onPress: () => {
          void removeAiKey(provider).then(() => {
            setKey(null);
            setEditing(true);
            setStatus('untested');
            toast.show({ message: t('aiSettings.removed'), kind: 'success' });
          });
        },
      },
    ]);

  const statusText =
    status === 'working'
      ? t('aiSettings.working')
      : status === 'failed'
        ? t('aiSettings.notWorking')
        : status === 'testing'
          ? t('aiSettings.testing')
          : t('aiSettings.untested');

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('aiSettings.title')}
      </Text>
      <View style={styles.group}>
        <View style={styles.segment}>
          <SegmentedControl
            role="radiogroup"
            tone="surface"
            accessibilityLabel={t('aiSettings.provider')}
            value={provider}
            onChange={chooseProvider}
            options={AI_PROVIDERS.map((p) => ({ value: p, label: t(PROVIDER_LABEL[p]) }))}
          />
        </View>
        {editing ? (
          <View style={styles.edit}>
            <TextField
              label={t('aiSettings.key')}
              placeholder={t('aiSettings.keyPlaceholder')}
              value={draft}
              onChangeText={setDraft}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              importantForAutofill="no"
            />
            <Button
              label={t('aiSettings.save')}
              size="md"
              onPress={() => void save()}
              disabled={!draft.trim()}
            />
          </View>
        ) : (
          <GroupedList style={styles.inner}>
            <ListRow
              title={t('aiSettings.key')}
              value={key ? maskSecret(key) : t('aiSettings.keyNone')}
              accessory={
                <Button
                  label={t('aiSettings.change')}
                  variant="ghost"
                  size="sm"
                  onPress={() => setEditing(true)}
                />
              }
            />
            <ListRow
              title={t('aiSettings.status')}
              accessory={
                <View style={styles.status}>
                  {status === 'working' ? (
                    <CheckCircle2 size={16} color={colors.success} strokeWidth={iconStroke} />
                  ) : status === 'failed' ? (
                    <CircleAlert size={16} color={colors.accent} strokeWidth={iconStroke} />
                  ) : null}
                  <Text variant="body" color={status === 'working' ? 'success' : 'label2'}>
                    {statusText}
                  </Text>
                  <Button
                    label={t('aiSettings.test')}
                    variant="secondary"
                    size="sm"
                    onPress={() => void test()}
                    loading={status === 'testing'}
                  />
                </View>
              }
            />
          </GroupedList>
        )}
        <GroupedList style={styles.inner}>
          <ListRow
            title={t('aiSettings.dailyLimit')}
            accessory={
              <Stepper
                value={limit}
                onChange={(v) => {
                  setLimit(v);
                  setPref('aiDailyLimit', v);
                }}
                label={t('aiSettings.dailyLimit')}
                min={1}
                max={AI_DEFAULTS.maxDailyRequestCap}
              />
            }
          />
          <ListRow title={t('aiSettings.onDevice')} value={t('aiSettings.onDeviceNone')} />
        </GroupedList>
      </View>
      <GroupFooter>{t('aiSettings.note')}</GroupFooter>

      <SectionLabel>{t('aiSettings.howTo')}</SectionLabel>
      <GroupFooter>{t(HOW_TO[provider])}</GroupFooter>

      {key ? (
        <Button label={t('aiSettings.remove')} variant="destructive" onPress={remove} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  segment: { padding: 12 },
  edit: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  inner: {
    borderRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
