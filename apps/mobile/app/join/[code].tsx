import { isInviteCode, normalizeInviteCode } from '@sparksquad/shared';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../../src/features/auth/SessionProvider';
import { colors } from '../../src/theme/tokens';

/**
 * Invite deep link entry (`sparksquad://join/CODE`, also reached from the API's /join/CODE page).
 * Works signed out: the code is kept until sign-in and onboarding finish, then the index
 * route opens the squad preview.
 */
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { setPendingInvite } = useSession();
  const [stored, setStored] = useState(false);

  useEffect(() => {
    const normalized = normalizeInviteCode(code ?? '');
    if (isInviteCode(normalized)) setPendingInvite(normalized);
    setStored(true);
  }, [code, setPendingInvite]);

  if (!stored) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <Redirect href="/" />;
}
