import { pickClosestSnack, scalingMultiplier } from '../portions';

describe('scalingMultiplier', () => {
  it('scales up when the target exceeds the recipe portion', () => {
    expect(scalingMultiplier(900, 600)).toBeCloseTo(1.5);
  });

  it('scales down when the target is below the recipe portion', () => {
    expect(scalingMultiplier(300, 600)).toBeCloseTo(0.5);
  });

  it('falls back to 1 for a zero-kcal recipe rather than dividing by zero', () => {
    expect(scalingMultiplier(500, 0)).toBe(1);
  });
});

describe('pickClosestSnack', () => {
  it('returns null when there are no candidates', () => {
    expect(pickClosestSnack({ kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 }, [])).toBeNull();
  });

  it('picks the candidate closest to the remaining target', () => {
    const candidates = [
      { item: 'nuts', nutrition: { kcal: 550, proteinG: 15, carbsG: 15, fatG: 45, fiberG: 8 } },
      { item: 'yogurt', nutrition: { kcal: 210, proteinG: 22, carbsG: 20, fatG: 6, fiberG: 0 } },
      { item: 'apple', nutrition: { kcal: 90, proteinG: 0.5, carbsG: 24, fatG: 0.3, fiberG: 4 } },
    ];
    const target = { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6 };
    expect(pickClosestSnack(target, candidates)?.item).toBe('yogurt');
  });

  it('weighs protein deviation more heavily than a same-magnitude carb/fat deviation', () => {
    const candidates = [
      // Same kcal as target; carbs off by 20.
      { item: 'carb_heavy', nutrition: { kcal: 200, proteinG: 20, carbsG: 40, fatG: 6, fiberG: 0 } },
      // Same kcal as target; protein off by 20.
      { item: 'protein_light', nutrition: { kcal: 200, proteinG: 0, carbsG: 20, fatG: 6, fiberG: 0 } },
    ];
    const target = { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6 };
    expect(pickClosestSnack(target, candidates)?.item).toBe('carb_heavy');
  });
});
