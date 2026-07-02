import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { bodyFatBand, colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  visible: boolean;
  sex: 'male' | 'female';
  onClose: () => void;
};

const RANGES = {
  male: [
    { band: 'ideal' as const, label: '6–17 %' },
    { band: 'average' as const, label: '18–24 %' },
    { band: 'overweight' as const, label: '25 %+' },
  ],
  female: [
    { band: 'ideal' as const, label: '14–24 %' },
    { band: 'average' as const, label: '25–31 %' },
    { band: 'overweight' as const, label: '32 %+' },
  ],
};

/** Reference body-fat ranges (ACE classification), shown as a simple color-coded info card. */
export function BodyFatChartModal({ visible, sex, onClose }: Props) {
  const { t } = useTranslation();

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

          {RANGES[sex].map((row) => (
            <View key={row.band} style={[styles.row, { backgroundColor: bodyFatBand[row.band] }]}>
              <Text style={styles.rowLabel}>{t(`bodyFatChart.band.${row.band}`)}</Text>
              <Text style={styles.rowValue}>{row.label}</Text>
            </View>
          ))}

          <Text style={styles.hint}>{t('bodyFatChart.hint')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.input,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  rowValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
