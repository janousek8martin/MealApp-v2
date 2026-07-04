import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  sex: 'male' | 'female';
  onClose: () => void;
};

type Row = { age: string; ideal: string; average: string; overweight: string };

/** Full age-banded body-fat reference table, recovered from the pre-rewrite app's WeightCompositionModal. */
const ROWS: Record<'male' | 'female', Row[]> = {
  male: [
    { age: '18–20', ideal: '6.2–10.5', average: '14.3–18.9', overweight: '20.2–24.1' },
    { age: '21–25', ideal: '7.3–11.6', average: '15.4–20.0', overweight: '21.2–25.6' },
    { age: '26–30', ideal: '8.5–12.7', average: '16.4–21.0', overweight: '22.3–26.8' },
    { age: '31–35', ideal: '9.4–13.7', average: '17.5–22.1', overweight: '23.4–28.0' },
    { age: '36–40', ideal: '10.2–14.8', average: '18.6–23.2', overweight: '24.5–29.2' },
    { age: '41–45', ideal: '11.5–15.9', average: '19.8–24.7', overweight: '25.6–30.4' },
    { age: '46–50', ideal: '12.6–16.9', average: '20.7–25.3', overweight: '26.6–31.5' },
    { age: '51–55', ideal: '13.7–17.9', average: '21.6–26.0', overweight: '27.6–32.5' },
    { age: '56+', ideal: '14.7–19.1', average: '22.8–27.4', overweight: '28.7–33.5' },
  ],
  female: [
    { age: '18–20', ideal: '15.7–19.7', average: '23.2–27.7', overweight: '29.0–34.6' },
    { age: '21–25', ideal: '16.3–20.3', average: '23.8–28.4', overweight: '29.6–35.2' },
    { age: '26–30', ideal: '16.9–20.9', average: '24.5–29.0', overweight: '30.3–35.8' },
    { age: '31–35', ideal: '17.5–21.5', average: '25.1–29.6', overweight: '30.9–36.4' },
    { age: '36–40', ideal: '18.2–22.2', average: '25.7–30.2', overweight: '31.5–37.0' },
    { age: '41–45', ideal: '18.8–22.8', average: '26.3–30.8', overweight: '32.1–37.7' },
    { age: '46–50', ideal: '19.4–23.4', average: '26.9–31.4', overweight: '32.7–38.3' },
    { age: '51–55', ideal: '20.0–24.0', average: '27.6–32.1', overweight: '33.4–38.9' },
    { age: '56+', ideal: '20.7–24.6', average: '28.2–32.7', overweight: '34.0–39.5' },
  ],
};

/** Full age-banded body-fat reference table (opened from the (i) icon next to the body-fat field). */
export function BodyFatChartModal({ visible, sex, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, bodyFatBand } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rows = ROWS[sex];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('bodyFatChart.title')}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t(`bodyFatChart.${sex}`)}</Text>

          <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.ageCell, styles.headerCell]}>{t('bodyFatChart.age')}</Text>
            <Text style={[styles.cell, styles.headerCell, { backgroundColor: bodyFatBand.ideal }]}>
              {t('bodyFatChart.band.ideal')}
            </Text>
            <Text style={[styles.cell, styles.headerCell, { backgroundColor: bodyFatBand.average }]}>
              {t('bodyFatChart.band.average')}
            </Text>
            <Text style={[styles.cell, styles.headerCell, { backgroundColor: bodyFatBand.overweight }]}>
              {t('bodyFatChart.band.overweight')}
            </Text>
          </View>

          <ScrollView>
            {rows.map((row) => (
              <View key={row.age} style={styles.row}>
                <Text style={[styles.cell, styles.ageCell]}>{row.age}</Text>
                <Text style={[styles.cell, { backgroundColor: bodyFatBand.ideal }]}>{row.ideal}</Text>
                <Text style={[styles.cell, { backgroundColor: bodyFatBand.average }]}>{row.average}</Text>
                <Text style={[styles.cell, { backgroundColor: bodyFatBand.overweight }]}>{row.overweight}</Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.hint}>{t('bodyFatChart.hint')}</Text>
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
