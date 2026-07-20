import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  count: number;
  onPress: () => void;
};

/**
 * Evolves the Home screen's former inline pantry-expiring quick card
 * (Task 12): now fed by the same `groupPantryItems()` `expiringSoon` bucket
 * (shared with the Pantry screen's own pinned "Brzy spotřebovat" section,
 * see `src/domain/pantryGrouping.ts`) instead of a separately-derived
 * `expiresAt <= today` check - this also fixes Home previously showing a
 * different count than Pantry for the same thing.
 *
 * Renders nothing when `count` is 0: an empty "0 items expiring" card is
 * exactly the non-alarming-but-still-unnecessary chrome this app's
 * silent-skip design principle avoids.
 */
export function PantryUseSoonCard({ count, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (count <= 0) return null;

  return (
    <Pressable accessibilityRole="button" style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Ionicons name="file-tray-stacked-outline" size={16} color={colors.attention} />
        <Text style={styles.value}>{count}</Text>
      </View>
      <Text style={styles.label}>{t('today.pantryExpiring')}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      minHeight: 72,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.attention,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    value: {
      color: colors.attention,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    label: {
      color: colors.attention,
      fontSize: typography.small,
      textAlign: 'center',
    },
  });
}
