import {
  extractRecipeFromHtml,
  matchFood,
  normalizeForMatch,
  parseIngredientLine,
  parseIsoDurationMinutes,
  resolveAmountForFood,
  type MatchableFood,
} from '../recipeImport';

function jsonLdPage(doc: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(doc)}</script></head><body></body></html>`;
}

const FLAT_RECIPE = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Kuřecí ny šťouchané brambory',
  recipeIngredient: ['500 g kuřecích prsou', '2 hrnky mouky'],
  recipeInstructions: 'Opečte maso. Podávejte.',
  totalTime: 'PT45M',
  recipeYield: '4 porce',
  image: 'https://example.com/photo.jpg',
};

describe('extractRecipeFromHtml', () => {
  it('parses a flat Recipe JSON-LD document', () => {
    const result = extractRecipeFromHtml(jsonLdPage(FLAT_RECIPE));
    expect(result).not.toBeNull();
    expect(result!.name).toContain('brambory');
    expect(result!.ingredientLines).toHaveLength(2);
    expect(result!.instructions).toContain('maso');
    expect(result!.prepTimeMinutes).toBe(45);
    expect(result!.servings).toBe(4);
    expect(result!.imageUrl).toBe('https://example.com/photo.jpg');
    expect(result!.partial).toBe(false);
  });

  it('finds the Recipe inside an @graph container', () => {
    const page = jsonLdPage({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, FLAT_RECIPE] });
    expect(extractRecipeFromHtml(page)?.name).toContain('brambory');
  });

  it('accepts an array @type containing Recipe', () => {
    const page = jsonLdPage({ ...FLAT_RECIPE, '@type': ['Recipe', 'NewsArticle'] });
    expect(extractRecipeFromHtml(page)?.partial).toBe(false);
  });

  it('joins HowToStep instructions into text lines', () => {
    const page = jsonLdPage({
      ...FLAT_RECIPE,
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Krok jedna.' },
        { '@type': 'HowToStep', text: 'Krok dva.' },
      ],
    });
    expect(extractRecipeFromHtml(page)?.instructions).toBe('Krok jedna.\nKrok dva.');
  });

  it('flattens HowToSection groups including their names', () => {
    const page = jsonLdPage({
      ...FLAT_RECIPE,
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Těsto',
          itemListElement: [{ '@type': 'HowToStep', text: 'Smíchejte mouku.' }],
        },
      ],
    });
    const instructions = extractRecipeFromHtml(page)?.instructions;
    expect(instructions).toContain('Těsto:');
    expect(instructions).toContain('Smíchejte mouku.');
  });

  it('takes the first usable url from an ImageObject array', () => {
    const page = jsonLdPage({ ...FLAT_RECIPE, image: [{ '@type': 'ImageObject', url: 'https://example.com/a.jpg' }] });
    expect(extractRecipeFromHtml(page)?.imageUrl).toBe('https://example.com/a.jpg');
  });

  it('skips a malformed JSON-LD block and uses the next valid one', () => {
    const page = `<script type="application/ld+json">{not json</script>${jsonLdPage(FLAT_RECIPE)}`;
    expect(extractRecipeFromHtml(page)?.partial).toBe(false);
  });

  it('supports the legacy "ingredients" property name', () => {
    const { recipeIngredient, ...rest } = FLAT_RECIPE;
    const page = jsonLdPage({ ...rest, ingredients: recipeIngredient });
    expect(extractRecipeFromHtml(page)?.ingredientLines).toHaveLength(2);
  });

  it('falls back to og:title/og:image as a partial import', () => {
    const page = `<html><head>
      <meta property="og:title" content="Babiččin guláš" />
      <meta property="og:image" content="https://example.com/gulas.jpg" />
    </head></html>`;
    const result = extractRecipeFromHtml(page);
    expect(result).toEqual({
      name: 'Babiččin guláš',
      ingredientLines: [],
      instructions: null,
      prepTimeMinutes: null,
      servings: null,
      imageUrl: 'https://example.com/gulas.jpg',
      partial: true,
    });
  });

  it('falls back to <title> when og:title is missing', () => {
    const result = extractRecipeFromHtml('<html><head><title>Svíčková | Recepty</title></head></html>');
    expect(result?.name).toBe('Svíčková | Recepty');
    expect(result?.partial).toBe(true);
  });

  it('returns null when the page has neither recipe data nor a title', () => {
    expect(extractRecipeFromHtml('<html><body><p>404</p></body></html>')).toBeNull();
  });

  it('decodes HTML entities in names', () => {
    const page = jsonLdPage({ ...FLAT_RECIPE, name: 'Mac &amp; Cheese' });
    expect(extractRecipeFromHtml(page)?.name).toBe('Mac & Cheese');
  });
});

describe('parseIsoDurationMinutes', () => {
  it.each([
    ['PT45M', 45],
    ['PT1H30M', 90],
    ['PT1H', 60],
    ['P1D', 1440],
    ['PT90S', 2],
  ])('parses %s → %d min', (input, expected) => {
    expect(parseIsoDurationMinutes(input)).toBe(expected);
  });

  it('returns null for non-durations', () => {
    expect(parseIsoDurationMinutes('45 minut')).toBeNull();
    expect(parseIsoDurationMinutes(undefined)).toBeNull();
    expect(parseIsoDurationMinutes('P')).toBeNull();
  });
});

describe('parseIngredientLine', () => {
  it('parses metric weight lines', () => {
    expect(parseIngredientLine('200 g kuřecí prsa')).toEqual({
      quantity: 200,
      unitToken: 'g',
      name: 'kuřecí prsa',
    });
  });

  it('parses Czech kitchen units', () => {
    expect(parseIngredientLine('2 hrnky mouky')).toEqual({ quantity: 2, unitToken: 'hrnky', name: 'mouky' });
  });

  it('parses mixed numbers with ASCII fractions', () => {
    const result = parseIngredientLine('1 1/2 cup flour');
    expect(result.quantity).toBeCloseTo(1.5);
    expect(result.unitToken).toBe('cup');
    expect(result.name).toBe('flour');
  });

  it('parses unicode fractions', () => {
    const result = parseIngredientLine('½ lžičky soli');
    expect(result.quantity).toBeCloseTo(0.5);
    expect(result.unitToken).toBe('lžičky');
    expect(result.name).toBe('soli');
  });

  it('takes the lower bound of a range', () => {
    expect(parseIngredientLine('1-2 ks cibule')).toEqual({ quantity: 1, unitToken: 'ks', name: 'cibule' });
  });

  it('parses decimal commas', () => {
    const result = parseIngredientLine('0,5 l mléka');
    expect(result.quantity).toBeCloseTo(0.5);
    expect(result.unitToken).toBe('l');
    expect(result.name).toBe('mléka');
  });

  it('handles a bare name with no quantity', () => {
    expect(parseIngredientLine('sůl')).toEqual({ quantity: null, unitToken: null, name: 'sůl' });
  });

  it('drops parenthesized notes', () => {
    expect(parseIngredientLine('100 g másla (změklého)').name).toBe('másla');
  });

  it('splits a quantity concatenated with its unit (no space)', () => {
    expect(parseIngredientLine('300ml milk')).toEqual({ quantity: 300, unitToken: 'ml', name: 'milk' });
    expect(parseIngredientLine('100g plain flour')).toEqual({ quantity: 100, unitToken: 'g', name: 'plain flour' });
  });

  it('does not split a bare number with no unit', () => {
    expect(parseIngredientLine('2eggs').name).toBe('eggs');
  });
});

const G_FOOD: MatchableFood = { id: 'f1', nameCs: 'Mouka', nameEn: 'Flour', baseUnit: 'g', gramsPerPiece: null, gramsPerCup: 120 };
const G_FOOD_NO_DENSITY: MatchableFood = { id: 'f2', nameCs: 'Kuřecí prsa', nameEn: 'Chicken breast', baseUnit: 'g', gramsPerPiece: null, gramsPerCup: null };
const ML_FOOD: MatchableFood = { id: 'f3', nameCs: 'Mléko', nameEn: 'Milk', baseUnit: 'ml', gramsPerPiece: null, gramsPerCup: null };
const PIECE_FOOD: MatchableFood = { id: 'f4', nameCs: 'Vejce', nameEn: 'Egg', baseUnit: 'piece', gramsPerPiece: 55, gramsPerCup: null };

describe('resolveAmountForFood', () => {
  it('converts metric weight into grams', () => {
    expect(resolveAmountForFood(200, 'g', G_FOOD_NO_DENSITY)).toBe(200);
    expect(resolveAmountForFood(1, 'kg', G_FOOD_NO_DENSITY)).toBe(1000);
    expect(resolveAmountForFood(5, 'dkg', G_FOOD_NO_DENSITY)).toBe(50);
  });

  it('converts kitchen weight into grams', () => {
    expect(resolveAmountForFood(1, 'oz', G_FOOD_NO_DENSITY)).toBeCloseTo(28.3, 0);
  });

  it('converts cups into grams via gramsPerCup density', () => {
    expect(resolveAmountForFood(2, 'hrnky', G_FOOD)).toBe(240);
  });

  it('refuses volume for a gram food without known density', () => {
    expect(resolveAmountForFood(2, 'hrnky', G_FOOD_NO_DENSITY)).toBeNull();
  });

  it('converts volume units for an ml food', () => {
    expect(resolveAmountForFood(0.5, 'l', ML_FOOD)).toBe(500);
    expect(resolveAmountForFood(1, 'cup', ML_FOOD)).toBe(240);
  });

  it('refuses weight units for an ml food', () => {
    expect(resolveAmountForFood(100, 'g', ML_FOOD)).toBeNull();
  });

  it('treats piece foods as counts', () => {
    expect(resolveAmountForFood(3, 'ks', PIECE_FOOD)).toBe(3);
    expect(resolveAmountForFood(2, null, PIECE_FOOD)).toBe(2);
    expect(resolveAmountForFood(100, 'g', PIECE_FOOD)).toBeNull();
  });

  it('treats a bare number on a gram food as grams only when plausibly large', () => {
    expect(resolveAmountForFood(200, null, G_FOOD_NO_DENSITY)).toBe(200);
    expect(resolveAmountForFood(2, null, G_FOOD_NO_DENSITY)).toBeNull();
  });

  it('returns null without a quantity', () => {
    expect(resolveAmountForFood(null, 'g', G_FOOD)).toBeNull();
  });
});

describe('normalizeForMatch', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeForMatch('Kuřecí  Prsa')).toBe('kureci prsa');
  });
});

describe('matchFood', () => {
  const foods = [G_FOOD, G_FOOD_NO_DENSITY, ML_FOOD, PIECE_FOOD];

  it('matches diacritics-insensitively against nameCs', () => {
    expect(matchFood('kureci prsa', foods)?.id).toBe('f2');
  });

  it('matches an inflected form via substring', () => {
    expect(matchFood('kuřecích prsou', foods)?.id).toBe('f2');
  });

  it('matches against nameEn too', () => {
    expect(matchFood('chicken breast', foods)?.id).toBe('f2');
  });

  it('prefers the longer, more specific food name among substring hits', () => {
    const salt: MatchableFood = { id: 's1', nameCs: 'Sůl', nameEn: 'Salt', baseUnit: 'g', gramsPerPiece: null, gramsPerCup: null };
    const seaSalt: MatchableFood = { id: 's2', nameCs: 'Mořská sůl', nameEn: 'Sea salt', baseUnit: 'g', gramsPerPiece: null, gramsPerCup: null };
    expect(matchFood('mořská sůl jemná', [salt, seaSalt])?.id).toBe('s2');
  });

  it('returns null for very short queries and misses', () => {
    expect(matchFood('a', foods)).toBeNull();
    expect(matchFood('dinosauří maso', foods)).toBeNull();
  });
});
