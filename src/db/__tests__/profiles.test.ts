import { eq } from 'drizzle-orm';

import { targetsForProfile } from '../../hooks/dataMapping';
import { createHouseholdWithDefaults } from '../repositories/households';
import { addBodyMetric, createProfile, restoreProfile, softDeleteProfile } from '../repositories/profiles';
import { bodyMetrics, profileRestrictions, profiles } from '../schema';
import { createTestDb } from '../testing/testDb';

function validCreateInput(householdId: string) {
  return {
    householdId,
    name: 'Martin',
    profileType: 'adult' as const,
    sex: 'male' as const,
    birthDate: '1990-05-01',
    heightCm: 180,
    activityLevel: 'moderate' as const,
    goal: 'lose' as const,
    weightKg: 80,
  };
}

describe('profile repository input validation (V3/D3)', () => {
  it('rejects an out-of-range height', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await expect(createProfile(db, { ...validCreateInput(householdId), heightCm: 30 })).rejects.toThrow();
    await expect(createProfile(db, { ...validCreateInput(householdId), heightCm: 400 })).rejects.toThrow();
  });

  it('rejects an out-of-range weight', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await expect(createProfile(db, { ...validCreateInput(householdId), weightKg: 1 })).rejects.toThrow();
    await expect(createProfile(db, { ...validCreateInput(householdId), weightKg: 500 })).rejects.toThrow();
  });

  it('rejects an out-of-range body fat percentage', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await expect(createProfile(db, { ...validCreateInput(householdId), bodyFatPct: 1 })).rejects.toThrow();
    await expect(createProfile(db, { ...validCreateInput(householdId), bodyFatPct: 95 })).rejects.toThrow();
  });

  it('rejects a birth date that is not in the past', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await expect(createProfile(db, { ...validCreateInput(householdId), birthDate: '2999-01-01' })).rejects.toThrow();
  });

  it('rejects an out-of-range weight/body-fat when logging a body metric', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createProfile(db, validCreateInput(householdId));
    await expect(addBodyMetric(db, profileId, { weightKg: 500 })).rejects.toThrow();
    await expect(addBodyMetric(db, profileId, { weightKg: 80, bodyFatPct: 95 })).rejects.toThrow();
  });
});

describe('softDeleteProfile / restoreProfile (N1 undo)', () => {
  it('soft-deletes a profile and restores it, reversing the delete', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createProfile(db, validCreateInput(householdId));

    await softDeleteProfile(db, profileId);
    const [deleted] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(deleted.deletedAt).not.toBeNull();

    await restoreProfile(db, profileId);
    const [restored] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(restored.deletedAt).toBeNull();
  });
});

describe('profile repository', () => {
  it('creates a profile with an initial body metric and restrictions', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');

    const profileId = await createProfile(db, {
      householdId,
      name: 'Martin',
      profileType: 'adult',
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 180,
      activityLevel: 'moderate',
      goal: 'lose',
      weightKg: 80,
      bodyFatPct: 20,
      bodyFatMethod: 'navy',
      allergens: ['nuts'],
      diets: ['vegetarian'],
    });

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(profile.goal).toBe('lose');
    expect(JSON.parse(profile.snackPositionsJson ?? '[]')).toEqual([
      'snack_morning',
      'snack_afternoon',
    ]);

    const metrics = await db.select().from(bodyMetrics).where(eq(bodyMetrics.profileId, profileId));
    expect(metrics).toHaveLength(1);
    expect(metrics[0].weightKg).toBe(80);
    expect(metrics[0].bodyFatPct).toBe(20);
    expect(metrics[0].method).toBe('navy');

    const restrictions = await db
      .select()
      .from(profileRestrictions)
      .where(eq(profileRestrictions.profileId, profileId));
    expect(restrictions.map((r) => `${r.kind}:${r.value}`).sort()).toEqual([
      'allergen:nuts',
      'diet:vegetarian',
    ]);
  });

  it('locks child profiles to the maintain goal', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');

    const childId = await createProfile(db, {
      householdId,
      name: 'Anička',
      profileType: 'child',
      sex: 'female',
      birthDate: '2018-03-10',
      heightCm: 120,
      activityLevel: 'moderate',
      goal: 'lose', // must be ignored
      weightKg: 24,
    });

    const [child] = await db.select().from(profiles).where(eq(profiles.id, childId));
    expect(child.goal).toBe('maintain');
  });

  it('maps DB rows to live TDCI targets', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createProfile(db, {
      householdId,
      name: 'Martin',
      profileType: 'adult',
      sex: 'male',
      birthDate: '1996-01-01',
      heightCm: 180,
      activityLevel: 'moderate',
      goal: 'maintain',
      weightKg: 80,
      bodyFatPct: 20,
    });

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    const [metric] = await db.select().from(bodyMetrics).where(eq(bodyMetrics.profileId, profileId));

    const targets = targetsForProfile(profile, metric);
    expect(targets).not.toBeNull();
    expect(targets!.tdee).toBeGreaterThan(2500);
    expect(targets!.macros.proteinG).toBeCloseTo(1.8 * 64, 1);

    // No metric yet → no targets (never a fabricated number).
    expect(targetsForProfile(profile, null)).toBeNull();
  });
});
