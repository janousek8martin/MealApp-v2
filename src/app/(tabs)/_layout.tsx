import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { useHousehold } from '@/hooks/data';
import { syncHouseholdNotifications } from '@/services/notifications';
import { colors } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { household, loaded } = useHousehold();

  // Reconciles scheduled reminders with current settings/meal-slot times on
  // every app open – cheap, and the only sync point until Settings (phase 9)
  // lets the user change these without restarting.
  useEffect(() => {
    if (!household) return;
    syncHouseholdNotifications(household.id).catch((error) => {
      console.error('Failed to sync notifications', error);
    });
  }, [household?.id]);

  if (!loaded) {
    return null;
  }
  if (!household) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.today'), tabBarIcon: tabIcon('sunny') }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: t('tabs.plan'), tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: t('tabs.library'), tabBarIcon: tabIcon('restaurant') }}
      />
      <Tabs.Screen
        name="shopping"
        options={{ title: t('tabs.shopping'), tabBarIcon: tabIcon('cart') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: t('tabs.progress'), tabBarIcon: tabIcon('trending-up') }}
      />
    </Tabs>
  );
}
