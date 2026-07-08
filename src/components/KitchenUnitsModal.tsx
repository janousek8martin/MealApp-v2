import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { createCustomKitchenUnit, deleteCustomKitchenUnit, updateCustomKitchenUnit } from '@/db/repositories/units';
import {
  customUnitToReference,
  isKitchenVolumeUnit,
  kitchenVolumeToMl,
  kitchenWeightToGrams,
  mergedKitchenUnitRows,
  type CustomKitchenUnit,
  type KitchenUnit,
  type KitchenUnitRow,
} from '@/domain/units';
import { useCustomKitchenUnits } from '@/hooks/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const BUILT_IN_UNITS: KitchenUnit[] = [
  'tsp',
  'tbsp',
  'cup_eighth',
  'cup_quarter',
  'cup_third',
  'cup_half',
  'cup_two_thirds',
  'cup',
  'fl_oz',
  'pint',
  'quart',
  'gallon',
  'oz',
  'lb',
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
  householdId: string;
};

type DraftUnit = { id: string | null; name: string; unitType: 'volume' | 'weight'; conversionValue: string; aliases: string };

const EMPTY_DRAFT: DraftUnit = { id: null, name: '', unitType: 'volume', conversionValue: '', aliases: '' };

export function KitchenUnitsModal({ visible, onClose, householdId }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [amount, setAmount] = useState('1');
  const customUnits = useCustomKitchenUnits(householdId);
  const rows = useMemo(
    () => mergedKitchenUnitRows((unit) => t(`kitchenUnitNames.${unit}`), customUnits),
    [customUnits, t],
  );
  const [selectedRowId, setSelectedRowId] = useState<string>('tbsp');
  const [draft, setDraft] = useState<DraftUnit | null>(null);

  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? rows[0];
  const amountNum = num(amount);
  const result =
    amountNum !== null && selectedRow
      ? BUILT_IN_UNITS.includes(selectedRow.id as KitchenUnit)
        ? isKitchenVolumeUnit(selectedRow.id as KitchenUnit)
          ? `${round1(kitchenVolumeToMl(amountNum, selectedRow.id as never))} ml`
          : `${round1(kitchenWeightToGrams(amountNum, selectedRow.id as never))} g`
        : `${round1(customUnitToReference(amountNum, selectedRow as unknown as CustomKitchenUnit))} ${selectedRow.unitType === 'volume' ? 'ml' : 'g'}`
      : null;

  const saveDraft = async () => {
    if (!draft) return;
    const conversionValue = num(draft.conversionValue);
    if (!draft.name.trim() || conversionValue === null || conversionValue <= 0) return;
    const input = {
      name: draft.name.trim(),
      unitType: draft.unitType,
      conversionValue,
      aliases: draft.aliases
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0),
    };
    if (draft.id) {
      await updateCustomKitchenUnit(db, draft.id, input);
    } else {
      await createCustomKitchenUnit(db, householdId, input);
    }
    setDraft(null);
  };

  const editRow = (row: KitchenUnitRow) => {
    setDraft({
      id: row.id,
      name: row.name,
      unitType: row.unitType,
      conversionValue: String(row.conversionValue),
      aliases: row.aliases.join(', '),
    });
  };

  const confirmDeleteRow = (row: KitchenUnitRow) => {
    Alert.alert(t('settings.deleteCustomUnitTitle'), t('settings.deleteCustomUnitMessage', { name: row.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteCustomKitchenUnit(db, row.id) },
    ]);
  };

  const draftValid = !!draft && draft.name.trim().length > 0 && num(draft.conversionValue) !== null && num(draft.conversionValue)! > 0;

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
            {rows.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                <View style={styles.tableRowLabelBlock}>
                  <Text style={styles.tableRowLabel}>{row.name}</Text>
                  {row.aliases.length > 0 ? (
                    <Text style={styles.tableRowAliases}>{row.aliases.join(', ')}</Text>
                  ) : null}
                </View>
                <Text style={styles.tableRowValue}>
                  {round1(row.conversionValue)} {row.unitType === 'volume' ? 'ml' : 'g'}
                </Text>
                {row.isCustom ? (
                  <View style={styles.tableRowActions}>
                    <Pressable accessibilityRole="button" onPress={() => editRow(row)} hitSlop={8}>
                      <Ionicons name="pencil" size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => confirmDeleteRow(row)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {draft ? (
            <View style={styles.draftForm}>
              <Text style={styles.sectionTitle}>
                {draft.id ? t('settings.editCustomUnit') : t('settings.addCustomUnit')}
              </Text>
              <TextField
                label={t('settings.customUnitName')}
                value={draft.name}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
              />
              <ChipSelect
                label={t('settings.customUnitType')}
                options={[
                  { value: 'volume', label: t('settings.customUnitVolume') },
                  { value: 'weight', label: t('settings.customUnitWeight') },
                ]}
                value={draft.unitType}
                onChange={(v) => setDraft({ ...draft, unitType: v as 'volume' | 'weight' })}
              />
              <TextField
                label={draft.unitType === 'volume' ? t('settings.customUnitValueMl') : t('settings.customUnitValueG')}
                value={draft.conversionValue}
                onChangeText={(v) => setDraft({ ...draft, conversionValue: v })}
                keyboardType="decimal-pad"
              />
              <TextField
                label={t('settings.customUnitAliases')}
                value={draft.aliases}
                onChangeText={(v) => setDraft({ ...draft, aliases: v })}
              />
              <View style={styles.draftActions}>
                <Pressable accessibilityRole="button" style={styles.draftCancel} onPress={() => setDraft(null)}>
                  <Text style={styles.draftCancelLabel}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.draftSave, !draftValid && styles.draftSaveDisabled]}
                  disabled={!draftValid}
                  onPress={() => void saveDraft()}>
                  <Text style={styles.draftSaveLabel}>{t('common.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" style={styles.addRow} onPress={() => setDraft(EMPTY_DRAFT)}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addRowLabel}>{t('settings.addCustomUnit')}</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>{t('settings.kitchenCalculator')}</Text>
          <TextField
            label={t('settings.kitchenCalculatorAmount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <ChipSelect
            label={t('settings.kitchenUnitsTable')}
            options={rows.map((row) => ({ value: row.id, label: row.name }))}
            value={selectedRowId}
            onChange={setSelectedRowId}
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    tableRowLabelBlock: {
      flex: 1,
    },
    tableRowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    tableRowAliases: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 1,
    },
    tableRowValue: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    tableRowActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    addRowLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    draftForm: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    draftActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    draftCancel: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
    },
    draftCancelLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    draftSave: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.input,
      backgroundColor: colors.primary,
    },
    draftSaveDisabled: {
      opacity: 0.45,
    },
    draftSaveLabel: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '600',
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
