import { appleCodeForRevoke } from '../auth/signIn';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, NavHeader, Screen, Text, TextField, useToast } from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { useOnline } from '../../lib/hooks/useOnline';
import { useSession } from '../auth/SessionProvider';
import { useYou } from '../you/useYou';

/** The confirm word must match exactly (case-insensitive, trimmed). */
export const deleteConfirmed = (typed: string) =>
  typed.trim().toUpperCase() === t('deleteAccount.confirmWord');

/** F14: explains what goes, warns owners about the hand-over, type DELETE, then sign out. */
export function DeleteAccountScreen() {
  const online = useOnline();
  const toast = useToast();
  const { signOut } = useSession();
  const you = useYou();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const owned = you.data?.ownedCount ?? 0;

  const remove = async () => {
    if (!deleteConfirmed(typed)) return;
    setBusy(true);
    try {
      // Best effort: a failed revoke must not stop someone deleting their account.
      const appleCode = await appleCodeForRevoke();
      if (appleCode) await endpoints.revokeApple(appleCode).catch(() => undefined);
      await endpoints.deleteAccount();
      toast.show({ message: t('deleteAccount.deleted'), kind: 'success' });
      await signOut();
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('deleteAccount.title')}
      </Text>
      <Card variant="section" style={styles.card}>
        <Text variant="body" style={styles.body}>
          {t('deleteAccount.body')}
        </Text>
        {owned > 0 ? (
          <Text variant="body" color="label2" style={styles.body}>
            {owned === 1 ? t('deleteAccount.ownerOne') : t('deleteAccount.owner', { n: owned })}
          </Text>
        ) : null}
        <Text variant="body" color="label2" style={styles.body}>
          {t('deleteAccount.subscription')}
        </Text>
      </Card>
      <Button
        label={t('deleteAccount.exportFirst')}
        variant="secondary"
        onPress={() => router.push('/settings/export')}
        style={styles.export}
      />
      <TextField
        label={t('deleteAccount.confirmLabel')}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        testID="delete-confirm"
      />
      {!online ? (
        <Text variant="footnote" color="label2" style={styles.offline}>
          {t('errors.NETWORK')}
        </Text>
      ) : null}
      <Button
        label={t('deleteAccount.button')}
        variant="destructive"
        onPress={() => void remove()}
        loading={busy}
        disabled={!online || !deleteConfirmed(typed)}
        style={styles.delete}
        testID="delete-account"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  card: { gap: 12, marginBottom: 12 },
  body: { lineHeight: 22 },
  export: { marginBottom: 24 },
  offline: { marginTop: 12 },
  delete: { marginTop: 16 },
});
