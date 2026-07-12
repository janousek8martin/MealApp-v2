import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const STEP = 0.25;
const MIN_MULTIPLIER = 0.25;
const MAX_MULTIPLIER = 3;

type Props = {
  visible: boolean;
  initialMultiplier: number;
  onClose: () => void;
  onConfirm: (multiplier: number) => void;
};

/** "Adjust servings" – edits one portion's scaling multiplier in ¼x steps. */
export function AdjustServingsModal({ visible, initialMultiplier, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [multiplier, setMultiplier] = useState(initialMultiplier);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{t('mealActions.adjustServings')}</Text>
          <View style={styles.stepperRow}>
            <Button
              variant="secondary"
              label="–"
              style={styles.stepperButton}
              onPress={() => setMultiplier((m) => Math.max(MIN_MULTIPLIER, Math.round((m - STEP) * 100) / 100))}
            />
            <Text style={styles.stepperValue}>{multiplier.toFixed(2)}×</Text>
            <Button
              variant="secondary"
              label="+"
              style={styles.stepperButton}
              onPress={() => setMultiplier((m) => Math.min(MAX_MULTIPLIER, Math.round((m + STEP) * 100) / 100))}
            />
          </View>
          <Button label={t('common.save')} onPress={() => onConfirm(multiplier)} style={styles.confirmButton} />
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
      padding: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    stepperButton: {
      width: 44,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
    },
    stepperValue: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      minWidth: 80,
      textAlign: 'center',
    },
    confirmButton: {},
  });
}
