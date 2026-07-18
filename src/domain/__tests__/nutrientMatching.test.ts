import { matchGenericForBranded } from '../nutrientMatching';

const genericPool = [
  { key: 'usda_1', nameEn: 'Chicken, broiler, breast, meat only, raw', category: 'meat', micronutrients: { ironMg: 0.4 } },
  { key: 'usda_2', nameEn: 'Beef, liver, raw', category: 'meat', micronutrients: { ironMg: 6.2 } },
  { key: 'usda_3', nameEn: 'Milk, whole', category: 'dairy', micronutrients: { calciumMg: 120 } },
];

describe('matchGenericForBranded', () => {
  it('matches a branded item to the closest same-category generic food', () => {
    const result = matchGenericForBranded({ nameEn: 'Grilled chicken breast fillet', categoriesTags: ['en:meats', 'en:poultry'] }, genericPool);
    expect(result?.fdcKey).toBe('usda_1');
    expect(result?.micronutrients.ironMg).toBe(0.4);
  });

  it('never matches across categories even with high name overlap', () => {
    const result = matchGenericForBranded({ nameEn: 'Chicken flavored milk drink', categoriesTags: ['en:dairies'] }, genericPool);
    expect(result?.fdcKey).not.toBe('usda_1');
  });

  it('returns null when nothing clears the confidence threshold', () => {
    const result = matchGenericForBranded({ nameEn: 'Sparkling water', categoriesTags: ['en:meats'] }, genericPool);
    expect(result).toBeNull();
  });

  it('returns null (not a bad guess) when the category itself has no mapping', () => {
    const result = matchGenericForBranded({ nameEn: 'Chicken breast', categoriesTags: ['en:some-unmapped-category'] }, genericPool);
    expect(result).toBeNull();
  });

  it('picks the highest-scoring candidate among multiple same-category matches', () => {
    const result = matchGenericForBranded({ nameEn: 'Beef liver pate', categoriesTags: ['en:meats'] }, genericPool);
    expect(result?.fdcKey).toBe('usda_2');
  });

  it('assigns a higher confidence to a closer name match', () => {
    const close = matchGenericForBranded({ nameEn: 'Chicken, broiler, breast, meat only, raw', categoriesTags: ['en:meats'] }, genericPool);
    expect(close?.confidence).toBe('high');
  });
});
