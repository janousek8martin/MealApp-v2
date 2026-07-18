import { mapOpenFoodFactsResponse } from '../openFoodFacts';

describe('mapOpenFoodFactsResponse', () => {
  it('maps a found product to nutrition fields', () => {
    const raw = {
      status: 1,
      product: {
        product_name: 'Greek Yogurt',
        nutriments: {
          'energy-kcal_100g': 97,
          proteins_100g: 9,
          carbohydrates_100g: 4,
          fat_100g: 5,
          fiber_100g: 0,
        },
      },
    };
    expect(mapOpenFoodFactsResponse(raw)).toEqual({
      name: 'Greek Yogurt',
      kcalPer100: 97,
      proteinPer100: 9,
      carbsPer100: 4,
      fatPer100: 5,
      fiberPer100: 0,
      novaGroup: null,
      nutriScoreGrade: null,
      ecoScoreGrade: null,
      categoriesTags: [],
    });
  });

  it('maps NOVA group, Nutri-Score, Eco-Score and categories when present', () => {
    const raw = {
      status: 1,
      product: {
        product_name: 'Greek Yogurt',
        nutriments: {},
        nova_group: 4,
        nutriscore_grade: 'c',
        ecoscore_grade: 'b',
        categories_tags: ['en:dairies', 'en:fermented-foods'],
      },
    };
    const result = mapOpenFoodFactsResponse(raw);
    expect(result?.novaGroup).toBe(4);
    expect(result?.nutriScoreGrade).toBe('c');
    expect(result?.ecoScoreGrade).toBe('b');
    expect(result?.categoriesTags).toEqual(['en:dairies', 'en:fermented-foods']);
  });

  it('leaves NOVA/Nutri-Score/Eco-Score null and categories empty when absent, never guessed', () => {
    const raw = { status: 1, product: { product_name: 'X', nutriments: {} } };
    const result = mapOpenFoodFactsResponse(raw);
    expect(result?.novaGroup).toBeNull();
    expect(result?.nutriScoreGrade).toBeNull();
    expect(result?.ecoScoreGrade).toBeNull();
    expect(result?.categoriesTags).toEqual([]);
  });

  it('falls back to the English name when the localized name is missing', () => {
    const raw = {
      status: 1,
      product: { product_name: '', product_name_en: 'Oat Milk', nutriments: {} },
    };
    expect(mapOpenFoodFactsResponse(raw)?.name).toBe('Oat Milk');
  });

  it('returns null when the product was not found (status !== 1)', () => {
    expect(mapOpenFoodFactsResponse({ status: 0 })).toBeNull();
  });

  it('returns null for a malformed/unexpected response shape', () => {
    expect(mapOpenFoodFactsResponse(null)).toBeNull();
    expect(mapOpenFoodFactsResponse(undefined)).toBeNull();
    expect(mapOpenFoodFactsResponse('not an object')).toBeNull();
    expect(mapOpenFoodFactsResponse({ status: 1 })).toBeNull(); // missing product
  });

  it('leaves missing individual nutriment fields as null rather than 0', () => {
    const raw = { status: 1, product: { product_name: 'Mystery Bar', nutriments: { proteins_100g: 5 } } };
    const result = mapOpenFoodFactsResponse(raw);
    expect(result?.proteinPer100).toBe(5);
    expect(result?.kcalPer100).toBeNull();
    expect(result?.carbsPer100).toBeNull();
    expect(result?.fatPer100).toBeNull();
    expect(result?.fiberPer100).toBeNull();
  });

  it('ignores non-numeric nutriment values instead of coercing them', () => {
    const raw = { status: 1, product: { product_name: 'Weird', nutriments: { 'energy-kcal_100g': 'not-a-number' } } };
    expect(mapOpenFoodFactsResponse(raw)?.kcalPer100).toBeNull();
  });
});
