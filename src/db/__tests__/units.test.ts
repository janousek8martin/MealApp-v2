import { eq } from 'drizzle-orm';

import { createHouseholdWithDefaults, updateHouseholdSettings } from '../repositories/households';
import { householdSettings } from '../schema';
import { createTestDb } from '../testing/testDb';

describe('kitchenUnitDisplayMode household setting (schema untouched, UI removed)', () => {
  it('still defaults to hybrid at the schema level (the kitchen-units UI was removed, the column was not)', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const [settings] = await db.select().from(householdSettings).where(eq(householdSettings.householdId, householdId));
    expect(settings.kitchenUnitDisplayMode).toBe('hybrid');
  });

  it('can still be written directly (no UI surfaces it anymore, but the column still accepts writes)', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await updateHouseholdSettings(db, householdId, { kitchenUnitDisplayMode: 'grams' });
    const [settings] = await db.select().from(householdSettings).where(eq(householdSettings.householdId, householdId));
    expect(settings.kitchenUnitDisplayMode).toBe('grams');
  });
});
