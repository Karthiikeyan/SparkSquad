import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useToast } from '../../src/components/ui';
import { OtpInput } from '../../src/features/auth/OtpInput';
import { sendEmailCode, SignInError, verifyEmailCode } from '../../src/features/auth/signIn';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';
import { track } from '../../src/lib/analytics';

const RESEND_SECONDS = 30;

/** A4: 6-digit code boxes, 30 s resend timer, paste and autofill support. */
export default function VerifyCode() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const verify = async (value: string) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setError(undefined);
    try {
      await verifyEmailCode(email, value);
      track('sign_in', { method: 'email' });
      // The session guard moves us on.
    } catch (e) {
      const tooMany = e instanceof SignInError && /TOO_MANY/i.test(e.message);
      setError(t(tooMany ? 'verify.tooMany' : 'verify.invalid'));
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    try {
      await sendEmailCode(email);
      setSeconds(RESEND_SECONDS);
      setError(undefined);
      setCode('');
      toast.show({ message: t('verify.resent'), kind: 'success' });
    } catch {
      toast.show({ message: t('emailSignIn.sendFailed'), kind: 'error' });
    }
  };

  return (
    <StepScreen
      title={t('verify.title')}
      body={t('verify.body', { email })}
      footer={
        <Button
          label={t('verify.submit')}
          onPress={() => void verify(code)}
          loading={verifying}
          disabled={code.length !== 6}
          testID="verify-code"
        />
      }
    >
      <OtpInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} autoFocus />
      {error ? (
        <Text variant="footnote" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={styles.links}>
        {seconds > 0 ? (
          <Text variant="footnote" color="label3" tabular>
            {t('verify.resendIn', { seconds })}
          </Text>
        ) : (
          <Button
            label={t('verify.resend')}
            variant="ghost"
            size="md"
            onPress={() => void resend()}
          />
        )}
        <Button
          label={t('verify.changeEmail')}
          variant="ghost"
          size="md"
          onPress={() => router.back()}
        />
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  error: { marginTop: 12 },
  links: { marginTop: 20, alignItems: 'flex-start', gap: 4, minHeight: 44 },
});
