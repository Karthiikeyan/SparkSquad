import { Redirect, useLocalSearchParams } from 'expo-router';

/** C3 deep link: the leaderboard is a segment of the squad screen. */
export default function LeaderboardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect href={{ pathname: '/squad/[id]', params: { id: id ?? '', tab: 'leaderboard' } }} />
  );
}
