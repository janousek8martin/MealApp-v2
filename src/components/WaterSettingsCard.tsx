import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateProfileWaterSettings } from '@/db/repositories/profiles';
import { DEFAULT_GLASS_ML } from '@/domain/water';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  profileId: string;
  trackWater: boolean;
  /** null = auto-computed from weight/sex. */
  waterGoalMl: number | null;
  /** null = the 250 ml default. */
  waterGlassMl: number | null;
};

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

/** Per-profile water settings: tracking toggle, optional daily-goal override, and the size of one logged serving ("glass"). */
export function WaterSettingsCard({ profileId, trackWater, waterGoalMl, waterGlassMl }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [goalText, setGoalText] = useState(waterGoalMl !== null ? String(waterGoalMl) : '');
  const [glassText, setGlassText] = useState(waterGlassMl !== null ? String(waterGlassMl) : '');

  const save = (patch: Partial<{ trackWater: boolean; waterGoalMl: number | null; waterGlassMl: number | null }>) => {
    void updateProfileWaterSettings(db, profileId, {
      trackWater,
      waterGoalMl,
      waterGlassMl,
      ...patch,
    });
  };

  return (
    <>
      <SwitchRow label={t('water.toggle')} value={trackWater} onChange={(value) => save({ trackWater: value })} />
      <TextField
        label={t('settings.waterGoalOverride')}
        value={goalText}
        onChangeText={(text) => {
          setGoalText(text);
          save({ waterGoalMl: parseNumber(text) });
        }}
        keyboardType="decimal-pad"
        suffix="ml"
        placeholder={t('settings.waterGoalAuto')}
      />
      <TextField
        label={t('settings.waterGlassSize')}
        value={glassText}
        onChangeText={(text) => {
          setGlassText(text);
          save({ waterGlassMl: parseNumber(text) });
        }}
        keyboardType="decimal-pad"
        suffix="ml"
        placeholder={String(DEFAULT_GLASS_ML)}
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
