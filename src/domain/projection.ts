import { ADAPTIVE_THERMOGENESIS_FACTOR, FAT_MASS_LOSS_FRACTION, MAINTENANCE_PHASE, type Sex } from './constants';
import { shouldRecommendMaintenance } from './goals';

export type ProjectionPhase = 'deficit' | 'maintenance' | 'surplus';
export type ProjectionPoint = { week: number; weightKg: number; phase: ProjectionPhase };

/** Safety cap so a tiny rate can never spin the loop forever (~4 years). */
const MAX_WEEKS = 208;

/**
 * Projects weight week-by-week from `startKg` toward `goalKg` at
 * `rateKgPerWeek` (a positive magnitude - direction comes from whether
 * goalKg is above or below startKg). Returns week 0 as the starting point
 * even when no change is needed (goal already met, or rate is zero/negative).
 *
 * The two directions are deliberately asymmetric (rešerše-c, 2026):
 * - Losing (deficit): the effective rate is scaled by
 *   ADAPTIVE_THERMOGENESIS_FACTOR (real-world loss runs slower than the
 *   naive linear math), and maintenance breaks are inserted. When `sex` and
 *   `startBodyFatPct` are both known, the break trigger is the same
 *   DIET_CYCLE_BF_DROP_* rule used for the advisory banner (shouldRecommend
 *   Maintenance) - body fat % is estimated week-by-week from weight lost so
 *   far via FAT_MASS_LOSS_FRACTION. Without that data (body-fat % is an
 *   optional field, soft-skipped rather than treated as 0 per this app's
 *   micronutrient-style convention), it falls back to a fixed
 *   MAINTENANCE_PHASE.deficitWeeks cycle - still evidence-based (sits inside
 *   both MATADOR's and ICECAP's studied schedules), just not personalized.
 * - Gaining (surplus): no correction, no breaks, a straight line to goal -
 *   there's no metabolic case for scheduled breaks during a bulk (if
 *   anything NEAT rises during overfeeding, the opposite problem from
 *   adaptive thermogenesis).
 */
export function computeWeightProjection(
  startKg: number,
  goalKg: number,
  rateKgPerWeek: number,
  sex?: Sex,
  startBodyFatPct?: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [{ week: 0, weightKg: startKg, phase: 'maintenance' }];

  const delta = goalKg - startKg;
  const totalChangeNeeded = Math.abs(delta);
  if (totalChangeNeeded < 1e-9 || rateKgPerWeek <= 0) {
    return points;
  }

  const isLosing = delta < 0;
  const activePhase: ProjectionPhase = isLosing ? 'deficit' : 'surplus';
  const direction = isLosing ? -1 : 1;
  const effectiveRate = isLosing ? rateKgPerWeek * ADAPTIVE_THERMOGENESIS_FACTOR : rateKgPerWeek;
  const useBodyFatTrigger = isLosing && sex !== undefined && startBodyFatPct !== undefined;
  const startFatMassKg = startKg * ((startBodyFatPct ?? 0) / 100);

  let week = 0;
  let currentWeight = startKg;
  let changeSoFar = 0;
  // Body-fat% at the start of the *current* deficit block - reset after each
  // maintenance break so the DIET_CYCLE_BF_DROP_* threshold applies to drop
  // since the last break, not cumulative drop since the very start.
  let phaseStartBodyFatPct = startBodyFatPct;

  while (changeSoFar < totalChangeNeeded - 1e-9 && week < MAX_WEEKS) {
    let activeWeeksThisBlock = 0;
    while (changeSoFar < totalChangeNeeded - 1e-9 && week < MAX_WEEKS) {
      const step = Math.min(effectiveRate, totalChangeNeeded - changeSoFar);
      currentWeight += direction * step;
      changeSoFar += step;
      week += 1;
      activeWeeksThisBlock += 1;
      points.push({ week, weightKg: currentWeight, phase: activePhase });

      if (!isLosing) continue;

      const estimatedCurrentBodyFatPct = ((startFatMassKg - changeSoFar * FAT_MASS_LOSS_FRACTION) / currentWeight) * 100;
      const dueForBreak = useBodyFatTrigger
        ? shouldRecommendMaintenance({
            sex: sex as Sex,
            startBodyFatPct: phaseStartBodyFatPct as number,
            currentBodyFatPct: estimatedCurrentBodyFatPct,
          })
        : activeWeeksThisBlock >= MAINTENANCE_PHASE.deficitWeeks;
      if (dueForBreak) {
        if (useBodyFatTrigger) phaseStartBodyFatPct = estimatedCurrentBodyFatPct;
        break;
      }
    }

    if (!isLosing || changeSoFar >= totalChangeNeeded - 1e-9 || week >= MAX_WEEKS) break;

    for (let i = 0; i < MAINTENANCE_PHASE.maintenanceWeeks; i += 1) {
      week += 1;
      points.push({ week, weightKg: currentWeight, phase: 'maintenance' });
    }
  }

  return points;
}
