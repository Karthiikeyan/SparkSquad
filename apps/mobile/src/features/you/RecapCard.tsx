import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from '../../components/ui';
import { t } from '../../i18n';
import { getAiKey, type AiProvider } from '../../lib/aiKeys';
import { getPref } from '../../lib/prefs';
import { colors, iconStroke } from '../../theme/tokens';
import { onDeviceAvailable, onDeviceText } from '../ai/onDevice';
import { sendChat } from '../ai/providers';
import { dailyLimit, takeRequest } from '../ai/session';

interface Props {
  summary: string;
  today: string;
  /** Plus users may have it rewritten by AI (on-device first, then their own key). */
  canRewrite: boolean;
  onError: (message: string) => void;
}

type Engine = { kind: 'device' } | { kind: 'byok'; provider: AiProvider; key: string };

/** Weekly recap: template text for everyone; Plus can rewrite it in 3 short sentences. */
export function RecapCard({ summary, today, canRewrite, onError }: Props) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canRewrite) return;
    if (onDeviceAvailable()) {
      setEngine({ kind: 'device' });
      return;
    }
    let alive = true;
    const provider = getPref('aiProvider') ?? 'gemini';
    getAiKey(provider).then((key) => {
      if (alive && key) setEngine({ kind: 'byok', provider, key });
    });
    return () => {
      alive = false;
    };
  }, [canRewrite]);

  // A new summary (new day, new check-in) invalidates an old rewrite.
  useEffect(() => setRewritten(null), [summary]);

  const rewrite = async () => {
    if (!engine) return;
    const prompt = t('recap.prompt', { summary });
    // On-device costs nothing, so only the user's own key counts toward the daily cap.
    if (engine.kind === 'byok' && !takeRequest(today)) {
      onError(t('aiBuild.limit', { n: dailyLimit() }));
      return;
    }
    setBusy(true);
    try {
      setRewritten(
        engine.kind === 'device'
          ? await onDeviceText(prompt)
          : await sendChat(engine.provider, engine.key, [{ role: 'user', text: prompt }]),
      );
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
      <Text variant="body" color="label2" style={styles.body} accessibilityLiveRegion="polite">
        {rewritten ?? summary}
      </Text>
      {canRewrite && engine && !rewritten ? (
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
