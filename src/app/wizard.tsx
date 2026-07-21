import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import {
  HouseholdPreferencesCarousel,
  type HouseholdPreferencesValue,
  type PreferencesCarouselHandle,
} from '@/components/householdWizard/HouseholdPreferencesCarousel';
import type { ProfileFormValue } from '@/components/ProfileForm';
import { ProfileSetupCarousel, type ProfileCarouselHandle } from '@/components/profileWizard/ProfileSetupCarousel';
import { Stepper } from '@/components/ui/Stepper';
import { StepFooter, useStepFooterPadding } from '@/components/ui/StepFooter';
import { AVOID_FOOD_GROUPS } from '@/constants/options';
import { db } from '@/db/client';
import { createHouseholdWithDefaults, saveHouseholdPreferences, updateHouseholdSettings } from '@/db/repositories/households';
import { createProfile } from '@/db/repositories/profiles';
import { defaultNotificationSettings } from '@/db/types';
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
  const footerPadding = useStepFooterPadding();
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

  // Once a step has been reached, its content stays mounted (see the
  // `display: none` render below) so navigating Back never discards
  // in-progress carousel state - these only ever flip false -> true.
  const [reachedPreferences, setReachedPreferences] = useState(false);
  const [reachedProfile, setReachedProfile] = useState(false);
  useEffect(() => {
    if (step === 'preferences') setReachedPreferences(true);
    if (step === 'profile') setReachedProfile(true);
  }, [step]);

  const [profileIndex, setProfileIndex] = useState(0);
  const [createdProfileTypes, setCreatedProfileTypes] = useState<Array<'adult' | 'child'>>([]);
  const totalMembers = adults + children;

  // The preferences/profile steps delegate their own Back/Next to a carousel
  // sub-component; this screen drives them imperatively so their buttons can
  // render in ITS fixed StepFooter (pinned to the bottom) instead of
  // scrolling inline inside the carousel's own content.
  const preferencesRef = useRef<PreferencesCarouselHandle>(null);
  const profileRef = useRef<ProfileCarouselHandle>(null);
  const [carouselNav, setCarouselNav] = useState<{ nextLabel: string; showBack: boolean }>({
    nextLabel: '',
    showBack: false,
  });

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, profileIndex]);

  // Fluid transition between the 3 macro-steps (composition/preferences/
  // profile) - a fade+slide-in on whatever just mounted, mirroring the
  // sub-card carousels' enter animation so switching steps doesn't feel like
  // an abrupt content jump.
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    stepFade.setValue(0);
    stepSlide.setValue(16);
    Animated.parallel([
      Animated.timing(stepFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(stepSlide, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      mealPrepMode: value.mealPrepMode,
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
      await updateHouseholdSettings(db, householdId, {
        notifications: { ...defaultNotificationSettings, weighInTime: value.weighInTime, planningTime: value.planningTime },
      });
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

  // Steps back one macro step (profile -> preferences -> composition). For
  // profile 2+ this still returns to preferences - re-walking already-created
  // profiles isn't supported (documented simplification).
  const backStep = () => {
    setStep(step === 'profile' ? 'preferences' : 'composition');
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
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            step === 'done' && styles.contentCentered,
            { paddingBottom: footerPadding },
          ]}
          keyboardShouldPersistTaps="handled">
          {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}

          {step === 'preferences' || step === 'profile' ? (
            <Pressable accessibilityRole="button" onPress={backStep} style={styles.backRow} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              <Text style={styles.backLabel}>{t('wizard.backStep')}</Text>
            </Pressable>
          ) : null}

          <Animated.View style={{ opacity: stepFade, transform: [{ translateY: stepSlide }] }}>
            {step === 'composition' ? (
              <View>
                <Text style={styles.title}>{t('wizard.compositionTitle')}</Text>
                <Text style={styles.subtitle}>{t('wizard.compositionSubtitle')}</Text>
                <Stepper label={t('wizard.adults')} value={adults} onChange={setAdults} min={0} max={8} />
                <Stepper label={t('wizard.children')} value={children} onChange={setChildren} min={0} max={8} />
              </View>
            ) : null}

            {/*
              'preferences'/'profile' stay MOUNTED (via `display: none` instead
              of unmounting) once first reached, so Back doesn't wipe whatever
              the user already typed/picked and doesn't reset the carousel
              back to its first card - both carousels keep their own internal
              state, which used to get thrown away on every remount.
            */}
            {reachedPreferences ? (
              <View style={step !== 'preferences' ? styles.hiddenStep : undefined}>
                <Text style={styles.title}>{t('wizard.preferencesTitle')}</Text>
                <Text style={styles.subtitle}>{t('wizard.preferencesSubtitle')}</Text>
                <HouseholdPreferencesCarousel
                  ref={preferencesRef}
                  active={step === 'preferences'}
                  submitLabel={t('common.continue')}
                  onSubmit={handlePreferencesSubmit}
                  onBack={backStep}
                  onNavStateChange={setCarouselNav}
                />
              </View>
            ) : null}

            {reachedProfile && householdId ? (
              <View style={step !== 'profile' ? styles.hiddenStep : undefined}>
                <Text style={styles.title}>{t('wizard.profileTitle', { current: profileIndex + 1, total: totalMembers })}</Text>
                <Text style={styles.subtitle}>{t('wizard.profileSubtitle')}</Text>
                <ProfileSetupCarousel
                  key={profileIndex}
                  ref={profileRef}
                  active={step === 'profile'}
                  householdId={householdId}
                  submitLabel={profileIndex + 1 >= totalMembers ? t('wizard.finishProfiles') : t('wizard.nextProfile')}
                  onSubmit={handleCreateProfile}
                  onBack={backStep}
                  initialProfileType={profileIndex < adults ? 'adult' : 'child'}
                  onNavStateChange={setCarouselNav}
                />
              </View>
            ) : null}

            {step === 'done' ? (
              <View style={styles.centered}>
                <Text style={styles.title}>{t('wizard.doneTitle')}</Text>
                <Text style={styles.subtitle}>{t('wizard.doneSubtitle')}</Text>
              </View>
            ) : null}
          </Animated.View>
        </HintedScrollView>
        {step === 'composition' ? (
          <StepFooter
            onNext={goComposition}
            nextLabel={t('common.continue')}
            nextDisabled={totalMembers < 1}
            hideBack
          />
        ) : null}
        {step === 'preferences' || step === 'profile' ? (
          <StepFooter
            onNext={() => (step === 'preferences' ? preferencesRef.current?.pressNext() : profileRef.current?.pressNext())}
            nextLabel={carouselNav.nextLabel}
            onBack={() => (step === 'preferences' ? preferencesRef.current?.pressBack() : profileRef.current?.pressBack())}
            hideBack={!carouselNav.showBack}
          />
        ) : null}
        {step === 'done' ? (
          <StepFooter
            onNext={() => router.replace('/(tabs)')}
            nextLabel={t('wizard.enterApp')}
            hideBack
          />
        ) : null}
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
    // `display: 'none'` (not conditional unmounting) so the hidden carousel
    // keeps its React state alive instead of losing it on the next Back/Next.
    hiddenStep: {
      display: 'none',
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
