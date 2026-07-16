/**
 * Single source of truth for chip-select option lists shared across the
 * wizard, ProfileForm, library filters and food editor – these used to be
 * copy-pasted in four places, which meant they silently drifted.
 */

/** EU14 mandatory food-information allergens (Regulation (EU) No 1169/2011). */
export const ALLERGEN_KEYS = [
  'gluten',
  'lactose',
  'eggs',
  'nuts',
  'peanuts',
  'fish',
  'shellfish',
  'soy',
  'sesame',
  'celery',
  'mustard',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

/**
 * Diet keys a food/recipe can be manually tagged with when editing it. Most
 * of these (balanced/keto/paleo/low_fat/halal/kosher/whole30/fodmap) can't be
 * reliably derived from the current ingredient/nutrition schema (no
 * processed/grain/kosher-status flags exist), so – like the original three –
 * they rely on curation rather than automatic derivation.
 */
export const MANUAL_DIET_KEYS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'mediterranean',
  'balanced',
  'keto',
  'paleo',
  'low_fat',
  'halal',
  'kosher',
  'whole30',
  'fodmap',
] as const;

/**
 * Full diet key list offered wherever a profile/household *requires* a diet
 * (wizard, ProfileForm, library filter). gluten_free/dairy_free/low_carb/
 * nut_free/soy_free aren't curated per-recipe like MANUAL_DIET_KEYS – they're
 * derived at generation/filter time from ingredient allergens or recipe
 * nutrition (see src/domain/generator/filters.ts), so they only ever appear
 * here, never in MANUAL_DIET_KEYS.
 */
export const DIET_KEYS = [
  ...MANUAL_DIET_KEYS,
  'gluten_free',
  'dairy_free',
  'low_carb',
  'nut_free',
  'soy_free',
] as const;

/** Free-form recipe tags offered when editing a recipe (see i18n recipeTags.*). */
export const RECIPE_TAG_KEYS = [
  'sweet',
  'savoury',
  'no_cook',
  'mediterranean',
  'fish',
  'czech',
  'batch_friendly',
  'vegan',
  'vegetarian',
  'quick',
  'protein',
  'fat',
] as const;

export const CUISINE_KEYS = [
  'czech',
  'mediterranean',
  'italian',
  'asian',
  'mexican',
  'american',
  'french',
  'indian',
  'thai',
  'chinese',
  'japanese',
  'greek',
  'spanish',
  'middle_eastern',
  'balkan',
  'other',
] as const;

/**
 * Curated "I don't eat this" chips for the household wizard, grouped by
 * common taste dislikes rather than exposing the raw recipe/food picker.
 * Each group maps to one or more seed food keys (src/db/seed/foods.ts) –
 * selecting a group avoids every food in it via profileAvoidedItems /
 * householdAvoidedItems (itemType: 'food').
 */
export const AVOID_FOOD_GROUPS: { key: string; foodKeys: string[] }[] = [
  { key: 'mushrooms', foodKeys: ['mushrooms'] },
  { key: 'olives', foodKeys: ['olives'] },
  { key: 'onion', foodKeys: ['onion'] },
  { key: 'garlic', foodKeys: ['garlic'] },
  { key: 'fish', foodKeys: ['salmon', 'cod', 'tuna_canned'] },
  { key: 'eggs', foodKeys: ['egg'] },
  { key: 'broccoli', foodKeys: ['broccoli'] },
  { key: 'cauliflower', foodKeys: ['cauliflower'] },
  { key: 'spinach', foodKeys: ['spinach'] },
  { key: 'bellPepper', foodKeys: ['bell_pepper'] },
  { key: 'zucchini', foodKeys: ['zucchini'] },
  { key: 'avocado', foodKeys: ['avocado'] },
  { key: 'banana', foodKeys: ['banana'] },
  { key: 'tomato', foodKeys: ['tomato'] },
  { key: 'legumes', foodKeys: ['beans_red_canned', 'chickpeas_canned', 'lentils_dry'] },
  { key: 'tofu', foodKeys: ['tofu'] },
  { key: 'walnuts', foodKeys: ['walnuts'] },
  { key: 'almonds', foodKeys: ['almonds'] },
  { key: 'peanutButter', foodKeys: ['peanut_butter'] },
  { key: 'darkChocolate', foodKeys: ['dark_chocolate'] },
  { key: 'honey', foodKeys: ['honey'] },
  { key: 'apple', foodKeys: ['apple'] },
  { key: 'pineapple', foodKeys: ['pineapple'] },
  { key: 'cilantro', foodKeys: ['cilantro'] },
  /** Broader than the old standalone "liver" group – covers organ meats generally, though beef_liver is the only one currently seeded. */
  { key: 'organMeats', foodKeys: ['beef_liver'] },
  { key: 'blueCheese', foodKeys: ['blue_cheese'] },
  { key: 'shrimp', foodKeys: ['shrimp'] },
  { key: 'raisins', foodKeys: ['raisins'] },
];

/** Ceiling tier for the household "cooking experience" setting – matches recipes.difficulty. */
export const COOKING_EXPERIENCE_LEVELS = ['easy', 'medium', 'hard'] as const;

/** Fixed options for the household "cooking time" filter; null = no limit. */
export const COOKING_TIME_LIMIT_OPTIONS = [null, 15, 30, 45] as const;

/** Ceiling tier for the household "budget" setting – matches recipes/foods budget. */
export const BUDGET_LEVELS = ['low', 'medium', 'high'] as const;
