import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateProfileWaterSettings } from '@/db/repositories/profiles';
import { flOzToMl, mlToFlOz } from '@/domain/units';
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
  /** 'us' displays/accepts fl oz; amounts are still always stored in ml. */
  unitSystem: 'metric' | 'us';
};

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

/** Displays/parses a stored-ml value in the household's unit system - metric shows ml as-is, US converts to/from fl oz. */
function toDisplay(ml: number, unitSystem: 'metric' | 'us'): number {
  return unitSystem === 'us' ? mlToFlOz(ml) : ml;
}
function fromDisplay(value: number, unitSystem: 'metric' | 'us'): number {
  return unitSystem === 'us' ? flOzToMl(value) : value;
}

/** Per-profile water settings: tracking toggle, optional daily-goal override, and the size of one logged serving ("glass"). */
export function WaterSettingsCard({ profileId, trackWater, waterGoalMl, waterGlassMl, unitSystem }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unitSuffix = unitSystem === 'us' ? t('settings.waterUnitFlOz') : 'ml';
  const [goalText, setGoalText] = useState(
    waterGoalMl !== null ? String(Math.round(toDisplay(waterGoalMl, unitSystem) * 10) / 10) : '',
  );
  const [glassText, setGlassText] = useState(
    waterGlassMl !== null ? String(Math.round(toDisplay(waterGlassMl, unitSystem) * 10) / 10) : '',
  );

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
          const parsed = parseNumber(text);
          save({ waterGoalMl: parsed !== null ? fromDisplay(parsed, unitSystem) : null });
        }}
        keyboardType="decimal-pad"
        suffix={unitSuffix}
        placeholder={t('settings.waterGoalAuto')}
      />
      <TextField
        label={t('settings.waterGlassSize')}
        value={glassText}
        onChangeText={(text) => {
          setGlassText(text);
          const parsed = parseNumber(text);
          save({ waterGlassMl: parsed !== null ? fromDisplay(parsed, unitSystem) : null });
        }}
        keyboardType="decimal-pad"
        suffix={unitSuffix}
        placeholder={String(Math.round(toDisplay(DEFAULT_GLASS_ML, unitSystem)))}
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
