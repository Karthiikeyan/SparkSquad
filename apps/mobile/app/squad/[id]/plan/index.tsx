import { Redirect, useLocalSearchParams } from 'expo-router';

/** C4 deep link: the plan is a segment of the squad screen. */
export default function PlanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/squad/[id]', params: { id: id ?? '', tab: 'plan' } }} />;
}
