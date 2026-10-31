import { router } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Text, useToast } from '../../src/components/ui';
import { useSession } from '../../src/features/auth/SessionProvider';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';
import { endpoints } from '../../src/lib/api/endpoints';
import { errorMessage } from '../../src/lib/api/errors';
import { colors, iconStroke, radius } from '../../src/theme/tokens';

/** A5: 18+ and terms consent. Blocks until both are checked (D7). */
export default function Consent() {
  const toast = useToast();
  const { setMe, signOut } = useSession();
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      setMe(await endpoints.consent());
      router.replace('/profile');
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepScreen
      back={false}
      title={t('consent.title')}
      body={t('consent.body')}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('consent.continue')}
            onPress={() => void submit()}
            disabled={!adult || !terms}
            loading={saving}
            testID="consent-continue"
          />
          <Button
            label={t('consent.otherAccount')}
            variant="ghost"
            size="md"
            onPress={() => void signOut()}
          />
        </View>
      }
    >
      <View style={styles.group}>
        <Checkbox
          label={t('consent.age')}
          checked={adult}
          onChange={setAdult}
          testID="consent-age"
        />
        <View style={styles.separator} />
        <Checkbox
          label={t('consent.terms')}
          checked={terms}
          onChange={setTerms}
          testID="consent-terms"
        />
      </View>
      <View style={styles.links}>
        <Button
          label={t('consent.readTerms')}
          variant="ghost"
          size="md"
          onPress={() => router.push('/settings/legal/terms')}
        />
        <Button
          label={t('consent.readPrivacy')}
          variant="ghost"
          size="md"
          onPress={() => router.push('/settings/legal/privacy')}
        />
      </View>
      <View style={styles.note}>
        <ShieldCheck size={20} color={colors.label2} strokeWidth={iconStroke} />
        <Text variant="footnote" color="label2" style={styles.noteText}>
          {t('consent.zeroTolerance')}
        </Text>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  links: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -10 },
  note: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 14,
    borderRadius: radius.list,
    backgroundColor: colors.surface,
  },
  noteText: { flex: 1 },
  footer: { gap: 4 },
});
