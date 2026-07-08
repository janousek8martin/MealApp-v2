import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KitchenUnitsModal } from '@/components/KitchenUnitsModal';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { ManualAdjustmentCard, MacroOverridesCard } from '@/components/ProfileNutritionCards';
import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { ProfilePortionsCard } from '@/components/ProfilePortionsCard';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Snackbar } from '@/components/ui/Snackbar';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateHouseholdSettings, updateMealSlotSetting } from '@/db/repositories/households';
import { restoreProfile, softDeleteProfile, updateProfile } from '@/db/repositories/profiles';
import { ageYears } from '@/domain/age';
import { micronutrientRda } from '@/domain/micronutrients';
import { defaultNotificationSettings, type NotificationSettings } from '@/db/types';
import {
  useHousehold,
  useHouseholdSettings,
  useLatestBodyMetric,
  useProfileRestrictions,
  useProfiles,
  useProfileTargets,
} from '@/hooks/data';
import type { ProfileRow } from '@/hooks/dataMapping';
import { useAllMealSlots } from '@/hooks/plan';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { syncHouseholdNotifications } from '@/services/notifications';
import { MAX_MAIN_NAV_ITEMS, useAppStore, type NavKey } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const NAV_LABEL_KEYS: Record<NavKey, string> = {
  index: 'tabs.home',
  plan: 'tabs.plan',
  library: 'tabs.library',
  shopping: 'tabs.shopping',
  pantry: 'tabs.pantry',
  progress: 'tabs.progress',
  settings: 'tabs.settings',
};

function parseNotifications(json: string | null): NotificationSettings {
  if (!json) return defaultNotificationSettings;
  try {
    return { ...defaultNotificationSettings, ...(JSON.parse(json) as Partial<NotificationSettings>) };
  } catch {
    return defaultNotificationSettings;
  }
}

