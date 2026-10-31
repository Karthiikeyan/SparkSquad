import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from '../../components/ui';
import { t } from '../../i18n';
import { getAiKey, type AiProvider } from '../../lib/aiKeys';
import { getPref } from '../../lib/prefs';
import { colors, iconStroke } from '../../theme/tokens';
import { sendChat } from '../ai/providers';
import { dailyLimit, takeRequest } from '../ai/session';

interface Props {
  summary: string;
  today: string;
  /** Plus users may rewrite with their own AI key. */
  canRewrite: boolean;
  onError: (message: string) => void;
}

/** Weekly recap: template text for everyone; Plus + a BYOK key can rewrite it in 3 sentences. */
export function RecapCard({ summary, today, canRewrite, onError }: Props) {
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canRewrite) return;
    let alive = true;
    const p = getPref('aiProvider') ?? 'gemini';
    getAiKey(p).then((k) => {
      if (!alive) return;
      setProvider(p);
      setKey(k);
    });
    return () => {
      alive = false;
    };
  }, [canRewrite]);

  // A new summary (new day, new check-in) invalidates an old rewrite.
  useEffect(() => setRewritten(null), [summary]);

  const rewrite = async () => {
    if (!provider || !key) return;
    if (!takeRequest(today)) {
      onError(t('aiBuild.limit', { n: dailyLimit() }));
      return;
    }
    setBusy(true);
    try {
      const text = await sendChat(provider, key, [
        { role: 'user', text: t('recap.prompt', { summary }) },
      ]);
      setRewritten(text);
    } catch {
      onError(t('you.recapFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text variant="headline" accessibilityRole="header">
        {t('you.recapTitle')}
      </Text>
      <Text variant="body" color="label2" style={styles.body}>
        {rewritten ?? summary}
      </Text>
      {canRewrite && key && !rewritten ? (
        <Button
          label={busy ? t('you.recapRewriting') : t('you.recapRewrite')}
          variant="secondary"
          size="sm"
          loading={busy}
          icon={<Sparkles size={16} color={colors.label} strokeWidth={iconStroke} />}
          onPress={() => void rewrite()}
          style={styles.button}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginBottom: 12 },
  body: { lineHeight: 22 },
  button: { alignSelf: 'flex-start' },
});
