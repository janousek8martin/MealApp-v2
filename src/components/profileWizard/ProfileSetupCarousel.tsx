import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { BodyFatCarousel } from '@/components/BodyFatCarousel';
import { BodyFatChartModal } from '@/components/BodyFatChartModal';
import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';
import { DietRadioList } from '@/components/DietRadioList';
import { GoalReviewCard } from '@/components/GoalReviewCard';
import { LifestylePicker } from '@/components/LifestylePicker';
import { MealSlotsPicker } from '@/components/MealSlotsPicker';
import { NavyCalculatorModal } from '@/components/NavyCalculatorModal';
import type { ProfileFormValue } from '@/components/ProfileForm';
import { WeightProjectionChart } from '@/components/WeightProjectionChart';
import { todayIsoDate } from '@/db/time';
import { Button } from '@/components/ui/Button';
import { ChipSelect, resolveChipSelectTap } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { ALLERGEN_ICONS } from '@/constants/chipIcons';
import { ALLERGEN_KEYS } from '@/constants/options';
import { SPEED_PRESETS_GAIN, SPEED_PRESETS_LOSE_PCT_BW, type ActivityLevel } from '@/domain/constants';
import { ageYears } from '@/domain/age';
import { computeWeightProjection } from '@/domain/projection';
import { computeTargets } from '@/domain/targets';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const CARD_KEYS = [
  'basics',
  'body',
  'goal',
  'tempo',
  'goalReview',
  'lifestyle',
  'training',
  'meals',
  'water',
  'allergens',
  'diet',
  'summary',
] as const;
type CardKey = (typeof CARD_KEYS)[number];

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Mirrors BODY_FAT_PCT_RANGE in db/repositories/profiles.ts - createProfile
// rejects anything outside this range, so the carousel must gate on it too
// instead of letting the user reach "Finish" with a value the save will throw on.
const BODY_FAT_PCT_RANGE: [number, number] = [3, 70];

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

function weekdayOptions(language: string): { value: string; label: string }[] {
  const monday = new Date(2026, 6, 6);
  const formatter = new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return { value: String(i + 1), label: formatter.format(day) };
  });
}

type Props = {
  householdId: string;
  submitLabel: string;
  onSubmit: (value: ProfileFormValue) => void;
  initialProfileType?: 'adult' | 'child';
};

/**
 * The wizard's profile-creation flow as a swipeable carousel of single-topic
 * cards (see plan file), instead of one long scrolling form - the long form
 * (ProfileForm) still exists for editing an existing profile. Navigation is
 * Next/Back-button-driven (animated slide) rather than a raw swipe gesture,
 * so each card's validity can gate progression.
 */
