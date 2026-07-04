import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;

/** Explanations for the 5 activity levels, opened from the (i) icon next to the activity picker. */
export function ActivityInfoModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('form.activity')}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView>
            {ACTIVITY_LEVELS.map((level) => (
              <View key={level} style={styles.row}>
                <Text style={styles.rowLabel}>{t(`activity.${level}`)}</Text>
                <Text style={styles.rowText}>{t(`activityInfo.${level}`)}</Text>
              </View>
            ))}
          </ScrollView>
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
      maxHeight: '75%',
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
    row: {
      borderRadius: radius.input,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    rowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    rowText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
    },
  });
}
