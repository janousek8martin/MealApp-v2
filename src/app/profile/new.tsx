import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { ScreenHeader } from '@/components/ScreenHeader';
import { db } from '@/db/client';
import { createProfile } from '@/db/repositories/profiles';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

export default function NewProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { householdId } = useLocalSearchParams<{ householdId: string }>();
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);

  const save = async (value: ProfileFormValue) => {
    if (!householdId) return;
    const profileId = await createProfile(db, { householdId, ...value });
    setActiveProfileId(profileId);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader />
        <Text style={styles.title}>{t('settings.addProfile')}</Text>
        <ProfileForm submitLabel={t('common.save')} onSubmit={save} />
      </HintedScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
  });
}
