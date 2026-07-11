import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateProfileWaterSettings } from '@/db/repositories/profiles';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  profileId: string;
  trackWater: boolean;
  /** null = auto-computed from weight/sex. */
  waterGoalMl: number | null;
};

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

/** Settings accordion: per-profile water tracking toggle + optional goal override. */
export function WaterSettingsCard({ profileId, trackWater, waterGoalMl }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [goalText, setGoalText] = useState(waterGoalMl !== null ? String(waterGoalMl) : '');

  return (
    <>
      <SwitchRow
        label={t('water.toggle')}
        value={trackWater}
        onChange={(value) => void updateProfileWaterSettings(db, profileId, { trackWater: value, waterGoalMl })}
      />
      <TextField
        label={t('settings.waterGoalOverride')}
        value={goalText}
        onChangeText={(text) => {
          setGoalText(text);
          void updateProfileWaterSettings(db, profileId, { trackWater, waterGoalMl: parseNumber(text) });
        }}
        keyboardType="decimal-pad"
        suffix="ml"
        placeholder={t('settings.waterGoalAuto')}
      />
      <Text style={styles.hint}>{t('water.hint')}</Text>
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    hint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: -spacing.sm,
    },
  });
}
