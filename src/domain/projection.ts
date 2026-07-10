import { ADAPTIVE_THERMOGENESIS_FACTOR, MAINTENANCE_PHASE } from './constants';

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
 *   naive linear math), and maintenance breaks are inserted every
 *   MAINTENANCE_PHASE.deficitWeeks active weeks - continuous long deficits
 *   are counterproductive and there's controlled-trial evidence
 *   (MATADOR/ICECAP) for scheduled breaks.
 * - Gaining (surplus): no correction, no breaks, a straight line to goal -
 *   there's no metabolic case for scheduled breaks during a bulk (if
 *   anything NEAT rises during overfeeding, the opposite problem from
 *   adaptive thermogenesis).
 */
export function computeWeightProjection(startKg: number, goalKg: number, rateKgPerWeek: number): ProjectionPoint[] {
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

  let week = 0;
  let currentWeight = startKg;
  let changeSoFar = 0;

  while (changeSoFar < totalChangeNeeded - 1e-9 && week < MAX_WEEKS) {
    const activeBlockWeeks = isLosing ? MAINTENANCE_PHASE.deficitWeeks : MAX_WEEKS;
    for (let i = 0; i < activeBlockWeeks && changeSoFar < totalChangeNeeded - 1e-9; i += 1) {
      const step = Math.min(effectiveRate, totalChangeNeeded - changeSoFar);
      currentWeight += direction * step;
      changeSoFar += step;
      week += 1;
      points.push({ week, weightKg: currentWeight, phase: activePhase });
    }

    if (!isLosing || changeSoFar >= totalChangeNeeded - 1e-9 || week >= MAX_WEEKS) break;

    for (let i = 0; i < MAINTENANCE_PHASE.maintenanceWeeks; i += 1) {
      week += 1;
      points.push({ week, weightKg: currentWeight, phase: 'maintenance' });
    }
  }

  return points;
}
