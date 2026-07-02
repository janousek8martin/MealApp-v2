import {
  clampDailyDeficitKcal,
  computeTargets,
  defaultDailyDeficitKcal,
  type TargetsInput,
} from '../targets';

const adultBase: TargetsInput = {
  profileType: 'adult',
  sex: 'male',
  ageYears: 30,
  heightCm: 180,
  weightKg: 80,
  bodyFatPct: 20,
  activityLevel: 'moderate',
  goal: 'maintain',
};

describe('computeTargets – adults', () => {
  it('maintenance equals TDEE', () => {
    const result = computeTargets(adultBase);
    expect(result.bmr).toBeCloseTo(1780, 5);
    expect(result.tdee).toBeCloseTo(2759, 5);
    expect(result.baseTdciKcal).toBeCloseTo(2759, 5);
    expect(result.mode).toBe('maintenance');
  });

  it('weight loss subtracts a deficit within the safe band and never cuts protein', () => {
    const result = computeTargets({ ...adultBase, goal: 'lose' });

    // Default deficit = 0.5 % BW/week → 80×0.005×7700/7 = 440 kcal/day
    expect(result.baseTdciKcal).toBeCloseTo(2759 - 440, 5);
    expect(result.mode).toBe('deficit');

    // Protein in deficit: 2.4 g/kg LBM × 64 kg = 153.6 g
    expect(result.macros.proteinG).toBeCloseTo(153.6, 1);

    // Energy accounting: protein + fat + carbs ≈ TDCI
    const kcal =
      result.macros.proteinG * 4 + result.macros.fatG * 9 + result.macros.carbsG * 4;
    expect(kcal).toBeCloseTo(result.adjustedTdciKcal, 0);

    // Fat never below 20 % of calories
    expect((result.macros.fatG * 9) / result.adjustedTdciKcal).toBeGreaterThanOrEqual(0.2 - 1e-9);
  });

  it('normal phase protein uses 1.8 g/kg LBM', () => {
    const result = computeTargets(adultBase);
    expect(result.macros.proteinG).toBeCloseTo(1.8 * 64, 1);
  });

  it('muscle gain adds the flat default surplus when fitness experience is unknown', () => {
    const result = computeTargets({ ...adultBase, goal: 'gain', goalBodyFatPct: 22 });
    expect(result.baseTdciKcal).toBeCloseTo(2759 + 250, 5);
    expect(result.mode).toBe('surplus');
  });

  it('muscle gain surplus scales with fitness experience when set', () => {
    const beginner = computeTargets({
      ...adultBase,
      goal: 'gain',
      goalBodyFatPct: 22,
      fitnessExperience: 'beginner',
    });
    expect(beginner.baseTdciKcal).toBeCloseTo(2759 * 1.1, 5);

    const intermediate = computeTargets({
      ...adultBase,
      goal: 'gain',
      goalBodyFatPct: 22,
      fitnessExperience: 'intermediate',
    });
    expect(intermediate.baseTdciKcal).toBeCloseTo(2759 * 1.07, 5);

    const advanced = computeTargets({
      ...adultBase,
      goal: 'gain',
      goalBodyFatPct: 22,
      fitnessExperience: 'advanced',
    });
    expect(advanced.baseTdciKcal).toBeCloseTo(2759 * 1.05, 5);
  });

  it('an explicit surplusKcal override takes priority over fitness experience', () => {
    const result = computeTargets({
      ...adultBase,
      goal: 'gain',
      goalBodyFatPct: 22,
      fitnessExperience: 'beginner',
      surplusKcal: 300,
    });
    expect(result.baseTdciKcal).toBeCloseTo(2759 + 300, 5);
  });

  it('recomposition: gain + lower target body fat → maintenance calories', () => {
    const result = computeTargets({ ...adultBase, goal: 'gain', goalBodyFatPct: 15 });
    expect(result.baseTdciKcal).toBeCloseTo(2759, 5);
    expect(result.mode).toBe('recomposition');
  });

  it('applies the manual ±kcal adjustment on top of the computed TDCI', () => {
    const result = computeTargets({ ...adultBase, manualAdjustmentKcal: 150 });
    expect(result.baseTdciKcal).toBeCloseTo(2759, 5);
    expect(result.adjustedTdciKcal).toBeCloseTo(2909, 5);
  });

  it('clamps a requested fat share below the 20 % floor', () => {
    const result = computeTargets({ ...adultBase, fatShareOfTdci: 0.15 });
    expect((result.macros.fatG * 9) / result.adjustedTdciKcal).toBeCloseTo(0.2, 2);
  });

  it('uses total weight for protein when body fat is unknown', () => {
    const result = computeTargets({ ...adultBase, bodyFatPct: undefined });
    expect(result.macros.proteinG).toBeCloseTo(1.8 * 80, 1);
  });

  it('fiber defaults to the EFSA minimum with an optional gender-specific mode', () => {
    expect(computeTargets(adultBase).fiberG).toBe(25);
    expect(computeTargets({ ...adultBase, fiberMode: 'gender_specific' }).fiberG).toBe(32);
    expect(
      computeTargets({ ...adultBase, sex: 'female', fiberMode: 'gender_specific' }).fiberG,
    ).toBe(28);
  });
});

describe('computeTargets – children', () => {
  it('uses EER and locks the goal to maintenance', () => {
    const result = computeTargets({
      profileType: 'child',
      sex: 'male',
      ageYears: 10,
      heightCm: 140,
      weightKg: 32,
      activityLevel: 'moderate',
      goal: 'lose', // must be ignored for children
    });
    expect(result.baseTdciKcal).toBeCloseTo(2163.9, 1);
    expect(result.mode).toBe('maintenance');
    expect(result.goalLocked).toBe(true);
  });
});

describe('deficit sizing', () => {
  it('default deficit corresponds to 0.5 % body weight per week', () => {
    expect(defaultDailyDeficitKcal(80)).toBeCloseTo(440, 5);
  });

  it('clamps to the 0.5–1 % per week safety band', () => {
    expect(clampDailyDeficitKcal(80, 100)).toBeCloseTo(440, 5);
    expect(clampDailyDeficitKcal(80, 2000)).toBeCloseTo(880, 5);
    expect(clampDailyDeficitKcal(80, 600)).toBe(600);
  });
});
