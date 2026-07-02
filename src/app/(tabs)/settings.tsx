import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateHouseholdSettings, updateMealSlotSetting } from '@/db/repositories/households';
import { updateProfileMacroOverrides, type MacroOverrides } from '@/db/repositories/profiles';
import { defaultNotificationSettings, type NotificationSettings } from '@/db/types';
import { PROTEIN_PER_KG_LBM, FAT_SHARE_DEFAULT, SURPLUS_KCAL_DEFAULT } from '@/domain/constants';
import { useHousehold, useHouseholdSettings, useProfiles, useProfileTargets } from '@/hooks/data';
import type { ProfileRow } from '@/hooks/dataMapping';
import { useAllMealSlots, type SlotRow } from '@/hooks/plan';
import { syncHouseholdNotifications } from '@/services/notifications';
import {
  ALL_NAV_KEYS,
  MAX_MAIN_NAV_ITEMS,
  useAppStore,
  type NavKey,
} from '@/stores/appStore';
import { colors, radius, spacing, typography } from '@/theme/tokens';

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

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

function parseNotifications(json: string | null): NotificationSettings {
  if (!json) return defaultNotificationSettings;
  try {
    return { ...defaultNotificationSettings, ...(JSON.parse(json) as Partial<NotificationSettings>) };
  } catch {
    return defaultNotificationSettings;
  }
}

function parseMacroOverrides(json: string | null): MacroOverrides {
  if (!json) return {};
  try {
    return JSON.parse(json) as MacroOverrides;
  } catch {
    return {};
  }
}

function ProfileSummaryRow({ profile }: { profile: ProfileRow }) {
  const { t } = useTranslation();
  const targets = useProfileTargets(profile);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryName}>{profile.name}</Text>
      <Text style={styles.summaryMeta}>
        {t(`goal.${profile.goal}`)}
        {targets ? ` · ${Math.round(targets.adjustedTdciKcal)} kcal` : ''}
      </Text>
    </View>
  );
}

type SlotEdit = { time: string; percent: string; enabled: boolean };

function MealSlotsCard({ householdId }: { householdId: string }) {
  const { t } = useTranslation();
  const slots = useAllMealSlots(householdId);
  const [edits, setEdits] = useState<Record<string, SlotEdit>>({});
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || slots.length === 0) return;
    const next: Record<string, SlotEdit> = {};
    for (const slot of slots) {
      next[slot.id] = {
        time: slot.time,
        percent: String(Math.round(slot.calorieShare * 100)),
        enabled: slot.enabled,
      };
    }
    setEdits(next);
    setSeeded(true);
  }, [slots, seeded]);

  const updateEdit = (slotId: string, patch: Partial<SlotEdit>) => {
    setEdits((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));
  };

  const enabledSum = slots.reduce((sum, slot) => {
    const edit = edits[slot.id];
    if (!edit?.enabled) return sum;
    return sum + (num(edit.percent) ?? 0);
  }, 0);
  const allTimesValid = slots.every((slot) => TIME_RE.test(edits[slot.id]?.time ?? ''));
  const canSave = Math.abs(enabledSum - 100) < 0.5 && allTimesValid;

  const save = async () => {
    for (const slot of slots) {
      const edit = edits[slot.id];
      if (!edit) continue;
      await updateMealSlotSetting(db, slot.id, {
        time: edit.time,
        calorieShare: (num(edit.percent) ?? 0) / 100,
        enabled: edit.enabled,
      });
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('settings.mealSlots')}</Text>
      <Text style={styles.cardHint}>{t('settings.mealSlotsHint')}</Text>

      {slots.map((slot: SlotRow) => {
        const edit = edits[slot.id];
        if (!edit) return null;
        return (
          <View key={slot.id} style={styles.slotRow}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotLabel}>{t(`slots.${slot.slotKey}`)}</Text>
              <Switch
                value={edit.enabled}
                onValueChange={(v) => updateEdit(slot.id, { enabled: v })}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={styles.slotFields}>
              <View style={styles.slotFieldTime}>
                <TextField
                  label={t('settings.slotTime')}
                  value={edit.time}
                  onChangeText={(v) => updateEdit(slot.id, { time: v })}
                  placeholder="HH:MM"
                />
              </View>
              <View style={styles.slotFieldPercent}>
                <TextField
                  label={t('settings.slotShare')}
                  value={edit.percent}
                  onChangeText={(v) => updateEdit(slot.id, { percent: v })}
                  keyboardType="numeric"
                  suffix="%"
                />
              </View>
            </View>
          </View>
        );
      })}

      <Text style={[styles.sumText, !canSave && styles.sumTextWarning]}>
        {t('settings.slotsSumWarning', { sum: Math.round(enabledSum) })}
      </Text>
      <Button label={t('settings.saveSlots')} onPress={save} disabled={!canSave} />
    </View>
  );
}

