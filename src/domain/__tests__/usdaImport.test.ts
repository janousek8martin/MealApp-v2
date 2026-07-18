import { parseUsdaFoodRow, USDA_NUTRIENT_ID_MAP } from '../usdaImport';

describe('parseUsdaFoodRow', () => {
  const baseNutrients = {
    1008: 165, // kcal
    1003: 31, // protein g
    1005: 0, // carbs g
    1004: 3.6, // fat g
    1079: 0, // fiber g
    1087: 15, // calcium mg
    1089: 1.3, // iron mg
  };

  it('maps a well-formed row to a UsdaFoodRecord', () => {
    const record = parseUsdaFoodRow(
      { fdc_id: '171077', description: 'Chicken, broiler, breast, meat only, raw', food_category: 'Poultry Products', nutrients: baseNutrients },
      'usda_foundation',
    );
    expect(record).toEqual({
      fdcId: '171077',
      descriptionEn: 'Chicken, broiler, breast, meat only, raw',
      category: 'Poultry Products',
      kcalPer100: 165,
      proteinPer100: 31,
      carbsPer100: 0,
      fatPer100: 3.6,
      fiberPer100: 0,
      micronutrients: { calciumMg: 15, ironMg: 1.3 },
      sourceDataset: 'usda_foundation',
    });
  });

  it('returns null when a core macro is missing', () => {
    const { 1008: _omit, ...withoutKcal } = baseNutrients;
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'X', food_category: 'Y', nutrients: withoutKcal },
      'usda_sr_legacy',
    );
    expect(record).toBeNull();
  });

  it('leaves a micronutrient out entirely when absent, never defaults to 0', () => {
    const { 1087: _omit, ...withoutCalcium } = baseNutrients;
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'X', food_category: 'Y', nutrients: withoutCalcium },
      'usda_foundation',
    );
    expect(record?.micronutrients.calciumMg).toBeUndefined();
    expect('calciumMg' in (record?.micronutrients ?? {})).toBe(false);
  });

  it('maps every nutrient ID this app tracks', () => {
    // 19 single-ID micronutrients + omega-3 (summed from 3 fatty-acid IDs, not a single ID)
    expect(Object.keys(USDA_NUTRIENT_ID_MAP).length).toBeGreaterThanOrEqual(19);
  });

  it('sums omega-3 from the three fatty-acid IDs, skipping any that are absent', () => {
    const withOmega3 = { ...baseNutrients, 1404: 0.1, 1278: 0.2, 1272: 0.3 };
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'Salmon', food_category: 'Finfish', nutrients: withOmega3 },
      'usda_foundation',
    );
    expect(record?.micronutrients.omega3G).toBeCloseTo(0.6, 5);
  });

  it('sums only the present omega-3 IDs, not treating a missing one as 0', () => {
    const partialOmega3 = { ...baseNutrients, 1404: 0.1 };
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'Salmon', food_category: 'Finfish', nutrients: partialOmega3 },
      'usda_foundation',
    );
    expect(record?.micronutrients.omega3G).toBeCloseTo(0.1, 5);
  });

  it('omits omega3G entirely when none of the three IDs are present', () => {
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'X', food_category: 'Y', nutrients: baseNutrients },
      'usda_foundation',
    );
    expect('omega3G' in (record?.micronutrients ?? {})).toBe(false);
  });
});
