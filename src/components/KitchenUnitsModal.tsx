import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import {
  isKitchenVolumeUnit,
  kitchenVolumeToMl,
  kitchenWeightToGrams,
  type KitchenUnit,
} from '@/domain/units';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const UNIT_ROWS: { unit: KitchenUnit; display: string }[] = [
  { unit: 'tsp', display: '5 ml' },
  { unit: 'tbsp', display: '15 ml' },
  { unit: 'cup_quarter', display: '60 ml' },
  { unit: 'cup_third', display: '80 ml' },
  { unit: 'cup_half', display: '120 ml' },
  { unit: 'cup', display: '240 ml' },
  { unit: 'oz', display: '28.35 g' },
  { unit: 'lb', display: '453.6 g' },
];

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function KitchenUnitsModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<KitchenUnit>('tbsp');

  const amountNum = num(amount);
  const result =
    amountNum !== null
      ? isKitchenVolumeUnit(unit)
        ? `${round1(kitchenVolumeToMl(amountNum, unit))} ml`
        : `${round1(kitchenWeightToGrams(amountNum, unit))} g`
      : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.kitchenUnitsTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>{t('settings.kitchenUnitsTable')}</Text>
          <View style={styles.table}>
            {UNIT_ROWS.map((row) => (
              <View key={row.unit} style={styles.tableRow}>
                <Text style={styles.tableRowLabel}>{t(`kitchenUnitNames.${row.unit}`)}</Text>
                <Text style={styles.tableRowValue}>{row.display}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t('settings.kitchenCalculator')}</Text>
          <TextField
            label={t('settings.kitchenCalculatorAmount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <ChipSelect
            label={t('settings.kitchenUnitsTable')}
            options={UNIT_ROWS.map((row) => ({ value: row.unit, label: t(`kitchenUnitNames.${row.unit}`) }))}
            value={unit}
            onChange={(value) => setUnit(value as KitchenUnit)}
          />
          {result ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultValue}>{t('settings.kitchenCalculatorResult', { result })}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
    },
    content: {
      paddingBottom: spacing.xl,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    table: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tableRowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    tableRowValue: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    resultBox: {
      backgroundColor: colors.mint,
      borderRadius: radius.input,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    resultValue: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '700',
    },
  });
}
