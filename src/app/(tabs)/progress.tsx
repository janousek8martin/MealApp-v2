import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NavyCalculatorModal } from '@/components/NavyCalculatorModal';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { TdciCard } from '@/components/TdciCard';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { WeightChart } from '@/components/WeightChart';
import { WeightProjectionChart } from '@/components/WeightProjectionChart';
import { db } from '@/db/client';
import { addBodyMetric } from '@/db/repositories/profiles';
import { todayIsoDate } from '@/db/time';
import { estimateAdaptiveTdee } from '@/domain/adaptiveTdee';
import { shouldRecommendMaintenance } from '@/domain/goals';
import { computeWeightProjection } from '@/domain/projection';
import { addDays } from '@/domain/week';
import { useLoggedDailyKcal } from '@/hooks/adaptiveTdee';
import {
  useActiveProfile,
  useBodyMetricHistory,
  useHousehold,
  useLatestBodyMetric,
  useProfileTargets,
} from '@/hooks/data';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

/** Whole weeks between two 'YYYY-MM-DD' dates, rounded to the nearest week. */
function weeksBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.round((to - from) / (7 * 24 * 60 * 60 * 1000));
}

/** Fixed in V1 (see the approved adaptive-TDEE proposal); a configurable 14-28 day range is a future refinement. */
const ADAPTIVE_TDEE_WINDOW_DAYS = 21;

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const targets = useProfileTargets(activeProfile);
  const latestMetric = useLatestBodyMetric(activeProfile?.id);
  const history = useBodyMetricHistory(activeProfile?.id);

  const adaptiveTdeeWindowStart = useMemo(() => addDays(todayIsoDate(), -ADAPTIVE_TDEE_WINDOW_DAYS), []);
  const loggedDailyKcal = useLoggedDailyKcal(activeProfile?.id, adaptiveTdeeWindowStart);
  const weighInsInWindow = useMemo(
    () => history.filter((h) => h.date >= adaptiveTdeeWindowStart).map((h) => ({ date: h.date, weightKg: h.weightKg })),
    [history, adaptiveTdeeWindowStart],
  );
  const adaptiveTdee = estimateAdaptiveTdee({
    weighIns: weighInsInWindow,
    loggedDailyKcal,
    windowDays: ADAPTIVE_TDEE_WINDOW_DAYS,
  });

  // Only shown when the profile went through the Tempo card (phase F) and
  // set an explicit rate - a guessed default rate here could be misleading.
  // Anchored at the first weigh-in (not "today") so real weigh-ins and the
  // plan share one week-0 reference and can be overlaid on the same chart.
  const projection = useMemo(() => {
    if (
      !activeProfile ||
      activeProfile.goal === 'maintain' ||
      activeProfile.goalWeightKg === null ||
      activeProfile.goalRateKgPerWeek === null ||
      history.length === 0
    ) {
      return null;
    }
    return computeWeightProjection(
      history[0].weightKg,
      activeProfile.goalWeightKg,
      activeProfile.goalRateKgPerWeek,
      activeProfile.sex,
      history[0].bodyFatPct ?? undefined,
    );
  }, [activeProfile, history]);

  const actualPoints = useMemo(() => {
    if (!projection || history.length === 0) return undefined;
    const startDate = history[0].date;
    return history.map((h) => ({ week: weeksBetween(startDate, h.date), weightKg: h.weightKg }));
  }, [projection, history]);

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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={(e) => {
          onRestoreScroll(e);
          scrollHint.onScroll(e);
        }}
        onContentSizeChange={scrollHint.onContentSizeChange}
        onLayout={scrollHint.onLayout}
        scrollEventThrottle={scrollEventThrottle}>
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
        ) : activeProfile ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/images/empty-states/progress-no-data.png')}
              style={styles.emptyImage}
              contentFit="contain"
            />
            <Text style={styles.cardTitle}>{t('progress.noDataTitle')}</Text>
            <Text style={styles.emptyText}>{t('progress.noDataText')}</Text>
          </View>
        ) : null}

        {activeProfile && targets ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('progress.adaptiveTdeeTitle')}</Text>
            <View style={styles.tdeeRow}>
              <Text style={styles.tdeeLabel}>{t('progress.tdeeFormula')}</Text>
              <Text style={styles.tdeeValue}>{Math.round(targets.tdee)} kcal</Text>
            </View>
            {adaptiveTdee.status === 'ok' ? (
              <>
                <View style={styles.tdeeRow}>
                  <Text style={styles.tdeeLabel}>
                    {t('progress.tdeeTrend', { days: ADAPTIVE_TDEE_WINDOW_DAYS })}
                  </Text>
                  <Text style={styles.tdeeValue}>{Math.round(adaptiveTdee.estimatedTdeeKcal)} kcal</Text>
                </View>
                <Text style={styles.tdeeMeta}>
                  {t('progress.tdeeTrendBasis', { count: adaptiveTdee.loggedDaysCount })}
                </Text>
              </>
            ) : (
              <Text style={styles.tdeeMeta}>{t('progress.tdeeInsufficientData')}</Text>
            )}
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

        {projection ? (
          <View style={styles.chartSection}>
            <Text style={styles.cardTitle}>{t('summary.projectionTitle')}</Text>
            <WeightProjectionChart
              projection={projection}
              actualPoints={actualPoints}
              startDateIso={history[0]?.date ?? todayIsoDate()}
            />
          </View>
        ) : null}
      </ScrollView>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
      />

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

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
      backgroundColor: colors.accentSoft,
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
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.md,
      alignItems: 'center',
    },
    emptyImage: {
      width: 200,
      height: 140,
      marginBottom: spacing.sm,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      textAlign: 'center',
    },
    goalLine: {
      color: colors.text,
      fontSize: typography.body,
      marginBottom: spacing.xs,
    },
    tdeeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: spacing.xs,
    },
    tdeeLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    tdeeValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    tdeeMeta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
    },
  });
}
