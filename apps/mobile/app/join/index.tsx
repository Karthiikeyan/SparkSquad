import { INVITE_CODE_LENGTH, isInviteCode, normalizeInviteCode } from '@sparksquad/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, TextField } from '../../src/components/ui';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';
import { fonts } from '../../src/theme/tokens';

/** E4: 6-character invite code → squad preview (E3). */
export default function JoinWithCode() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const normalized = normalizeInviteCode(code);
    if (!isInviteCode(normalized)) {
      setError(t('joinCode.invalid'));
      return;
    }
    router.push({ pathname: '/invite/[code]', params: { code: normalized } });
  };

  return (
    <StepScreen
      back
      title={t('joinCode.title')}
      body={t('joinCode.body')}
      footer={
        <Button
          label={t('joinCode.submit')}
          onPress={submit}
          disabled={normalizeInviteCode(code).length !== INVITE_CODE_LENGTH}
          testID="join-submit"
        />
      }
    >
      <TextField
        label={t('joinCode.label')}
        placeholder={t('joinCode.placeholder')}
        value={code}
        onChangeText={(v) => {
          setCode(normalizeInviteCode(v).slice(0, INVITE_CODE_LENGTH));
          if (error) setError(undefined);
        }}
        error={error}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="join-code"
        inputStyle={styles.code}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: fonts.displaySemibold, fontSize: 24, letterSpacing: 6 },
});
