/**
 * Bundled fallback photo per food, shown only when the household hasn't
 * taken its own photo for that food yet (see usePhoto/PhotoPicker).
 * Same convention as recipeImages.ts — keyed by foods.seedKey, not the
 * runtime id. See that file for the full explanation.
 */
export const foodImages: Partial<Record<string, ReturnType<typeof require>>> = {
  // banana: require('./images/foods/banana.jpg'),
};

export function foodImageFor(seedKey: string | null | undefined) {
  if (!seedKey) return undefined;
  return foodImages[seedKey];
}
