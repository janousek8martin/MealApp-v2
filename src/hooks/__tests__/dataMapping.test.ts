import type { MetricRow, ProfileRow } from '../dataMapping';
import { targetsForProfile } from '../dataMapping';

function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    householdId: 'h1',
    name: 'Test',
    color: null,
    profileType: 'adult',
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 180,
    activityLevel: 'moderate',
    activityMultiplier: null,
    goal: 'maintain',
    goalWeightKg: null,
    goalBodyFatPct: null,
    goalRateKgPerWeek: null,
    fitnessExperience: null,
    customTdeeKcal: null,
    sharesMainMeals: true,
    workoutDaysJson: null,
    snackPositionsJson: null,
    tdciManualAdjustmentKcal: 0,
    macroOverridesJson: null,
    macroDayOverridesJson: null,
    enabledSlotKeysJson: null,
    trackWater: true,
    waterGoalMl: null,
    waterGlassMl: null,
    wantsNewFoods: false,
    ...overrides,
  } as ProfileRow;
}

function makeMetric(): MetricRow {
  return {
    id: 'm1',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    profileId: 'p1',
    date: '2026-07-13',
    weightKg: 80,
    bodyFatPct: 20,
  } as MetricRow;
}

describe('targetsForProfile per-weekday override', () => {
  it('a Monday-only override changes Monday but not Tuesday', () => {
    const profile = makeProfile({
      macroDayOverridesJson: JSON.stringify({ '1': { proteinPerKgLbm: 3 } }),
    });
    const metric = makeMetric();

    const monday = targetsForProfile(profile, metric, 'efsa_min', '2026-07-13'); // a Monday
    const tuesday = targetsForProfile(profile, metric, 'efsa_min', '2026-07-14'); // a Tuesday
    const noDate = targetsForProfile(profile, metric, 'efsa_min');

    expect(monday!.macros.proteinG).not.toBe(tuesday!.macros.proteinG);
    expect(tuesday!.macros.proteinG).toBe(noDate!.macros.proteinG);
  });
});
