import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DbGate } from '@/db/provider';
import '@/i18n';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <DbGate>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </DbGate>
  );
}
