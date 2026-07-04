import type { ImageSourcePropType } from 'react-native';

/**
 * Icon lookup for the allergen/diet/cuisine/avoid-food chips shared across
 * the wizard, ProfileForm, library filters and food editor. Uses relative
 * require() paths (not the `@/` alias) – Metro can't resolve aliased paths
 * inside require() for bundled image assets.
 */
export const ALLERGEN_ICONS: Record<string, ImageSourcePropType> = {
  gluten: require('../assets/icons/allergens/gluten.png'),
  lactose: require('../assets/icons/allergens/lactose.png'),
  eggs: require('../assets/icons/allergens/eggs.png'),
  nuts: require('../assets/icons/allergens/nuts.png'),
  peanuts: require('../assets/icons/allergens/peanuts.png'),
  fish: require('../assets/icons/allergens/fish.png'),
  shellfish: require('../assets/icons/allergens/shellfish.png'),
  soy: require('../assets/icons/allergens/soy.png'),
  sesame: require('../assets/icons/allergens/sesame.png'),
  celery: require('../assets/icons/allergens/celery.png'),
  mustard: require('../assets/icons/allergens/mustard.png'),
  sulphites: require('../assets/icons/allergens/sulphites.png'),
  lupin: require('../assets/icons/allergens/lupin.png'),
  molluscs: require('../assets/icons/allergens/molluscs.png'),
};

export const DIET_ICONS: Record<string, ImageSourcePropType> = {
  vegetarian: require('../assets/icons/diets/vegetarian.png'),
  vegan: require('../assets/icons/diets/vegan.png'),
  pescatarian: require('../assets/icons/diets/pescatarian.png'),
  gluten_free: require('../assets/icons/diets/gluten_free.png'),
  dairy_free: require('../assets/icons/diets/dairy_free.png'),
  low_carb: require('../assets/icons/diets/low_carb.png'),
};

export const CUISINE_ICONS: Record<string, ImageSourcePropType> = {
  czech: require('../assets/icons/cuisines/czech.png'),
  mediterranean: require('../assets/icons/cuisines/mediterranean.png'),
  italian: require('../assets/icons/cuisines/italian.png'),
  asian: require('../assets/icons/cuisines/asian.png'),
  mexican: require('../assets/icons/cuisines/mexican.png'),
  american: require('../assets/icons/cuisines/american.png'),
  french: require('../assets/icons/cuisines/french.png'),
  indian: require('../assets/icons/cuisines/indian.png'),
  thai: require('../assets/icons/cuisines/thai.png'),
  chinese: require('../assets/icons/cuisines/chinese.png'),
  japanese: require('../assets/icons/cuisines/japanese.png'),
  greek: require('../assets/icons/cuisines/greek.png'),
  spanish: require('../assets/icons/cuisines/spanish.png'),
  middle_eastern: require('../assets/icons/cuisines/middle_eastern.png'),
  balkan: require('../assets/icons/cuisines/balkan.png'),
  other: require('../assets/icons/cuisines/other.png'),
};

export const AVOID_FOOD_ICONS: Record<string, ImageSourcePropType> = {
  mushrooms: require('../assets/icons/avoidFoods/mushrooms.png'),
  olives: require('../assets/icons/avoidFoods/olives.png'),
  onion: require('../assets/icons/avoidFoods/onion.png'),
  garlic: require('../assets/icons/avoidFoods/garlic.png'),
  fish: require('../assets/icons/avoidFoods/fish.png'),
  eggs: require('../assets/icons/avoidFoods/eggs.png'),
  broccoli: require('../assets/icons/avoidFoods/broccoli.png'),
  cauliflower: require('../assets/icons/avoidFoods/cauliflower.png'),
  spinach: require('../assets/icons/avoidFoods/spinach.png'),
  bellPepper: require('../assets/icons/avoidFoods/bellPepper.png'),
  zucchini: require('../assets/icons/avoidFoods/zucchini.png'),
  avocado: require('../assets/icons/avoidFoods/avocado.png'),
  banana: require('../assets/icons/avoidFoods/banana.png'),
  tomato: require('../assets/icons/avoidFoods/tomato.png'),
  legumes: require('../assets/icons/avoidFoods/legumes.png'),
  walnuts: require('../assets/icons/avoidFoods/walnuts.png'),
  almonds: require('../assets/icons/avoidFoods/almonds.png'),
  peanutButter: require('../assets/icons/avoidFoods/peanutButter.png'),
  darkChocolate: require('../assets/icons/avoidFoods/darkChocolate.png'),
  honey: require('../assets/icons/avoidFoods/honey.png'),
};
