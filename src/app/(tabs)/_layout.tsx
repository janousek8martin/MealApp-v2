import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AppTabBar } from '@/components/AppTabBar';
import { useHousehold, useHouseholdSettings } from '@/hooks/data';
import { syncHouseholdNotifications } from '@/services/notifications';
import { useAppStore } from '@/stores/appStore';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const { household, loaded } = useHousehold();
  const settings = useHouseholdSettings(household?.id);
  const walkthroughSeen = useAppStore((state) => state.walkthroughSeen);

  // Reconciles scheduled reminders with current settings/meal-slot times on
  // every app open, and whenever Settings changes them – the only sync point,
  // no restart required.
  useEffect(() => {
    if (!household) return;
    syncHouseholdNotifications(household.id).catch((error) => {
      console.error('Failed to sync notifications', error);
    });
  }, [household?.id, settings?.notificationsJson]);

  // The household's language choice (Settings) drives the whole app's UI language.
  useEffect(() => {
    if (settings?.language && settings.language !== i18n.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings?.language, i18n]);

  if (!loaded) {
    return null;
  }
  if (!household) {
    return <Redirect href={walkthroughSeen ? '/wizard' : '/walkthrough'} />;
  }

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="plan" options={{ title: t('tabs.plan') }} />
      <Tabs.Screen name="library" options={{ title: t('tabs.library') }} />
      <Tabs.Screen name="shopping" options={{ title: t('tabs.shopping') }} />
      <Tabs.Screen name="pantry" options={{ title: t('tabs.pantry') }} />
      <Tabs.Screen name="progress" options={{ title: t('tabs.progress') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
