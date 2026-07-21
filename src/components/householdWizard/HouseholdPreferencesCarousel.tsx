import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Stepper } from '@/components/ui/Stepper';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { AVOID_FOOD_ICONS, CUISINE_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import {
  AVOID_FOOD_GROUPS,
  BUDGET_LEVELS,
  COOKING_EXPERIENCE_LEVELS,
  COOKING_TIME_LIMIT_OPTIONS,
  CUISINE_KEYS,
  DIET_KEYS,
} from '@/constants/options';
import { defaultNotificationSettings } from '@/db/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const CARD_KEYS = [
  'repetition',
  'variety',
  'diet',
  'cuisines',
  'avoid',
  'cookingExperience',
  'cookingTime',
  'budget',
  'notifications',
] as const;
type CardKey = (typeof CARD_KEYS)[number];

export type HouseholdPreferencesValue = {
  maxReps: number;
  allowConsecutive: boolean;
  allowSameLunchDinner: boolean;
  preferPantryItems: boolean;
  mealVarietyLevel: 'low' | 'medium' | 'high';
  coldDinnerFrequencyPerWeek: number;
  diets: string[];
  mealPrepMode: boolean;
  favoriteCuisines: string[];
  avoidFoodGroupKeys: string[];
  cookingExperienceLevel: 'easy' | 'medium' | 'hard';
  cookingTimeLimitMinutes: number | null;
  budgetLevel: 'low' | 'medium' | 'high';
  notificationsEnabled: boolean;
  weighInTime: string;
  planningTime: string;
};

const ANY_TIME_KEY = 'any';

export type PreferencesCarouselHandle = {
  pressNext: () => void;
  pressBack: () => void;
};

type Props = {
  submitLabel: string;
  onSubmit: (value: HouseholdPreferencesValue) => void;
  /** Called when Back is pressed on the FIRST card - steps back to the previous wizard step. */
  onBack?: () => void;
  /**
   * Whether this carousel is the one currently visible in the wizard - the
   * parent keeps both step carousels mounted (see wizard.tsx) so Back/Next
   * don't wipe their state, so this tells the hidden one not to report its
   * footer state over the visible one's, and makes the visible one re-report
   * its own state the moment it becomes visible again.
   */
  active?: boolean;
  /**
   * Reports the current Next label and whether Back is currently available,
   * so a parent-rendered fixed `StepFooter` can reflect the carousel's state
   * without the footer living inside this component's own scrolling content.
   */
  onNavStateChange?: (state: { nextLabel: string; showBack: boolean }) => void;
};

/**
 * The wizard's household-preferences step (step 2 of 3) as a swipeable
 * carousel of single-topic cards, mirroring ProfileSetupCarousel's pattern –
 * see the approved plan's "wizard preferences redesign" spec. No card has a
 * required field: every setting has a sensible schema-matching default, so
 * canProceed is always true and Back/Next never blocks.
 *
 * Back/Next themselves are NOT rendered inline here - a parent screen renders
 * a fixed `StepFooter` outside this component's scroll container and drives
 * it via the imperative handle (`pressNext`/`pressBack`), reading label/back-
 * visibility from `onNavStateChange`.
 */
