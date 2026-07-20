import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { ProfileDropdownMenu } from '@/components/ProfileDropdownMenu';
import { ManualAdjustmentCard, MacroDayOverridesEditor, MacroOverridesCard } from '@/components/ProfileNutritionCards';
import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { ProfilePortionsCard } from '@/components/ProfilePortionsCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WaterSettingsCard } from '@/components/WaterSettingsCard';
import { AdvancedExpander } from '@/components/ui/AdvancedExpander';
import { AccordionCard } from '@/components/ui/AccordionCard';
import { Snackbar } from '@/components/ui/Snackbar';
import { db } from '@/db/client';
import { restoreProfile, softDeleteProfile, updateProfile } from '@/db/repositories/profiles';
import { ageYears } from '@/domain/age';
import { micronutrientRda } from '@/domain/micronutrients';
import {
  useHousehold,
  useHouseholdSettings,
  useLatestBodyMetric,
  useProfileRestrictions,
  useProfiles,
  useProfileTargets,
} from '@/hooks/data';
import type { ProfileRow } from '@/hooks/dataMapping';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

/** Header pill showing the selected profile; tapping opens a dropdown of all profiles + "add profile". */
function ProfileSwitcherHeader({
  householdId,
  selectedProfileId,
  onSelect,
}: {
  householdId: string;
  selectedProfileId: string | undefined;
  onSelect: (profileId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const members = useProfiles(householdId);
  const [visible, setVisible] = useState(false);
  const selected = members.find((m) => m.id === selectedProfileId) ?? members[0];

  return (
    <>
      <Pressable accessibilityRole="button" style={styles.profileHeader} onPress={() => setVisible(true)}>
        <View style={styles.profileHeaderIcon}>
          <Text style={styles.profileHeaderInitial}>{selected?.name.slice(0, 1).toUpperCase() ?? '?'}</Text>
        </View>
        <View style={styles.profileHeaderText}>
          <Text style={styles.profileHeaderLabel}>{t('settings.selectProfile')}</Text>
          <Text style={styles.profileHeaderName}>{selected?.name ?? '—'}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </Pressable>

      <ProfileDropdownMenu
        visible={visible}
        onClose={() => setVisible(false)}
        householdId={householdId}
        members={members}
        selectedId={selected?.id}
        onSelect={onSelect}
      />
    </>
  );
}

function profileFormValueFor(profile: ProfileRow, weightKg: number, bodyFatPct: number | null | undefined, restrictions: { allergens: string[]; diets: string[] }): ProfileFormValue {
  return {
    name: profile.name,
    profileType: profile.profileType,
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    weightKg,
    bodyFatPct: bodyFatPct ?? undefined,
    activityLevel: profile.activityLevel,
    customTdeeKcal: profile.customTdeeKcal ?? undefined,
    goal: profile.goal,
    goalWeightKg: profile.goalWeightKg ?? undefined,
    goalBodyFatPct: profile.goalBodyFatPct ?? undefined,
    fitnessExperience: profile.fitnessExperience ?? undefined,
    sharesMainMeals: profile.sharesMainMeals,
    workoutDays: profile.workoutDaysJson ? (JSON.parse(profile.workoutDaysJson) as number[]) : [],
    allergens: restrictions.allergens,
    diets: restrictions.diets,
  };
}

/** Accordion cards for the profile selected in the header dropdown. */
function ProfileSections({
  profile,
  onDelete,
}: {
  profile: ProfileRow;
  /** Omitted when this is the household's only profile – deleting it isn't offered. */
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const targets = useProfileTargets(profile);
  const latestMetric = useLatestBodyMetric(profile.id);
  const restrictions = useProfileRestrictions(profile.id);
  const householdSettings = useHouseholdSettings(profile.householdId);

  const saveProfile = async (value: ProfileFormValue) => {
    await updateProfile(db, profile.id, {
      name: value.name,
      sex: value.sex,
      birthDate: value.birthDate,
      heightCm: value.heightCm,
      activityLevel: value.activityLevel,
      customTdeeKcal: value.customTdeeKcal,
      goal: value.goal ?? 'maintain',
      goalWeightKg: value.goalWeightKg,
      goalBodyFatPct: value.goalBodyFatPct,
      fitnessExperience: value.fitnessExperience,
      workoutDays: value.workoutDays ?? [],
      sharesMainMeals: value.sharesMainMeals ?? true,
      wantsNewFoods: profile.wantsNewFoods,
      allergens: value.allergens ?? [],
      diets: value.diets ?? [],
    });
  };

  return (
    <>
      <AccordionCard title={t('profile.personalAndGoals')} subtitle={profile.name}>
        {latestMetric ? (
          <ProfileForm
            key={profile.id}
            submitLabel={t('common.save')}
            initialValue={profileFormValueFor(profile, latestMetric.weightKg, latestMetric.bodyFatPct, restrictions)}
            onSubmit={saveProfile}
          />
        ) : null}
      </AccordionCard>

      <AccordionCard title={t('settings.nutritionSection')}>
        {targets ? (
          <>
            <Text style={styles.tdciSummary}>
              {Math.round(targets.adjustedTdciKcal)} kcal · {t(`tdciMode.${targets.mode}`)}
            </Text>
            <Text style={styles.fiberInfo}>
              {t('macros.protein')} {Math.round(targets.macros.proteinG)} g · {t('macros.carbs')}{' '}
              {Math.round(targets.macros.carbsG)} g · {t('macros.fat')} {Math.round(targets.macros.fatG)} g
            </Text>
          </>
        ) : null}
        {targets ? <ManualAdjustmentCard profileId={profile.id} kcal={profile.tdciManualAdjustmentKcal} /> : null}
        <AdvancedExpander>
          <MacroOverridesCard profileId={profile.id} macroOverridesJson={profile.macroOverridesJson} />
          <MacroDayOverridesEditor profileId={profile.id} macroDayOverridesJson={profile.macroDayOverridesJson} />
        </AdvancedExpander>
        {(() => {
          const rda = micronutrientRda(profile.sex, ageYears(profile.birthDate));
          return (
            <Text style={styles.fiberInfo}>
              {t('micros.ironMg')} {rda.ironMg} · {t('micros.vitaminDUg')} {rda.vitaminDUg} · {t('micros.b12Ug')}{' '}
              {rda.b12Ug} · {t('micros.calciumMg')} {rda.calciumMg}
              {targets ? ` · ${t('macros.fiber')} ${Math.round(targets.fiberG)} g` : ''} ·{' '}
              {t('micros.omega3G')} {rda.omega3G}
            </Text>
          );
        })()}
      </AccordionCard>

      <AccordionCard title={t('settings.slotPortions')}>
        <ProfilePortionsCard
          householdId={profile.householdId}
          profileId={profile.id}
          dailyTargetKcal={targets ? targets.adjustedTdciKcal : null}
        />
      </AccordionCard>

      <AccordionCard title={t('water.cardTitle')}>
        {householdSettings ? (
          <WaterSettingsCard
            profileId={profile.id}
            trackWater={profile.trackWater}
            waterGoalMl={profile.waterGoalMl}
            waterGlassMl={profile.waterGlassMl}
            unitSystem={householdSettings.unitSystem}
          />
        ) : null}
      </AccordionCard>

      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          style={styles.deleteProfileButton}
          onPress={() =>
            Alert.alert(t('profile.deleteTitle'), t('profile.deleteMessage', { name: profile.name }), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: onDelete },
            ])
          }>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteProfileLabel}>{t('profile.deleteProfile')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

export default function SettingsProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const members = useProfiles(household?.id);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const [deletedProfile, setDeletedProfile] = useState<{ id: string; name: string } | null>(null);

  if (!household) return null;

  const effectiveProfileId =
    selectedProfileId ?? (members.some((m) => m.id === activeProfileId) ? (activeProfileId ?? undefined) : members[0]?.id);
  const selectedProfile = members.find((m) => m.id === effectiveProfileId);

  const deleteSelectedProfile = async () => {
    if (!selectedProfile) return;
    await softDeleteProfile(db, selectedProfile.id);
    setDeletedProfile({ id: selectedProfile.id, name: selectedProfile.name });
    setSelectedProfileId(undefined);
    if (activeProfileId === selectedProfile.id) {
      const fallback = members.find((m) => m.id !== selectedProfile.id);
      setActiveProfileId(fallback?.id ?? null);
    }
  };

  const undoDeleteProfile = async () => {
    if (!deletedProfile) return;
    await restoreProfile(db, deletedProfile.id);
    setSelectedProfileId(deletedProfile.id);
    setActiveProfileId(deletedProfile.id);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content}>
        <ScreenHeader />
        <Text style={styles.heading}>{t('settings.category.profile.title')}</Text>

        <ProfileSwitcherHeader
          householdId={household.id}
          selectedProfileId={effectiveProfileId}
          onSelect={setSelectedProfileId}
        />

        {selectedProfile ? (
          <ProfileSections
            profile={selectedProfile}
            onDelete={members.length > 1 ? deleteSelectedProfile : undefined}
          />
        ) : null}
      </HintedScrollView>

      {deletedProfile ? (
        <Snackbar
          message={t('profile.deletedSnackbar', { name: deletedProfile.name })}
          actionLabel={t('common.undo')}
          onAction={undoDeleteProfile}
          onDismiss={() => setDeletedProfile(null)}
        />
      ) : null}
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
    deleteProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.chip,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    deleteProfileLabel: {
      color: colors.danger,
      fontSize: typography.body,
      fontWeight: '600',
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    profileHeaderIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileHeaderInitial: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    profileHeaderText: {
      flex: 1,
    },
    profileHeaderLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    profileHeaderName: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    tdciSummary: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    fiberInfo: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.sm,
    },
  });
}
