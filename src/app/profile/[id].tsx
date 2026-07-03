import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { ManualAdjustmentCard, MacroOverridesCard } from '@/components/ProfileNutritionCards';
import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import { updateProfile } from '@/db/repositories/profiles';
import { useLatestBodyMetric, useProfile, useProfileRestrictions, useProfileTargets } from '@/hooks/data';
import { TdciCard } from '@/components/TdciCard';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

export default function ProfileOverviewScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    workoutDays: profile.workoutDaysJson ? (JSON.parse(profile.workoutDaysJson) as number[]) : [],
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
      workoutDays: value.workoutDays ?? [],
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
    sectionHeading: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
  });
}
