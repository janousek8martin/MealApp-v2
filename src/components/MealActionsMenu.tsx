import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  hasClipboard: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onAdjustServings: () => void;
  onSaveAsRecipe: () => void;
};

/** The "⋯" actions sheet for one meal slot card (Plan screen, full variant only). */
export function MealActionsMenu({
  visible,
  onClose,
  hasClipboard,
  onCopy,
  onPaste,
  onClear,
  onAdjustServings,
  onSaveAsRecipe,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const run = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Pressable accessibilityRole="button" style={styles.row} onPress={() => run(onCopy)}>
            <Ionicons name="copy-outline" size={18} color={colors.text} />
            <Text style={styles.rowLabel}>{t('mealActions.copy')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            disabled={!hasClipboard}
            onPress={() => run(onPaste)}>
            <Ionicons name="clipboard-outline" size={18} color={hasClipboard ? colors.text : colors.textSecondary} />
            <Text style={[styles.rowLabel, !hasClipboard && styles.rowLabelDisabled]}>{t('mealActions.paste')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.row} onPress={() => run(onClear)}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>{t('mealActions.clear')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.row} onPress={() => run(onAdjustServings)}>
            <Ionicons name="resize-outline" size={18} color={colors.text} />
            <Text style={styles.rowLabel}>{t('mealActions.adjustServings')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.row} onPress={() => run(onSaveAsRecipe)}>
            <Ionicons name="bookmark-outline" size={18} color={colors.text} />
            <Text style={styles.rowLabel}>{t('mealActions.saveAsRecipe')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      backgroundColor: colors.background,
      borderRadius: radius.card,
      padding: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    rowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    rowLabelDisabled: {
      color: colors.textSecondary,
    },
  });
}
