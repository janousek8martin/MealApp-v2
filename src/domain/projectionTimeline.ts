import { addDays } from './week';
import type { ProjectionPoint } from './projection';

export type ProjectionSummary = { weeks: number; endDateIso: string };

/** Derives a human-facing timeline summary from a computeWeightProjection result - kept separate from projection.ts itself so the domain layer stays date-agnostic (see computeWeightProjection's own doc comment). */
export function formatProjectionSummary(projection: ProjectionPoint[], startDateIso: string): ProjectionSummary {
  const lastWeek = projection[projection.length - 1]?.week ?? 0;
  return {
    weeks: lastWeek,
    endDateIso: addDays(startDateIso, lastWeek * 7),
  };
}
