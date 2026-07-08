/**
 * Adaptive TDEE estimate: backs out an estimate of actual energy expenditure
 * from a profile's logged weight trend and logged intake, for a purely
 * informational side-by-side comparison against the formula-based TDEE
 * (Mifflin-St Jeor × activity coefficient, see `targets.ts`). Never feeds
 * back into `tdciManualAdjustmentKcal` or any target automatically.
 */

import { KCAL_PER_KG_FAT } from './constants';

export type WeighIn = { date: string; weightKg: number };
export type LoggedDailyKcal = { date: string; kcal: number };

export type AdaptiveTdeeInput = {
  /** Weigh-ins within the window, ascending by date. */
  weighIns: WeighIn[];
  /** One entry per day that had at least one eaten portion – a day with no logging is omitted, never treated as 0 kcal. */
  loggedDailyKcal: LoggedDailyKcal[];
  /** How many days back data was loaded for (informational only – does not multiply into the weight-change calculation). */
  windowDays: number;
};

export type AdaptiveTdeeResult =
  | { status: 'insufficient_data'; reason: 'weight' | 'intake' | 'both' }
  | {
      status: 'ok';
      estimatedTdeeKcal: number;
      weightTrendKgPerWeek: number;
      loggedDaysCount: number;
      spanDays: number;
    };

const MIN_WEIGH_INS = 3;
const MIN_WEIGH_IN_SPAN_DAYS = 10;
const MIN_LOGGED_DAYS = 5;

/** Days between two ISO 'YYYY-MM-DD' dates. */
function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z').getTime();
  const to = new Date(toIso + 'T00:00:00Z').getTime();
  return (to - from) / (1000 * 60 * 60 * 24);
}

/** Least-squares slope (kg/day) of weight against day-offset from the first weigh-in. */
function weightSlopeKgPerDay(weighIns: WeighIn[]): number {
  const xs = weighIns.map((w) => daysBetween(weighIns[0].date, w.date));
  const ys = weighIns.map((w) => w.weightKg);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Backs out an estimated TDEE from energy balance:
 * TDEE ≈ avg daily intake − (weight change × kcal/kg) / spanDays.
 * A weight loss (deficit) means true expenditure exceeded intake, so the
 * negative weight change increases the estimated TDEE above intake, and
 * vice versa for a gain.
 */
export function estimateAdaptiveTdee(input: AdaptiveTdeeInput): AdaptiveTdeeResult {
  const weighIns = [...input.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const loggedDays = input.loggedDailyKcal;

  const spanDays = weighIns.length > 0 ? daysBetween(weighIns[0].date, weighIns[weighIns.length - 1].date) : 0;

  const weightDataOk = weighIns.length >= MIN_WEIGH_INS && spanDays >= MIN_WEIGH_IN_SPAN_DAYS;
  const intakeDataOk = loggedDays.length >= MIN_LOGGED_DAYS;

  if (!weightDataOk || !intakeDataOk) {
    const reason = !weightDataOk && !intakeDataOk ? 'both' : !weightDataOk ? 'weight' : 'intake';
    return { status: 'insufficient_data', reason };
  }

  const slope = weightSlopeKgPerDay(weighIns);
  const weightChangeKg = slope * spanDays;

  const avgDailyIntakeKcal = loggedDays.reduce((sum, d) => sum + d.kcal, 0) / loggedDays.length;
  const estimatedTdeeKcal = avgDailyIntakeKcal - (weightChangeKg * KCAL_PER_KG_FAT) / spanDays;

  return {
    status: 'ok',
    estimatedTdeeKcal,
    weightTrendKgPerWeek: slope * 7,
    loggedDaysCount: loggedDays.length,
    spanDays,
  };
}
