import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { PartyPopper } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, useToast } from '../../../components/ui';
import { t } from '../../../i18n';
import { formatLocalDate } from '../../../lib/format';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { useSquad } from '../../squads/useSquad';
import { inviteLink, shareInvite } from '../../squads/screens/InviteScreen';

/** D11: "<squad> is ready" + invite card (code, share, copy link) + go to squad. */
export function DoneScreen() {
  const { squadId = '', start = '' } = useLocalSearchParams<{ squadId: string; start: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const squad = useSquad(squadId);
  const sq = squad.data?.squad;
  const code = sq?.inviteCode ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <PartyPopper size={28} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        <Text variant="title1" align="center" accessibilityRole="header">
          {t('done.title', { name: sq?.name ?? '' })}
        </Text>
        {start ? (
          <Text variant="callout" color="label2" align="center">
            {t('done.body', { date: formatLocalDate(start) })}
          </Text>
        ) : null}
        {code && sq ? (
          <View style={styles.card}>
            <Text variant="footnote" color="label2">
              {t('invite.code')}
            </Text>
            <Text style={styles.code} accessibilityLabel={code.split('').join(' ')}>
              {code}
            </Text>
            <Button
              label={t('done.share')}
              onPress={() => shareInvite(sq.name, code)}
              style={styles.stretch}
            />
            <Button
              label={t('done.copyLink')}
              variant="secondary"
              size="md"
              style={styles.stretch}
              onPress={() => {
                void Clipboard.setStringAsync(inviteLink(code));
                toast.show({ message: t('invite.copied'), kind: 'success' });
              }}
            />
          </View>
        ) : null}
      </View>
      <Button
        label={t('done.go')}
        variant={code ? 'secondary' : 'primary'}
        onPress={() => router.dismissTo({ pathname: '/squad/[id]', params: { id: squadId } })}
        testID="done-go"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  body: { flex: 1, alignItems: 'center', gap: 12 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    marginTop: 12,
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: 6,
    color: colors.accent,
  },
  stretch: { alignSelf: 'stretch' },
});
