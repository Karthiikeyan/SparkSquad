import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { BellRing } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Text, useToast } from '../../src/components/ui';
import { useMe, useSession } from '../../src/features/auth/SessionProvider';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import {
  dateToReminder,
  DEFAULT_REMINDER,
  formatReminder,
  reminderToDate,
} from '../../src/features/onboarding/time';
import { t } from '../../src/i18n';
import { endpoints } from '../../src/lib/api/endpoints';
import { errorMessage } from '../../src/lib/api/errors';
import { setPref } from '../../src/lib/prefs';
import { colors, fonts, iconStroke, radius } from '../../src/theme/tokens';

/** A8: reminder time (default 8:00 PM); explains reminders run on the phone. */
export default function Reminder() {
  const me = useMe();
  const { setMe } = useSession();
  const toast = useToast();
  const [time, setTime] = useState(me.reminderTime || DEFAULT_REMINDER);
  const [saving, setSaving] = useState(false);

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: reminderToDate(time),
      mode: 'time',
      is24Hour: false,
      onValueChange: (_e, date) => setTime(dateToReminder(date)),
    });

  const submit = async () => {
    setSaving(true);
    try {
      setMe(await endpoints.updateMe({ reminderTime: time }));
      setPref('reminderTime', time);
      router.push('/notifications');
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepScreen
      step={t('reminder.step')}
      title={t('reminder.title')}
      body={t('reminder.body')}
      footer={
        <Button
          label={t('reminder.continue')}
          onPress={() => void submit()}
          loading={saving}
          testID="reminder-continue"
        />
      }
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <BellRing size={20} color={colors.accent} strokeWidth={iconStroke} />
          <Text variant="body" color="label2">
            {t('reminder.label')}
          </Text>
        </View>
        <Text style={styles.time} tabular accessibilityLiveRegion="polite">
          {formatReminder(time)}
        </Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={reminderToDate(time)}
            mode="time"
            display="spinner"
            themeVariant="dark"
            textColor={colors.label}
            onValueChange={(_e, date) => setTime(dateToReminder(date))}
            accessibilityLabel={t('reminder.label')}
          />
        ) : (
          <Button
            label={t('reminder.change')}
            variant="secondary"
            size="md"
            onPress={openAndroid}
            accessibilityLabel={`${t('reminder.change')}, ${formatReminder(time)}`}
          />
        )}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, color: colors.label },
});
