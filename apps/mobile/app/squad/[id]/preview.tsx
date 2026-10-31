import { useLocalSearchParams } from 'expo-router';
import { SquadPreview } from '../../../src/features/squads/SquadPreview';

/** E3 reached by squad id (Discover). */
export default function SquadPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SquadPreview source={{ squadId: id ?? '' }} />;
}
