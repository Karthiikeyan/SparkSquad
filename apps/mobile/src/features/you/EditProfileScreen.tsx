import { TEXT_LIMITS } from '@sparksquad/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, NavHeader, Screen, Text, TextField, useToast } from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage, isApiError } from '../../lib/api/errors';
import { useOnline } from '../../lib/hooks/useOnline';
import { avatarIndexFor } from '../../theme/tokens';
import { useMe, useSession } from '../auth/SessionProvider';
import { ColorPicker } from '../onboarding/ColorPicker';
import {
  useUsernameCheck,
  validUsername,
  type UsernameState,
} from '../onboarding/useUsernameCheck';

/** F2: display name, username (availability check) and avatar colour. */
export function EditProfileScreen() {
  const me = useMe();
  const { setMe } = useSession();
  const toast = useToast();
  const online = useOnline();
  const [name, setName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username ?? '');
  const [color, setColor] = useState(
    me.avatarColor >= 0 && me.avatarColor <= 11 ? me.avatarColor : avatarIndexFor(me.id),
  );
  const [nameError, setNameError] = useState<string | undefined>();
  const [takenOnSave, setTakenOnSave] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const check = useUsernameCheck(username, me.username);
  const state: UsernameState = takenOnSave === username ? 'taken' : check;

  const usernameError =
    state === 'invalid'
      ? t('profile.usernameInvalid')
      : state === 'taken'
        ? t('profile.usernameTaken')
        : undefined;
  const handle = validUsername(username);
  const changed =
    name.trim() !== me.displayName || handle !== me.username || color !== me.avatarColor;

  const save = async () => {
    const displayName = name.trim();
    if (!displayName) {
      setNameError(t('profile.nameRequired'));
      return;
    }
    if (!handle || state === 'taken') return;
    setSaving(true);
    try {
      setMe(await endpoints.updateMe({ displayName, username: handle, avatarColor: color }));
      toast.show({ message: t('editProfile.saved'), kind: 'success' });
      router.back();
    } catch (e) {
      if (isApiError(e) && e.code === 'USERNAME_TAKEN') setTakenOnSave(username);
      else if (isApiError(e) && e.code === 'CONTENT_NOT_ALLOWED') setNameError(errorMessage(e));
      else toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}
      footer={
        <Button
          label={t('editProfile.save')}
          onPress={() => void save()}
          loading={saving}
          disabled={!online || !changed || !name.trim() || !handle || state === 'taken'}
          testID="profile-save"
        />
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('editProfile.title')}
      </Text>
      <View style={styles.preview}>
        <Avatar
          name={name || '?'}
          color={color}
          size={56}
          accessibilityLabel={t('profile.preview')}
        />
        <View style={styles.flex}>
          <Text variant="title2" numberOfLines={1}>
            {name.trim() || ' '}
          </Text>
          <Text variant="footnote" color="label2" numberOfLines={1}>
            {handle ? `@${handle}` : ' '}
          </Text>
        </View>
      </View>
      <View style={styles.fields}>
        <TextField
          label={t('profile.name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          maxLength={TEXT_LIMITS.displayName}
          autoCapitalize="words"
          textContentType="name"
          testID="edit-name"
        />
        <TextField
          label={t('profile.username')}
          value={username}
          onChangeText={(v) => setUsername(v.trim().toLowerCase())}
          error={usernameError}
          helper={
            usernameError
              ? undefined
              : state === 'checking'
                ? t('profile.usernameChecking')
                : t('profile.usernameHelp')
          }
          maxLength={TEXT_LIMITS.usernameMax}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          testID="edit-username"
        />
        <View style={styles.colours}>
          <Text variant="footnote" color="label2">
            {t('profile.colour')}
          </Text>
          <ColorPicker value={color} onChange={setColor} />
        </View>
        {!online ? (
          <Text variant="footnote" color="label2">
            {t('errors.NETWORK')}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  flex: { flex: 1, gap: 2 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  fields: { gap: 18 },
  colours: { gap: 10 },
});
