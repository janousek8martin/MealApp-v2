import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { navyBodyFatPct } from '@/domain/bodyFat';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  sex: 'male' | 'female';
  heightCm: number | null;
  onClose: () => void;
  onUse: (bodyFatPct: number) => void;
};

/**
 * Navy tape method calculator (~±3–4 % error) – the default way to estimate
 * body fat; more accurate sources (DEXA, calipers) can be typed in manually.
 */
export function NavyCalculatorModal({ visible, sex, heightCm, onClose, onUse }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [hip, setHip] = useState('');

  const result = useMemo(() => {
    const waistCm = Number(waist.replace(',', '.'));
    const neckCm = Number(neck.replace(',', '.'));
    const hipCm = Number(hip.replace(',', '.'));
    if (!heightCm || !waistCm || !neckCm || (sex === 'female' && !hipCm)) return null;
    try {
      const pct = navyBodyFatPct({
        sex,
        heightCm,
        waistCm,
        neckCm,
        hipCm: sex === 'female' ? hipCm : undefined,
      });
      return Number.isFinite(pct) && pct > 1 && pct < 70 ? Math.round(pct * 10) / 10 : null;
    } catch {
      return null;
    }
  }, [waist, neck, hip, sex, heightCm]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('navy.title')}</Text>
          <Text style={styles.subtitle}>{t('navy.subtitle')}</Text>

          <TextField
            label={t('navy.waist')}
            value={waist}
            onChangeText={setWaist}
            keyboardType="decimal-pad"
            suffix="cm"
          />
          <TextField
            label={t('navy.neck')}
            value={neck}
            onChangeText={setNeck}
            keyboardType="decimal-pad"
            suffix="cm"
          />
          {sex === 'female' ? (
            <TextField
              label={t('navy.hip')}
              value={hip}
              onChangeText={setHip}
              keyboardType="decimal-pad"
              suffix="cm"
            />
          ) : null}

          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>{t('navy.result')}</Text>
            <Text style={styles.resultValue}>{result !== null ? `${result} %` : '–'}</Text>
          </View>

          <View style={styles.actions}>
            <Button label={t('common.cancel')} variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              label={t('navy.use')}
              onPress={() => result !== null && onUse(result)}
              disabled={result === null}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(36, 54, 32, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    resultBox: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.input,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    resultLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    resultValue: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    action: {
      flex: 1,
    },
  });
}
