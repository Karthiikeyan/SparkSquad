import { Stack } from 'expo-router';
import { CreateFlowProvider } from '../../src/features/create/flow';
import { colors } from '../../src/theme/tokens';

/** One create-flow draft shared by D1?D11. */
export default function CreateLayout() {
  return (
    <CreateFlowProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="done" options={{ gestureEnabled: false }} />
      </Stack>
    </CreateFlowProvider>
  );
}
