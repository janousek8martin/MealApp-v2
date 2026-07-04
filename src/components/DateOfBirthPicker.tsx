import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  label: string;
  /** ISO 'YYYY-MM-DD', or '' when not yet set. */
  value: string;
  onChange: (iso: string) => void;
  error?: string;
};

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 3;
const MIN_YEAR = 1920;

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function monthLabels(language: string): string[] {
  const formatter = new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(2026, i, 1)));
}

function parseIso(value: string): { day: number; month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatIso(day: number, month: number, year: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * One vertical wheel column (day/month/year) – tap or scroll-settle both
 * commit a value. Plain ScrollView rather than FlatList: these lists are
 * small and bounded (max ~107 years), so virtualization buys nothing and
 * would otherwise nest a VirtualizedList inside the form's outer ScrollView.
 */
function WheelColumn({
  values,
  labels,
  selectedValue,
  onSelect,
}: {
  values: number[];
  labels: string[];
  selectedValue: number;
  onSelect: (value: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createWheelStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    // Only on mount – subsequent selection changes are driven by the user's
    // own scroll/tap, which already keep the view in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    onSelect(values[clamped]);
  };

  const commitIndex = (index: number) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    onSelect(values[index]);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
      onMomentumScrollEnd={onMomentumScrollEnd}>
      {values.map((item, index) => {
        const selected = item === selectedValue;
        return (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => commitIndex(index)}
            style={styles.row}>
            <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{labels[index]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Expandable European-order (day/month/year) date-of-birth picker – replaces free-text entry. */
export function DateOfBirthPicker({ label, value, onChange, error }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const currentYear = new Date().getFullYear();
  const fallback = { day: 1, month: 1, year: currentYear - 30 };
  const parsed = parseIso(value) ?? fallback;
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  const months = useMemo(() => monthLabels(i18n.language), [i18n.language]);
  const monthValues = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const dayCount = daysInMonth(month, year);
  const dayValues = useMemo(() => Array.from({ length: dayCount }, (_, i) => i + 1), [dayCount]);
  const dayLabels = useMemo(() => dayValues.map(String), [dayValues]);
  const yearValues = useMemo(
    () => Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => currentYear - i),
    [currentYear],
  );
  const yearLabels = useMemo(() => yearValues.map(String), [yearValues]);

  const commit = (nextDay: number, nextMonth: number, nextYear: number) => {
    const clampedDay = Math.min(nextDay, daysInMonth(nextMonth, nextYear));
    setDay(clampedDay);
    setMonth(nextMonth);
    setYear(nextYear);
    onChange(formatIso(clampedDay, nextMonth, nextYear));
  };

  const displayValue = parseIso(value)
    ? `${parsed.day}. ${parsed.month}. ${parsed.year}`
    : t('form.selectDate');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((prev) => !prev)}
        style={[styles.trigger, !!error && styles.triggerError]}>
        <Text style={[styles.triggerText, !parseIso(value) && styles.triggerPlaceholder]}>
          {displayValue}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {expanded ? (
        <View style={styles.wheelRow}>
          <View style={styles.wheelColumn}>
            <WheelColumn
              key={`day-${dayCount}`}
              values={dayValues}
              labels={dayLabels}
              selectedValue={day}
              onSelect={(d) => commit(d, month, year)}
            />
          </View>
          <View style={[styles.wheelColumn, styles.wheelColumnMonth]}>
            <WheelColumn
              values={monthValues}
              labels={months}
              selectedValue={month}
              onSelect={(m) => commit(day, m, year)}
            />
          </View>
          <View style={styles.wheelColumn}>
            <WheelColumn
              values={yearValues}
              labels={yearLabels}
              selectedValue={year}
              onSelect={(y) => commit(day, month, y)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.xs,
      fontWeight: '600',
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
    },
    triggerError: {
      borderColor: colors.danger,
    },
    triggerText: {
      color: colors.text,
      fontSize: typography.body,
    },
    triggerPlaceholder: {
      color: colors.textSecondary,
    },
    error: {
      color: colors.danger,
      fontSize: typography.small,
      marginTop: spacing.xs,
    },
    wheelRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    wheelColumn: {
      flex: 1,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    wheelColumnMonth: {
      flex: 1.4,
    },
  });
}

function createWheelStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    rowLabelSelected: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
}
