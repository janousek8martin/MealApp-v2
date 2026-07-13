import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { HouseholdPreferencesCarousel, type HouseholdPreferencesValue } from '@/components/householdWizard/HouseholdPreferencesCarousel';
import type { ProfileFormValue } from '@/components/ProfileForm';
import { ProfileSetupCarousel } from '@/components/profileWizard/ProfileSetupCarousel';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { AVOID_FOOD_GROUPS } from '@/constants/options';
import { db } from '@/db/client';
import { createHouseholdWithDefaults, saveHouseholdPreferences, updateHouseholdSettings } from '@/db/repositories/households';
import { createProfile } from '@/db/repositories/profiles';
import { checkCompositionMatch } from '@/domain/wizardComposition';
import { useFoods } from '@/hooks/library';
import { syncHouseholdNotifications } from '@/services/notifications';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type Step = 'composition' | 'preferences' | 'profile' | 'done';

export default function WizardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setActiveProfileId = useAppStore((state) => state.setActiveProfileId);
  const foodRows = useFoods();
  const foodIdBySeedKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const food of foodRows) {
      if (food.seedKey) map.set(food.seedKey, food.id);
    }
    return map;
  }, [foodRows]);

  const [step, setStep] = useState<Step>('composition');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [profileIndex, setProfileIndex] = useState(0);
  const [createdProfileTypes, setCreatedProfileTypes] = useState<Array<'adult' | 'child'>>([]);
  const totalMembers = adults + children;

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, profileIndex]);

  const goComposition = async () => {
    if (totalMembers < 1) return;
    if (!householdId) {
      const id = await createHouseholdWithDefaults(db, t('walkthrough.defaultHouseholdName'));
      setHouseholdId(id);
    }
    setStep('preferences');
  };

  const handlePreferencesSubmit = async (value: HouseholdPreferencesValue) => {
    if (!householdId) return;
    await updateHouseholdSettings(db, householdId, {
      defaultMaxRepetitionsPerWeek: value.maxReps,
      defaultAllowConsecutiveDays: value.allowConsecutive,
      allowSameLunchDinner: value.allowSameLunchDinner,
      preferPantryItems: value.preferPantryItems,
      mealVarietyLevel: value.mealVarietyLevel,
      coldDinnerFrequencyPerWeek: value.coldDinnerFrequencyPerWeek,
      cookingExperienceLevel: value.cookingExperienceLevel,
      cookingTimeLimitMinutes: value.cookingTimeLimitMinutes,
      budgetLevel: value.budgetLevel,
    });
    const avoidedFoodIds = AVOID_FOOD_GROUPS.filter((group) => value.avoidFoodGroupKeys.includes(group.key))
      .flatMap((group) => group.foodKeys)
      .map((foodKey) => foodIdBySeedKey.get(foodKey))
      .filter((id): id is string => !!id);
    await saveHouseholdPreferences(db, householdId, {
      // Allergies are now set per-profile only (see ProfileForm) - household-
      // wide allergens are no longer collected in the wizard.
      allergens: [],
      diets: value.diets,
      avoidedRecipeIds: [],
      avoidedFoodIds,
      favoriteCuisines: value.favoriteCuisines,
    });
    if (value.notificationsEnabled) {
      await syncHouseholdNotifications(householdId);
    }
    setStep('profile');
  };

  const handleCreateProfile = async (value: ProfileFormValue) => {
    if (!householdId) return;
    const profileId = await createProfile(db, { householdId, ...value });
    if (profileIndex === 0) {
      setActiveProfileId(profileId);
    }
    const thisType: 'adult' | 'child' = profileIndex < adults ? 'adult' : 'child';
    const updatedTypes = [...createdProfileTypes, thisType];
    setCreatedProfileTypes(updatedTypes);

    const next = profileIndex + 1;
    if (next >= totalMembers) {
      const check = checkCompositionMatch(updatedTypes, { adults, children });
      if (!check.matches) {
        Alert.alert(
          t('wizard.compositionMismatchTitle'),
          t('wizard.compositionMismatchMessage', {
            actualAdults: check.adults,
            actualChildren: check.children,
            adults,
            children,
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('wizard.finishAnyway'), onPress: () => setStep('done') },
          ],
        );
      } else {
        setStep('done');
      }
    } else {
      setProfileIndex(next);
    }
  };

  const backToComposition = () => {
    setStep('composition');
  };

  const stepLabel =
    step === 'composition'
      ? t('wizard.stepOf', { current: 1, total: 3 })
      : step === 'preferences'
        ? t('wizard.stepOf', { current: 2, total: 3 })
        : step === 'profile'
          ? t('wizard.stepOf', { current: 3, total: 3 })
          : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <HintedScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, step === 'done' && styles.contentCentered]}
          keyboardShouldPersistTaps="handled">
          {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}

          {step === 'preferences' || step === 'profile' ? (
            <Pressable accessibilityRole="button" onPress={backToComposition} style={styles.backRow} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              <Text style={styles.backLabel}>{t('wizard.backToComposition')}</Text>
            </Pressable>
          ) : null}

          {step === 'composition' ? (
            <View>
              <Text style={styles.title}>{t('wizard.compositionTitle')}</Text>
              <Text style={styles.subtitle}>{t('wizard.compositionSubtitle')}</Text>
              <Stepper label={t('wizard.adults')} value={adults} onChange={setAdults} min={0} max={8} />
              <Stepper label={t('wizard.children')} value={children} onChange={setChildren} min={0} max={8} />
              <Button
                label={t('common.continue')}
                onPress={goComposition}
                disabled={totalMembers < 1}
                style={styles.cta}
              />
            </View>
          ) : null}

          {step === 'preferences' ? (
            <View>
              <Text style={styles.title}>{t('wizard.preferencesTitle')}</Text>
              <Text style={styles.subtitle}>{t('wizard.preferencesSubtitle')}</Text>
              <HouseholdPreferencesCarousel
                submitLabel={t('common.continue')}
                onSubmit={handlePreferencesSubmit}
              />
            </View>
          ) : null}

          {step === 'profile' && householdId ? (
            <View>
              <Text style={styles.title}>{t('wizard.profileTitle', { current: profileIndex + 1, total: totalMembers })}</Text>
              <Text style={styles.subtitle}>{t('wizard.profileSubtitle')}</Text>
              <ProfileSetupCarousel
                key={profileIndex}
                householdId={householdId}
                submitLabel={profileIndex + 1 >= totalMembers ? t('wizard.finishProfiles') : t('wizard.nextProfile')}
                onSubmit={handleCreateProfile}
                initialProfileType={profileIndex < adults ? 'adult' : 'child'}
              />
            </View>
          ) : null}

          {step === 'done' ? (
            <View style={styles.centered}>
              <Text style={styles.title}>{t('wizard.doneTitle')}</Text>
              <Text style={styles.subtitle}>{t('wizard.doneSubtitle')}</Text>
              <Button label={t('wizard.enterApp')} onPress={() => router.replace('/(tabs)')} style={styles.cta} />
            </View>
          ) : null}
        </HintedScrollView>
      </KeyboardAvoidingView>
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
      padding: spacing.lg,
      flexGrow: 1,
      justifyContent: 'flex-start',
    },
    contentCentered: {
      justifyContent: 'center',
    },
    centered: {
      alignItems: 'stretch',
    },
    stepLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginBottom: spacing.sm,
    },
    backLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      marginLeft: 2,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    cta: {
      marginTop: spacing.md,
    },
  });
}
