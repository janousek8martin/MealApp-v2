import { WEEKLY_LOSS_PCT_MAX } from './constants';

export type GoalReviewTier = 'realistic' | 'ambitious' | 'challenging';

export type GoalReview = {
  tier: GoalReviewTier;
  /** True when a LOSS goal's chosen pace exceeds the ~1 %/week safe band (Garthe et al., 2011). */
  paceExceedsSafeBand: boolean;
  /** Naive linear weeks-to-goal at the chosen rate - the projection chart owns the thermogenesis-corrected timeline, this is just the card's quick figure. Null when no usable rate. */
  estimatedWeeks: number | null;
};

const REALISTIC_MAX_PCT = 0.1;
const AMBITIOUS_MAX_PCT = 0.2;

const TIER_ORDER: GoalReviewTier[] = ['realistic', 'ambitious', 'challenging'];

/**
 * Classifies a weight-change goal by the percentage of current body weight
 * involved, using general clinical obesity-guidance thresholds (5-10% is
 * commonly cited as a realistic, clinically meaningful initial target;
 * 10-20% is achievable but needs sustained multi-month adherence; beyond
 * 20% success/maintenance rates drop noticeably in outcome literature).
 * This is a deliberate simplification (see design spec's Risks section),
 * not a single-study threshold - framed as general guidance in the UI.
 * Symmetric for both loss and gain goals.
 *
 * When `rateKgPerWeek` is given the review also reacts to PACE: a loss rate
 * above WEEKLY_LOSS_PCT_MAX (the 1 %/week ceiling of the safe band) sets
 * `paceExceedsSafeBand` and bumps the tier one step toward 'challenging' -
 * an aggressive pace makes the same goal harder to sustain. Gain goals
 * never trip the loss band (surplus pacing is capped elsewhere).
 */
export function classifyGoalReview(
  currentWeightKg: number,
  goalWeightKg: number,
  rateKgPerWeek?: number,
): GoalReview {
  const deltaKg = Math.abs(goalWeightKg - currentWeightKg);
  const pctChange = deltaKg / currentWeightKg;
  let tier: GoalReviewTier =
    pctChange <= REALISTIC_MAX_PCT ? 'realistic' : pctChange <= AMBITIOUS_MAX_PCT ? 'ambitious' : 'challenging';

  const isLosing = goalWeightKg < currentWeightKg;
  const paceExceedsSafeBand =
    isLosing && rateKgPerWeek !== undefined && rateKgPerWeek / currentWeightKg > WEEKLY_LOSS_PCT_MAX;
  if (paceExceedsSafeBand) {
    tier = TIER_ORDER[Math.min(TIER_ORDER.indexOf(tier) + 1, TIER_ORDER.length - 1)];
  }

  const estimatedWeeks =
    rateKgPerWeek !== undefined && rateKgPerWeek > 0 && deltaKg > 0 ? Math.ceil(deltaKg / rateKgPerWeek) : null;

  return { tier, paceExceedsSafeBand, estimatedWeeks };
}
