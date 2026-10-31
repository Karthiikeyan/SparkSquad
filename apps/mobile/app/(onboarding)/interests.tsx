import type { z } from 'zod';
import { interestSchema } from '@sparksquad/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ChipToggle, useToast } from '../../src/components/ui';
import { useMe, useSession } from '../../src/features/auth/SessionProvider';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';
import { endpoints } from '../../src/lib/api/endpoints';
import { errorMessage } from '../../src/lib/api/errors';

type Interest = z.infer<typeof interestSchema>;
const OPTIONS = interestSchema.options;

/** A7: Career / Fitness / Learning (multi), used to rank Discover. */
export default function Interests() {
  const me = useMe();
  const { setMe } = useSession();
  const toast = useToast();
  const [selected, setSelected] = useState<Interest[]>(() =>
    me.interests.filter((i): i is Interest => (OPTIONS as readonly string[]).includes(i)),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (i: Interest) =>
    setSelected((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const submit = async () => {
    setSaving(true);
    try {
      setMe(await endpoints.updateMe({ interests: selected }));
      router.push('/reminder');
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepScreen
      step={t('interests.step')}
      title={t('interests.title')}
      body={t('interests.body')}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('interests.continue')}
            onPress={() => void submit()}
            loading={saving}
            disabled={selected.length === 0}
            testID="interests-continue"
          />
          <Button
            label={t('interests.skip')}
            variant="ghost"
            size="md"
            onPress={() => router.push('/reminder')}
          />
        </View>
      }
    >
      <View style={styles.chips}>
        {OPTIONS.map((i) => (
          <ChipToggle
            key={i}
            label={t(`interests.${i}`)}
            selected={selected.includes(i)}
            role="checkbox"
            onPress={() => toggle(i)}
            testID={`interest-${i}`}
          />
        ))}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { gap: 4 },
});
