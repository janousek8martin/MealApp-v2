import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateProfile, updateProfileMacroOverrides, updateTdciManualAdjustment, type MacroOverrides } from '@/db/repositories/profiles';
import { PROTEIN_PER_KG_LBM, FAT_SHARE_DEFAULT, SURPLUS_KCAL_DEFAULT } from '@/domain/constants';
import { useLatestBodyMetric, useProfile, useProfileRestrictions, useProfileTargets } from '@/hooks/data';
import { TdciCard } from '@/components/TdciCard';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

function parseMacroOverrides(json: string | null): MacroOverrides {
  if (!json) return {};
  try {
    return JSON.parse(json) as MacroOverrides;
  } catch {
    return {};
  }
}

function ManualAdjustmentCard({ profileId, kcal }: { profileId: string; kcal: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('profile.manualAdjustment')}</Text>
      <Text style={styles.cardHint}>{t('profile.manualAdjustmentHint')}</Text>
      <View style={styles.stepperRow}>
        <Text style={styles.stepperValue}>
          {kcal > 0 ? '+' : ''}
          {kcal} kcal
        </Text>
        <View style={styles.stepper}>
          <Button
            variant="secondary"
            label="–"
            style={styles.stepperButton}
            onPress={() => void updateTdciManualAdjustment(db, profileId, kcal - 100)}
          />
          <Button
            variant="secondary"
            label="+"
            style={styles.stepperButton}
            onPress={() => void updateTdciManualAdjustment(db, profileId, kcal + 100)}
          />
        </View>
      </View>
    </View>
  );
}

function MacroOverridesCard({ profileId, macroOverridesJson }: { profileId: string; macroOverridesJson: string | null }) {
  const { t } = useTranslation();
  const overrides = parseMacroOverrides(macroOverridesJson);
  const [protein, setProtein] = useState(overrides.proteinPerKgLbm !== undefined ? String(overrides.proteinPerKgLbm) : '');
  const [fatShare, setFatShare] = useState(
    overrides.fatShareOfTdci !== undefined ? String(Math.round(overrides.fatShareOfTdci * 100)) : '',
  );
  const [surplus, setSurplus] = useState(overrides.surplusKcal !== undefined ? String(overrides.surplusKcal) : '');

  const save = async () => {
    const next: MacroOverrides = {};
    const proteinNum = num(protein);
    const fatShareNum = num(fatShare);
    const surplusNum = num(surplus);
    if (proteinNum !== null) next.proteinPerKgLbm = proteinNum;
    if (fatShareNum !== null) next.fatShareOfTdci = fatShareNum / 100;
    if (surplusNum !== null) next.surplusKcal = surplusNum;
    await updateProfileMacroOverrides(db, profileId, Object.keys(next).length > 0 ? next : null);
  };

  const reset = async () => {
    setProtein('');
    setFatShare('');
    setSurplus('');
    await updateProfileMacroOverrides(db, profileId, null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('settings.macroOverrides')}</Text>
      <Text style={styles.cardHint}>{t('settings.macroOverridesHint')}</Text>
      <TextField
        label={t('settings.proteinPerKgLbm')}
        value={protein}
        onChangeText={setProtein}
        keyboardType="decimal-pad"
        placeholder={String(PROTEIN_PER_KG_LBM.normalDefault)}
        suffix="g/kg"
      />
      <TextField
        label={t('settings.fatShare')}
        value={fatShare}
        onChangeText={setFatShare}
        keyboardType="numeric"
        placeholder={String(Math.round(FAT_SHARE_DEFAULT * 100))}
        suffix="%"
      />
      <TextField
        label={t('settings.surplusKcal')}
        value={surplus}
        onChangeText={setSurplus}
        keyboardType="numeric"
        placeholder={String(SURPLUS_KCAL_DEFAULT)}
        suffix="kcal"
      />
      <View style={styles.macroActions}>
        <Button label={t('settings.resetToDefault')} variant="secondary" onPress={reset} style={styles.actionButton} />
        <Button label={t('common.save')} onPress={save} style={styles.actionButton} />
      </View>
    </View>
  );
}

export default function ProfileOverviewScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile(id);
  const targets = useProfileTargets(profile);
  const latestMetric = useLatestBodyMetric(profile?.id);
  const restrictions = useProfileRestrictions(profile?.id);

  if (!profile || !latestMetric) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  const initialValue: ProfileFormValue = {
    name: profile.name,
    profileType: profile.profileType,
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    weightKg: latestMetric?.weightKg ?? 0,
    bodyFatPct: latestMetric?.bodyFatPct ?? undefined,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    goalWeightKg: profile.goalWeightKg ?? undefined,
    goalBodyFatPct: profile.goalBodyFatPct ?? undefined,
    fitnessExperience: profile.fitnessExperience ?? undefined,
    sharesMainMeals: profile.sharesMainMeals,
    allergens: restrictions.allergens,
    diets: restrictions.diets,
  };

  const save = async (value: ProfileFormValue) => {
    await updateProfile(db, profile.id, {
      name: value.name,
      sex: value.sex,
      birthDate: value.birthDate,
      heightCm: value.heightCm,
      activityLevel: value.activityLevel,
      goal: value.goal ?? 'maintain',
      goalWeightKg: value.goalWeightKg,
      goalBodyFatPct: value.goalBodyFatPct,
      fitnessExperience: value.fitnessExperience,
      sharesMainMeals: value.sharesMainMeals ?? true,
      allergens: value.allergens ?? [],
      diets: value.diets ?? [],
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        {targets ? <TdciCard name={profile.name} targets={targets} /> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.weightComposition')}</Text>
          <View style={styles.weightRow}>
            <Text style={styles.weightValue}>
              {latestMetric ? `${latestMetric.weightKg} kg` : '–'}
            </Text>
            {latestMetric?.bodyFatPct != null ? (
              <Text style={styles.weightMeta}>{latestMetric.bodyFatPct} % {t('profile.bodyFat')}</Text>
            ) : null}
          </View>
          <Button
            label={t('profile.viewProgress')}
            variant="secondary"
            onPress={() => router.push('/progress')}
          />
        </View>

        {targets ? <ManualAdjustmentCard profileId={profile.id} kcal={profile.tdciManualAdjustmentKcal} /> : null}

        <MacroOverridesCard profileId={profile.id} macroOverridesJson={profile.macroOverridesJson} />

        <Text style={styles.sectionHeading}>{t('profile.personalAndGoals')}</Text>
        <ProfileForm
          key={profile.id}
          submitLabel={t('common.save')}
          initialValue={initialValue}
          onSubmit={save}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  topBar: {
    marginBottom: spacing.sm,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  cardHint: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weightValue: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  weightMeta: {
    color: colors.textSecondary,
    fontSize: typography.small,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  macroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
