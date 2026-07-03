import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { upsertProfileSlotPortion } from '@/db/repositories/profiles';
import { resolveSnackTarget } from '@/domain/generator/portions';
import { useProfileSlotPortions } from '@/hooks/data';
import { useAllMealSlots, type SlotRow } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const SNACK_PRESETS = [5, 10, 15, 20, 25];

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

type SlotEdit = { percent: string; proteinG: string; fatG: string };

function SlotRowEditor({
  slot,
  edit,
  dailyTargetKcal,
  onChange,
  onReset,
}: {
  slot: SlotRow;
  edit: SlotEdit;
  dailyTargetKcal: number | null;
  onChange: (patch: Partial<SlotEdit>) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const isSnack = slot.kind === 'snack';

  const percentValue = num(edit.percent);
  const preview =
    isSnack && dailyTargetKcal !== null && percentValue !== null
      ? resolveSnackTarget(
          { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
          dailyTargetKcal,
          { calorieSharePercent: percentValue / 100, proteinTargetG: num(edit.proteinG), fatTargetG: num(edit.fatG) },
        )
      : null;

  return (
    <View style={styles.slotCard}>
      <Pressable accessibilityRole="button" style={styles.slotHeader} onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.slotTitle}>{t(`slots.${slot.slotKey}`)}</Text>
        <Text style={styles.slotSummary}>{edit.percent} %</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.slotBody}>
          <TextField
            label={t('settings.percentOfTdci')}
            value={edit.percent}
            onChangeText={(v) => onChange({ percent: v })}
            keyboardType="numeric"
            suffix="%"
          />
          {isSnack ? (
            <>
              <View style={styles.presetRow}>
                {SNACK_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    accessibilityRole="button"
                    style={[styles.presetChip, num(edit.percent) === preset && styles.presetChipActive]}
                    onPress={() => onChange({ percent: String(preset) })}>
                    <Text style={[styles.presetLabel, num(edit.percent) === preset && styles.presetLabelActive]}>
                      {preset} %
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.macroRow}>
                <View style={styles.macroField}>
                  <TextField
                    label={t('settings.proteinTargetLabel')}
                    value={edit.proteinG}
                    onChangeText={(v) => onChange({ proteinG: v })}
                    keyboardType="numeric"
                    suffix="g"
                  />
                </View>
                <View style={styles.macroField}>
                  <TextField
                    label={t('settings.fatTargetLabel')}
                    value={edit.fatG}
                    onChangeText={(v) => onChange({ fatG: v })}
                    keyboardType="numeric"
                    suffix="g"
                  />
                </View>
              </View>
              {preview ? (
                <Text style={styles.computedLine}>
                  {t('settings.carbsComputed')}: {Math.round(preview.carbsG)} g · {Math.round(preview.kcal)} kcal
                </Text>
              ) : null}
            </>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.resetLink} onPress={onReset}>
            <Text style={styles.resetLinkLabel}>{t('settings.useDefault')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function ProfilePortionsCard({
  householdId,
  profileId,
  dailyTargetKcal,
}: {
  householdId: string;
  profileId: string;
  dailyTargetKcal: number | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useAllMealSlots(householdId);
  const overrides = useProfileSlotPortions(profileId);
  const [edits, setEdits] = useState<Record<string, SlotEdit>>({});
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || slots.length === 0) return;
    const overrideBySlot = new Map(overrides.map((row) => [row.slotId, row]));
    const next: Record<string, SlotEdit> = {};
    for (const slot of slots) {
      const override = overrideBySlot.get(slot.id);
      const percent = override?.calorieSharePercent ?? slot.calorieShare;
      next[slot.id] = {
        percent: String(Math.round(percent * 100)),
        proteinG: override?.proteinTargetG !== null && override?.proteinTargetG !== undefined ? String(override.proteinTargetG) : '',
        fatG: override?.fatTargetG !== null && override?.fatTargetG !== undefined ? String(override.fatTargetG) : '',
      };
    }
    setEdits(next);
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, overrides, seeded]);

  const updateEdit = (slotId: string, patch: Partial<SlotEdit>) => {
    setEdits((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));
  };

  const resetSlot = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    setEdits((prev) => ({
      ...prev,
      [slotId]: { percent: String(Math.round(slot.calorieShare * 100)), proteinG: '', fatG: '' },
    }));
  };

  const enabledSlots = slots.filter((s) => s.enabled);
  const sumPercent = enabledSlots.reduce((sum, slot) => sum + (num(edits[slot.id]?.percent ?? '') ?? 0), 0);
  const canSave = Math.abs(sumPercent - 100) < 0.5;

  const save = async () => {
    for (const slot of slots) {
      const edit = edits[slot.id];
      if (!edit) continue;
      const percent = num(edit.percent);
      await upsertProfileSlotPortion(db, profileId, slot.id, {
        calorieSharePercent: percent !== null ? percent / 100 : null,
        proteinTargetG: slot.kind === 'snack' ? num(edit.proteinG) : null,
        fatTargetG: slot.kind === 'snack' ? num(edit.fatG) : null,
      });
    }
  };

  return (
    <View>
      <Text style={styles.hint}>{t('settings.slotPortionsHint')}</Text>
      {enabledSlots.map((slot) => {
        const edit = edits[slot.id];
        if (!edit) return null;
        return (
          <SlotRowEditor
            key={slot.id}
            slot={slot}
            edit={edit}
            dailyTargetKcal={dailyTargetKcal}
            onChange={(patch) => updateEdit(slot.id, patch)}
            onReset={() => resetSlot(slot.id)}
          />
        );
      })}
      <Text style={[styles.sumText, !canSave && styles.sumTextWarning]}>
        {t('settings.slotsSumWarning', { sum: Math.round(sumPercent) })}
      </Text>
      <Button label={t('settings.savePortions')} onPress={save} disabled={!canSave} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    hint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.sm,
      lineHeight: 18,
    },
    slotCard: {
      backgroundColor: colors.background,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    slotHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.sm + 2,
    },
    slotTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    slotSummary: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    slotBody: {
      paddingHorizontal: spacing.sm + 2,
      paddingBottom: spacing.sm + 2,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    presetChip: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm,
    },
    presetChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    presetLabelActive: {
      color: colors.onPrimary,
    },
    macroRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    macroField: {
      flex: 1,
    },
    computedLine: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
    },
    resetLink: {
      alignSelf: 'flex-start',
    },
    resetLinkLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '600',
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
  });
}
