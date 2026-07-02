import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
};

/**
 * UX rule from the brief: the destructive action stays hidden until the user
 * long-presses the edit button (~0.5 s); deleting always asks for confirmation.
 */
export function EditActions({ onEdit, onDelete, deleteConfirmTitle, deleteConfirmMessage }: Props) {
  const { t } = useTranslation();
  const [deleteRevealed, setDeleteRevealed] = useState(false);

  const confirmDelete = () => {
    Alert.alert(deleteConfirmTitle, deleteConfirmMessage, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        style={styles.edit}
        onPress={onEdit}
        delayLongPress={500}
        onLongPress={() => setDeleteRevealed(true)}>
        <Ionicons name="pencil" size={16} color={colors.primary} />
        <Text style={styles.editLabel}>{t('common.edit')}</Text>
      </Pressable>
      {deleteRevealed ? (
        <Pressable accessibilityRole="button" style={styles.delete} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteLabel}>{t('common.delete')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.chip,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  editLabel: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '600',
  },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.chip,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
  },
});
