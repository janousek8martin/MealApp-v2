/**
 * Curated list of common household staple foods for the pantry's "Prefill
 * pantry" button, matched by the seed database's stable `seedKey` (see
 * src/db/seed/foods.ts). Quantities are in the food's own base unit (g for
 * solids, ml for liquids) and are deliberately generous "you probably have
 * about this much" defaults, not precise measurements - the user edits/
 * removes individual pantry rows afterward like any other pantry item.
 */
export const PANTRY_STAPLE_SEED_KEYS: { seedKey: string; quantity: number }[] = [
  { seedKey: 'olive_oil', quantity: 500 },
  { seedKey: 'onion', quantity: 500 },
  { seedKey: 'garlic', quantity: 100 },
  { seedKey: 'egg', quantity: 10 },
  { seedKey: 'milk_semi', quantity: 1000 },
  { seedKey: 'butter', quantity: 250 },
  { seedKey: 'rice_white_dry', quantity: 1000 },
  { seedKey: 'pasta_dry', quantity: 500 },
  { seedKey: 'oats', quantity: 500 },
  { seedKey: 'potatoes', quantity: 1500 },
  { seedKey: 'lentils_dry', quantity: 500 },
  { seedKey: 'tomato', quantity: 500 },
  { seedKey: 'bread_wholegrain', quantity: 500 },
  { seedKey: 'greek_yogurt', quantity: 500 },
  { seedKey: 'cheese_edam', quantity: 200 },
];
