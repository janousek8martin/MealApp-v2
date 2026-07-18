import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { addMonths, isoWeekday, monthGridDates } from '@/domain/week';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  /** The date whose month the grid opens on (usually the currently viewed week's Monday). */
  initialDate: string;
  today: string;
  selectedDate: string;
  onSelectDate: (dateIso: string) => void;
  onClose: () => void;
};

function monthTitle(dateIso: string, language: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const formatted = new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Compact tap-to-jump month grid, opened from the caret next to the Plan screen's month title. */
export function PlanMonthPickerModal({ visible, initialDate, today, selectedDate, onSelectDate, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cursor, setCursor] = useState(initialDate);

  const viewedMonth = cursor;
  const grid = useMemo(() => monthGridDates(cursor), [cursor]);
  const gridMonthNumber = cursor.split('-')[1];

  const weekdayLabels = useMemo(() => {
    // Monday..Sunday short labels for the header row, locale-aware.
    return grid.slice(0, 7).map((d) => {
      const [y, m, day] = d.split('-').map(Number);
      return new Intl.DateTimeFormat(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'narrow' }).format(
        new Date(y, m - 1, day),
      );
    });
  }, [grid, i18n.language]);

  const goToMonth = (dateIso: string) => {
    setCursor(dateIso);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      onShow={() => setCursor(initialDate)}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => goToMonth(addMonths(viewedMonth, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{monthTitle(viewedMonth, i18n.language)}</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => goToMonth(addMonths(viewedMonth, 1))}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, i) => (
              <Text key={i} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map((dateIso) => {
              const inMonth = dateIso.split('-')[1] === gridMonthNumber;
              const isToday = dateIso === today;
              const isSelected = dateIso === selectedDate;
              const day = Number(dateIso.split('-')[2]);
              return (
                <Pressable
                  key={dateIso}
                  accessibilityRole="button"
                  style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
                  onPress={() => {
                    onSelectDate(dateIso);
                    onClose();
                  }}>
                  <Text
                    style={[
                      styles.cellLabel,
                      !inMonth && styles.cellLabelOutside,
                      isSelected && styles.cellLabelSelected,
                    ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            style={styles.todayButton}
            onPress={() => {
              onSelectDate(today);
              onClose();
            }}>
            <Text style={styles.todayButtonLabel}>{t('planScreen.jumpToToday')}</Text>
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 360,
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
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    weekdayLabel: {
      flex: 1,
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.chip,
      marginVertical: 1,
    },
    cellSelected: {
      backgroundColor: colors.primary,
    },
    cellToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    cellLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    cellLabelOutside: {
      color: colors.textSecondary,
      opacity: 0.4,
    },
    cellLabelSelected: {
      color: colors.onPrimary,
      fontWeight: '800',
    },
    todayButton: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.chip,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    todayButtonLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '700',
    },
  });
}
