import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DbGate } from '@/db/provider';
import '@/i18n';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

function RootStack() {
  const { colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="walkthrough" />
        <Stack.Screen name="wizard" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DbGate>
          <RootStack />
        </DbGate>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
