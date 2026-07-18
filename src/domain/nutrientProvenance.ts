export type ProvenanceSource = 'usda_foundation' | 'usda_sr_legacy' | 'off_label' | 'user_entered';
export type NutrientConfidence = 'high' | 'medium' | 'low';

/**
 * A food is safe to auto-suggest to a profile with an active allergy only
 * once a human has looked at it. Bulk-imported/heuristically-tagged foods
 * start as needsReview=true; user-entered and hand-curated seed foods are
 * never review-gated. This is the one place the app's usual "missing data
 * != 0" rule is deliberately overridden for safety.
 */
export function isTrustedForAllergySafety(needsReview: boolean): boolean {
  return !needsReview;
}
