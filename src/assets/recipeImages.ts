/**
 * Bundled fallback photo per recipe, shown only when the household hasn't
 * taken its own photo for that recipe yet (see usePhoto/PhotoPicker).
 *
 * How to add one:
 * 1. Drop the generated image at src/assets/images/recipes/<seedKey>.jpg
 *    (see the image spec list for dimensions/style — 800x600, photorealistic,
 *    warm natural light, rounded-card framing, no text/logos baked in).
 * 2. Add one line below, keyed by the recipe's seed key (src/db/seed/recipes.ts,
 *    e.g. 'oats_banana_smoothie') — NOT the runtime database id, which is a
 *    random UUID and differs per install. The seed key is persisted on the
 *    recipes.seedKey column precisely so it can be matched back to this map.
 *
 * Metro resolves require() statically, so this map can only ever contain
 * entries for images that already exist in the repo — there's no way to
 * "reserve a slot" for a file that isn't there yet without breaking the build.
 */
export const recipeImages: Partial<Record<string, ReturnType<typeof require>>> = {
  // oats_banana_smoothie: require('./images/recipes/oats_banana_smoothie.jpg'),
};

export function recipeImageFor(seedKey: string | null | undefined) {
  if (!seedKey) return undefined;
  return recipeImages[seedKey];
}
