import { createSeededRng } from './rng';
import { startOfWeek, weekDates } from '../week';

/**
 * FNV-1a string hash – small, fast, good enough to seed the RNG below.
 * Not cryptographic; just needs to spread household/week combinations well.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministically picks which dates in a week are "cold dinner" days.
 *
 * Keyed only by `(householdId, weekDates[0])` – NOT the per-run `Rng` already
 * threaded through `generateWeek`/`generateDay` (that seed changes on every
 * regeneration, e.g. `Date.now()` by default, which would make a day's
 * "cold-ness" flicker every time any other slot on any other day of the same
 * week gets regenerated). Keying off the week alone makes membership stable
 * for the whole week regardless of how many times individual slots are
 * swapped, and lets `isColdDinnerDay` be called standalone from
 * `regenerateSlot` without threading extra state through the call chain.
 */
export function pickColdDinnerDates(weekDates: string[], householdId: string, frequencyPerWeek: number): Set<string> {
  const count = Math.max(0, Math.min(frequencyPerWeek, weekDates.length));
  if (count === 0) return new Set();

  const seed = hashString(`${householdId}:${weekDates[0] ?? ''}`);
  const rng = createSeededRng(seed);

  // Fisher-Yates shuffle a copy, then take the first `count`.
  const shuffled = [...weekDates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return new Set(shuffled.slice(0, count));
}

/** Convenience wrapper: is this one date a cold-dinner day for the household? Derives its own week from `date`. */
export function isColdDinnerDay(date: string, householdId: string, frequencyPerWeek: number): boolean {
  const dates = weekDates(startOfWeek(date));
  return pickColdDinnerDates(dates, householdId, frequencyPerWeek).has(date);
}
