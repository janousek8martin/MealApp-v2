import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BodyFatCarousel } from '@/components/BodyFatCarousel';
import { BodyFatChartModal } from '@/components/BodyFatChartModal';
import { NavyCalculatorModal } from '@/components/NavyCalculatorModal';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import type { CreateProfileInput } from '@/db/repositories/profiles';
import { validateGoals } from '@/domain/goals';
import { colors, spacing, typography } from '@/theme/tokens';

export type ProfileFormValue = Omit<CreateProfileInput, 'householdId'>;

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;

type Props = {
  submitLabel: string;
  onSubmit: (value: ProfileFormValue) => void;
  initialProfileType?: 'adult' | 'child';
  /** Prefills the form for editing an existing profile; omitted when creating a new one. */
  initialValue?: ProfileFormValue;
};

const ALLERGEN_KEYS = ['gluten', 'lactose', 'eggs', 'nuts', 'peanuts', 'fish', 'shellfish', 'soy'];
const DIET_KEYS = ['vegetarian', 'vegan', 'pescatarian'];

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

export function ProfileForm({ submitLabel, onSubmit, initialProfileType, initialValue }: Props) {
  const { t, i18n } = useTranslation();

  const [name, setName] = useState(initialValue?.name ?? '');
  const [profileType, setProfileType] = useState<'adult' | 'child'>(
    initialValue?.profileType ?? initialProfileType ?? 'adult',
  );
  const [sex, setSex] = useState<'male' | 'female' | null>(initialValue?.sex ?? null);
  const [birthDate, setBirthDate] = useState(initialValue?.birthDate ?? '');
  const [height, setHeight] = useState(initialValue ? String(initialValue.heightCm) : '');
  const [weight, setWeight] = useState(initialValue ? String(initialValue.weightKg) : '');
  const [bodyFat, setBodyFat] = useState(initialValue?.bodyFatPct !== undefined ? String(initialValue.bodyFatPct) : '');
  const [activityLevel, setActivityLevel] = useState<string | null>(initialValue?.activityLevel ?? null);
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
  const [activityInfoVisible, setActivityInfoVisible] = useState(false);
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

      <TextField
        label={t('form.birthDate')}
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="1990-05-21"
        error={fieldError('birthDate')}
      />
      <TextField
        label={t('form.height')}
        value={height}
        onChangeText={setHeight}
        keyboardType="decimal-pad"
        suffix="cm"
        error={fieldError('height')}
      />
      <TextField
        label={t('form.weight')}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        suffix="kg"
        error={fieldError('weight')}
      />

      {!isChild ? (
        <>
          <TextField
            label={t('form.bodyFat')}
            value={bodyFat}
            onChangeText={setBodyFat}
            keyboardType="decimal-pad"
            suffix="%"
            error={fieldError('bodyFat')}
          />
          {sex ? (
            <BodyFatCarousel
              sex={sex}
              value={bodyFatPct}
              onSelect={(value) => setBodyFat(String(value))}
            />
          ) : null}
          <View style={styles.bodyFatActions}>
            <Button
              label={t('navy.open')}
              variant="secondary"
              onPress={() => setNavyVisible(true)}
              style={styles.bodyFatActionButton}
            />
            <Button
              label={t('bodyFatChart.open')}
              variant="secondary"
              onPress={() => setBodyFatChartVisible(true)}
              style={styles.bodyFatActionButton}
            />
          </View>
        </>
      ) : null}

      <ChipSelect
        label={t('form.activity')}
        options={[
          { value: 'sedentary', label: t('activity.sedentary') },
          { value: 'light', label: t('activity.light') },
          { value: 'moderate', label: t('activity.moderate') },
          { value: 'active', label: t('activity.active') },
          { value: 'very_active', label: t('activity.very_active') },
        ]}
        value={activityLevel}
        onChange={setActivityLevel}
      />
      {submitted && activityLevel === null ? (
        <Text style={styles.error}>{t('form.required')}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setActivityInfoVisible((prev) => !prev)}
        style={styles.infoToggle}>
        <Text style={styles.infoToggleLabel}>
          {activityInfoVisible ? t('form.hideActivityInfo') : t('form.showActivityInfo')}
        </Text>
      </Pressable>
      {activityInfoVisible ? (
        <View style={styles.infoCard}>
          {ACTIVITY_LEVELS.map((level) => (
            <Text key={level} style={styles.infoLine}>
              <Text style={styles.infoLineLabel}>{t(`activity.${level}`)}: </Text>
              {t(`activityInfo.${level}`)}
            </Text>
          ))}
        </View>
      ) : null}

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
              />
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
          <ChipSelect
            label={t('form.workoutDays')}
            multi
            options={weekdayOptions(i18n.language)}
            value={workoutDays}
            onChange={setWorkoutDays}
          />
          <Text style={styles.workoutDaysHint}>{t('form.workoutDaysHint')}</Text>
        </>
      ) : null}

      <ChipSelect
        label={t('form.allergens')}
        multi
        options={ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`) }))}
        value={allergens}
        onChange={setAllergens}
      />
      <ChipSelect
        label={t('form.diets')}
        multi
        options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`) }))}
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
          trackColor={{ true: colors.primaryLight, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>

      <Button label={submitLabel} onPress={handleSubmit} style={styles.submit} />

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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: typography.small,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  bodyFatActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bodyFatActionButton: {
    flex: 1,
  },
  infoToggle: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  infoToggleLabel: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  infoLine: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  infoLineLabel: {
    color: colors.text,
    fontWeight: '700',
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
