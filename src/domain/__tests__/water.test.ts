import { defaultWaterGoalMl } from '../water';

describe('defaultWaterGoalMl', () => {
  it('computes ml/kg for a typical adult weight', () => {
    expect(defaultWaterGoalMl(80, 'male')).toBeCloseTo(80 * 33, 5);
  });

  it('clamps very low body weights to the minimum', () => {
    expect(defaultWaterGoalMl(20, 'female')).toBe(1500);
  });

  it('clamps very high body weights to the maximum', () => {
    expect(defaultWaterGoalMl(200, 'male')).toBe(4000);
  });
});
