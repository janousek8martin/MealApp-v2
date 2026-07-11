import { createHouseholdWithDefaults } from '../repositories/households';
import { createProfile } from '../repositories/profiles';
import { getWaterTotalForDate, logWater } from '../repositories/water';
import { createTestDb } from '../testing/testDb';

async function createTestProfile(db: ReturnType<typeof createTestDb>) {
  const householdId = await createHouseholdWithDefaults(db, 'Test');
  return createProfile(db, {
    householdId,
    name: 'Martin',
    profileType: 'adult',
    sex: 'male',
    birthDate: '1990-05-01',
    heightCm: 180,
    activityLevel: 'moderate',
    goal: 'maintain',
    weightKg: 80,
  });
}

describe('water repository', () => {
  it('sums logged amounts for a date', async () => {
    const db = createTestDb();
    const profileId = await createTestProfile(db);

    await logWater(db, profileId, 250, '2026-07-01');
    await logWater(db, profileId, 250, '2026-07-01');
    expect(await getWaterTotalForDate(db, profileId, '2026-07-01')).toBe(500);
  });

  it('a negative delta (undo a glass) reduces the total', async () => {
    const db = createTestDb();
    const profileId = await createTestProfile(db);

    await logWater(db, profileId, 250, '2026-07-01');
    await logWater(db, profileId, -250, '2026-07-01');
    expect(await getWaterTotalForDate(db, profileId, '2026-07-01')).toBe(0);
  });

  it('keeps totals separate per date', async () => {
    const db = createTestDb();
    const profileId = await createTestProfile(db);

    await logWater(db, profileId, 250, '2026-07-01');
    await logWater(db, profileId, 500, '2026-07-02');
    expect(await getWaterTotalForDate(db, profileId, '2026-07-01')).toBe(250);
    expect(await getWaterTotalForDate(db, profileId, '2026-07-02')).toBe(500);
  });

  it('keeps totals separate per profile', async () => {
    const db = createTestDb();
    const profileA = await createTestProfile(db);
    const profileB = await createTestProfile(db);

    await logWater(db, profileA, 250, '2026-07-01');
    expect(await getWaterTotalForDate(db, profileA, '2026-07-01')).toBe(250);
    expect(await getWaterTotalForDate(db, profileB, '2026-07-01')).toBe(0);
  });
});