/** Collapsible card shared by every settings section – tap the header to expand/collapse. */
function AccordionCard({
  title,
  subtitle,
  defaultExpanded,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        style={styles.accordionHeader}
        onPress={() => setExpanded((prev) => !prev)}>
        <View style={styles.accordionHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardHint}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </Pressable>
      {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

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

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.dropdownSheet} onPress={() => undefined}>
            {members.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                style={styles.dropdownRow}
                onPress={() => {
                  onSelect(m.id);
                  setVisible(false);
                }}>
                <Text style={styles.dropdownRowLabel}>{m.name}</Text>
                {m.id === selected?.id ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              style={styles.dropdownAdd}
              onPress={() => {
                setVisible(false);
                router.push({ pathname: '/profile/new', params: { householdId } });
              }}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.dropdownAddLabel}>{t('settings.addProfile')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  const saveProfile = async (value: ProfileFormValue) => {
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
        <MacroOverridesCard profileId={profile.id} macroOverridesJson={profile.macroOverridesJson} />
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

/** Per-slot time fields, shown only while meal reminders are enabled (moved here from the slots editor). */
function MealTimesSection({ householdId }: { householdId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useAllMealSlots(householdId);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || slots.length === 0) return;
    const next: Record<string, string> = {};
    for (const slot of slots) next[slot.id] = slot.time;
    setTimes(next);
    setSeeded(true);
  }, [slots, seeded]);

  const allValid = slots.every((slot) => TIME_RE.test(times[slot.id] ?? ''));

  const save = async () => {
    for (const slot of slots) {
      const time = times[slot.id];
      if (time === undefined || !TIME_RE.test(time)) continue;
      await updateMealSlotSetting(db, slot.id, { time });
    }
  };

  return (
    <View style={styles.mealTimesSection}>
      <Text style={styles.cardTitle}>{t('settings.mealTimes')}</Text>
      <Text style={styles.cardHint}>{t('settings.mealTimesHint')}</Text>
      {slots.map((slot) => (
        <TextField
          key={slot.id}
          label={t(`slots.${slot.slotKey}`)}
          value={times[slot.id] ?? ''}
          onChangeText={(v) => setTimes((prev) => ({ ...prev, [slot.id]: v }))}
          placeholder="HH:MM"
        />
      ))}
      <Button label={t('settings.saveTimes')} onPress={save} disabled={!allValid} />
    </View>
  );
}

function NavigationCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navOrder = useAppStore((s) => s.navOrder);
  const setNavOrder = useAppStore((s) => s.setNavOrder);

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<NavKey>) => {
    const index = getIndex() ?? 0;
    return (
      <View>
        {index === 0 ? <Text style={styles.navSectionLabel}>{t('settings.navigationMain')}</Text> : null}
        {index === MAX_MAIN_NAV_ITEMS ? (
          <Text style={styles.navSectionLabel}>{t('settings.navigationExpand')}</Text>
        ) : null}
        <View style={[styles.navDragRow, isActive && styles.navDragRowActive]}>
          <Text style={styles.slotLabel}>{t(NAV_LABEL_KEYS[item])}</Text>
          <Pressable onPressIn={drag} disabled={isActive} hitSlop={12} style={styles.navDragHandle}>
            <Ionicons name="reorder-three-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <DraggableFlatList
      data={navOrder}
      keyExtractor={(item) => item}
      renderItem={renderItem}
      onDragEnd={({ data }) => setNavOrder(data)}
      scrollEnabled={false}
      activationDistance={0}
    />
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);
  const { household } = useHousehold();
  const settings = useHouseholdSettings(household?.id);
  const members = useProfiles(household?.id);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const restoreScrollEnabled = useAppStore((s) => s.restoreScrollEnabled);
  const setRestoreScrollEnabled = useAppStore((s) => s.setRestoreScrollEnabled);
  const restoreScrollTimeoutSec = useAppStore((s) => s.restoreScrollTimeoutSec);
  const setRestoreScrollTimeoutSec = useAppStore((s) => s.setRestoreScrollTimeoutSec);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const [kitchenUnitsVisible, setKitchenUnitsVisible] = useState(false);
  const [deletedProfile, setDeletedProfile] = useState<{ id: string; name: string } | null>(null);

  const notifications = parseNotifications(settings?.notificationsJson ?? null);
  const [weighInTime, setWeighInTime] = useState('');
  const [planningTime, setPlanningTime] = useState('');
  const [timesSeeded, setTimesSeeded] = useState(false);

  useEffect(() => {
    if (timesSeeded || !settings) return;
    setWeighInTime(notifications.weighInTime);
    setPlanningTime(notifications.planningTime);
    setTimesSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, timesSeeded]);

  if (!household || !settings) return null;

  const effectiveProfileId =
    selectedProfileId ?? (members.some((m) => m.id === activeProfileId) ? (activeProfileId ?? undefined) : members[0]?.id);
  const selectedProfile = members.find((m) => m.id === effectiveProfileId);

  const patchNotifications = async (patch: Partial<NotificationSettings>) => {
    await updateHouseholdSettings(db, household.id, { notifications: { ...notifications, ...patch } });
    await syncHouseholdNotifications(household.id);
  };

  const saveTimes = async () => {
    await updateHouseholdSettings(db, household.id, {
      notifications: { ...notifications, weighInTime, planningTime },
    });
    await syncHouseholdNotifications(household.id);
  };
  const timesValid = TIME_RE.test(weighInTime) && TIME_RE.test(planningTime);

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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={(e) => {
          onRestoreScroll(e);
          scrollHint.onScroll(e);
        }}
        onContentSizeChange={scrollHint.onContentSizeChange}
        onLayout={scrollHint.onLayout}
        scrollEventThrottle={scrollEventThrottle}>
        <Text style={styles.heading}>{t('settings.title')}</Text>

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

        <AccordionCard title={t('settings.general')}>
          <ChipSelect
            label={t('settings.units')}
            options={[
              { value: 'metric', label: t('settings.unitsMetric') },
              { value: 'us', label: t('settings.unitsUs') },
            ]}
            value={settings.unitSystem}
            onChange={(v) => updateHouseholdSettings(db, household.id, { unitSystem: v as 'metric' | 'us' })}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.kitchenUnitsRow}
            onPress={() => setKitchenUnitsVisible(true)}>
            <Text style={styles.slotLabel}>{t('settings.kitchenUnits')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
          <ChipSelect
            label={t('settings.kitchenUnitDisplayMode')}
            options={[
              { value: 'grams', label: t('settings.kitchenUnitDisplayGrams') },
              { value: 'hybrid', label: t('settings.kitchenUnitDisplayHybrid') },
            ]}
            value={settings.kitchenUnitDisplayMode}
            onChange={(v) => updateHouseholdSettings(db, household.id, { kitchenUnitDisplayMode: v as 'grams' | 'hybrid' })}
          />
          <ChipSelect
            label={t('settings.language')}
            options={[
              { value: 'cs', label: t('settings.languageCs') },
              { value: 'en', label: t('settings.languageEn') },
            ]}
            value={settings.language}
            onChange={(v) => {
              void updateHouseholdSettings(db, household.id, { language: v as 'cs' | 'en' });
              void i18n.changeLanguage(v);
            }}
          />
          <ChipSelect
            label={t('settings.theme')}
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            value={themeMode}
            onChange={(v) => setThemeMode(v as 'light' | 'dark')}
          />
        </AccordionCard>

        <AccordionCard title={t('settings.mealRepetition')}>
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
        </AccordionCard>

        <AccordionCard title={t('settings.notifications')}>
          <SwitchRow
            label={t('settings.mealReminders')}
            value={notifications.mealRemindersEnabled}
            onChange={(v) => patchNotifications({ mealRemindersEnabled: v })}
          />
          <SwitchRow
            label={t('settings.shoppingReminder')}
            value={notifications.shoppingReminderEnabled}
            onChange={(v) => patchNotifications({ shoppingReminderEnabled: v })}
          />
          <SwitchRow
            label={t('settings.weighInReminder')}
            value={notifications.weighInReminderEnabled}
            onChange={(v) => patchNotifications({ weighInReminderEnabled: v })}
          />
          <SwitchRow
            label={t('settings.planningReminder')}
            value={notifications.planningReminderEnabled}
            onChange={(v) => patchNotifications({ planningReminderEnabled: v })}
          />
          <View style={styles.slotFields}>
            <View style={styles.slotFieldTime}>
              <TextField label={t('settings.weighInTime')} value={weighInTime} onChangeText={setWeighInTime} placeholder="HH:MM" />
            </View>
            <View style={styles.slotFieldTime}>
              <TextField label={t('settings.planningTime')} value={planningTime} onChangeText={setPlanningTime} placeholder="HH:MM" />
            </View>
          </View>
          {!timesValid ? <Text style={styles.sumTextWarning}>{t('settings.invalidTime')}</Text> : null}
          <Button label={t('settings.saveTimes')} onPress={saveTimes} disabled={!timesValid} />

          {notifications.mealRemindersEnabled ? <MealTimesSection householdId={household.id} /> : null}
        </AccordionCard>

        <AccordionCard title={t('settings.navigation')} subtitle={t('settings.navigationHint', { max: MAX_MAIN_NAV_ITEMS })}>
          <NavigationCard />
        </AccordionCard>

        <AccordionCard title={t('settings.scrollMemory')} subtitle={t('settings.scrollMemoryHint')}>
          <SwitchRow
            label={t('settings.scrollMemoryEnable')}
            value={restoreScrollEnabled}
            onChange={setRestoreScrollEnabled}
          />
          {restoreScrollEnabled ? (
            <View style={styles.stepperRow}>
              <Text style={styles.slotLabel}>{t('settings.scrollMemoryTimeout')}</Text>
              <View style={styles.stepper}>
                <Button
                  variant="secondary"
                  label="–"
                  style={styles.stepperButton}
                  onPress={() => setRestoreScrollTimeoutSec(Math.max(1, restoreScrollTimeoutSec - 1))}
                />
                <Text style={styles.stepperValue}>{restoreScrollTimeoutSec}s</Text>
                <Button
                  variant="secondary"
                  label="+"
                  style={styles.stepperButton}
                  onPress={() => setRestoreScrollTimeoutSec(Math.min(10, restoreScrollTimeoutSec + 1))}
                />
              </View>
            </View>
          ) : null}
        </AccordionCard>
      </ScrollView>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
      />

      <KitchenUnitsModal
        visible={kitchenUnitsVisible}
        onClose={() => setKitchenUnitsVisible(false)}
        householdId={household.id}
      />

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
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    dropdownSheet: {
      backgroundColor: colors.background,
      borderRadius: radius.card,
      padding: spacing.sm,
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    dropdownRowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    dropdownAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
    },
    dropdownAddLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '700',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.md,
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
    },
    accordionHeaderText: {
      flex: 1,
      paddingRight: spacing.sm,
    },
    accordionBody: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    cardTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
    },
    cardHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
      lineHeight: 18,
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
    kitchenUnitsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    slotLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    slotFields: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    slotFieldTime: {
      flex: 1,
    },
    sumTextWarning: {
      color: colors.danger,
      fontWeight: '600',
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
    navSectionLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    navDragRow: {
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
    navDragRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    navDragHandle: {
      padding: spacing.xs,
    },
  });
}
