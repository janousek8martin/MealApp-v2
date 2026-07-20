import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BodyFatCarousel } from '@/components/BodyFatCarousel';
import { BodyFatChartModal } from '@/components/BodyFatChartModal';
import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';
import { LifestylePicker } from '@/components/LifestylePicker';
import { NavyCalculatorModal } from '@/components/NavyCalculatorModal';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import { ALLERGEN_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import { ALLERGEN_KEYS, DIET_KEYS } from '@/constants/options';
import type { CreateProfileInput } from '@/db/repositories/profiles';
import { ageYears } from '@/domain/age';
import type { ActivityLevel } from '@/domain/constants';
import { validateGoals } from '@/domain/goals';
import { cmToFeetInches, feetInchesToCm, kgToLbs, lbsToKg } from '@/domain/units';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

export type ProfileFormValue = Omit<CreateProfileInput, 'householdId'>;

/** Small 2-option pill toggle used next to a field label to switch its unit system. */
function UnitToggle({
  value,
  onChange,
  labelA,
  labelB,
}: {
  value: 'metric' | 'us';
  onChange: (value: 'metric' | 'us') => void;
  labelA: string;
  labelB: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createUnitToggleStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={() => onChange('metric')} style={[styles.pill, value === 'metric' && styles.pillActive]}>
        <Text style={[styles.pillLabel, value === 'metric' && styles.pillLabelActive]}>{labelA}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => onChange('us')} style={[styles.pill, value === 'us' && styles.pillActive]}>
        <Text style={[styles.pillLabel, value === 'us' && styles.pillLabelActive]}>{labelB}</Text>
      </Pressable>
    </View>
  );
}

function createUnitToggleStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 4,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    pillLabelActive: {
      color: colors.onPrimary,
    },
  });
}

type Props = {
  submitLabel: string;
  onSubmit: (value: ProfileFormValue) => void;
  initialProfileType?: 'adult' | 'child';
  /** Prefills the form for editing an existing profile; omitted when creating a new one. */
  initialValue?: ProfileFormValue;
  /** When true, ProfileForm does not render its own inline submit button - the parent renders a StepFooter instead and calls submit() via ref. */
  hideInlineSubmit?: boolean;
  /** Called whenever the form's overall validity changes, so a parent-rendered StepFooter can disable its Next button correctly. */
  onValidityChange?: (canSubmit: boolean) => void;
};

export type ProfileFormHandle = { submit: () => void };

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO weekday (1 = Monday .. 7 = Sunday) short labels, localized via a stable reference week. */
function weekdayOptions(language: string): { value: string; label: string }[] {
  const monday = new Date(2026, 6, 6);
  const formatter = new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return { value: String(i + 1), label: formatter.format(day) };
  });
}

