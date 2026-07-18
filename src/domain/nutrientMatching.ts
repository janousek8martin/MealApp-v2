import type { MicronutrientKey } from './micronutrients';
import type { NutrientConfidence } from './nutrientProvenance';

const MATCH_THRESHOLD = 0.34;
const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

// Mirrors scripts/import-usda-foods.ts's CATEGORY_MAP but keyed by Open Food
// Facts' `en:`-prefixed category slugs instead of USDA's food_category
// strings - kept as a separate table since the two source vocabularies
// don't align. Extend as real OFF category coverage gaps are found.
const OFF_CATEGORY_MAP: Record<string, string> = {
  'en:meats': 'meat',
  'en:poultry': 'meat',
  'en:fishes': 'fish',
  'en:seafood': 'fish',
  'en:dairies': 'dairy',
  'en:cheeses': 'dairy',
  'en:vegetables': 'vegetables',
  'en:fruits': 'fruit',
  'en:cereals-and-potatoes': 'grains',
  'en:cereals': 'grains',
  'en:legumes': 'legumes',
  'en:breads': 'bakery',
  'en:nuts': 'nuts',
  'en:fats': 'fats',
  'en:sweets': 'sweets',
};

function tokenSet(name: string): Set<string> {
  return new Set(name.toLowerCase().split(/[^a-z]+/).filter(Boolean));
}

/**
 * Overlap (Szymkiewicz-Simpson) coefficient, not Jaccard: |intersection| /
 * min(|a|,|b|) instead of / union. USDA's generic descriptions are
 * deliberately verbose ("Chicken, broiler, breast, meat only, raw") next to
 * a branded label's short name ("Grilled chicken breast fillet") - dividing
 * by the union heavily penalizes that extra qualifier vocabulary even for
 * an obviously-correct match, since it inflates the denominator without the
 * branded side ever being able to contribute matching tokens for words it
 * doesn't have. Dividing by the smaller set's size instead asks "how much of
 * the shorter name's own vocabulary is accounted for" - immune to one side
 * being wordier.
 */
function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((x) => b.has(x)).length;
  const smaller = Math.min(a.size, b.size);
  return smaller === 0 ? 0 : intersection / smaller;
}

export type MatchResult = {
  fdcKey: string;
  confidence: NutrientConfidence;
  micronutrients: Partial<Record<MicronutrientKey, number>>;
};

export type GenericFoodRef = {
  key: string;
  nameEn: string;
  category: string;
  micronutrients: Partial<Record<MicronutrientKey, number>>;
};

/**
 * Matches a branded (Open Food Facts) product to the closest same-category
 * generic USDA food, for filling in micronutrients a branded label rarely
 * states. Category is a hard gate - never matches across categories, no
 * matter how similar the names look. Among same-category candidates, scores
 * by normalized token overlap (Jaccard similarity) between the two names;
 * returns null (never a guessed number) when nothing clears the confidence
 * threshold or the branded item's category doesn't map to anything.
 */
export function matchGenericForBranded(
  branded: { nameEn: string; categoriesTags: string[] },
  genericPool: GenericFoodRef[],
): MatchResult | null {
  const mappedCategories = new Set(branded.categoriesTags.map((tag) => OFF_CATEGORY_MAP[tag]).filter(Boolean));
  if (mappedCategories.size === 0) return null;

  const brandedTokens = tokenSet(branded.nameEn);
  let best: { key: string; micronutrients: Partial<Record<MicronutrientKey, number>>; score: number } | null = null;
  for (const generic of genericPool) {
    if (!mappedCategories.has(generic.category)) continue;
    const score = overlapCoefficient(brandedTokens, tokenSet(generic.nameEn));
    if (!best || score > best.score) best = { key: generic.key, micronutrients: generic.micronutrients, score };
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;
  const confidence: NutrientConfidence =
    best.score >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : best.score >= MEDIUM_CONFIDENCE_THRESHOLD ? 'medium' : 'low';
  return { fdcKey: best.key, confidence, micronutrients: best.micronutrients };
}
