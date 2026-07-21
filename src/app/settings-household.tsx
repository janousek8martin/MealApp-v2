import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DietRadioList } from '@/components/DietRadioList';
import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { HintedScrollView } from '@/components/HintedScrollView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { CUISINE_ICONS } from '@/constants/chipIcons';
import { BUDGET_LEVELS, COOKING_EXPERIENCE_LEVELS, COOKING_TIME_LIMIT_OPTIONS, CUISINE_KEYS } from '@/constants/options';
import { db } from '@/db/client';
import { renameHousehold, replaceHouseholdPreferences, updateHouseholdSettings } from '@/db/repositories/households';
import {
  useHousehold,
  useHouseholdAvoidedItems,
  useHouseholdRestrictions,
  useHouseholdSettings,
  useProfiles,
} from '@/hooks/data';
import { useFoods } from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

const ANY_TIME_KEY = 'any';

export default function SettingsHouseholdScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const settings = useHouseholdSettings(household?.id);
  const members = useProfiles(household?.id);
  const restrictions = useHouseholdRestrictions(household?.id);
  const { avoidedFoodIds } = useHouseholdAvoidedItems(household?.id);
  const foodRows = useFoods();
  const foodById = useMemo(() => new Map(foodRows.map((f) => [f.id, f])), [foodRows]);

  const [name, setName] = useState('');
  const [nameSeeded, setNameSeeded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (nameSeeded || !household) return;
    setName(household.name);
    setNameSeeded(true);
  }, [household, nameSeeded]);

  if (!household || !settings) return null;

  const favoriteCuisines: string[] = settings.favoriteCuisinesJson ? JSON.parse(settings.favoriteCuisinesJson) : [];

  const addAvoidedFood = (food: FoodRow) => {
    setPickerVisible(false);
    if (avoidedFoodIds.includes(food.id)) return;
    void replaceHouseholdPreferences(db, household.id, { avoidedFoodIds: [...avoidedFoodIds, food.id] });
  };
  const removeAvoidedFood = (foodId: string) => {
    void replaceHouseholdPreferences(db, household.id, { avoidedFoodIds: avoidedFoodIds.filter((id) => id !== foodId) });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content}>
        <ScreenHeader />
        <Text style={styles.heading}>{t('settings.category.household.title')}</Text>

        <View style={styles.slotFieldTime}>
          <TextField label={t('settings.householdName')} value={name} onChangeText={setName} />
        </View>
        <Button
          label={t('common.save')}
          variant="secondary"
          disabled={name.trim().length === 0 || name === household.name}
          onPress={() => void renameHousehold(db, household.id, name.trim())}
        />

        <Text style={styles.slotLabel}>{t('settings.householdDiets')}</Text>
        <DietRadioList
          value={restrictions.diets[0] ?? null}
          onChange={(key) => void replaceHouseholdPreferences(db, household.id, { diets: key ? [key] : [] })}
          recommendedKey="mediterranean"
        />

        <ChipSelect
          label={t('settings.householdCuisines')}
          multi
          options={CUISINE_KEYS.map((key) => ({ value: key, label: t(`cuisines.${key}`), icon: CUISINE_ICONS[key] }))}
          value={favoriteCuisines}
          onChange={(favoriteCuisines) => void replaceHouseholdPreferences(db, household.id, { favoriteCuisines })}
        />

        <Text style={styles.slotLabel}>{t('settings.householdAvoidedFoods')}</Text>
        <View style={styles.avoidedChipsRow}>
          {avoidedFoodIds.map((foodId) => {
            const food = foodById.get(foodId);
            if (!food) return null;
            return (
              <Pressable key={foodId} style={styles.avoidedChip} onPress={() => removeAvoidedFood(foodId)}>
                <Text style={styles.avoidedChipLabel}>{localizedName(food)}</Text>
                <Ionicons name="close" size={14} color={colors.textSecondary} />
              </Pressable>
            );
          })}
          <Pressable style={styles.avoidedChipAdd} onPress={() => setPickerVisible(true)}>
            <Text style={styles.avoidedChipAddLabel}>{t('settings.householdAddAvoidedFood')}</Text>
          </Pressable>
        </View>
        <FoodPickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} onPick={addAvoidedFood} />

        <Text style={styles.slotLabel}>{t('settings.householdMembers')}</Text>
        {members.map((member) => (
          <Pressable
            key={member.id}
            style={styles.memberRow}
            onPress={() => router.push({ pathname: '/profile/[id]', params: { id: member.id } })}>
            <Text style={styles.slotLabel}>{member.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
        <Pressable style={styles.memberRow} onPress={() => router.push('/profile/new')}>
          <Text style={styles.addMemberLabel}>{t('settings.addMember')}</Text>
        </Pressable>

        <View style={styles.mealTimesSection}>
          <View style={styles.stepperRow}>
            <Text style={styles.slotLabel}>{t('settings.maxRepetitionsPerWeek')}</Text>
            <View style={styles.stepper}>
              <Button
                variant="secondary"
                label="–"
                style={styles.stepperButton}
                onPress={() =>
                  updateHouseholdSettings(db, household.id, {
                    defaultMaxRepetitionsPerWeek: Math.max(1, settings.defaultMaxRepetitionsPerWeek - 1),
                  })
                }
              />
              <Text style={styles.stepperValue}>{settings.defaultMaxRepetitionsPerWeek}</Text>
              <Button
                variant="secondary"
                label="+"
                style={styles.stepperButton}
                onPress={() =>
                  updateHouseholdSettings(db, household.id, {
                    defaultMaxRepetitionsPerWeek: Math.min(7, settings.defaultMaxRepetitionsPerWeek + 1),
                  })
                }
              />
            </View>
          </View>
          <Text style={styles.cardHint}>{t('settings.maxRepetitionsHint')}</Text>

          <SwitchRow
            label={t('settings.allowConsecutiveDays')}
            hint={t('settings.allowConsecutiveDaysHint')}
            value={settings.defaultAllowConsecutiveDays}
            onChange={(v) => updateHouseholdSettings(db, household.id, { defaultAllowConsecutiveDays: v })}
          />

          <View style={styles.stepperRow}>
            <Text style={styles.slotLabel}>{t('settings.coldDinnerFrequency')}</Text>
            <View style={styles.stepper}>
              <Button
                variant="secondary"
                label="–"
                style={styles.stepperButton}
                onPress={() =>
                  updateHouseholdSettings(db, household.id, {
                    coldDinnerFrequencyPerWeek: Math.max(0, settings.coldDinnerFrequencyPerWeek - 1),
                  })
                }
              />
              <Text style={styles.stepperValue}>{settings.coldDinnerFrequencyPerWeek}</Text>
              <Button
                variant="secondary"
                label="+"
                style={styles.stepperButton}
                onPress={() =>
                  updateHouseholdSettings(db, household.id, {
                    coldDinnerFrequencyPerWeek: Math.min(7, settings.coldDinnerFrequencyPerWeek + 1),
                  })
                }
              />
            </View>
          </View>
          <Text style={styles.cardHint}>{t('settings.coldDinnerFrequencyHint')}</Text>

          <SwitchRow
            label={t('settings.allowSameLunchDinner')}
            hint={t('settings.allowSameLunchDinnerHint')}
            value={settings.allowSameLunchDinner}
            onChange={(v) => updateHouseholdSettings(db, household.id, { allowSameLunchDinner: v })}
          />

          <SwitchRow
            label={t('householdCarousel.mealPrepMode')}
            hint={t('householdCarousel.mealPrepModeHint')}
            value={settings.mealPrepMode}
            onChange={(v) => updateHouseholdSettings(db, household.id, { mealPrepMode: v })}
          />

          <SwitchRow
            label={t('settings.preferPantryItems')}
            hint={t('settings.preferPantryItemsHint')}
            value={settings.preferPantryItems}
            onChange={(v) => updateHouseholdSettings(db, household.id, { preferPantryItems: v })}
          />

          <ChipSelect
            label={t('settings.mealVariety')}
            options={(['low', 'medium', 'high'] as const).map((level) => ({
              value: level,
              label: t(`mealVariety.${level}`),
            }))}
            value={settings.mealVarietyLevel}
            onChange={(v) => void updateHouseholdSettings(db, household.id, { mealVarietyLevel: v as 'low' | 'medium' | 'high' })}
          />
          <Text style={styles.cardHint}>{t('settings.mealVarietyHint')}</Text>

          <ChipSelect
            label={t('settings.cookingExperienceLevel')}
            options={COOKING_EXPERIENCE_LEVELS.map((level) => ({ value: level, label: t(`cookingExperience.${level}`) }))}
            value={settings.cookingExperienceLevel}
            onChange={(v) =>
              void updateHouseholdSettings(db, household.id, { cookingExperienceLevel: v as 'easy' | 'medium' | 'hard' })
            }
          />
          <Text style={styles.cardHint}>{t('householdCarousel.cardCookingExperienceHint')}</Text>

          <ChipSelect
            label={t('settings.cookingTimeLimit')}
            options={COOKING_TIME_LIMIT_OPTIONS.map((minutes) => ({
              value: minutes === null ? ANY_TIME_KEY : String(minutes),
              label: minutes === null ? t('cookingTime.any') : t('cookingTime.upTo', { minutes }),
            }))}
            value={settings.cookingTimeLimitMinutes === null ? ANY_TIME_KEY : String(settings.cookingTimeLimitMinutes)}
            onChange={(v) =>
              void updateHouseholdSettings(db, household.id, {
                cookingTimeLimitMinutes: v === ANY_TIME_KEY ? null : Number(v),
              })
            }
          />
          <Text style={styles.cardHint}>{t('householdCarousel.cardCookingTimeHint')}</Text>

          <ChipSelect
            label={t('settings.budgetLevel')}
            options={BUDGET_LEVELS.map((level) => ({ value: level, label: t(`budgetLevel.${level}`) }))}
            value={settings.budgetLevel}
            onChange={(v) => void updateHouseholdSettings(db, household.id, { budgetLevel: v as 'low' | 'medium' | 'high' })}
          />
          <Text style={styles.cardHint}>{t('householdCarousel.cardBudgetHint')}</Text>
        </View>
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
    heading: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    cardHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
      lineHeight: 18,
    },
    slotLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    slotFieldTime: {
      flex: 1,
    },
    mealTimesSection: {
      marginTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperButton: {
      width: 44,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
    },
    stepperValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      minWidth: 20,
      textAlign: 'center',
    },
    avoidedChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    avoidedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    avoidedChipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '500',
    },
    avoidedChipAdd: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    avoidedChipAddLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    addMemberLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}
