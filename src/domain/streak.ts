import { previousDay } from './week';

/**
 * Counts consecutive qualifying days ending at `today`, walking backward day
 * by day; stops at the first non-qualifying day. If `today` itself doesn't
 * yet qualify, that's not treated as "streak broken" – a day in progress
 * simply isn't counted yet, and counting starts from `previousDay(today)`.
 */
export function countConsecutiveDays(qualifyingDates: Set<string>, today: string, maxLookbackDays = 180): number {
  let cursor = qualifyingDates.has(today) ? today : previousDay(today);
  let count = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    if (!qualifyingDates.has(cursor)) break;
    count++;
    cursor = previousDay(cursor);
  }
  return count;
}
