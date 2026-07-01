import { estimateLbmKg, navyBodyFatPct } from '../bodyFat';

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
});

describe('lean body mass', () => {
  it('derives LBM from body fat percentage', () => {
    expect(estimateLbmKg(80, 20)).toBeCloseTo(64, 5);
  });

  it('falls back to total weight when body fat is unknown', () => {
    expect(estimateLbmKg(80, undefined)).toBe(80);
  });
});
