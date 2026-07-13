import { router, Stack } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DbGate } from '@/db/provider';
import '@/i18n';
import { extractUrl } from '@/services/recipeImport';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

/** Renders nothing – forwards an incoming Android share (recipe URL) to the import screen. */
function ShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const url = shareIntent.webUrl ?? extractUrl(shareIntent.text ?? '');
    if (url) {
      router.push({ pathname: '/recipe/import', params: { url } });
    }
    resetShareIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent]);

  return null;
}

function RootStack() {
  const { colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <ShareIntentBridge />
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
      <ShareIntentProvider>
        <ThemeProvider>
          <DbGate>
            <RootStack />
          </DbGate>
        </ThemeProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
