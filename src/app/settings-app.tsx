import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AccordionCard } from '@/components/ui/AccordionCard';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateHouseholdSettings, updateMealSlotSetting } from '@/db/repositories/households';
import { defaultNotificationSettings, type NotificationSettings } from '@/db/types';
import { useHousehold, useHouseholdSettings } from '@/hooks/data';
import { useAllMealSlots } from '@/hooks/plan';
import { syncHouseholdNotifications } from '@/services/notifications';
import { MAX_MAIN_NAV_ITEMS, useAppStore, type NavKey } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { slotDisplayLabel } from '@/utils/mealSlots';

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
          label={slotDisplayLabel(t, slot)}
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

export default function SettingsAppScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const settings = useHouseholdSettings(household?.id);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const restoreScrollEnabled = useAppStore((s) => s.restoreScrollEnabled);
  const setRestoreScrollEnabled = useAppStore((s) => s.setRestoreScrollEnabled);
  const restoreScrollTimeoutSec = useAppStore((s) => s.restoreScrollTimeoutSec);
  const setRestoreScrollTimeoutSec = useAppStore((s) => s.setRestoreScrollTimeoutSec);

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
      <HintedScrollView contentContainerStyle={styles.content}>
        <ScreenHeader />
        <Text style={styles.heading}>{t('settings.category.app.title')}</Text>

        <AccordionCard title={t('settings.general')} defaultExpanded>
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
            label={t('settings.theme')}
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            value={themeMode}
            onChange={(v) => setThemeMode(v as 'light' | 'dark')}
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
