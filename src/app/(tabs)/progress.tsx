import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NavyCalculatorModal } from '@/components/NavyCalculatorModal';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { TdciCard } from '@/components/TdciCard';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { WeightChart } from '@/components/WeightChart';
import { db } from '@/db/client';
import { addBodyMetric } from '@/db/repositories/profiles';
import { todayIsoDate } from '@/db/time';
import { shouldRecommendMaintenance } from '@/domain/goals';
import {
  useActiveProfile,
  useBodyMetricHistory,
  useHousehold,
  useLatestBodyMetric,
  useProfileTargets,
} from '@/hooks/data';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const targets = useProfileTargets(activeProfile);
  const latestMetric = useLatestBodyMetric(activeProfile?.id);
  const history = useBodyMetricHistory(activeProfile?.id);

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [navyVisible, setNavyVisible] = useState(false);

  // Prefill from the latest entry so logging today only means confirming/adjusting.
  useEffect(() => {
    if (latestMetric) {
      setWeight(String(latestMetric.weightKg));
      setBodyFat(latestMetric.bodyFatPct !== null ? String(latestMetric.bodyFatPct) : '');
    }
  }, [latestMetric?.id]);

  const canSave = num(weight) !== null && num(weight)! > 0;

  const saveEntry = async () => {
    if (!activeProfile || !canSave) return;
    await addBodyMetric(db, activeProfile.id, {
      weightKg: num(weight)!,
      bodyFatPct: num(bodyFat),
      method: num(bodyFat) !== null ? 'manual' : null,
    });
  };

  const recommendMaintenance =
    activeProfile &&
    activeProfile.goal !== 'maintain' &&
    history.length > 1 &&
    history[0].bodyFatPct !== null &&
    latestMetric?.bodyFatPct != null &&
    shouldRecommendMaintenance({
      sex: activeProfile.sex,
      startBodyFatPct: history[0].bodyFatPct!,
      currentBodyFatPct: latestMetric.bodyFatPct,
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('tabs.progress')}</Text>

        {household ? <ProfileSwitcher householdId={household.id} /> : null}

        {activeProfile && targets ? <TdciCard name={activeProfile.name} targets={targets} /> : null}

        {recommendMaintenance ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t('progress.dietCycleBanner')}</Text>
          </View>
        ) : null}

        {activeProfile ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('progress.logWeight')}</Text>
            <TextField
              label={t('progress.weight')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              suffix="kg"
            />
            <TextField
              label={t('progress.bodyFat')}
              value={bodyFat}
              onChangeText={setBodyFat}
              keyboardType="decimal-pad"
              suffix="%"
            />
            <Button
              label={t('navy.open')}
              variant="secondary"
              onPress={() => setNavyVisible(true)}
              style={styles.navyButton}
            />
            <Button label={t('common.save')} onPress={saveEntry} disabled={!canSave} />
          </View>
        ) : null}

        {history.length > 0 ? (
          <View style={styles.chartSection}>
            <Text style={styles.cardTitle}>{t('progress.chartTitle')}</Text>
            <WeightChart points={history.map((h) => ({ date: h.date, weightKg: h.weightKg }))} />
          </View>
        ) : null}

        {activeProfile && (activeProfile.goalWeightKg !== null || activeProfile.goalBodyFatPct !== null) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('progress.currentGoal')}</Text>
            <Text style={styles.goalLine}>{t(`goal.${activeProfile.goal}`)}</Text>
            {activeProfile.goalWeightKg !== null ? (
              <Text style={styles.goalLine}>
                {t('progress.goalWeightLabel')}: {activeProfile.goalWeightKg} kg
              </Text>
            ) : null}
            {activeProfile.goalBodyFatPct !== null ? (
              <Text style={styles.goalLine}>
                {t('progress.goalBodyFatLabel')}: {activeProfile.goalBodyFatPct} %
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {activeProfile ? (
        <NavyCalculatorModal
          visible={navyVisible}
          sex={activeProfile.sex}
          heightCm={activeProfile.heightCm}
          onClose={() => setNavyVisible(false)}
          onUse={(pct) => {
            setBodyFat(String(pct));
            setNavyVisible(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  banner: {
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  bannerText: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  navyButton: {
    marginBottom: spacing.sm,
  },
  chartSection: {
    marginTop: spacing.md,
  },
  goalLine: {
    color: colors.text,
    fontSize: typography.body,
    marginBottom: spacing.xs,
  },
});
