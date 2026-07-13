import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import {
  parseMacroDayOverrides,
  parseMacroOverrides,
  updateProfileMacroDayOverrides,
  updateProfileMacroOverrides,
  updateTdciManualAdjustment,
  type MacroOverrides,
} from '@/db/repositories/profiles';
import { PROTEIN_PER_KG_LBM, FAT_SHARE_DEFAULT, SURPLUS_KCAL_DEFAULT } from '@/domain/constants';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function weekdayShortLabels(language: string): string[] {
  const monday = new Date(2026, 6, 6); // a known Monday
  const formatter = new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' });
  return WEEKDAYS.map((i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + (i - 1));
    return formatter.format(day);
  });
}

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

export function ManualAdjustmentCard({ profileId, kcal }: { profileId: string; kcal: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

export function MacroOverridesCard({
  profileId,
  macroOverridesJson,
}: {
  profileId: string;
  macroOverridesJson: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

export function MacroDayOverridesEditor({
  profileId,
  macroDayOverridesJson,
}: {
  profileId: string;
  macroDayOverridesJson: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dayOverrides = parseMacroDayOverrides(macroDayOverridesJson);
  const dayLabels = useMemo(() => weekdayShortLabels(i18n.language), [i18n.language]);
  const [openDay, setOpenDay] = useState<(typeof WEEKDAYS)[number] | null>(null);
  const [edits, setEdits] = useState<Record<number, { protein: string; fatShare: string; surplus: string }>>({});

  const seedFor = (day: number) => {
    const existing = dayOverrides[String(day)] ?? {};
    return {
      protein: existing.proteinPerKgLbm !== undefined ? String(existing.proteinPerKgLbm) : '',
      fatShare: existing.fatShareOfTdci !== undefined ? String(Math.round(existing.fatShareOfTdci * 100)) : '',
      surplus: existing.surplusKcal !== undefined ? String(existing.surplusKcal) : '',
    };
  };

  const toggleDay = (day: (typeof WEEKDAYS)[number]) => {
    setOpenDay((prev) => (prev === day ? null : day));
    setEdits((prev) => (prev[day] ? prev : { ...prev, [day]: seedFor(day) }));
  };

  const patchEdit = (day: number, patch: Partial<{ protein: string; fatShare: string; surplus: string }>) =>
    setEdits((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const save = async (day: (typeof WEEKDAYS)[number]) => {
    const edit = edits[day];
    if (!edit) return;
    const next: MacroOverrides = {};
    const proteinNum = num(edit.protein);
    const fatShareNum = num(edit.fatShare);
    const surplusNum = num(edit.surplus);
    if (proteinNum !== null) next.proteinPerKgLbm = proteinNum;
    if (fatShareNum !== null) next.fatShareOfTdci = fatShareNum / 100;
    if (surplusNum !== null) next.surplusKcal = surplusNum;
    await updateProfileMacroDayOverrides(db, profileId, day, Object.keys(next).length > 0 ? next : null);
  };

  const resetDay = async (day: (typeof WEEKDAYS)[number]) => {
    setEdits((prev) => ({ ...prev, [day]: { protein: '', fatShare: '', surplus: '' } }));
    await updateProfileMacroDayOverrides(db, profileId, day, null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('settings.macroDayOverrides')}</Text>
      <Text style={styles.cardHint}>{t('form.macroDayOverridesHint')}</Text>
      <View style={styles.dayChipsRow}>
        {WEEKDAYS.map((day, index) => {
          const active = openDay === day;
          const hasOverride = dayOverrides[String(day)] !== undefined;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.dayChip, active && styles.dayChipActive, hasOverride && !active && styles.dayChipHasOverride]}
              onPress={() => toggleDay(day)}>
              <Text style={[styles.dayChipLabel, active && styles.dayChipLabelActive]}>{dayLabels[index]}</Text>
            </Pressable>
          );
        })}
      </View>
      {openDay !== null && edits[openDay] ? (
        <View style={styles.dayBody}>
          <TextField
            label={t('settings.proteinPerKgLbm')}
            value={edits[openDay].protein}
            onChangeText={(v) => patchEdit(openDay, { protein: v })}
            keyboardType="decimal-pad"
            suffix="g/kg"
          />
          <TextField
            label={t('settings.fatShare')}
            value={edits[openDay].fatShare}
            onChangeText={(v) => patchEdit(openDay, { fatShare: v })}
            keyboardType="numeric"
            suffix="%"
          />
          <TextField
            label={t('settings.surplusKcal')}
            value={edits[openDay].surplus}
            onChangeText={(v) => patchEdit(openDay, { surplus: v })}
            keyboardType="numeric"
            suffix="kcal"
          />
          <View style={styles.macroActions}>
            <Button
              label={t('settings.resetToDefault')}
              variant="secondary"
              style={styles.actionButton}
              onPress={() => void resetDay(openDay)}
            />
            <Button label={t('common.save')} style={styles.actionButton} onPress={() => void save(openDay)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
    dayChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    dayChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipHasOverride: {
      borderColor: colors.primary,
    },
    dayChipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    dayChipLabelActive: {
      color: colors.onPrimary,
    },
    dayBody: {
      marginTop: spacing.xs,
    },
  });
}
