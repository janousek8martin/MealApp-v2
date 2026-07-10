import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { ALLERGEN_ICONS, AVOID_FOOD_ICONS, CUISINE_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import { ALLERGEN_KEYS, AVOID_FOOD_GROUPS, CUISINE_KEYS, DIET_KEYS } from '@/constants/options';
import { db } from '@/db/client';
import { createHouseholdWithDefaults, saveHouseholdPreferences, updateHouseholdSettings } from '@/db/repositories/households';
import { createProfile } from '@/db/repositories/profiles';
import { checkCompositionMatch } from '@/domain/wizardComposition';
import { useFoods } from '@/hooks/library';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Step = 'composition' | 'preferences' | 'profile' | 'done';

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          style={styles.stepperButton}
          onPress={() => onChange(Math.max(min, value - 1))}>
          <Ionicons name="remove" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.stepperButton}
          onPress={() => onChange(Math.min(max, value + 1))}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

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

  const [maxReps, setMaxReps] = useState(2);
  const [allowConsecutive, setAllowConsecutive] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
  const [avoidFoodGroupKeys, setAvoidFoodGroupKeys] = useState<string[]>([]);

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

  const goPreferences = async () => {
    if (!householdId) return;
    await updateHouseholdSettings(db, householdId, {
      defaultMaxRepetitionsPerWeek: maxReps,
      defaultAllowConsecutiveDays: allowConsecutive,
    });
    const avoidedFoodIds = AVOID_FOOD_GROUPS.filter((group) => avoidFoodGroupKeys.includes(group.key))
      .flatMap((group) => group.foodKeys)
      .map((foodKey) => foodIdBySeedKey.get(foodKey))
      .filter((id): id is string => !!id);
    await saveHouseholdPreferences(db, householdId, {
      allergens,
      diets,
      avoidedRecipeIds: [],
      avoidedFoodIds,
      favoriteCuisines,
    });
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
        <HintedScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

              <View style={styles.section}>
                <Stepper label={t('settings.maxRepetitionsPerWeek')} value={maxReps} onChange={setMaxReps} min={1} max={7} />
                <Text style={styles.sectionHint}>{t('wizard.maxRepetitionsHint')}</Text>
                <SwitchRow
                  label={t('settings.allowConsecutiveDays')}
                  hint={t('settings.allowConsecutiveDaysHint')}
                  value={allowConsecutive}
                  onChange={setAllowConsecutive}
                />
              </View>

              <View style={styles.section}>
                <ChipSelect
                  label={t('wizard.householdAllergens')}
                  multi
                  options={ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`), icon: ALLERGEN_ICONS[key] }))}
                  value={allergens}
                  onChange={setAllergens}
                />
              </View>

              <View style={styles.section}>
                <ChipSelect
                  label={t('wizard.householdDiets')}
                  multi
                  options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] }))}
                  value={diets}
                  onChange={setDiets}
                />
              </View>

              <View style={styles.section}>
                <ChipSelect
                  label={t('wizard.favoriteCuisines')}
                  multi
                  options={CUISINE_KEYS.map((key) => ({ value: key, label: t(`cuisines.${key}`), icon: CUISINE_ICONS[key] }))}
                  value={favoriteCuisines}
                  onChange={setFavoriteCuisines}
                />
              </View>

              <View style={[styles.section, styles.sectionLast]}>
                <ChipSelect
                  label={t('wizard.avoidMeals')}
                  multi
                  options={AVOID_FOOD_GROUPS.map((group) => ({
                    value: group.key,
                    label: t(`avoidFoods.${group.key}`),
                    icon: AVOID_FOOD_ICONS[group.key],
                  }))}
                  value={avoidFoodGroupKeys}
                  onChange={setAvoidFoodGroupKeys}
                />
              </View>

              <Button label={t('common.continue')} onPress={goPreferences} style={styles.cta} />
            </View>
          ) : null}

          {step === 'profile' ? (
            <View>
              <Text style={styles.title}>{t('wizard.profileTitle', { current: profileIndex + 1, total: totalMembers })}</Text>
              <Text style={styles.subtitle}>{t('wizard.profileSubtitle')}</Text>
              <ProfileForm
                key={profileIndex}
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
    section: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.md,
      marginBottom: spacing.md,
    },
    sectionLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
      marginBottom: 0,
    },
    sectionHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
      marginTop: -spacing.sm,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    stepperLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
      flex: 1,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperButton: {
      width: 32,
      height: 32,
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      minWidth: 24,
      textAlign: 'center',
    },
  });
}
