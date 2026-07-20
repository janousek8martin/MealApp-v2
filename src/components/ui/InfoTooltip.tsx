import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  /** i18n key for the sheet's short heading (2-4 words). */
  titleKey: string;
  /** i18n key for the sheet's 1-2 sentence explanation. */
  bodyKey: string;
  /**
   * Icon tint override for contexts where `colors.textSecondary` doesn't have
   * enough contrast (e.g. on top of the hero gradient) - defaults to
   * `colors.textSecondary`, this app's standard low-emphasis icon color.
   */
  color?: string;
};

/**
 * Small (i) affordance ("ⓘ") that opens a short bottom-sheet explanation on
 * tap - never a hover-only tooltip (doesn't exist on touch), never a
 * full-screen takeover for one line of copy. Reuses this codebase's
 * established transparent-Modal + backdrop-Pressable (closes on tap) +
 * inner-sheet-Pressable (stops propagation) shape, see WaterCard's settings
 * sheet. Every usage site is just two i18n keys - no per-site customization
 * lives in this component; copy, tone, and length are entirely owned by the
 * locale files.
 */
export function InfoTooltip({ titleKey, bodyKey, color }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(titleKey)}
        onPress={() => setVisible(true)}
        hitSlop={12}
        style={styles.iconWrap}>
        <Ionicons name="information-circle-outline" size={16} color={color ?? colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.header}>
              <Text style={styles.title}>{t(titleKey)}</Text>
              <Pressable accessibilityRole="button" onPress={() => setVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.body}>{t(bodyKey)}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: {
      flex: 1,
      marginRight: spacing.sm,
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    body: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
    },
  });
}
