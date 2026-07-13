export type GoalReviewTier = 'realistic' | 'ambitious' | 'challenging';

const REALISTIC_MAX_PCT = 0.1;
const AMBITIOUS_MAX_PCT = 0.2;

/**
 * Classifies a weight-change goal by the percentage of current body weight
 * involved, using general clinical obesity-guidance thresholds (5-10% is
 * commonly cited as a realistic, clinically meaningful initial target;
 * 10-20% is achievable but needs sustained multi-month adherence; beyond
 * 20% success/maintenance rates drop noticeably in outcome literature).
 * This is a deliberate simplification (see design spec's Risks section),
 * not a single-study threshold - framed as general guidance in the UI.
 * Symmetric for both loss and gain goals.
 */
export function classifyGoalReview(currentWeightKg: number, goalWeightKg: number): GoalReviewTier {
  const pctChange = Math.abs(goalWeightKg - currentWeightKg) / currentWeightKg;
  if (pctChange <= REALISTIC_MAX_PCT) return 'realistic';
  if (pctChange <= AMBITIOUS_MAX_PCT) return 'ambitious';
  return 'challenging';
}
