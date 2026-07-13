import { KITCHEN_VOLUME_ML, kitchenVolumeToMl, kitchenWeightToGrams, type KitchenVolumeUnit, type KitchenWeightUnit } from './units';

// ---------------------------------------------------------------------------
// Extracting a recipe from a web page (schema.org JSON-LD + og: fallbacks)
// ---------------------------------------------------------------------------

export type ImportedRecipe = {
  name: string;
  ingredientLines: string[];
  /** Joined instruction text; null when the page provided none. */
  instructions: string | null;
  prepTimeMinutes: number | null;
  servings: number | null;
  imageUrl: string | null;
  /** True when only og:/title fallbacks matched – name (+ maybe photo), no structured recipe data. */
  partial: boolean;
};

/** Decodes the handful of HTML entities that actually show up in recipe names/ingredients. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

/** Strips any leftover HTML tags from a text value (some sites embed markup inside JSON-LD strings). */
function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

/** ISO-8601 duration (PT1H30M / PT45M / P0DT1H) → minutes; null for anything unparseable. */
export function parseIsoDurationMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;
  const total =
    (days ? Number(days) * 24 * 60 : 0) +
    (hours ? Number(hours) * 60 : 0) +
    (minutes ? Number(minutes) : 0) +
    (seconds ? Number(seconds) / 60 : 0);
  return Math.round(total);
}

function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as Record<string, unknown>)['@type'];
  if (typeof type === 'string') return type.toLowerCase() === 'recipe';
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
  return false;
}

/** Walks a parsed JSON-LD document (object, array, or @graph container) looking for the first Recipe node. */
function findRecipeNode(doc: unknown): Record<string, unknown> | null {
  if (isRecipeNode(doc)) return doc;
  if (Array.isArray(doc)) {
    for (const entry of doc) {
      const found = findRecipeNode(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof doc === 'object' && doc !== null) {
    const graph = (doc as Record<string, unknown>)['@graph'];
    if (Array.isArray(graph)) return findRecipeNode(graph);
  }
  return null;
}

/** image: "url" | {url} | ImageObject[] | string[] → first usable url. */
function extractImageUrl(image: unknown): string | null {
  if (typeof image === 'string') return image || null;
  if (Array.isArray(image)) {
    for (const entry of image) {
      const url = extractImageUrl(entry);
      if (url) return url;
    }
    return null;
  }
  if (typeof image === 'object' && image !== null) {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === 'string' && url) return url;
  }
  return null;
}

/** recipeInstructions: string | string[] | HowToStep[] | HowToSection[] → joined plain text. */
function extractInstructions(value: unknown): string | null {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      const text = stripTags(node);
      if (text) parts.push(text);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object' && node !== null) {
      const record = node as Record<string, unknown>;
      // HowToSection: name + itemListElement; HowToStep: text.
      if (typeof record.text === 'string') {
        const text = stripTags(record.text);
        if (text) parts.push(text);
      } else if (record.itemListElement !== undefined) {
        if (typeof record.name === 'string' && record.name.trim()) parts.push(`${stripTags(record.name)}:`);
        walk(record.itemListElement);
      } else if (typeof record.name === 'string') {
        const text = stripTags(record.name);
        if (text) parts.push(text);
      }
    }
  };
  walk(value);
  return parts.length > 0 ? parts.join('\n') : null;
}