export const HouseholdPreferencesCarousel = forwardRef<PreferencesCarouselHandle, Props>(
  function HouseholdPreferencesCarousel({ submitLabel, onSubmit, onBack, active = true, onNavStateChange }, ref) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [maxReps, setMaxReps] = useState(2);
  const [allowConsecutive, setAllowConsecutive] = useState(false);
  const [allowSameLunchDinner, setAllowSameLunchDinner] = useState(false);
  const [preferPantryItems, setPreferPantryItems] = useState(true);
  const [mealVarietyLevel, setMealVarietyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [coldDinnerFrequencyPerWeek, setColdDinnerFrequencyPerWeek] = useState(0);

  const [diets, setDiets] = useState<string[]>([]);
  const [mealPrepMode, setMealPrepMode] = useState(false);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
  const [avoidFoodGroupKeys, setAvoidFoodGroupKeys] = useState<string[]>([]);

  // These have a reasonable, estimable middle-ground default and start
  // PRESELECTED (unlike diet/cuisine/avoided-food choices, which are
  // personal and can't be guessed) - the user can still change any of them.
  const [cookingExperienceLevel, setCookingExperienceLevel] = useState<'easy' | 'medium' | 'hard' | null>('medium');
  const [cookingTimeKey, setCookingTimeKey] = useState<string | null>('45');
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'medium' | 'high' | null>('medium');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weighInTime, setWeighInTime] = useState(defaultNotificationSettings.weighInTime);
  const [planningTime, setPlanningTime] = useState(defaultNotificationSettings.planningTime);

  const [currentKey, setCurrentKey] = useState<CardKey>('repetition');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const index = CARD_KEYS.indexOf(currentKey);
  const isLastCard = currentKey === 'notifications';

  const EXIT_DISTANCE = 24;
  const ENTER_DISTANCE = 32;
  const isAnimatingRef = useRef(false);

  const goToCard = (key: CardKey, direction: 1 | -1) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -direction * EXIT_DISTANCE, duration: 140, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setCurrentKey(key);
      slideAnim.setValue(direction * ENTER_DISTANCE);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        isAnimatingRef.current = false;
      });
    });
  };

  const goNext = () => {
    const next = CARD_KEYS[index + 1];
    if (next) goToCard(next, 1);
  };
  const goBack = () => {
    const prev = CARD_KEYS[index - 1];
    if (prev) goToCard(prev, -1);
  };

  const handleSubmit = () => {
    onSubmit({
      maxReps,
      allowConsecutive,
      allowSameLunchDinner,
      preferPantryItems,
      mealVarietyLevel,
      coldDinnerFrequencyPerWeek,
      diets,
      mealPrepMode,
      favoriteCuisines,
      avoidFoodGroupKeys,
      // Skipped cards fall back to the middle of the road: medium difficulty,
      // 45-minute recipes, medium budget. An EXPLICIT "any time" pick still
      // means no limit - only the untouched-null case gets the 45 default.
      cookingExperienceLevel: cookingExperienceLevel ?? 'medium',
      cookingTimeLimitMinutes: cookingTimeKey === null ? 45 : cookingTimeKey === ANY_TIME_KEY ? null : Number(cookingTimeKey),
      budgetLevel: budgetLevel ?? 'medium',
      notificationsEnabled,
      weighInTime: TIME_RE.test(weighInTime) ? weighInTime : defaultNotificationSettings.weighInTime,
      planningTime: TIME_RE.test(planningTime) ? planningTime : defaultNotificationSettings.planningTime,
    });
  };

  const showBack = index > 0 || !!onBack;

  const pressNext = () => {
    if (isLastCard) handleSubmit();
    else goNext();
  };
  const pressBack = () => {
    if (index > 0) goBack();
    else onBack?.();
  };
  useImperativeHandle(ref, () => ({ pressNext, pressBack }));

  useEffect(() => {
    if (!active) return;
    onNavStateChange?.({ nextLabel: isLastCard ? submitLabel : t('carousel.next'), showBack });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isLastCard, submitLabel, showBack, t]);

  return (
    <View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / CARD_KEYS.length) * 100}%` }]} />
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        {currentKey === 'repetition' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardRepetition')}</Text>
            <View style={styles.controlGap}>
              <Stepper
                label={t('settings.maxRepetitionsPerWeek')}
                value={maxReps}
                onChange={setMaxReps}
                min={1}
                max={7}
              />
              <Text style={styles.hintText}>{t('wizard.maxRepetitionsHint')}</Text>
            </View>
            <View style={styles.controlGap}>
              <SwitchRow
                label={t('settings.allowConsecutiveDays')}
                hint={t('settings.allowConsecutiveDaysHint')}
                value={allowConsecutive}
                onChange={setAllowConsecutive}
              />
            </View>
            <View style={styles.controlGap}>
              <SwitchRow
                label={t('settings.allowSameLunchDinner')}
                hint={t('settings.allowSameLunchDinnerHint')}
                value={allowSameLunchDinner}
                onChange={setAllowSameLunchDinner}
              />
            </View>
          </View>
        ) : null}

        {currentKey === 'variety' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardVariety')}</Text>
            <View style={styles.controlGap}>
              <SwitchRow
                label={t('settings.preferPantryItems')}
                hint={t('settings.preferPantryItemsHint')}
                value={preferPantryItems}
                onChange={setPreferPantryItems}
              />
            </View>
            <ChipSelect
              label={t('settings.mealVariety')}
              options={(['low', 'medium', 'high'] as const).map((level) => ({
                value: level,
                label: t(`mealVariety.${level}`),
              }))}
              value={mealVarietyLevel}
              onChange={(v) => setMealVarietyLevel(v as 'low' | 'medium' | 'high')}
            />
            <Text style={styles.hintText}>{t('settings.mealVarietyHint')}</Text>
            <Stepper
              label={t('settings.coldDinnerFrequency')}
              value={coldDinnerFrequencyPerWeek}
              onChange={setColdDinnerFrequencyPerWeek}
              min={0}
              max={7}
            />
            <Text style={styles.hintText}>{t('settings.coldDinnerFrequencyHint')}</Text>
          </View>
        ) : null}

        {currentKey === 'diet' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardDiet')}</Text>
            <ChipSelect
              label={t('wizard.householdDiets')}
              multi
              options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] }))}
              value={diets}
              onChange={setDiets}
            />
            <SwitchRow
              label={t('householdCarousel.mealPrepMode')}
              value={mealPrepMode}
              onChange={setMealPrepMode}
            />
            <Text style={styles.hintText}>{t('householdCarousel.mealPrepModeHint')}</Text>
          </View>
        ) : null}

        {currentKey === 'cuisines' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardCuisines')}</Text>
            <ChipSelect
              label={t('wizard.favoriteCuisines')}
              multi
              options={CUISINE_KEYS.map((key) => ({ value: key, label: t(`cuisines.${key}`), icon: CUISINE_ICONS[key] }))}
              value={favoriteCuisines}
              onChange={setFavoriteCuisines}
            />
          </View>
        ) : null}

        {currentKey === 'avoid' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardAvoid')}</Text>
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
        ) : null}

        {currentKey === 'cookingExperience' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardCookingExperience')}</Text>
            <Text style={styles.hintText}>{t('householdCarousel.cardCookingExperienceHint')}</Text>
            {COOKING_EXPERIENCE_LEVELS.map((level) => (
              <SelectableRow
                key={level}
                title={t(`cookingExperience.${level}`)}
                subtitle={t(`cookingExperience.${level}Hint`)}
                selected={cookingExperienceLevel === level}
                onPress={() => setCookingExperienceLevel(level)}
              />
            ))}
          </View>
        ) : null}

        {currentKey === 'cookingTime' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardCookingTime')}</Text>
            <Text style={styles.hintText}>{t('householdCarousel.cardCookingTimeHint')}</Text>
            {COOKING_TIME_LIMIT_OPTIONS.map((minutes) => {
              const key = minutes === null ? ANY_TIME_KEY : String(minutes);
              return (
                <SelectableRow
                  key={key}
                  title={minutes === null ? t('cookingTime.any') : t('cookingTime.upTo', { minutes })}
                  selected={cookingTimeKey === key}
                  onPress={() => setCookingTimeKey(key)}
                />
              );
            })}
          </View>
        ) : null}

        {currentKey === 'budget' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardBudget')}</Text>
            <Text style={styles.hintText}>{t('householdCarousel.cardBudgetHint')}</Text>
            {BUDGET_LEVELS.map((level) => (
              <SelectableRow
                key={level}
                title={t(`budgetLevel.${level}`)}
                selected={budgetLevel === level}
                onPress={() => setBudgetLevel(level)}
              />
            ))}
          </View>
        ) : null}

        {currentKey === 'notifications' ? (
          <View>
            <Text style={styles.cardTitle}>{t('householdCarousel.cardNotifications')}</Text>
            <Text style={styles.hintText}>{t('householdCarousel.cardNotificationsHint')}</Text>
            <SwitchRow
              label={t('householdCarousel.allowNotifications')}
              value={notificationsEnabled}
              onChange={setNotificationsEnabled}
            />
            {notificationsEnabled ? (
              <View style={styles.controlGap}>
                <TextField
                  label={t('settings.weighInTime')}
                  value={weighInTime}
                  onChangeText={setWeighInTime}
                  placeholder="HH:MM"
                />
                <TextField
                  label={t('settings.planningTime')}
                  value={planningTime}
                  onChangeText={setPlanningTime}
                  placeholder="HH:MM"
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
});

/** Single-select row for the three-option cards (cooking experience / time / budget) – a radio-style list reads clearer than chips when each option also needs a subtitle. */
function SelectableRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.selectableRow, selected && styles.selectableRowSelected]}>
      <View style={styles.selectableRowText}>
        <Text style={[styles.selectableRowTitle, selected && styles.selectableRowTitleSelected]}>{title}</Text>
        {subtitle ? <Text style={styles.selectableRowSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    progressFill: {
      height: 4,
      backgroundColor: colors.primary,
    },
    controlGap: {
      marginBottom: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    hintText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },
    selectableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    selectableRowSelected: {
      borderColor: colors.primary,
    },
    selectableRowText: {
      flex: 1,
      marginRight: spacing.sm,
    },
    selectableRowTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    selectableRowTitleSelected: {
      color: colors.primary,
    },
    selectableRowSubtitle: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
  });
}
