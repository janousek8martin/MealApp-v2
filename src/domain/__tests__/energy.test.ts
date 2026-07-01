import { activityMultiplier, eerChildKcal, mifflinStJeorBmr, tdee } from '../energy';

describe('Mifflin-St Jeor BMR', () => {
  it('computes the male formula', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780
    expect(mifflinStJeorBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })).toBeCloseTo(
      1780,
      5,
    );
  });

  it('computes the female formula', () => {
    // 10×65 + 6.25×165 − 5×40 − 161 = 1320.25
    expect(
      mifflinStJeorBmr({ sex: 'female', weightKg: 65, heightCm: 165, ageYears: 40 }),
    ).toBeCloseTo(1320.25, 5);
  });
});

describe('TDEE', () => {
  it('uses the activity coefficients from the brief', () => {
    expect(activityMultiplier('sedentary')).toBe(1.2);
    expect(activityMultiplier('light')).toBe(1.375);
    expect(activityMultiplier('moderate')).toBe(1.55);
    expect(activityMultiplier('active')).toBe(1.725);
    expect(activityMultiplier('very_active')).toBe(1.9);
  });

  it('multiplies BMR by the coefficient', () => {
    expect(tdee(1780, 'moderate')).toBeCloseTo(2759, 5);
  });
});

describe('EER for children (IOM)', () => {
  it('computes an active 10-year-old boy', () => {
    // 88.5 − 61.9×10 + 1.26×(26.7×32 + 903×1.40) + 25 ≈ 2163.9
    expect(
      eerChildKcal({ sex: 'male', ageYears: 10, weightKg: 32, heightCm: 140, activityLevel: 'moderate' }),
    ).toBeCloseTo(2163.9, 1);
  });

  it('computes a lightly active 6-year-old girl', () => {
    // 135.3 − 30.8×6 + 1.16×(10×21 + 934×1.18) + 20 = −49.5 + 1522.06 + 20 = 1492.56
    expect(
      eerChildKcal({ sex: 'female', ageYears: 6, weightKg: 21, heightCm: 118, activityLevel: 'light' }),
    ).toBeCloseTo(1492.56, 1);
  });
});