export const ProfileForm = forwardRef<ProfileFormHandle, Props>(function ProfileForm(
  { submitLabel, onSubmit, initialProfileType, initialValue, hideInlineSubmit, onValidityChange },
  ref,
) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState(initialValue?.name ?? '');
  const [profileType, setProfileType] = useState<'adult' | 'child'>(
    initialValue?.profileType ?? initialProfileType ?? 'adult',
  );
  const [sex, setSex] = useState<'male' | 'female' | null>(initialValue?.sex ?? null);
  const [birthDate, setBirthDate] = useState(initialValue?.birthDate ?? '');
  const [height, setHeight] = useState(initialValue ? String(initialValue.heightCm) : '');
  const [weight, setWeight] = useState(initialValue ? String(initialValue.weightKg) : '');
  const [heightUnit, setHeightUnit] = useState<'metric' | 'us'>('metric');
  const [weightUnit, setWeightUnit] = useState<'metric' | 'us'>('metric');
  const initialFeetInches = initialValue ? cmToFeetInches(initialValue.heightCm) : null;
  const [heightFeet, setHeightFeet] = useState(
    initialFeetInches ? String(initialFeetInches.feet) : '',
  );
  const [heightInches, setHeightInches] = useState(
    initialFeetInches ? String(Math.round(initialFeetInches.inches * 10) / 10) : '',
  );
  const [weightUsInput, setWeightUsInput] = useState(
    initialValue ? String(Math.round(kgToLbs(initialValue.weightKg) * 10) / 10) : '',
  );
  const [bodyFat, setBodyFat] = useState(initialValue?.bodyFatPct !== undefined ? String(initialValue.bodyFatPct) : '');
  const [activityLevel, setActivityLevel] = useState<string | null>(initialValue?.activityLevel ?? null);
  const [activityMultiplier, setActivityMultiplier] = useState<number | null>(
    initialValue?.activityMultiplier ?? null,
  );
  const [customTdeeKcal, setCustomTdeeKcal] = useState(
    initialValue?.customTdeeKcal !== undefined ? String(initialValue.customTdeeKcal) : '',
  );
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>(initialValue?.goal ?? 'maintain');
  const [goalWeight, setGoalWeight] = useState(
    initialValue?.goalWeightKg !== undefined ? String(initialValue.goalWeightKg) : '',
  );
  const [goalBodyFat, setGoalBodyFat] = useState(
    initialValue?.goalBodyFatPct !== undefined ? String(initialValue.goalBodyFatPct) : '',
  );
  const [fitnessExperience, setFitnessExperience] = useState<string | null>(initialValue?.fitnessExperience ?? null);
  const [sharesMainMeals, setSharesMainMeals] = useState(initialValue?.sharesMainMeals ?? true);
  const [workoutDays, setWorkoutDays] = useState<string[]>(
    (initialValue?.workoutDays ?? []).map(String),
  );
  const [allergens, setAllergens] = useState<string[]>(initialValue?.allergens ?? []);
  const [diets, setDiets] = useState<string[]>(initialValue?.diets ?? []);
  const [navyVisible, setNavyVisible] = useState(false);
  const [bodyFatChartVisible, setBodyFatChartVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isChild = profileType === 'child';

  const heightCm = parseNumber(height);
  const weightKg = parseNumber(weight);
  const bodyFatPct = parseNumber(bodyFat);
  const goalWeightKg = parseNumber(goalWeight);
  const goalBodyFatPct = parseNumber(goalBodyFat);

  const errors = useMemo(() => {
    const map: Record<string, string> = {};
    if (!name.trim()) map.name = t('form.required');
    if (!BIRTH_DATE_RE.test(birthDate)) map.birthDate = t('form.birthDateFormat');
    if (heightCm === null || heightCm < 60 || heightCm > 230) map.height = t('form.heightRange');
    if (weightKg === null || weightKg < 10 || weightKg > 300) map.weight = t('form.weightRange');
    if (bodyFat.trim() !== '' && (bodyFatPct === null || bodyFatPct < 2 || bodyFatPct > 70)) {
      map.bodyFat = t('form.bodyFatRange');
    }

    if (!isChild && weightKg !== null) {
      const goalCheck = validateGoals({
        currentWeightKg: weightKg,
        currentBodyFatPct: bodyFatPct ?? undefined,
        goalWeightKg: goalWeightKg ?? undefined,
        goalBodyFatPct: goalBodyFatPct ?? undefined,
      });
      if (goalCheck.errors.includes('goal_weight_must_not_exceed_current')) {
        map.goalWeight = t('form.goalWeightConflict');
      }
    }
    return map;
  }, [name, birthDate, heightCm, weightKg, bodyFat, bodyFatPct, goalWeightKg, goalBodyFatPct, isChild, t]);

  const canSubmit = Object.keys(errors).length === 0 && sex !== null && activityLevel !== null;

  const handleSubmit = () => {
    setSubmitted(true);
    if (!canSubmit || sex === null || activityLevel === null || heightCm === null || weightKg === null) {
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
      fitnessExperience: (fitnessExperience ?? undefined) as ProfileFormValue['fitnessExperience'],
      sharesMainMeals,
      workoutDays: isChild ? [] : workoutDays.map(Number),
      allergens,
      diets,
    });
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  useEffect(() => {
    onValidityChange?.(canSubmit);
  }, [canSubmit, onValidityChange]);

  const fieldError = (key: string) => (submitted ? errors[key] : undefined);

  return (
    <View>
      <TextField label={t('form.name')} value={name} onChangeText={setName} error={fieldError('name')} />

      <ChipSelect
        label={t('form.profileType')}
        options={[
          { value: 'adult', label: t('form.adult') },
          { value: 'child', label: t('form.child') },
        ]}
        value={profileType}
        onChange={(value) => setProfileType(value as 'adult' | 'child')}
      />

      <ChipSelect
        label={t('form.sex')}
        options={[
          { value: 'male', label: t('form.male') },
          { value: 'female', label: t('form.female') },
        ]}
        value={sex}
        onChange={(value) => setSex(value as 'male' | 'female')}
      />
      {submitted && sex === null ? <Text style={styles.error}>{t('form.required')}</Text> : null}

      <DateOfBirthPicker
        label={t('form.birthDate')}
        value={birthDate}
        onChange={setBirthDate}
        error={fieldError('birthDate')}
      />

      {heightUnit === 'metric' ? (
        <TextField
          label={t('form.height')}
          value={height}
          onChangeText={setHeight}
          keyboardType="decimal-pad"
          suffix="cm"
          error={fieldError('height')}
          labelRight={<UnitToggle value={heightUnit} onChange={setHeightUnit} labelA="cm" labelB="ft/in" />}
        />
      ) : (
        <View>
          <View style={styles.unitToggleRow}>
            <Text style={styles.label}>{t('form.height')}</Text>
            <UnitToggle value={heightUnit} onChange={setHeightUnit} labelA="cm" labelB="ft/in" />
          </View>
          <View style={styles.imperialRow}>
            <View style={styles.imperialField}>
              <TextField
                label={t('form.feet')}
                value={heightFeet}
                onChangeText={(text) => {
                  setHeightFeet(text);
                  const feet = parseNumber(text) ?? 0;
                  const inches = parseNumber(heightInches) ?? 0;
                  setHeight(String(Math.round(feetInchesToCm(feet, inches) * 10) / 10));
                }}
                keyboardType="decimal-pad"
                suffix="ft"
              />
            </View>
            <View style={styles.imperialField}>
              <TextField
                label={t('form.inches')}
                value={heightInches}
                onChangeText={(text) => {
                  setHeightInches(text);
                  const feet = parseNumber(heightFeet) ?? 0;
                  const inches = parseNumber(text) ?? 0;
                  setHeight(String(Math.round(feetInchesToCm(feet, inches) * 10) / 10));
                }}
                keyboardType="decimal-pad"
                suffix="in"
              />
            </View>
          </View>
          {fieldError('height') ? <Text style={styles.error}>{fieldError('height')}</Text> : null}
        </View>
      )}

      {weightUnit === 'metric' ? (
        <TextField
          label={t('form.weight')}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          suffix="kg"
          error={fieldError('weight')}
          labelRight={<UnitToggle value={weightUnit} onChange={setWeightUnit} labelA="kg" labelB="lb" />}
        />
      ) : (
        <TextField
          label={t('form.weight')}
          value={weightUsInput}
          onChangeText={(text) => {
            setWeightUsInput(text);
            const lbs = parseNumber(text);
            if (lbs !== null) setWeight(String(Math.round(lbsToKg(lbs) * 10) / 10));
          }}
          keyboardType="decimal-pad"
          suffix="lb"
          error={fieldError('weight')}
          labelRight={<UnitToggle value={weightUnit} onChange={setWeightUnit} labelA="kg" labelB="lb" />}
        />
      )}

      {!isChild ? (
        <>
          <TextField
            label={t('form.bodyFat')}
            value={bodyFat}
            onChangeText={setBodyFat}
            keyboardType="decimal-pad"
            suffix="%"
            error={fieldError('bodyFat')}
            labelRight={
              <Pressable
                accessibilityRole="button"
                onPress={() => setBodyFatChartVisible(true)}
                hitSlop={8}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              </Pressable>
            }
          />
          {sex ? (
            <BodyFatCarousel
              sex={sex}
              value={bodyFatPct}
              onSelect={(value) => setBodyFat(String(value))}
            />
          ) : null}
          <Button
            label={t('navy.open')}
            variant="secondary"
            onPress={() => setNavyVisible(true)}
            style={styles.bodyFatActionButton}
          />
        </>
      ) : null}

      <LifestylePicker
        value={activityLevel as ActivityLevel | null}
        onChange={(level) => {
          setActivityLevel(level);
          setActivityMultiplier(null);
        }}
        multiplier={activityMultiplier}
        onChangeMultiplier={setActivityMultiplier}
        customTdeeKcal={customTdeeKcal}
        onChangeCustomTdeeKcal={setCustomTdeeKcal}
        error={submitted && activityLevel === null ? t('form.required') : undefined}
      />

      {!isChild ? (
        <>
          <ChipSelect
            label={t('form.goal')}
            options={[
              { value: 'lose', label: t('goal.lose') },
              { value: 'maintain', label: t('goal.maintain') },
              { value: 'gain', label: t('goal.gain') },
            ]}
            value={goal}
            onChange={(value) => setGoal(value as 'lose' | 'maintain' | 'gain')}
          />
          {goal !== 'maintain' ? (
            <>
              <TextField
                label={t('form.goalWeight')}
                value={goalWeight}
                onChangeText={setGoalWeight}
                keyboardType="decimal-pad"
                suffix="kg"
                error={fieldError('goalWeight')}
              />
              <TextField
                label={t('form.goalBodyFat')}
                value={goalBodyFat}
                onChangeText={setGoalBodyFat}
                keyboardType="decimal-pad"
                suffix="%"
                labelRight={
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setBodyFatChartVisible(true)}
                    hitSlop={8}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                  </Pressable>
                }
              />
              {sex ? (
                <BodyFatCarousel
                  sex={sex}
                  value={goalBodyFatPct}
                  onSelect={(value) => setGoalBodyFat(String(value))}
                />
              ) : null}
              {goal === 'gain' && bodyFatPct === null ? (
                <Text style={styles.workoutDaysHint}>{t('form.recompositionHint')}</Text>
              ) : null}
            </>
          ) : null}
          <ChipSelect
            label={t('form.fitnessExperience')}
            options={[
              { value: 'beginner', label: t('fitness.beginner') },
              { value: 'intermediate', label: t('fitness.intermediate') },
              { value: 'advanced', label: t('fitness.advanced') },
            ]}
            value={fitnessExperience}
            onChange={setFitnessExperience}
          />
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
                    setWorkoutDays(
                      selected
                        ? workoutDays.filter((value) => value !== day.value)
                        : [...workoutDays, day.value],
                    )
                  }
                  style={[styles.weekdayChip, selected && styles.weekdayChipSelected]}>
                  <Text style={[styles.weekdayChipLabel, selected && styles.weekdayChipLabelSelected]}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.workoutDaysHint}>{t('form.workoutDaysHint')}</Text>
        </>
      ) : null}

      <ChipSelect
        label={t('form.allergens')}
        multi
        options={ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`), icon: ALLERGEN_ICONS[key] }))}
        value={allergens}
        onChange={setAllergens}
      />
      <ChipSelect
        label={t('form.diets')}
        multi
        options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] }))}
        value={diets}
        onChange={setDiets}
      />

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>{t('form.sharesMainMeals')}</Text>
          <Text style={styles.switchHint}>{t('form.sharesMainMealsHint')}</Text>
        </View>
        <Switch
          value={sharesMainMeals}
          onValueChange={setSharesMainMeals}
          trackColor={{ true: colors.interactive, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>

      {!hideInlineSubmit ? <Button label={submitLabel} onPress={handleSubmit} style={styles.submit} /> : null}

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
      <BodyFatChartModal
        visible={bodyFatChartVisible}
        sex={sex ?? 'male'}
        onClose={() => setBodyFatChartVisible(false)}
        currentValuePct={bodyFatPct ?? undefined}
        currentAge={BIRTH_DATE_RE.test(birthDate) ? ageYears(birthDate) : undefined}
      />
    </View>
  );
});

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    error: {
      color: colors.danger,
      fontSize: typography.small,
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
    },
    bodyFatActionButton: {
      marginBottom: spacing.md,
    },
    unitToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    imperialRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    imperialField: {
      flex: 1,
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
    workoutDaysHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    switchText: {
      flex: 1,
      paddingRight: spacing.md,
    },
    switchLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    switchHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    submit: {
      marginBottom: spacing.xl,
    },
  });
}