function MacroOverridesCard({ profile }: { profile: ProfileRow }) {
  const { t } = useTranslation();
  const overrides = parseMacroOverrides(profile.macroOverridesJson);
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
    await updateProfileMacroOverrides(db, profile.id, Object.keys(next).length > 0 ? next : null);
  };

  const reset = async () => {
    setProtein('');
    setFatShare('');
    setSurplus('');
    await updateProfileMacroOverrides(db, profile.id, null);
  };

  return (
    <View style={styles.subCard}>
      <Text style={styles.subCardTitle}>{profile.name}</Text>
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

function NavigationCard() {
  const { t } = useTranslation();
  const mainNavKeys = useAppStore((s) => s.mainNavKeys);
  const setMainNavKeys = useAppStore((s) => s.setMainNavKeys);

  const toggle = (key: NavKey, inMain: boolean) => {
    if (inMain) {
      setMainNavKeys(mainNavKeys.filter((k) => k !== key));
    } else if (mainNavKeys.length < MAX_MAIN_NAV_ITEMS) {
      setMainNavKeys(ALL_NAV_KEYS.filter((k) => mainNavKeys.includes(k) || k === key));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('settings.navigation')}</Text>
      <Text style={styles.cardHint}>{t('settings.navigationHint', { max: MAX_MAIN_NAV_ITEMS })}</Text>
      {ALL_NAV_KEYS.map((key) => {
        const inMain = mainNavKeys.includes(key);
        const disable = !inMain && mainNavKeys.length >= MAX_MAIN_NAV_ITEMS;
        return (
          <View key={key} style={styles.navRow}>
            <Text style={styles.slotLabel}>{t(NAV_LABEL_KEYS[key])}</Text>
            <Switch
              value={inMain}
              onValueChange={() => toggle(key, inMain)}
              disabled={disable}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={colors.surface}
            />
          </View>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { household } = useHousehold();
  const settings = useHouseholdSettings(household?.id);
  const members = useProfiles(household?.id);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('settings.title')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{household.name}</Text>
          {members.map((profile) => (
            <ProfileSummaryRow key={profile.id} profile={profile} />
          ))}
        </View>

        <View style={styles.card}>
          <ChipSelect
            label={t('settings.units')}
            options={[
              { value: 'metric', label: t('settings.unitsMetric') },
              { value: 'us', label: t('settings.unitsUs') },
            ]}
            value={settings.unitSystem}
            onChange={(v) => updateHouseholdSettings(db, household.id, { unitSystem: v as 'metric' | 'us' })}
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
            label={t('settings.fiberMode')}
            options={[
              { value: 'efsa_min', label: t('settings.fiberEfsa') },
              { value: 'gender_specific', label: t('settings.fiberGenderSpecific') },
            ]}
            value={settings.fiberMode}
            onChange={(v) =>
              updateHouseholdSettings(db, household.id, { fiberMode: v as 'efsa_min' | 'gender_specific' })
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.mealRepetition')}</Text>
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
        </View>

        <MealSlotsCard householdId={household.id} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.macroOverrides')}</Text>
          <Text style={styles.cardHint}>{t('settings.macroOverridesHint')}</Text>
          {members.map((profile) => (
            <MacroOverridesCard key={profile.id} profile={profile} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.notifications')}</Text>
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
        </View>

        <NavigationCard />
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
  heading: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    marginBottom: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  cardHint: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  summaryRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontSize: typography.small,
  },
  slotRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  slotFieldPercent: {
    width: 110,
  },
  sumText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginBottom: spacing.sm,
  },
  sumTextWarning: {
    color: colors.danger,
    fontWeight: '600',
  },
  subCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  subCardTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  macroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
