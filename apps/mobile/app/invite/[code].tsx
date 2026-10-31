import { normalizeInviteCode } from '@sparksquad/shared';
import { useLocalSearchParams } from 'expo-router';
import { SquadPreview } from '../../src/features/squads/SquadPreview';

/** E3 reached by invite code (deep link or E4). */
export default function InvitePreview() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <SquadPreview source={{ code: normalizeInviteCode(code ?? '') }} />;
}