/** recipeYield: "4 porce" | "4" | 4 | ["4 servings"] → first integer found. */
function extractServings(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = extractServings(entry);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function extractMetaContent(html: string, property: string): string | null {
  // Attribute order varies across sites: property first or content first.
  const patterns = [
    new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

/**
 * Parses a fetched HTML page into an ImportedRecipe. Primary source is
 * schema.org/Recipe JSON-LD (what virtually every modern recipe site embeds);
 * when that's missing, falls back to og:title/og:image/<title> for a partial
 * import (name + photo only). Returns null when not even a title exists.
 */
export function extractRecipeFromHtml(html: string): ImportedRecipe | null {
  const scriptBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of scriptBlocks) {
    let doc: unknown;
    try {
      doc = JSON.parse(block[1].trim());
    } catch {
      continue; // malformed block – try the next one
    }
    const recipe = findRecipeNode(doc);
    if (!recipe) continue;

    const name = typeof recipe.name === 'string' ? stripTags(recipe.name) : null;
    if (!name) continue;

    const rawIngredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient
      : Array.isArray(recipe.ingredients) // legacy schema.org property name
        ? recipe.ingredients
        : [];
    const ingredientLines = rawIngredients
      .filter((line): line is string => typeof line === 'string')
      .map(stripTags)
      .filter((line) => line.length > 0);

    return {
      name,
      ingredientLines,
      instructions: extractInstructions(recipe.recipeInstructions),
      prepTimeMinutes: parseIsoDurationMinutes(recipe.totalTime) ?? parseIsoDurationMinutes(recipe.prepTime),
      servings: extractServings(recipe.recipeYield),
      imageUrl: extractImageUrl(recipe.image),
      partial: false,
    };
  }

  // Fallback: og: metadata / <title> – enough for a name (+ maybe photo).
  const ogTitle = extractMetaContent(html, 'og:title');
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name = ogTitle ?? (titleTag ? stripTags(titleTag) : null);
  if (!name) return null;

  return {
    name,
    ingredientLines: [],
    instructions: null,
    prepTimeMinutes: null,
    servings: null,
    imageUrl: extractMetaContent(html, 'og:image'),
    partial: true,
  };
}

// ---------------------------------------------------------------------------
// Ingredient line parsing ("2 hrnky mouky" → quantity/unit/name)
// ---------------------------------------------------------------------------

export type ParsedIngredientLine = {
  quantity: number | null;
  /** The raw token that looked like a unit (lowercased); null when the line had none. */
  unitToken: string | null;
  /** Remaining text – the ingredient name to match against the foods DB. */
  name: string;
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅛': 0.125,
};

function parseQuantityToken(token: string): number | null {
  if (UNICODE_FRACTIONS[token] !== undefined) return UNICODE_FRACTIONS[token];
  const fraction = token.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  // "1-2" / "1–2" ranges → the lower bound.
  const range = token.match(/^(\d+(?:[.,]\d+)?)[-–]\d+(?:[.,]\d+)?$/);
  if (range) return Number(range[1].replace(',', '.'));
  const plain = token.replace(',', '.');
  const value = Number(plain);
  return Number.isFinite(value) && plain.trim() !== '' ? value : null;
}

/**
 * Every token that this parser treats as a unit, mapped to a converter tag.
 * Kitchen (cup/spoon) tokens map to the units.ts kitchen table; metric maps
 * straight to g/ml; piece words mark countable foods.
 */
type UnitTag =
  | { kind: 'volume'; unit: KitchenVolumeUnit }
  | { kind: 'weight'; unit: KitchenWeightUnit }
  | { kind: 'gram'; factor: number }
  | { kind: 'ml'; factor: number }
  | { kind: 'piece' };

const UNIT_ALIASES: Record<string, UnitTag> = {
  // metric weight
  g: { kind: 'gram', factor: 1 },
  gram: { kind: 'gram', factor: 1 },
  gramy: { kind: 'gram', factor: 1 },
  gramů: { kind: 'gram', factor: 1 },
  grams: { kind: 'gram', factor: 1 },
  kg: { kind: 'gram', factor: 1000 },
  dkg: { kind: 'gram', factor: 10 },
  dag: { kind: 'gram', factor: 10 },
  mg: { kind: 'gram', factor: 0.001 },
  // metric volume
  ml: { kind: 'ml', factor: 1 },
  l: { kind: 'ml', factor: 1000 },
  litr: { kind: 'ml', factor: 1000 },
  litry: { kind: 'ml', factor: 1000 },
  litru: { kind: 'ml', factor: 1000 },
  dl: { kind: 'ml', factor: 100 },
  cl: { kind: 'ml', factor: 10 },
  // kitchen volume (english + czech aliases, mirroring units.ts BUILT_IN_ALIASES)
  tsp: { kind: 'volume', unit: 'tsp' },
  teaspoon: { kind: 'volume', unit: 'tsp' },
  teaspoons: { kind: 'volume', unit: 'tsp' },
  lžička: { kind: 'volume', unit: 'tsp' },
  lžičky: { kind: 'volume', unit: 'tsp' },
  lžiček: { kind: 'volume', unit: 'tsp' },
  tbsp: { kind: 'volume', unit: 'tbsp' },
  tablespoon: { kind: 'volume', unit: 'tbsp' },
  tablespoons: { kind: 'volume', unit: 'tbsp' },
  lžíce: { kind: 'volume', unit: 'tbsp' },
  lžic: { kind: 'volume', unit: 'tbsp' },
  lžíci: { kind: 'volume', unit: 'tbsp' },
  cup: { kind: 'volume', unit: 'cup' },
  cups: { kind: 'volume', unit: 'cup' },
  hrnek: { kind: 'volume', unit: 'cup' },
  hrnky: { kind: 'volume', unit: 'cup' },
  hrnků: { kind: 'volume', unit: 'cup' },
  šálek: { kind: 'volume', unit: 'cup' },
  šálky: { kind: 'volume', unit: 'cup' },
  šálků: { kind: 'volume', unit: 'cup' },
  // kitchen weight
  oz: { kind: 'weight', unit: 'oz' },
  ounce: { kind: 'weight', unit: 'oz' },
  ounces: { kind: 'weight', unit: 'oz' },
  unce: { kind: 'weight', unit: 'oz' },
  lb: { kind: 'weight', unit: 'lb' },
  lbs: { kind: 'weight', unit: 'lb' },
  pound: { kind: 'weight', unit: 'lb' },
  pounds: { kind: 'weight', unit: 'lb' },
  libra: { kind: 'weight', unit: 'lb' },
  libry: { kind: 'weight', unit: 'lb' },
  // pieces
  ks: { kind: 'piece' },
  kus: { kind: 'piece' },
  kusy: { kind: 'piece' },
  kusů: { kind: 'piece' },
  pc: { kind: 'piece' },
  pcs: { kind: 'piece' },
  piece: { kind: 'piece' },
  pieces: { kind: 'piece' },
};

/**
 * Splits an ingredient line into leading quantity, optional unit token and
 * the remaining name. Handles decimal commas, ASCII and unicode fractions,
 * mixed numbers ("1 1/2") and simple ranges ("1-2" → 1).
 */
export function parseIngredientLine(line: string): ParsedIngredientLine {
  const withoutNotes = line.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  // Recipe sites frequently concatenate quantity and unit with no space
  // ("300ml milk", "100g flour") – split only the leading run so this never
  // touches a unit-less name that happens to start with digits.
  const cleaned = withoutNotes.replace(/^(\d+(?:[.,]\d+)?)([a-zA-Zà-žÀ-Ž]+)\b/, '$1 $2');
  const tokens = cleaned.split(' ').filter((token) => token.length > 0);
  if (tokens.length === 0) return { quantity: null, unitToken: null, name: '' };

  let quantity: number | null = null;
  let index = 0;

  const first = parseQuantityToken(tokens[0]);
  if (first !== null) {
    quantity = first;
    index = 1;
    // Mixed number: "1 1/2" or "1 ½".
    if (index < tokens.length) {
      const second = tokens[index];
      const secondValue =
        UNICODE_FRACTIONS[second] !== undefined
          ? UNICODE_FRACTIONS[second]
          : /^\d+\/\d+$/.test(second)
            ? parseQuantityToken(second)
            : null;
      if (secondValue !== null) {
        quantity += secondValue;
        index += 1;
      }
    }
  }

  let unitToken: string | null = null;
  if (quantity !== null && index < tokens.length) {
    const candidate = tokens[index].toLowerCase().replace(/[.,;]$/, '');
    if (UNIT_ALIASES[candidate] !== undefined) {
      unitToken = candidate;
      index += 1;
    }
  }

  const name = tokens.slice(index).join(' ').trim();
  return { quantity, unitToken, name };
}

// ---------------------------------------------------------------------------
// Amount conversion into a food's base unit
// ---------------------------------------------------------------------------

/** The subset of a foods row the import matching/conversion needs (structural – any FoodRow satisfies it). */
export type MatchableFood = {
  id: string;
  nameCs: string;
  nameEn: string;
  baseUnit: 'g' | 'ml' | 'piece';
  gramsPerPiece: number | null;
  gramsPerCup: number | null;
};

/**
 * Converts a parsed quantity+unit into `food.baseUnit` (the unit
 * recipeIngredients.amount is stored in). Returns null when there's no
 * sensible conversion – the caller shows the row as "needs manual amount".
 */
export function resolveAmountForFood(
  quantity: number | null,
  unitToken: string | null,
  food: MatchableFood,
): number | null {
  if (quantity === null || quantity <= 0) return null;
  const tag = unitToken !== null ? UNIT_ALIASES[unitToken] : undefined;

  if (food.baseUnit === 'piece') {
    // Countable food: bare numbers and piece words are counts; anything else doesn't map.
    if (tag === undefined || tag.kind === 'piece') return quantity;
    return null;
  }

  if (food.baseUnit === 'ml') {
    if (tag?.kind === 'ml') return round1(quantity * tag.factor);
    if (tag?.kind === 'volume') return round1(kitchenVolumeToMl(quantity, tag.unit));
    return null;
  }

  // baseUnit === 'g'
  if (tag?.kind === 'gram') return round1(quantity * tag.factor);
  if (tag?.kind === 'weight') return round1(kitchenWeightToGrams(quantity, tag.unit));
  if (tag?.kind === 'volume') {
    // Volume of a solid: only convertible when the food's density is known.
    if (food.gramsPerCup === null) return null;
    const ml = kitchenVolumeToMl(quantity, tag.unit);
    return round1((ml / KITCHEN_VOLUME_ML.cup) * food.gramsPerCup);
  }
  if (tag === undefined) {
    // "200 kuřecí prsa" – a bare number ≥ 10 on a gram food almost certainly means grams.
    return quantity >= 10 ? round1(quantity) : null;
  }
  return null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Fuzzy food matching (diacritics-insensitive)
// ---------------------------------------------------------------------------

/** Lowercases and strips diacritics – "Kuřecí Prsa" → "kureci prsa". */
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Two normalized words "stem-match" when one is a prefix of the other or
 * they share a long-enough common prefix – catches Czech inflection
 * ("kurecich" ~ "kureci", "prsou" ~ "prsa") without a real stemmer.
 */
function wordsStemMatch(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return a === b;
  let common = 0;
  const limit = Math.min(a.length, b.length);
  while (common < limit && a[common] === b[common]) common += 1;
  if (common === limit) return true; // one is a prefix of the other
  return common >= Math.max(3, Math.ceil(0.7 * limit));
}

/**
 * Finds the best foods-DB match for an imported ingredient name: exact →
 * starts-with → substring → word-level stem overlap (handles Czech
 * inflection), on nameCs and nameEn, diacritics-insensitive. Among equal
 * tiers, prefers the longest food name so a generic short name ("sůl")
 * can't shadow a more specific match.
 */
export function matchFood<T extends MatchableFood>(name: string, foods: T[]): T | null {
  const query = normalizeForMatch(name);
  if (query.length < 3) return null;
  const queryWords = query.split(' ');

  let best: T | null = null;
  let bestScore = 0;
  for (const food of foods) {
    const names = [normalizeForMatch(food.nameCs), normalizeForMatch(food.nameEn)];
    let score = 0;
    for (const foodName of names) {
      if (foodName.length === 0) continue;
      if (foodName === query) score = Math.max(score, 400);
      else if (query.startsWith(foodName) || foodName.startsWith(query)) {
        score = Math.max(score, 300 + Math.min(foodName.length, query.length));
      } else if (query.includes(foodName) || foodName.includes(query)) {
        score = Math.max(score, 200 + Math.min(foodName.length, query.length));
      } else {
        // Word-level fallback: every word of the food name must stem-match some query word.
        const foodWords = foodName.split(' ');
        const allMatched = foodWords.every((foodWord) =>
          queryWords.some((queryWord) => wordsStemMatch(foodWord, queryWord)),
        );
        if (allMatched) score = Math.max(score, 100 + foodName.length);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return best;
}
