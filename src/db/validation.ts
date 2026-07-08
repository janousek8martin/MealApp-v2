import { todayIsoDate } from './time';

/**
 * Thin repository-layer input guards – catch obviously-bad data (a typo, a
 * unit mix-up, a broken form) before it reaches the domain layer, which
 * assumes plausible inputs and doesn't itself validate. Ranges are
 * deliberately generous (they must admit the app's own child profiles, e.g.
 * a 3-year-old well under typical adult minimums) rather than tight
 * "medically normal" bounds.
 */
export function assertInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max} (got ${value})`);
  }
}

export function assertPastDate(dateIso: string, label: string): void {
  if (dateIso >= todayIsoDate()) {
    throw new Error(`${label} must be in the past (got ${dateIso})`);
  }
}
