import { addDays, previousDay } from './week';

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

/**
 * Longest unbroken run of consecutive qualifying dates anywhere in the set
 * (not just ending at "today", unlike countConsecutiveDays) - used for a
 * streak detail view's "best streak" figure.
 */
export function longestConsecutiveRun(qualifyingDates: Set<string>): number {
  if (qualifyingDates.size === 0) return 0;
  const sorted = [...qualifyingDates].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    current = sorted[i] === addDays(sorted[i - 1], 1) ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}
