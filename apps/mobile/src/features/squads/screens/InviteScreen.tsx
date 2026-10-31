import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Button,
  ErrorState,
  NavHeader,
  Screen,
  SkeletonCard,
  Text,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { env } from '../../../lib/env';
import { colors, fonts, radius } from '../../../theme/tokens';
import { syncSoon } from '../actions';
import { canManage } from '../model';
import { useSquad } from '../useSquad';

/** https invite page on the API domain (redirects into the app or the store, D5). */
export function inviteLink(code: string): string {
  return `${env.apiUrl}/join/${code}`;
}

export function shareInvite(squadName: string, code: string): void {
  const link = inviteLink(code);
  track('invite_share', { surface: 'invite' });
  Share.share({ message: t('invite.shareMessage', { squad: squadName, code, link }) }).catch(
    () => undefined,
  );
}

/** C10: big code, copy link, share sheet, QR code, rotate (owner/admin). */
export function InviteScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const squad = useSquad(id);
  const [rotated, setRotated] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;

  if (squad.isPending)
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  if (!squad.data)
    return (
      <Screen header={header}>
        <ErrorState message={t('squad.notFound')} />
      </Screen>
    );
  const { squad: sq, myRole } = squad.data;
  const code = rotated ?? sq.inviteCode;

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    toast.show({ message: t('invite.copied'), kind: 'success' });
  };
  const rotate = () =>
    Alert.alert(t('invite.rotateConfirm'), t('invite.rotateBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('invite.rotate'),
        style: 'destructive',
        onPress: () => {
          setRotating(true);
          endpoints
            .rotateInvite(id)
            .then((r) => {
              setRotated(r.inviteCode);
              syncSoon();
              toast.show({ message: t('invite.rotated'), kind: 'success' });
            })
            .catch((e: unknown) => toast.show({ message: errorMessage(e), kind: 'error' }))
            .finally(() => setRotating(false));
        },
      },
    ]);

  if (!code) {
    return (
      <Screen header={header}>
        <Text variant="title1" style={styles.title}>
          {t('invite.title')}
        </Text>
        <Text variant="body" color="label2">
          {t('invite.noCode')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <Button
          label={t('invite.share')}
          onPress={() => shareInvite(sq.name, code)}
          testID="invite-share"
        />
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('invite.title')}
      </Text>
      <Text variant="callout" color="label2" style={styles.body}>
        {t('invite.body')}
      </Text>
      <View style={styles.card}>
        <Text variant="footnote" color="label2">
          {t('invite.code')}
        </Text>
        <Text style={styles.code} accessibilityLabel={code.split('').join(' ')} selectable>
          {code}
        </Text>
        <View
          style={styles.qr}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('invite.qr')}
        >
          <QRCode
            value={inviteLink(code)}
            size={180}
            color="#000000"
            backgroundColor="#FFFFFF"
            quietZone={12}
          />
        </View>
        <View style={styles.row}>
          <Button
            label={t('invite.copyCode')}
            variant="secondary"
            size="md"
            style={styles.flex}
            onPress={() => void copy(code)}
          />
          <Button
            label={t('invite.copyLink')}
            variant="secondary"
            size="md"
            style={styles.flex}
            onPress={() => void copy(inviteLink(code))}
          />
        </View>
      </View>
      {canManage(myRole) ? (
        <Button
          label={t('invite.rotate')}
          variant="ghost"
          size="md"
          loading={rotating}
          onPress={rotate}
          style={styles.rotate}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 6 },
  body: { marginBottom: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: 6,
    color: colors.accent,
  },
  qr: { borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
  rotate: { marginTop: 12 },
});
