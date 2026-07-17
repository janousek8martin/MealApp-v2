import { RECIPE_TAG_KEYS } from '@/constants/options';

/** Renders a recipe tag: the `recipeTags.*` translation for a fixed key, or the raw string as-typed for a custom tag (which has no translation entry). */
export function displayRecipeTag(t: (key: string) => string, tag: string): string {
  return (RECIPE_TAG_KEYS as readonly string[]).includes(tag) ? t(`recipeTags.${tag}`) : tag;
}
