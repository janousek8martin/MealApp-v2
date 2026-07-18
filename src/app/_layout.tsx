import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { router, Stack } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DbGate } from '@/db/provider';
import '@/i18n';
import { extractUrl } from '@/services/recipeImport';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { fontFamily } from '@/theme/tokens';

// Every Text picks up Inter by default once fonts are loaded below, so most
// existing screens get the new typeface with no per-file change. Headings
// still need fontFamily.heading applied explicitly - see tokens.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps = (Text as any).defaultProps || {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps.style = [{ fontFamily: fontFamily.body }, (Text as any).defaultProps.style];

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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#EFF6E0' }} />;
  }

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
