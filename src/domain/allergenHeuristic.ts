import type { AllergenKey } from '../constants/options';

/**
 * Bilingual keyword table for heuristic allergen tagging of bulk-imported
 * foods that have no manual allergen curation. Deliberately biased toward
 * false positives (over-tagging) over false negatives - a food this misses
 * is a real safety gap, a food this over-tags just gets filtered out more
 * than strictly necessary for that one profile.
 */
const KEYWORDS: Record<AllergenKey, string[]> = {
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye', 'oat', 'pšenic', 'mouk', 'chléb', 'chleb', 'těstovin', 'ječmen', 'žito', 'oves'],
  lactose: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'dairy', 'whey', 'casein', 'mléko', 'mléč', 'sýr', 'jogurt', 'máslo', 'smetan', 'tvaroh', 'syrovátk'],
  eggs: ['egg', 'vejce', 'vaječ'],
  nuts: ['almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'pecan', 'mandl', 'vlašsk', 'lísk', 'kešu', 'pistác'],
  peanuts: ['peanut', 'arašíd'],
  fish: ['salmon', 'tuna', 'cod', 'fish', 'herring', 'anchov', 'losos', 'tuňák', 'treska', 'ryb', 'sleď'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'kreve', 'krab', 'humr'],
  soy: ['soy', 'soya', 'tofu', 'edamame', 'sója', 'sojov'],
  sesame: ['sesame', 'tahini', 'sezam'],
  celery: ['celery', 'celer'],
  mustard: ['mustard', 'hořčic'],
  sulphites: ['sulphite', 'sulfite', 'siřič'],
  lupin: ['lupin', 'vlčí bob'],
  molluscs: ['mussel', 'oyster', 'squid', 'octopus', 'snail', 'slávk', 'ústřic', 'chobotnic'],
};

export function deriveAllergensFromName(nameCs: string, nameEn: string): AllergenKey[] {
  const haystack = `${nameCs} ${nameEn}`.toLowerCase();
  const matches: AllergenKey[] = [];
  for (const [allergen, keywords] of Object.entries(KEYWORDS) as [AllergenKey, string[]][]) {
    if (keywords.some((kw) => haystack.includes(kw))) matches.push(allergen);
  }
  return matches;
}
