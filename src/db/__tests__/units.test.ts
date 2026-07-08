import { eq } from 'drizzle-orm';

import { createHouseholdWithDefaults, updateHouseholdSettings } from '../repositories/households';
import {
  createCustomKitchenUnit,
  deleteCustomKitchenUnit,
  listCustomKitchenUnits,
  updateCustomKitchenUnit,
} from '../repositories/units';
import { householdSettings } from '../schema';
import { createTestDb } from '../testing/testDb';

describe('custom kitchen units repository (item 8)', () => {
  it('creates a custom unit and lists it back with its aliases', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');

    await createCustomKitchenUnit(db, householdId, {
      name: 'Odměrka proteinu',
      unitType: 'weight',
      conversionValue: 30,
      aliases: ['scoop', 'odměrka'],
    });

    const units = await listCustomKitchenUnits(db, householdId);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      name: 'Odměrka proteinu',
      unitType: 'weight',
      conversionValue: 30,
      aliases: ['scoop', 'odměrka'],
    });
  });

  it('rejects a non-positive conversion value', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await expect(
      createCustomKitchenUnit(db, householdId, { name: 'Broken', unitType: 'volume', conversionValue: 0, aliases: [] }),
    ).rejects.toThrow();
  });

  it('updates a custom unit in place', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const unitId = await createCustomKitchenUnit(db, householdId, {
      name: 'Hrnek',
      unitType: 'volume',
      conversionValue: 200,
      aliases: [],
    });

    await updateCustomKitchenUnit(db, unitId, {
      name: 'Velký hrnek',
      unitType: 'volume',
      conversionValue: 300,
      aliases: ['mug'],
    });

    const [unit] = await listCustomKitchenUnits(db, householdId);
    expect(unit).toMatchObject({ name: 'Velký hrnek', conversionValue: 300, aliases: ['mug'] });
  });

  it('soft-deletes a custom unit so it no longer appears in the list', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const unitId = await createCustomKitchenUnit(db, householdId, {
      name: 'Lžíce medu',
      unitType: 'weight',
      conversionValue: 21,
      aliases: [],
    });

    await deleteCustomKitchenUnit(db, unitId);

    expect(await listCustomKitchenUnits(db, householdId)).toHaveLength(0);
  });
});

describe('kitchenUnitDisplayMode household setting (item 8)', () => {
  it('defaults to hybrid', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const [settings] = await db.select().from(householdSettings).where(eq(householdSettings.householdId, householdId));
    expect(settings.kitchenUnitDisplayMode).toBe('hybrid');
  });

  it('can be switched to grams-only', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await updateHouseholdSettings(db, householdId, { kitchenUnitDisplayMode: 'grams' });
    const [settings] = await db.select().from(householdSettings).where(eq(householdSettings.householdId, householdId));
    expect(settings.kitchenUnitDisplayMode).toBe('grams');
  });
});
