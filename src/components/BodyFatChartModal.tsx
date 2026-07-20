import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  sex: 'male' | 'female';
  onClose: () => void;
  /** The profile's current body-fat %, if known – used only to mark the closest matching cell, never to recolor a band. */
  currentValuePct?: number;
  /** The profile's current age in years, if known – used to find the closest age row for the marker. */
  currentAge?: number;
};

type Band = 'low' | 'mid' | 'high';
type Row = { age: string; low: string; mid: string; high: string };

/** Full age-banded body-fat reference table, recovered from the pre-rewrite app's WeightCompositionModal. */
const ROWS: Record<'male' | 'female', Row[]> = {
  male: [
    { age: '18–20', low: '6.2–10.5', mid: '14.3–18.9', high: '20.2–24.1' },
    { age: '21–25', low: '7.3–11.6', mid: '15.4–20.0', high: '21.2–25.6' },
    { age: '26–30', low: '8.5–12.7', mid: '16.4–21.0', high: '22.3–26.8' },
    { age: '31–35', low: '9.4–13.7', mid: '17.5–22.1', high: '23.4–28.0' },
    { age: '36–40', low: '10.2–14.8', mid: '18.6–23.2', high: '24.5–29.2' },
    { age: '41–45', low: '11.5–15.9', mid: '19.8–24.7', high: '25.6–30.4' },
    { age: '46–50', low: '12.6–16.9', mid: '20.7–25.3', high: '26.6–31.5' },
    { age: '51–55', low: '13.7–17.9', mid: '21.6–26.0', high: '27.6–32.5' },
    { age: '56+', low: '14.7–19.1', mid: '22.8–27.4', high: '28.7–33.5' },
  ],
  female: [
    { age: '18–20', low: '15.7–19.7', mid: '23.2–27.7', high: '29.0–34.6' },
    { age: '21–25', low: '16.3–20.3', mid: '23.8–28.4', high: '29.6–35.2' },
    { age: '26–30', low: '16.9–20.9', mid: '24.5–29.0', high: '30.3–35.8' },
    { age: '31–35', low: '17.5–21.5', mid: '25.1–29.6', high: '30.9–36.4' },
    { age: '36–40', low: '18.2–22.2', mid: '25.7–30.2', high: '31.5–37.0' },
    { age: '41–45', low: '18.8–22.8', mid: '26.3–30.8', high: '32.1–37.7' },
    { age: '46–50', low: '19.4–23.4', mid: '26.9–31.4', high: '32.7–38.3' },
    { age: '51–55', low: '20.0–24.0', mid: '27.6–32.1', high: '33.4–38.9' },
    { age: '56+', low: '20.7–24.6', mid: '28.2–32.7', high: '34.0–39.5' },
  ],
};

/** Parses an age bracket like '31–35' or the open-ended '56+' into [min, max]. */
function parseAgeRange(ageLabel: string): [number, number] {
  if (ageLabel.endsWith('+')) {
    return [Number(ageLabel.slice(0, -1)), Infinity];
  }
  const [min, max] = ageLabel.split('–').map(Number);
  return [min, max];
}

/** Parses a value range like '14.3–18.9' into [min, max]. */
function parseValueRange(rangeLabel: string): [number, number] {
  const [min, max] = rangeLabel.split('–').map(Number);
  return [min, max];
}

/** Index of the row whose age bracket contains `age`, or the closest bracket if none matches exactly. */
function closestRowIndex(rows: Row[], age: number): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  rows.forEach((row, index) => {
    const [min, max] = parseAgeRange(row.age);
    const distance = age < min ? min - age : age > max ? age - max : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** Which of the row's three columns `value` falls into, or null if it's outside all three ranges. */
function matchingBand(row: Row, value: number): Band | null {
  const bands: Band[] = ['low', 'mid', 'high'];
  for (const band of bands) {
    const [min, max] = parseValueRange(row[band]);
    if (value >= min && value <= max) return band;
  }
  return null;
}

/** Full age-banded body-fat reference table (opened from the (i) icon next to the body-fat field). */
export function BodyFatChartModal({ visible, sex, onClose, currentValuePct, currentAge }: Props) {
  const { t } = useTranslation();
  const { colors, bodyFatBand } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rows = ROWS[sex];

  const marked = useMemo(() => {
    if (currentValuePct === undefined || currentAge === undefined) return null;
    const rowIndex = closestRowIndex(rows, currentAge);
    const band = matchingBand(rows[rowIndex], currentValuePct);
    return band ? { rowIndex, band } : null;
  }, [rows, currentValuePct, currentAge]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{t('bodyFatChart.title')}</Text>
              <InfoTooltip titleKey="tooltip.bodyFat.title" bodyKey="tooltip.bodyFat.body" />
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t(`bodyFatChart.${sex}`)}</Text>

          <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.ageCell, styles.headerCell]}>{t('bodyFatChart.age')}</Text>
            <Text style={[styles.cell, styles.headerCell, { backgroundColor: bodyFatBand.low }]}>
              {t('bodyFatChart.band.low')}
            </Text>
            <Text style={[styles.cell, styles.headerCell, { backgroundColor: bodyFatBand.mid }]}>
              {t('bodyFatChart.band.mid')}
            </Text>
            <Text style={[styles.cell, styles.headerCell, { backgroundColor: bodyFatBand.high }]}>
              {t('bodyFatChart.band.high')}
            </Text>
          </View>

          <ScrollView>
            {rows.map((row, rowIndex) => {
              const isMarkedRow = marked?.rowIndex === rowIndex;
              const markerStyle = (band: Band) =>
                isMarkedRow && marked?.band === band ? styles.markedCell : null;
              const marker = (band: Band) => (isMarkedRow && marked?.band === band ? ' •' : '');
              return (
                <View key={row.age} style={styles.row}>
                  <Text style={[styles.cell, styles.ageCell]}>{row.age}</Text>
                  <Text style={[styles.cell, { backgroundColor: bodyFatBand.low }, markerStyle('low')]}>
                    {row.low}
                    {marker('low')}
                  </Text>
                  <Text style={[styles.cell, { backgroundColor: bodyFatBand.mid }, markerStyle('mid')]}>
                    {row.mid}
                    {marker('mid')}
                  </Text>
                  <Text style={[styles.cell, { backgroundColor: bodyFatBand.high }, markerStyle('high')]}>
                    {row.high}
                    {marker('high')}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <Text style={styles.hint}>{t('bodyFatChart.hint')}</Text>
          {marked ? <Text style={styles.hint}>{t('bodyFatChart.currentValue')}</Text> : null}
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
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      marginRight: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 2,
    },
    cell: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
      paddingVertical: spacing.sm,
      borderRadius: 6,
    },
    headerCell: {
      fontWeight: '800',
      backgroundColor: colors.surface,
    },
    /** Marks the cell closest to the profile's own current value – a plain outline + dot, never a distinct hue. */
    markedCell: {
      borderWidth: 1.5,
      borderColor: colors.interactive,
      fontWeight: '800',
    },
    ageCell: {
      flex: 0.7,
      backgroundColor: 'transparent',
      color: colors.textSecondary,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
  });
}
