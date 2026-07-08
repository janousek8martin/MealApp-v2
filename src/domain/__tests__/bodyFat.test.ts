import { clampBodyFatPct, estimateLbmKg, navyBodyFatPct } from '../bodyFat';

describe('Navy tape method', () => {
  it('estimates a male body fat percentage', () => {
    // height 180, waist 85, neck 38 → ≈ 16.1 %
    const result = navyBodyFatPct({ sex: 'male', heightCm: 180, waistCm: 85, neckCm: 38 });
    expect(result).toBeCloseTo(16.1, 1);
  });

  it('estimates a female body fat percentage (requires hip)', () => {
    const result = navyBodyFatPct({
      sex: 'female',
      heightCm: 165,
      waistCm: 75,
      neckCm: 33,
      hipCm: 98,
    });
    // D = 1.29579 − 0.35004×log10(75+98−33) + 0.221×log10(165)
    //   = 1.29579 − 0.35004×log10(140) + 0.221×log10(165)
    expect(result).toBeGreaterThan(20);
    expect(result).toBeLessThan(35);
  });

  it('throws for a female measurement without hip circumference', () => {
    expect(() =>
      navyBodyFatPct({ sex: 'female', heightCm: 165, waistCm: 75, neckCm: 33 }),
    ).toThrow();
  });

  it('throws instead of returning NaN when waist <= neck for a male measurement', () => {
    expect(() => navyBodyFatPct({ sex: 'male', heightCm: 180, waistCm: 35, neckCm: 38 })).toThrow();
    expect(() => navyBodyFatPct({ sex: 'male', heightCm: 180, waistCm: 38, neckCm: 38 })).toThrow();
  });

  it('throws instead of returning NaN when waist+hip <= neck for a female measurement', () => {
    expect(() =>
      navyBodyFatPct({ sex: 'female', heightCm: 165, waistCm: 20, neckCm: 33, hipCm: 10 }),
    ).toThrow();
  });
});

describe('clampBodyFatPct', () => {
  it('passes through a plausible value unchanged', () => {
    expect(clampBodyFatPct(20)).toBe(20);
  });

  it('clamps below the 3% floor', () => {
    expect(clampBodyFatPct(-5)).toBe(3);
  });

  it('clamps above the 70% ceiling', () => {
    expect(clampBodyFatPct(95)).toBe(70);
  });
});

describe('lean body mass', () => {
  it('derives LBM from body fat percentage', () => {
    expect(estimateLbmKg(80, 20)).toBeCloseTo(64, 5);
  });

  it('falls back to total weight when body fat is unknown', () => {
    expect(estimateLbmKg(80, undefined)).toBe(80);
  });

  it('clamps an out-of-range body fat percentage before computing LBM', () => {
    expect(estimateLbmKg(80, 95)).toBeCloseTo(80 * (1 - 70 / 100), 5);
  });
});
