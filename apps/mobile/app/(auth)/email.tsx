import { router } from 'expo-router';
import { useState } from 'react';
import { Button, TextField, useToast } from '../../src/components/ui';
import { isEmail } from '../../src/features/auth/routing';
import { sendEmailCode } from '../../src/features/auth/signIn';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';

/** A3: email field and "Send code". */
export default function EmailSignIn() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) {
      setError(t('emailSignIn.invalid'));
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      await sendEmailCode(value);
      router.push({ pathname: '/verify', params: { email: value } });
    } catch {
      toast.show({ message: t('emailSignIn.sendFailed'), kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <StepScreen
      title={t('emailSignIn.title')}
      body={t('emailSignIn.body')}
      footer={
        <Button
          label={t('emailSignIn.send')}
          onPress={() => void submit()}
          loading={sending}
          disabled={email.trim().length === 0}
          testID="send-code"
        />
      }
    >
      <TextField
        label={t('emailSignIn.label')}
        placeholder={t('emailSignIn.placeholder')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError(undefined);
        }}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
        testID="email-input"
      />
    </StepScreen>
  );
}
