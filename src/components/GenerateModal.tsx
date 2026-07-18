import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { BUDGET_LEVELS, COOKING_EXPERIENCE_LEVELS, COOKING_TIME_LIMIT_OPTIONS } from '@/constants/options';
import { db } from '@/db/client';
import { updateHouseholdSettings } from '@/db/repositories/households';
import { useHouseholdSettings } from '@/hooks/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const ANY_TIME_KEY = 'any';

export type GeneratePeriod = 'day' | 'week' | 'month';

type Props = {
  visible: boolean;
  householdId: string;
  generating: boolean;
  /** Past days are read-only, so "day" isn't offered when the viewed date is in the past. */
  allowDay: boolean;
  onClose: () => void;
  onGenerate: (period: GeneratePeriod) => void;
};

/**
 * Replaces the old separate "generate day"/"generate week" buttons: pick a
 * period (day/week/month) and, right below it, the household's generator
 * constraints - so the user can flip meal-prep mode, variety, budget, etc.
 * right before generating instead of hunting for them in Settings.
 */
export function GenerateModal({ visible, householdId, generating, allowDay, onClose, onGenerate }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const settings = useHouseholdSettings(householdId);
  const [period, setPeriod] = useState<GeneratePeriod>('week');

  useEffect(() => {
    if (!allowDay && period === 'day') setPeriod('week');
  }, [allowDay, period]);

  if (!settings) return null;

  const periodOptions = [
    ...(allowDay ? [{ value: 'day', label: t('generateModal.periodDay') }] : []),
    { value: 'week', label: t('generateModal.periodWeek') },
    { value: 'month', label: t('generateModal.periodMonth') },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('generateModal.title')}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView>
            <ChipSelect
              label={t('generateModal.periodLabel')}
              options={periodOptions}
              value={period}
              onChange={(v) => setPeriod(v as GeneratePeriod)}
            />

            <Text style={styles.sectionTitle}>{t('generateModal.settingsLabel')}</Text>

            <SwitchRow
              label={t('householdCarousel.mealPrepMode')}
              hint={t('householdCarousel.mealPrepModeHint')}
              value={settings.mealPrepMode}
              onChange={(v) => updateHouseholdSettings(db, householdId, { mealPrepMode: v })}
            />

            <SwitchRow
              label={t('settings.preferPantryItems')}
              hint={t('settings.preferPantryItemsHint')}
              value={settings.preferPantryItems}
              onChange={(v) => updateHouseholdSettings(db, householdId, { preferPantryItems: v })}
            />

            <ChipSelect
              label={t('settings.mealVariety')}
              options={(['low', 'medium', 'high'] as const).map((level) => ({
                value: level,
                label: t(`mealVariety.${level}`),
              }))}
              value={settings.mealVarietyLevel}
              onChange={(v) => void updateHouseholdSettings(db, householdId, { mealVarietyLevel: v as 'low' | 'medium' | 'high' })}
            />

            <ChipSelect
              label={t('settings.cookingExperienceLevel')}
              options={COOKING_EXPERIENCE_LEVELS.map((level) => ({ value: level, label: t(`cookingExperience.${level}`) }))}
              value={settings.cookingExperienceLevel}
              onChange={(v) =>
                void updateHouseholdSettings(db, householdId, { cookingExperienceLevel: v as 'easy' | 'medium' | 'hard' })
              }
            />

            <ChipSelect
              label={t('settings.cookingTimeLimit')}
              options={COOKING_TIME_LIMIT_OPTIONS.map((minutes) => ({
                value: minutes === null ? ANY_TIME_KEY : String(minutes),
                label: minutes === null ? t('cookingTime.any') : t('cookingTime.upTo', { minutes }),
              }))}
              value={settings.cookingTimeLimitMinutes === null ? ANY_TIME_KEY : String(settings.cookingTimeLimitMinutes)}
              onChange={(v) =>
                void updateHouseholdSettings(db, householdId, {
                  cookingTimeLimitMinutes: v === ANY_TIME_KEY ? null : Number(v),
                })
              }
            />

            <ChipSelect
              label={t('settings.budgetLevel')}
              options={BUDGET_LEVELS.map((level) => ({ value: level, label: t(`budgetLevel.${level}`) }))}
              value={settings.budgetLevel}
              onChange={(v) => void updateHouseholdSettings(db, householdId, { budgetLevel: v as 'low' | 'medium' | 'high' })}
            />
          </ScrollView>

          <Button
            label={generating ? t('today.generating') : t('generateModal.confirm')}
            onPress={() => onGenerate(period)}
            disabled={generating}
            style={styles.generateButton}
          />
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      padding: spacing.md,
      paddingBottom: spacing.xl,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    generateButton: {
      marginTop: spacing.md,
    },
  });
}
