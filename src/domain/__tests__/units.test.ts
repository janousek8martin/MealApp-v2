import {
  cmToFeetInches,
  feetInchesToCm,
  formatAmount,
  gramsToOunces,
  kgToLbs,
  lbsToKg,
  mlToUsCups,
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
