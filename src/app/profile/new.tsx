import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { ProfileForm, type ProfileFormHandle, type ProfileFormValue } from '@/components/ProfileForm';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StepFooter, useStepFooterPadding } from '@/components/ui/StepFooter';
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
  const footerPadding = useStepFooterPadding();
  const formRef = useRef<ProfileFormHandle>(null);
  const [canSubmit, setCanSubmit] = useState(false);

  // profile/new can be reached via router.replace(...) with no prior stack
  // entry (e.g. from the wizard's finish flow), so router.back() alone can
  // silently fail. Fall back to replacing the tabs root when there's nothing
  // to dismiss to.
  const handleBack = () => (router.canDismiss() ? router.dismiss() : router.replace('/(tabs)'));

  const save = async (value: ProfileFormValue) => {
    if (!householdId) return;
    const profileId = await createProfile(db, { householdId, ...value });
    setActiveProfileId(profileId);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.flex}>
        <HintedScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: footerPadding }]}
          keyboardShouldPersistTaps="handled">
          <ScreenHeader onBack={handleBack} />
          <Text style={styles.title}>{t('settings.addProfile')}</Text>
          <ProfileForm
            ref={formRef}
            submitLabel={t('common.save')}
            onSubmit={save}
            hideInlineSubmit
            onValidityChange={setCanSubmit}
          />
        </HintedScrollView>
        <StepFooter
          onBack={handleBack}
          backLabel={t('common.back')}
          onNext={() => formRef.current?.submit()}
          nextLabel={t('common.save')}
          nextDisabled={!canSubmit}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      padding: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
  });
}
