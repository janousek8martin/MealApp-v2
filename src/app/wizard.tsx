import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { createHouseholdWithDefaults, saveHouseholdPreferences, updateHouseholdSettings } from '@/db/repositories/households';
import { createProfile } from '@/db/repositories/profiles';
import { useRecipes } from '@/hooks/library';
import { useAppStore } from '@/stores/appStore';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type Step = 'composition' | 'preferences' | 'profile' | 'done';

const ALLERGEN_KEYS = ['gluten', 'lactose', 'eggs', 'nuts', 'peanuts', 'fish', 'shellfish', 'soy'];
const DIET_KEYS = ['vegetarian', 'vegan', 'pescatarian'];
const CUISINE_KEYS = ['czech', 'mediterranean', 'italian', 'asian', 'mexican', 'american', 'other'];

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
  const setActiveProfileId = useAppStore((state) => state.setActiveProfileId);
  const recipes = useRecipes();

  const [step, setStep] = useState<Step>('composition');
  const [householdName, setHouseholdName] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const [maxReps, setMaxReps] = useState(2);
  const [allowConsecutive, setAllowConsecutive] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
  const [avoidRecipeIds, setAvoidRecipeIds] = useState<string[]>([]);

  const [profileIndex, setProfileIndex] = useState(0);
  const totalMembers = adults + children;

  const goComposition = async () => {
    const name = householdName.trim();
    if (!name || totalMembers < 1) return;
    const id = await createHouseholdWithDefaults(db, name);
    setHouseholdId(id);
    setStep('preferences');
  };

  const goPreferences = async () => {
    if (!householdId) return;
    await updateHouseholdSettings(db, householdId, {
      defaultMaxRepetitionsPerWeek: maxReps,
      defaultAllowConsecutiveDays: allowConsecutive,
    });
    await saveHouseholdPreferences(db, householdId, {
      allergens,
      diets,
      avoidedRecipeIds: avoidRecipeIds,
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
    const next = profileIndex + 1;
    if (next >= totalMembers) {
      setStep('done');
    } else {
      setProfileIndex(next);
    }
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}

          {step === 'composition' ? (
            <View>
              <Text style={styles.title}>{t('wizard.compositionTitle')}</Text>
              <Text style={styles.subtitle}>{t('wizard.compositionSubtitle')}</Text>
              <TextField
                label={t('wizard.householdName')}
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder={t('wizard.householdPlaceholder')}
              />
              <Stepper label={t('wizard.adults')} value={adults} onChange={setAdults} min={0} max={8} />
              <Stepper label={t('wizard.children')} value={children} onChange={setChildren} min={0} max={8} />
              <Button
                label={t('common.continue')}
                onPress={goComposition}
                disabled={!householdName.trim() || totalMembers < 1}
                style={styles.cta}
              />
            </View>
          ) : null}

          {step === 'preferences' ? (
            <View>
              <Text style={styles.title}>{t('wizard.preferencesTitle')}</Text>
              <Text style={styles.subtitle}>{t('wizard.preferencesSubtitle')}</Text>

              <Stepper label={t('settings.maxRepetitionsPerWeek')} value={maxReps} onChange={setMaxReps} min={1} max={7} />
              <SwitchRow
                label={t('settings.allowConsecutiveDays')}
                hint={t('settings.allowConsecutiveDaysHint')}
                value={allowConsecutive}
                onChange={setAllowConsecutive}
              />

              <ChipSelect
                label={t('wizard.householdAllergens')}
                multi
                options={ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`) }))}
                value={allergens}
                onChange={setAllergens}
              />
              <ChipSelect
                label={t('wizard.householdDiets')}
                multi
                options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`) }))}
                value={diets}
                onChange={setDiets}
              />
              <ChipSelect
                label={t('wizard.favoriteCuisines')}
                multi
                options={CUISINE_KEYS.map((key) => ({ value: key, label: t(`cuisines.${key}`) }))}
                value={favoriteCuisines}
                onChange={setFavoriteCuisines}
              />
              {recipes.length > 0 ? (
                <ChipSelect
                  label={t('wizard.avoidMeals')}
                  multi
                  options={recipes.map((recipe) => ({ value: recipe.id, label: localizedName(recipe) }))}
                  value={avoidRecipeIds}
                  onChange={setAvoidRecipeIds}
                />
              ) : null}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
