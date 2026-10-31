import { Redirect } from 'expo-router';

/** Session-aware routing (auth/onboarding) arrives in Phase 4; until then, open Today. */
export default function Index() {
  return <Redirect href="/today" />;
}
