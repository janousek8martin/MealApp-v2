import { shouldRecommendMaintenance, validateGoals } from '../goals';

describe('goal validation', () => {
  it('rejects a higher goal weight when target body fat is lower', () => {
    const result = validateGoals({
      currentWeightKg: 80,
      currentBodyFatPct: 22,
      goalWeightKg: 85,
      goalBodyFatPct: 15,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('goal_weight_must_not_exceed_current');
  });

  it('accepts a consistent cut goal', () => {
    const result = validateGoals({
      currentWeightKg: 80,
      currentBodyFatPct: 22,
      goalWeightKg: 74,
      goalBodyFatPct: 15,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('allows a higher goal weight when target body fat is not lower', () => {
    const result = validateGoals({
      currentWeightKg: 80,
      currentBodyFatPct: 15,
      goalWeightKg: 86,
      goalBodyFatPct: 16,
    });
    expect(result.valid).toBe(true);
  });
});

describe('diet cycle recommendation', () => {
  it('recommends maintenance after a 5-point body fat drop for men', () => {
    expect(shouldRecommendMaintenance({ sex: 'male', startBodyFatPct: 25, currentBodyFatPct: 20 })).toBe(true);
    expect(shouldRecommendMaintenance({ sex: 'male', startBodyFatPct: 25, currentBodyFatPct: 21 })).toBe(false);
  });

  it('uses the 7-point threshold for women', () => {
    expect(shouldRecommendMaintenance({ sex: 'female', startBodyFatPct: 32, currentBodyFatPct: 25 })).toBe(true);
    expect(shouldRecommendMaintenance({ sex: 'female', startBodyFatPct: 32, currentBodyFatPct: 26 })).toBe(false);
  });
});