export function ProfileSetupCarousel({ householdId, submitLabel, onSubmit, initialProfileType }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState<'adult' | 'child'>(initialProfileType ?? 'adult');
  const [sex, setSex] = useState<'male' | 'female' | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [sharesMainMeals, setSharesMainMeals] = useState(true);

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [navyVisible, setNavyVisible] = useState(false);
  const [bodyFatChartVisible, setBodyFatChartVisible] = useState(false);

  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [goalWeight, setGoalWeight] = useState('');
  const [goalBodyFat, setGoalBodyFat] = useState('');

  const [tempoPreset, setTempoPreset] = useState<'slow' | 'recommended' | 'fast'>('recommended');
  const [customRate, setCustomRate] = useState<number | null>(null);

  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [activityMultiplier, setActivityMultiplier] = useState<number | null>(null);
  const [customTdeeKcal, setCustomTdeeKcal] = useState('');

  const [fitnessExperience, setFitnessExperience] = useState<string | null>(null);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);

  const [enabledSlotKeys, setEnabledSlotKeys] = useState<string[] | null>(null);
  const [trackWater, setTrackWater] = useState(true);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);

  const [submitted, setSubmitted] = useState(false);
  const [currentKey, setCurrentKey] = useState<CardKey>('basics');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isChild = profileType === 'child';

  const heightCm = parseNumber(height);
  const weightKg = parseNumber(weight);
  const bodyFatPct = parseNumber(bodyFat);
  const goalWeightKg = parseNumber(goalWeight);
  const goalBodyFatPct = parseNumber(goalBodyFat);

  const cardKeys = useMemo<CardKey[]>(() => {
    return CARD_KEYS.filter((key) => {
      if (isChild && (key === 'goal' || key === 'tempo' || key === 'goalReview' || key === 'training')) return false;
      if (!isChild && key === 'tempo' && goal === 'maintain') return false;
      if (key === 'goalReview' && (goal === 'maintain' || goalWeightKg === null)) return false;
      if (key === 'diet' && sharesMainMeals) return false;
      return true;
    });
  }, [isChild, goal, goalWeightKg, sharesMainMeals]);

  const index = Math.max(0, cardKeys.indexOf(currentKey));

  // A single rate (kg/week, magnitude) drives both the preset pills and the
  // fine-tune stepper - the preset just sets the starting value.
  const presetRateKgPerWeek =
    goal === 'lose'
      ? (weightKg ?? 0) * SPEED_PRESETS_LOSE_PCT_BW[tempoPreset]
      : SPEED_PRESETS_GAIN[tempoPreset] === undefined
        ? 0
        : // Gain presets are flat kcal, not a rate - approximate a kg/week
          // equivalent just for the stepper's starting point (≈7700 kcal/kg).
          SPEED_PRESETS_GAIN[tempoPreset] / (7700 / 7);
  const rateKgPerWeek = customRate ?? presetRateKgPerWeek;

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

  const canProceed = (key: CardKey): boolean => {
    switch (key) {
      case 'basics':
        return (
          name.trim() !== '' &&
          sex !== null &&
          BIRTH_DATE_RE.test(birthDate) &&
          heightCm !== null &&
          heightCm >= 60 &&
          heightCm <= 230
        );
      case 'body':
        return (
          weightKg !== null &&
          weightKg >= 10 &&
          weightKg <= 300 &&
          (bodyFatPct === null || (bodyFatPct >= BODY_FAT_PCT_RANGE[0] && bodyFatPct <= BODY_FAT_PCT_RANGE[1]))
        );
      case 'lifestyle':
        return activityLevel !== null;
      default:
        return true;
    }
  };

  const goNext = () => {
    setSubmitted(true);
    if (!canProceed(currentKey)) return;
    setSubmitted(false);
    const next = cardKeys[index + 1];
    if (next) goToCard(next, 1);
  };

  const goBack = () => {
    const prev = cardKeys[index - 1];
    if (prev) goToCard(prev, -1);
  };

  const handleSubmit = () => {
    if (!canProceed(currentKey) || sex === null || activityLevel === null || heightCm === null || weightKg === null) {
      return;
    }
    onSubmit({
      name: name.trim(),
      profileType,
      sex,
      birthDate,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPct ?? undefined,
      activityLevel: activityLevel as ProfileFormValue['activityLevel'],
      activityMultiplier,
      customTdeeKcal: parseNumber(customTdeeKcal) ?? undefined,
      goal: isChild ? 'maintain' : goal,
      goalWeightKg: isChild ? undefined : (goalWeightKg ?? undefined),
      goalBodyFatPct: isChild ? undefined : (goalBodyFatPct ?? undefined),
      goalRateKgPerWeek: isChild || goal === 'maintain' ? undefined : rateKgPerWeek,
      fitnessExperience: (fitnessExperience ?? undefined) as ProfileFormValue['fitnessExperience'],
      sharesMainMeals,
      workoutDays: isChild ? [] : workoutDays.map(Number),
      allergens,
      diets,
      trackWater,
      enabledSlotKeys: enabledSlotKeys ?? undefined,
    });
  };

  const targets = useMemo(() => {
    if (sex === null || heightCm === null || weightKg === null || activityLevel === null) return null;
    return computeTargets({
      profileType,
      sex,
      ageYears: BIRTH_DATE_RE.test(birthDate) ? ageYears(birthDate) : 25,
      heightCm,
      weightKg,
      bodyFatPct: bodyFatPct ?? undefined,
      activityLevel: activityLevel as ProfileFormValue['activityLevel'],
      activityMultiplier,
      customTdeeKcal: parseNumber(customTdeeKcal) ?? undefined,
      goal: isChild ? 'maintain' : goal,
      goalBodyFatPct: isChild ? undefined : (goalBodyFatPct ?? undefined),
      goalRateKgPerWeek: isChild || goal === 'maintain' ? undefined : rateKgPerWeek,
      fitnessExperience: (fitnessExperience ?? undefined) as
        | 'beginner'
        | 'intermediate'
        | 'advanced'
        | undefined,
    });
  }, [
    sex,
    heightCm,
    weightKg,
    activityLevel,
    activityMultiplier,
    customTdeeKcal,
    profileType,
    birthDate,
    bodyFatPct,
    isChild,
    goal,
    goalBodyFatPct,
    rateKgPerWeek,
    fitnessExperience,
  ]);

  const projection = useMemo(() => {
    if (weightKg === null || isChild || goal === 'maintain' || goalWeightKg === null || rateKgPerWeek <= 0) {
      return null;
    }
    return computeWeightProjection(weightKg, goalWeightKg, rateKgPerWeek, sex ?? undefined, bodyFatPct ?? undefined);
  }, [weightKg, isChild, goal, goalWeightKg, rateKgPerWeek, sex, bodyFatPct]);

  const isLastCard = currentKey === 'summary';

  return (
    <View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / cardKeys.length) * 100}%` }]} />
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        {currentKey === 'basics' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardBasics')}</Text>
            <TextField label={t('form.name')} value={name} onChangeText={setName} error={submitted && !name.trim() ? t('form.required') : undefined} />
            <ChipSelect
              label={t('form.sex')}
              options={[
                { value: 'male', label: t('form.male') },
                { value: 'female', label: t('form.female') },
              ]}
              value={sex}
              onChange={(v) => setSex(v as 'male' | 'female')}
            />
            {submitted && sex === null ? <Text style={styles.error}>{t('form.required')}</Text> : null}
            <DateOfBirthPicker
              label={t('form.birthDate')}
              value={birthDate}
              onChange={setBirthDate}
              error={submitted && !BIRTH_DATE_RE.test(birthDate) ? t('form.birthDateFormat') : undefined}
            />
            <TextField
              label={t('form.height')}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              suffix="cm"
              error={submitted && (heightCm === null || heightCm < 60 || heightCm > 230) ? t('form.heightRange') : undefined}
            />
            <SwitchRow
              label={t('form.sharesMainMeals')}
              hint={t('form.sharesMainMealsHint')}
              value={sharesMainMeals}
              onChange={setSharesMainMeals}
            />
          </View>
        ) : null}

        {currentKey === 'body' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardBody')}</Text>
            <TextField
              label={t('form.weight')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              suffix="kg"
              error={submitted && (weightKg === null || weightKg < 10 || weightKg > 300) ? t('form.weightRange') : undefined}
            />
            <TextField
              label={t('form.bodyFat')}
              value={bodyFat}
              onChangeText={setBodyFat}
              keyboardType="decimal-pad"
              suffix="%"
              error={
                submitted && bodyFatPct !== null && (bodyFatPct < BODY_FAT_PCT_RANGE[0] || bodyFatPct > BODY_FAT_PCT_RANGE[1])
                  ? t('form.bodyFatRange')
                  : undefined
              }
              labelRight={
                <Pressable accessibilityRole="button" onPress={() => setBodyFatChartVisible(true)} hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                </Pressable>
              }
            />
            {sex ? <BodyFatCarousel sex={sex} value={bodyFatPct} onSelect={(v) => setBodyFat(String(v))} /> : null}
            <Button label={t('navy.open')} variant="secondary" onPress={() => setNavyVisible(true)} style={styles.secondaryAction} />
          </View>
        ) : null}

        {currentKey === 'goal' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardGoal')}</Text>
            <ChipSelect
              label={t('form.goal')}
              options={[
                { value: 'lose', label: t('goal.lose') },
                { value: 'maintain', label: t('goal.maintain') },
                { value: 'gain', label: t('goal.gain') },
              ]}
              value={goal}
              onChange={(v) => setGoal(v as 'lose' | 'maintain' | 'gain')}
            />
            {goal !== 'maintain' ? (
              <>
                <TextField label={t('form.goalWeight')} value={goalWeight} onChangeText={setGoalWeight} keyboardType="decimal-pad" suffix="kg" />
                <TextField
                  label={t('form.goalBodyFat')}
                  value={goalBodyFat}
                  onChangeText={setGoalBodyFat}
                  keyboardType="decimal-pad"
                  suffix="%"
                  labelRight={
                    <Pressable accessibilityRole="button" onPress={() => setBodyFatChartVisible(true)} hitSlop={8}>
                      <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                    </Pressable>
                  }
                />
                {sex ? <BodyFatCarousel sex={sex} value={goalBodyFatPct} onSelect={(v) => setGoalBodyFat(String(v))} /> : null}
                {goal === 'gain' && bodyFatPct === null ? (
                  <Text style={styles.hintText}>{t('form.recompositionHint')}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {currentKey === 'tempo' ? (
          <View>
            <Text style={styles.cardTitle}>{t('tempo.title')}</Text>
            <Text style={styles.hintText}>{t(goal === 'lose' ? 'tempo.hintLose' : 'tempo.hintGain')}</Text>
            <ChipSelect
              label=""
              options={[
                { value: 'slow', label: t('tempo.slow') },
                { value: 'recommended', label: t('tempo.recommended') },
                { value: 'fast', label: t('tempo.fast') },
              ]}
              value={tempoPreset}
              onChange={(v) => {
                setTempoPreset(v as 'slow' | 'recommended' | 'fast');
                setCustomRate(null);
              }}
            />
            <View style={styles.proConBox}>
              <Text style={styles.proConLine}>
                <Text style={styles.proConLabel}>{t('common.pro')} </Text>
                {t(`tempo.${tempoPreset}Pro${goal === 'lose' ? 'Lose' : 'Gain'}`)}
              </Text>
              <Text style={styles.proConLine}>
                <Text style={styles.proConLabel}>{t('common.con')} </Text>
                {t(`tempo.${tempoPreset}Con${goal === 'lose' ? 'Lose' : 'Gain'}`)}
              </Text>
            </View>
            <View style={styles.rateRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.rateButton}
                onPress={() => setCustomRate(Math.max(0.1, Math.round((rateKgPerWeek - 0.1) * 10) / 10))}>
                <Ionicons name="remove" size={18} color={colors.primary} />
              </Pressable>
              <Text style={styles.rateValue}>
                {rateKgPerWeek.toFixed(1)} {t('tempo.perWeek')}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.rateButton}
                onPress={() => setCustomRate(Math.round((rateKgPerWeek + 0.1) * 10) / 10)}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {currentKey === 'goalReview' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardGoalReview')}</Text>
            {weightKg !== null && goalWeightKg !== null ? (
              <GoalReviewCard currentWeightKg={weightKg} goalWeightKg={goalWeightKg} />
            ) : null}
          </View>
        ) : null}

        {currentKey === 'lifestyle' ? (
          <View>
            <LifestylePicker
              value={activityLevel as ActivityLevel | null}
              onChange={setActivityLevel}
              multiplier={activityMultiplier}
              onChangeMultiplier={setActivityMultiplier}
              customTdeeKcal={customTdeeKcal}
              onChangeCustomTdeeKcal={setCustomTdeeKcal}
              error={submitted && activityLevel === null ? t('form.required') : undefined}
            />
          </View>
        ) : null}

        {currentKey === 'training' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardTraining')}</Text>
            <View style={styles.controlGap}>
              <ChipSelect
                label={t('form.fitnessExperience')}
                options={[
                  { value: 'beginner', label: t('fitness.beginner') },
                  { value: 'intermediate', label: t('fitness.intermediate') },
                  { value: 'advanced', label: t('fitness.advanced') },
                ]}
                value={fitnessExperience}
                onChange={(v) => setFitnessExperience(resolveChipSelectTap(fitnessExperience, v, true))}
              />
            </View>
            <View style={styles.controlGap}>
              <Text style={styles.weekdayLabel}>{t('form.workoutDays')}</Text>
              <View style={styles.weekdayGrid}>
                {weekdayOptions(i18n.language).map((day) => {
                  const selected = workoutDays.includes(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setWorkoutDays(selected ? workoutDays.filter((v) => v !== day.value) : [...workoutDays, day.value])
                      }
                      style={[styles.weekdayChip, selected && styles.weekdayChipSelected]}>
                      <Text style={[styles.weekdayChipLabel, selected && styles.weekdayChipLabelSelected]}>{day.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hintText}>{t('form.workoutDaysHint')}</Text>
            </View>
          </View>
        ) : null}

        {currentKey === 'meals' ? (
          <MealSlotsPicker
            householdId={householdId}
            sharesMainMeals={sharesMainMeals}
            value={enabledSlotKeys}
            onChange={setEnabledSlotKeys}
          />
        ) : null}

        {currentKey === 'water' ? (
          <View>
            <Text style={styles.cardTitle}>{t('water.title')}</Text>
            <Text style={styles.hintText}>{t('water.hint')}</Text>
            {(
              [
                { icon: 'flash-outline' as const, titleKey: 'water.benefitMetabolismTitle', bodyKey: 'water.benefitMetabolismBody' },
                { icon: 'battery-charging-outline' as const, titleKey: 'water.benefitEnergyTitle', bodyKey: 'water.benefitEnergyBody' },
                { icon: 'restaurant-outline' as const, titleKey: 'water.benefitRecoveryTitle', bodyKey: 'water.benefitRecoveryBody' },
              ]
            ).map((row) => (
              <View key={row.titleKey} style={styles.benefitRow}>
                <View style={styles.benefitIconWrap}>
                  <Ionicons name={row.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{t(row.titleKey)}</Text>
                  <Text style={styles.benefitBody}>{t(row.bodyKey)}</Text>
                </View>
              </View>
            ))}
            <SwitchRow label={t('water.toggle')} value={trackWater} onChange={setTrackWater} />
          </View>
        ) : null}

        {currentKey === 'allergens' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardAllergens')}</Text>
            <ChipSelect
              label={t('form.allergens')}
              multi
              options={ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`), icon: ALLERGEN_ICONS[key] }))}
              value={allergens}
              onChange={setAllergens}
            />
          </View>
        ) : null}

        {currentKey === 'diet' ? (
          <View>
            <Text style={styles.cardTitle}>{t('carousel.cardDiet')}</Text>
            <DietRadioList
              value={diets[0] ?? null}
              onChange={(key) => setDiets(key ? [key] : [])}
              recommendedKey="mediterranean"
            />
          </View>
        ) : null}

        {currentKey === 'summary' ? (
          <View>
            <Text style={styles.cardTitle}>{t('summary.title')}</Text>
            {targets ? (
              <>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryKcal}>{Math.round(targets.adjustedTdciKcal)} kcal</Text>
                  <Text style={styles.summaryLabel}>{t('summary.dailyTarget')}</Text>
                  <View style={styles.summaryMacrosRow}>
                    <Text style={styles.summaryMacro}>{Math.round(targets.macros.proteinG)} g {t('macros.protein')}</Text>
                    <Text style={styles.summaryMacro}>{Math.round(targets.macros.carbsG)} g {t('macros.carbs')}</Text>
                    <Text style={styles.summaryMacro}>{Math.round(targets.macros.fatG)} g {t('macros.fat')}</Text>
                  </View>
                  {targets.mode === 'recomposition' ? (
                    <Text style={styles.hintText}>{t('summary.recompositionNote')}</Text>
                  ) : null}
                </View>
                {projection ? (
                  <>
                    <Text style={styles.weekdayLabel}>{t('summary.projectionTitle')}</Text>
                    <WeightProjectionChart projection={projection} startDateIso={todayIsoDate()} />
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.navRow}>
        {index > 0 ? (
          <Button label={t('carousel.back')} variant="secondary" onPress={goBack} style={styles.navButton} />
        ) : (
          <View style={styles.navButton} />
        )}
        <Button
          label={isLastCard ? submitLabel : t('carousel.next')}
          onPress={isLastCard ? handleSubmit : goNext}
          style={styles.navButton}
        />
      </View>

      <BodyFatChartModal visible={bodyFatChartVisible} sex={sex ?? 'male'} onClose={() => setBodyFatChartVisible(false)} />
      <NavyCalculatorModal
        visible={navyVisible}
        sex={sex ?? 'male'}
        heightCm={heightCm}
        onClose={() => setNavyVisible(false)}
        onUse={(pct) => {
          setBodyFat(String(pct));
          setNavyVisible(false);
        }}
      />
    </View>
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
    proConBox: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    proConLine: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
      marginBottom: 2,
    },
    proConLabel: {
      fontWeight: '700',
      color: colors.text,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.card - 6,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    benefitIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitText: {
      flex: 1,
    },
    benefitTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    benefitBody: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 1,
    },
    cardTitle: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    error: {
      color: colors.danger,
      fontSize: typography.small,
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
    },
    hintText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },
    secondaryAction: {
      marginBottom: spacing.md,
    },
    rateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    rateButton: {
      width: 40,
      height: 40,
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rateValue: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      minWidth: 100,
      textAlign: 'center',
    },
    weekdayLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    weekdayGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    weekdayChip: {
      width: '22%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      minHeight: 44,
    },
    weekdayChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    weekdayChipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '500',
      textAlign: 'center',
      textTransform: 'capitalize',
    },
    weekdayChipLabelSelected: {
      color: colors.onPrimary,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    summaryKcal: {
      color: colors.text,
      fontSize: typography.hero,
      fontWeight: '800',
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },
    summaryMacrosRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    summaryMacro: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    navRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    navButton: {
      flex: 1,
    },
  });
}
