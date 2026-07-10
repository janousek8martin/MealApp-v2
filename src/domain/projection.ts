import { MAINTENANCE_PHASE } from './constants';

export type ProjectionPhase = 'deficit' | 'maintenance' | 'surplus';
export type ProjectionPoint = { week: number; weightKg: number; phase: ProjectionPhase };

/** Safety cap so a tiny rate can never spin the loop forever (~4 years). */
const MAX_WEEKS = 208;

/**
 * Projects weight week-by-week from `startKg` toward `goalKg` at
 * `rateKgPerWeek` (a positive magnitude - direction comes from whether
 * goalKg is above or below startKg), inserting planned maintenance breaks
 * every `MAINTENANCE_PHASE.deficitWeeks` active weeks (see TODO(research-c)
 * on that constant). Returns week 0 as the starting point even when no
 * change is needed (goal already met, or rate is zero/negative).
 */
export function computeWeightProjection(startKg: number, goalKg: number, rateKgPerWeek: number): ProjectionPoint[] {
  const points: ProjectionPoint[] = [{ week: 0, weightKg: startKg, phase: 'maintenance' }];

  const delta = goalKg - startKg;
  const totalChangeNeeded = Math.abs(delta);
  if (totalChangeNeeded < 1e-9 || rateKgPerWeek <= 0) {
    return points;
  }

  const direction = delta > 0 ? 1 : -1;
  const activePhase: ProjectionPhase = direction > 0 ? 'surplus' : 'deficit';

  let week = 0;
  let currentWeight = startKg;
  let changeSoFar = 0;

  while (changeSoFar < totalChangeNeeded - 1e-9 && week < MAX_WEEKS) {
    for (let i = 0; i < MAINTENANCE_PHASE.deficitWeeks && changeSoFar < totalChangeNeeded - 1e-9; i += 1) {
      const step = Math.min(rateKgPerWeek, totalChangeNeeded - changeSoFar);
      currentWeight += direction * step;
      changeSoFar += step;
      week += 1;
      points.push({ week, weightKg: currentWeight, phase: activePhase });
    }

    if (changeSoFar >= totalChangeNeeded - 1e-9 || week >= MAX_WEEKS) break;

    for (let i = 0; i < MAINTENANCE_PHASE.maintenanceWeeks; i += 1) {
      week += 1;
      points.push({ week, weightKg: currentWeight, phase: 'maintenance' });
    }
  }

  return points;
}
