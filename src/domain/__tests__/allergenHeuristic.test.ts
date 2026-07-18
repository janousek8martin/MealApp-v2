import { deriveAllergensFromName } from '../allergenHeuristic';

describe('deriveAllergensFromName', () => {
  it('detects peanuts in English and Czech', () => {
    expect(deriveAllergensFromName('', 'Peanut butter')).toContain('peanuts');
    expect(deriveAllergensFromName('Arašídové máslo', '')).toContain('peanuts');
  });

  it('detects dairy/lactose from common terms', () => {
    expect(deriveAllergensFromName('Mléko', 'Milk')).toContain('lactose');
    expect(deriveAllergensFromName('Sýr eidam', 'Edam cheese')).toContain('lactose');
    expect(deriveAllergensFromName('Jogurt', 'Yogurt')).toContain('lactose');
  });

  it('detects gluten-bearing grains', () => {
    expect(deriveAllergensFromName('Pšeničná mouka', 'Wheat flour')).toContain('gluten');
    expect(deriveAllergensFromName('Žitný chléb', 'Rye bread')).toContain('gluten');
  });

  it('detects shellfish vs molluscs as distinct EU categories', () => {
    expect(deriveAllergensFromName('Krevety', 'Shrimp')).toEqual(['shellfish']);
    expect(deriveAllergensFromName('Slávky', 'Mussels')).toEqual(['molluscs']);
  });

  it('is case-insensitive', () => {
    expect(deriveAllergensFromName('', 'PEANUT BUTTER')).toContain('peanuts');
  });

  it('can match multiple allergens in one name', () => {
    const result = deriveAllergensFromName('', 'Peanut butter cheese sandwich (wheat bread)');
    expect(result).toEqual(expect.arrayContaining(['peanuts', 'lactose', 'gluten']));
  });

  it('returns an empty array when nothing matches, never null/undefined', () => {
    expect(deriveAllergensFromName('Mrkev', 'Carrot')).toEqual([]);
  });
});
