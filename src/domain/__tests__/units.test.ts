import {
  cmToFeetInches,
  feetInchesToCm,
  formatAmount,
  formatCupQuarters,
  gramsToOunces,
  isKitchenVolumeUnit,
  kgToLbs,
  kitchenEquivalentLabel,
  kitchenVolumeToMl,
  kitchenWeightToGrams,
  lbsToKg,
  mlToUsCups,
  poundsToGrams,
  usCupsToMl,
} from '../units';

describe('unit conversions', () => {
  it('converts weight both ways', () => {
    expect(kgToLbs(80)).toBeCloseTo(176.37, 2);
    expect(lbsToKg(kgToLbs(80))).toBeCloseTo(80, 6);
  });

  it('converts height to feet/inches and back', () => {
    const { feet, inches } = cmToFeetInches(180);
    expect(feet).toBe(5);
    expect(inches).toBeCloseTo(10.9, 1);
    expect(feetInchesToCm(5, 10.866)).toBeCloseTo(180, 0);
  });

  it('converts volumes using the US customary cup', () => {
    expect(mlToUsCups(236.588)).toBeCloseTo(1, 4);
    expect(usCupsToMl(2)).toBeCloseTo(473.176, 2);
  });

  it('converts grams to ounces', () => {
    expect(gramsToOunces(100)).toBeCloseTo(3.5274, 3);
  });

  it('formats amounts in the selected unit system', () => {
    expect(formatAmount(150, 'g', 'metric')).toBe('150 g');
    expect(formatAmount(150, 'g', 'us')).toBe('5.3 oz');
    expect(formatAmount(250, 'ml', 'metric')).toBe('250 ml');
    expect(formatAmount(250, 'ml', 'us')).toBe('1.1 cup');
    expect(formatAmount(2, 'piece', 'us')).toBe('2 pcs');
  });
});

describe('kitchen unit conversions', () => {
  it('converts the standard kitchen volume units to ml', () => {
    expect(kitchenVolumeToMl(1, 'tsp')).toBe(5);
    expect(kitchenVolumeToMl(1, 'tbsp')).toBe(15);
    expect(kitchenVolumeToMl(1, 'cup')).toBe(240);
    expect(kitchenVolumeToMl(1, 'cup_half')).toBe(120);
    expect(kitchenVolumeToMl(1, 'cup_third')).toBeCloseTo(80);
    expect(kitchenVolumeToMl(1, 'cup_quarter')).toBe(60);
  });

  it('scales kitchen volumes linearly with amount', () => {
    expect(kitchenVolumeToMl(3, 'tbsp')).toBe(45);
  });

  it('converts pounds to grams using the same factor as kgToLbs', () => {
    expect(poundsToGrams(1)).toBeCloseTo(453.6, 1);
  });

  it('converts kitchen weight units (oz/lb) to grams', () => {
    expect(kitchenWeightToGrams(1, 'oz')).toBeCloseTo(28.35, 1);
    expect(kitchenWeightToGrams(1, 'lb')).toBeCloseTo(453.6, 1);
  });

  it('identifies which kitchen units are volume-based', () => {
    expect(isKitchenVolumeUnit('cup')).toBe(true);
    expect(isKitchenVolumeUnit('oz')).toBe(false);
  });
});

describe('formatCupQuarters', () => {
  it('renders whole numbers with no fraction', () => {
    expect(formatCupQuarters(4)).toBe('1');
    expect(formatCupQuarters(8)).toBe('2');
  });

  it('renders quarter fractions under a whole cup', () => {
    expect(formatCupQuarters(1)).toBe('1/4');
    expect(formatCupQuarters(2)).toBe('1/2');
    expect(formatCupQuarters(3)).toBe('3/4');
  });

  it('renders a mixed whole + fraction', () => {
    expect(formatCupQuarters(5)).toBe('1 1/4');
    expect(formatCupQuarters(6)).toBe('1 1/2');
  });
});

describe('kitchenEquivalentLabel', () => {
  it('matches the "60 g of oats -> ~3/4 cup" example from the spec', () => {
    // oats gramsPerCup = 90 -> 60g = 2/3 cup -> rounds to nearest quarter (2.67 quarters -> 3 -> 3/4)
    expect(kitchenEquivalentLabel(60, 'g', 90)).toBe('3/4');
  });

  it('returns null for piece-based ingredients', () => {
    expect(kitchenEquivalentLabel(2, 'piece', null)).toBeNull();
  });

  it('returns null for g-based foods with no known density', () => {
    expect(kitchenEquivalentLabel(100, 'g', null)).toBeNull();
    expect(kitchenEquivalentLabel(100, 'g', undefined)).toBeNull();
  });

  it('returns null for amounts under a quarter cup', () => {
    expect(kitchenEquivalentLabel(5, 'g', 90)).toBeNull();
  });

  it('computes a direct volume equivalent for ml-based foods, no density needed', () => {
    // 120 ml = 1/2 cup (240 ml/cup)
    expect(kitchenEquivalentLabel(120, 'ml', null)).toBe('1/2');
  });
});
