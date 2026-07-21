import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, type ColorTokens } from '@/theme/tokens';

export const STEP_FOOTER_HEIGHT = 64; // excludes safe-area inset; export so screens can pad correctly

type Props = {
  onBack?: () => void;
  backLabel?: string;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  hideBack?: boolean;
};

export function StepFooter({ onBack, backLabel, onNext, nextLabel, nextDisabled, hideBack }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.sm }]}>
      {!hideBack && onBack ? (
        <Button
          label={backLabel ?? t('common.back')}
          variant="secondary"
          onPress={onBack}
          style={styles.back}
        />
      ) : (
        <View style={styles.back} />
      )}
      <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} style={styles.next} />
    </View>
  );
}

/**
 * Returns the total bottom padding a scroll container should apply so its
 * content isn't hidden behind the fixed StepFooter.
 * Calculation: STEP_FOOTER_HEIGHT + safe-area inset + spacing.lg
 */
export function useStepFooterPadding(): number {
  const insets = useSafeAreaInsets();
  return STEP_FOOTER_HEIGHT + insets.bottom + spacing.lg;
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    back: { flex: 1 },
    next: { flex: 2 },
  });
}
