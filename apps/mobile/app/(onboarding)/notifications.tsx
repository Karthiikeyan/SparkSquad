import { router } from 'expo-router';
import { Bell, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Text } from '../../src/components/ui';
import { afterNotificationsStep } from '../../src/features/auth/routing';
import { useSession } from '../../src/features/auth/SessionProvider';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';
import { track } from '../../src/lib/analytics';
import { registerPushToken, requestNotificationPermission } from '../../src/lib/notifications';
import { colors, iconStroke, radius } from '../../src/theme/tokens';

/** A9: why we ask, then the system prompt. "Not now" is always allowed. */
export default function NotificationsPrime() {
  const { pendingInvite, completeOnboarding } = useSession();
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  const next = () => {
    // An invite deep link skips A10 and lands on the squad preview.
    if (afterNotificationsStep(pendingInvite) === 'finish') completeOnboarding();
    else router.push('/start');
  };

  const enable = async () => {
    setAsking(true);
    const result = await requestNotificationPermission();
    setAsking(false);
    track('notifications_prompt', { result });
    if (result === 'granted') {
      registerPushToken().catch(() => undefined);
      next();
    } else if (result === 'denied') {
      setDenied(true);
    } else {
      next();
    }
  };

  const points = [
    t('notificationsPrime.point1'),
    t('notificationsPrime.point2'),
    t('notificationsPrime.point3'),
  ];

  return (
    <StepScreen
      step={t('notificationsPrime.step')}
      title={t('notificationsPrime.title')}
      body={t('notificationsPrime.body')}
      footer={
        <View style={styles.footer}>
          {denied ? (
            <Button
              label={t('notificationsPrime.openSettings')}
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : (
            <Button
              label={t('notificationsPrime.enable')}
              onPress={() => void enable()}
              loading={asking}
              testID="notifications-enable"
            />
          )}
          <Button
            label={denied ? t('common.continue') : t('notificationsPrime.notNow')}
            variant="ghost"
            size="md"
            onPress={next}
            testID="notifications-skip"
          />
        </View>
      }
    >
      <View style={styles.card}>
        <View style={styles.icon}>
          <Bell size={26} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        {points.map((p) => (
          <View key={p} style={styles.point}>
            <Check size={18} color={colors.success} strokeWidth={2.2} />
            <Text variant="body" style={styles.pointText}>
              {p}
            </Text>
          </View>
        ))}
      </View>
      {denied ? (
        <Text
          variant="footnote"
          color="label2"
          style={styles.denied}
          accessibilityLiveRegion="polite"
        >
          {t('notificationsPrime.denied')}
        </Text>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { flex: 1 },
  denied: { marginTop: 12 },
  footer: { gap: 4 },
});
