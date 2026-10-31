import { isValidTimeZone, TEXT_LIMITS } from '@sparksquad/shared';
import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Text, TextField, useToast } from '../../src/components/ui';
import { suggestUsername } from '../../src/features/auth/routing';
import { useMe, useSession } from '../../src/features/auth/SessionProvider';
import { ColorPicker } from '../../src/features/onboarding/ColorPicker';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import {
  useUsernameCheck,
  validUsername,
  type UsernameState,
} from '../../src/features/onboarding/useUsernameCheck';
import { t } from '../../src/i18n';
import { endpoints } from '../../src/lib/api/endpoints';
import { errorMessage, isApiError } from '../../src/lib/api/errors';
import { avatarIndexFor, colors } from '../../src/theme/tokens';

const STATUS_COPY: Partial<Record<UsernameState, { text: string; color: 'label3' | 'success' }>> = {
  checking: { text: t('profile.usernameChecking'), color: 'label3' },
  available: { text: t('profile.usernameAvailable'), color: 'success' },
};

/** A6: display name, username (availability check), avatar colour. */
export default function Profile() {
  const me = useMe();
  const { setMe } = useSession();
  const toast = useToast();
  const [name, setName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username ?? suggestUsername(me.displayName));
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
  const status = STATUS_COPY[state];

  const submit = async () => {
    const displayName = name.trim();
    if (!displayName) {
      setNameError(t('profile.nameRequired'));
      return;
    }
    const handle = validUsername(username);
    if (!handle || state === 'taken') return;
    setSaving(true);
    try {
      const tz = getCalendars()[0]?.timeZone;
      const next = await endpoints.updateMe({
        displayName,
        username: handle,
        avatarColor: color,
        ...(tz && isValidTimeZone(tz) ? { timezone: tz } : {}),
      });
      setMe(next);
      router.push('/interests');
    } catch (e) {
      if (isApiError(e) && e.code === 'USERNAME_TAKEN') setTakenOnSave(username);
      else if (isApiError(e) && e.code === 'CONTENT_NOT_ALLOWED') setNameError(errorMessage(e));
      else toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepScreen
      back={false}
      step={t('profile.step')}
      title={t('profile.title')}
      body={t('profile.body')}
      footer={
        <Button
          label={t('profile.continue')}
          onPress={() => void submit()}
          loading={saving}
          disabled={!name.trim() || !validUsername(username) || state === 'taken'}
          testID="profile-continue"
        />
      }
    >
      <View style={styles.preview}>
        <Avatar
          name={name || '?'}
          color={color}
          size={56}
          accessibilityLabel={t('profile.preview')}
        />
        <View style={styles.previewText}>
          <Text variant="title2" numberOfLines={1}>
            {name.trim() || ' '}
          </Text>
          <Text variant="footnote" color="label2" numberOfLines={1}>
            {validUsername(username) ? `@${validUsername(username)}` : ' '}
          </Text>
        </View>
      </View>

      <View style={styles.fields}>
        <TextField
          label={t('profile.name')}
          placeholder={t('profile.namePlaceholder')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          maxLength={TEXT_LIMITS.displayName}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          testID="profile-name"
        />
        <View>
          <TextField
            label={t('profile.username')}
            placeholder={t('profile.usernamePlaceholder')}
            value={username}
            onChangeText={(v) => setUsername(v.trim().toLowerCase())}
            error={usernameError}
            helper={usernameError ? undefined : t('profile.usernameHelp')}
            maxLength={TEXT_LIMITS.usernameMax}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            testID="profile-username"
          />
          {status && !usernameError ? (
            <Text
              variant="caption"
              color={status.color}
              style={styles.status}
              accessibilityLiveRegion="polite"
            >
              {status.text}
            </Text>
          ) : null}
        </View>
        <View style={styles.colours}>
          <Text variant="footnote" color="label2">
            {t('profile.colour')}
          </Text>
          <ColorPicker value={color} onChange={setColor} />
        </View>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  previewText: { flex: 1, gap: 2 },
  fields: { gap: 18 },
  status: { marginTop: 4 },
  colours: { gap: 10 },
});
