import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type Point = { date: string; weightKg: number };

const CHART_HEIGHT = 140;
const MAX_POINTS = 20;

/**
 * A simple sparkline-style bar chart of recent weight entries – no charting
 * library required. Shows at most the last MAX_POINTS entries so bars stay
 * legible; the underlying data is unbounded (full body_metrics history).
 */
export function WeightChart({ points }: { points: Point[] }) {
  const recent = points.slice(-MAX_POINTS);
  if (recent.length === 0) return null;

  const weights = recent.map((p) => p.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  return (
    <View style={styles.container}>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{max.toFixed(1)} kg</Text>
        <Text style={styles.axisLabel}>{min.toFixed(1)} kg</Text>
      </View>
      <View style={styles.barsRow}>
        {recent.map((point) => {
          const heightPct = ((point.weightKg - min) / range) * 0.8 + 0.2; // keep every bar visible
          return (
            <View key={point.date} style={styles.barTrack}>
              <View style={[styles.bar, { height: CHART_HEIGHT * heightPct }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.datesRow}>
        <Text style={styles.axisLabel}>{recent[0].date}</Text>
        <Text style={styles.axisLabel}>{recent[recent.length - 1].date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  axisLabel: {
    color: colors.textSecondary,
    fontSize: typography.small,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 3,
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    height: CHART_HEIGHT,
  },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    minHeight: 4,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
