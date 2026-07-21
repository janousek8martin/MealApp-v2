import type { ImageSourcePropType } from 'react-native';

/**
 * One representative icon per `foods.category` value (the 15 known values
 * in current seed data), for the Pantry screen's per-row icon (Task 8).
 * `src/assets/icons/library/*` is organized into folders per broad food
 * type, not per `category` value, so this hand-picks one filename per
 * category from the closest-matching folder – verified to exist by listing
 * each folder's real contents before picking (see task-8-report.md).
 *
 * Never used directly for an unmapped/unknown category – always go through
 * `getFoodCategoryIcon`, which falls back to a generic kitchen-misc icon so
 * the row image is never broken.
 */
export const FOOD_CATEGORY_ICONS: Record<string, ImageSourcePropType> = {
  meat: require('../assets/icons/library/meat-poultry/010-chicken.png'),
  fish: require('../assets/icons/library/seafood/020-fish.png'),
  eggs: require('../assets/icons/library/dairy-eggs/002-egg.png'),
  dairy: require('../assets/icons/library/dairy-eggs/017-cheese.png'),
  grains: require('../assets/icons/library/bakery-grains/010-rice.png'),
  legumes: require('../assets/icons/library/vegetables/016-beans.png'),
  bakery: require('../assets/icons/library/bakery-grains/009-bread.png'),
  vegetables: require('../assets/icons/library/vegetables/012-carrot.png'),
  fruit: require('../assets/icons/library/fruits/002-apple.png'),
  nuts: require('../assets/icons/library/other/059-nuts.png'),
  seeds: require('../assets/icons/library/other/071-sunflower.png'),
  fats: require('../assets/icons/library/condiments-spices/061-olive-oil.png'),
  sweets: require('../assets/icons/library/sweets-desserts/013-cake.png'),
  sweeteners: require('../assets/icons/library/sweets-desserts/026-sugar.png'),
  supplements: require('../assets/icons/library/kitchen-misc/048-placeholder.png'),
  other: require('../assets/icons/library/kitchen-misc/048-placeholder.png'),
};

/** Generic fallback for any category not in the map above – never leave a row with a broken image. */
const FALLBACK_ICON: ImageSourcePropType = require('../assets/icons/library/kitchen-misc/048-placeholder.png');

export function getFoodCategoryIcon(category: string | null | undefined): ImageSourcePropType {
  if (!category) return FALLBACK_ICON;
  return FOOD_CATEGORY_ICONS[category] ?? FALLBACK_ICON;
}
