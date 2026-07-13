import {
  allocateSnackWeights,
  isScalingMultiplierClamped,
  pickClosestSnack,
  resolveMainSlotTarget,
  resolveSlotCalorieShare,
  resolveSnackTarget,
  scalingMultiplier,
} from '../portions';

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

  it('clamps a would-be tiny portion to 0.25x', () => {
    expect(scalingMultiplier(50, 600)).toBeCloseTo(0.25);
  });

  it('clamps a would-be huge portion to 4x', () => {
    expect(scalingMultiplier(6000, 600)).toBeCloseTo(4);
  });
});

describe('isScalingMultiplierClamped', () => {
  it('is false within the 0.25x-4x range', () => {
    expect(isScalingMultiplierClamped(900, 600)).toBe(false);
  });

  it('is true when the raw ratio would fall below 0.25x', () => {
    expect(isScalingMultiplierClamped(50, 600)).toBe(true);
  });

  it('is true when the raw ratio would exceed 4x', () => {
    expect(isScalingMultiplierClamped(6000, 600)).toBe(true);
  });

  it('is false for a zero-kcal recipe (scalingMultiplier falls back to 1, not a ratio)', () => {
    expect(isScalingMultiplierClamped(500, 0)).toBe(false);
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

describe('resolveSlotCalorieShare', () => {
  it('falls back to the household share when there is no override', () => {
    expect(resolveSlotCalorieShare(0.25, undefined)).toBe(0.25);
  });

  it('falls back to the household share when the override has a null calorieSharePercent', () => {
    expect(
      resolveSlotCalorieShare(0.25, { calorieSharePercent: null, proteinTargetG: 20, fatTargetG: 10 }),
    ).toBe(0.25);
  });

  it("uses the profile's own override percent when set", () => {
    expect(
      resolveSlotCalorieShare(0.25, { calorieSharePercent: 0.3, proteinTargetG: null, fatTargetG: null }),
    ).toBe(0.3);
  });
});

describe('resolveSnackTarget', () => {
  const remaining = { kcal: 400, proteinG: 30, carbsG: 40, fatG: 10 };

  it('returns the remaining daily target unchanged when there is no override', () => {
    expect(resolveSnackTarget(remaining, 2400, undefined)).toEqual(remaining);
  });

  it('returns the remaining daily target unchanged when the override has every field null', () => {
    const override = { calorieSharePercent: null, proteinTargetG: null, fatTargetG: null };
    expect(resolveSnackTarget(remaining, 2400, override)).toEqual(remaining);
  });

  it('computes carbs from the remaining kcal once protein/fat are overridden', () => {
    // kcal stays "remaining" (no calorieSharePercent override); protein/fat come from the override.
    const override = { calorieSharePercent: null, proteinTargetG: 20, fatTargetG: 15 };
    const result = resolveSnackTarget(remaining, 2400, override);
    expect(result.kcal).toBe(400);
    expect(result.proteinG).toBe(20);
    expect(result.fatG).toBe(15);
    // (400 - 20*4 - 15*9) / 4 = (400 - 80 - 135) / 4 = 185/4 = 46.25
    expect(result.carbsG).toBeCloseTo(46.25);
  });

  it('derives kcal from calorieSharePercent × daily target when the share is overridden too', () => {
    const override = { calorieSharePercent: 0.1, proteinTargetG: 10, fatTargetG: 5 };
    const result = resolveSnackTarget(remaining, 2400, override);
    expect(result.kcal).toBe(240);
    expect(result.proteinG).toBe(10);
    expect(result.fatG).toBe(5);
    // (240 - 40 - 45) / 4 = 155/4 = 38.75
    expect(result.carbsG).toBeCloseTo(38.75);
  });

  it('never returns negative carbs when protein/fat overrides exceed the kcal budget', () => {
    const override = { calorieSharePercent: 0.05, proteinTargetG: 40, fatTargetG: 20 };
    const result = resolveSnackTarget(remaining, 2400, override);
    expect(result.carbsG).toBe(0);
  });
});

describe('resolveMainSlotTarget', () => {
  // Internally consistent with kcal = protein×4 + fat×9 + carbs×4 (150×4 + 70×9 + 250×4 = 2230),
  // like a real computeTargets() result, so the no-override case can assert exact proportionality.
  const dailyTarget = { kcal: 2230, proteinG: 150, carbsG: 250, fatG: 70 };

  it('proportionally splits every macro by the calorie share when there is no override', () => {
    const result = resolveMainSlotTarget(dailyTarget, 0.25, undefined);
    expect(result.kcal).toBeCloseTo(557.5);
    expect(result.proteinG).toBeCloseTo(37.5);
    expect(result.fatG).toBeCloseTo(17.5);
    expect(result.carbsG).toBeCloseTo(62.5);
  });

  it('uses the override protein/fat targets and derives carbs from the remaining kcal budget', () => {
    const override = { calorieSharePercent: null, proteinTargetG: 50, fatTargetG: 15 };
    const result = resolveMainSlotTarget(dailyTarget, 0.25, override);
    expect(result.kcal).toBeCloseTo(557.5);
    expect(result.proteinG).toBe(50);
    expect(result.fatG).toBe(15);
    // (557.5 - 50*4 - 15*9) / 4 = (557.5 - 200 - 135) / 4 = 222.5/4 = 55.625
    expect(result.carbsG).toBeCloseTo(55.625);
  });

  it('derives kcal from an overridden calorie share too', () => {
    const override = { calorieSharePercent: 0.4, proteinTargetG: 60, fatTargetG: 20 };
    const result = resolveMainSlotTarget(dailyTarget, 0.25, override);
    expect(result.kcal).toBeCloseTo(892);
  });

  it('never returns negative carbs when protein/fat overrides exceed the slot kcal budget', () => {
    const override = { calorieSharePercent: null, proteinTargetG: 100, fatTargetG: 50 };
    const result = resolveMainSlotTarget(dailyTarget, 0.1, override);
    expect(result.carbsG).toBe(0);
  });
});

describe('allocateSnackWeights', () => {
  it('splits evenly across slots with no calorieShare and no overrides (e.g. all newly inserted)', () => {
    const slots = [{ id: 'a', calorieShare: 0 }, { id: 'b', calorieShare: 0 }, { id: 'c', calorieShare: 0 }];
    const weights = allocateSnackWeights(slots, new Map());
    expect(weights).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('gives a single slot the full weight', () => {
    const slots = [{ id: 'a', calorieShare: 0 }];
    expect(allocateSnackWeights(slots, new Map())).toEqual([1]);
  });

  it('splits proportionally to calorieShare when set', () => {
    const slots = [{ id: 'a', calorieShare: 0.1 }, { id: 'b', calorieShare: 0.3 }];
    const weights = allocateSnackWeights(slots, new Map());
    expect(weights[0]).toBeCloseTo(0.25);
    expect(weights[1]).toBeCloseTo(0.75);
  });

  it('lets a per-profile override win over the slot default', () => {
    const slots = [{ id: 'a', calorieShare: 0.1 }, { id: 'b', calorieShare: 0.1 }];
    const overrides = new Map([['a', { calorieSharePercent: 0.4, proteinTargetG: null, fatTargetG: null }]]);
    const weights = allocateSnackWeights(slots, overrides);
    expect(weights[0]).toBeCloseTo(0.8);
    expect(weights[1]).toBeCloseTo(0.2);
  });
});
