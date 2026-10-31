import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  GroupedList,
  GroupFooter,
  ListRow,
  NavHeader,
  Screen,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { notificationPermission, type PermissionState } from '../../lib/notifications';
import { setPref } from '../../lib/prefs';
import { colors, themeName } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { dateToReminder, formatReminder, reminderToDate } from '../onboarding/time';
import { useMePatch } from './useMePatch';

/** F8: reminder time and the three notification switches; shows when the OS has them off. */
export function NotificationsSettingsScreen() {
  const me = useMe();
  const patch = useMePatch();
  const [permission, setPermission] = useState<PermissionState>('granted');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      notificationPermission().then((p) => {
        if (alive) setPermission(p);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const saveTime = (date: Date) => {
    const time = dateToReminder(date);
    if (time === me.reminderTime) return;
    setPref('reminderTime', time);
    void patch({ reminderTime: time });
  };

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: reminderToDate(me.reminderTime),
      mode: 'time',
      is24Hour: false,
      onValueChange: (_e, date) => saveTime(date),
    });

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('notificationsSettings.title')}
      </Text>

      {permission === 'denied' ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Text variant="body">{t('notificationsSettings.permissionOff')}</Text>
          <Button
            label={t('notificationsSettings.openSettings')}
            variant="secondary"
            size="sm"
            onPress={() => void Linking.openSettings()}
            style={styles.bannerButton}
          />
        </View>
      ) : null}

      <GroupedList style={styles.group}>
        {Platform.OS === 'ios' ? (
          <ListRow
            title={t('notificationsSettings.reminderTime')}
            accessory={
              <DateTimePicker
                value={reminderToDate(me.reminderTime)}
                mode="time"
                display="compact"
                themeVariant={themeName}
                onValueChange={(_e, date) => saveTime(date)}
                accessibilityLabel={t('notificationsSettings.reminderTime')}
              />
            }
          />
        ) : (
          <ListRow
            title={t('notificationsSettings.reminderTime')}
            value={formatReminder(me.reminderTime)}
            chevron
            onPress={openAndroid}
            testID="reminder-time"
          />
        )}
        <ListRow
          title={t('notificationsSettings.missedDay')}
          toggle={{
            value: me.notifyMissedDay,
            onValueChange: (v) => void patch({ notifyMissedDay: v }),
          }}
        />
        <ListRow
          title={t('notificationsSettings.squadUpdates')}
          toggle={{
            value: me.notifySquadUpdates,
            onValueChange: (v) => void patch({ notifySquadUpdates: v }),
          }}
        />
        <ListRow
          title={t('notificationsSettings.nudges')}
          toggle={{
            value: me.notifyNudges,
            onValueChange: (v) => void patch({ notifyNudges: v }),
          }}
        />
      </GroupedList>
      <GroupFooter>{t('notificationsSettings.squadUpdatesBody')}</GroupFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: { marginBottom: 0 },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  bannerButton: { alignSelf: 'flex-start' },
});
