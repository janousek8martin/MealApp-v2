import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateProfileMacroOverrides, updateTdciManualAdjustment, type MacroOverrides } from '@/db/repositories/profiles';
import { PROTEIN_PER_KG_LBM, FAT_SHARE_DEFAULT, SURPLUS_KCAL_DEFAULT } from '@/domain/constants';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

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
  });
}
