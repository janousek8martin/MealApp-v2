import { eq } from 'drizzle-orm';

import { seedIfEmpty, seedUsdaFoodsIfEmpty } from '../seed';
import { foods } from '../schema';
import { createTestDb } from '../testing/testDb';
import type { FoodSeed } from '../seed/types';

const smallCuratedSeed: FoodSeed[] = [
  { key: 'test_apple', nameCs: 'Jablko', nameEn: 'Apple', category: 'fruit', baseUnit: 'g', kcalPer100: 52, proteinPer100: 0.3, carbsPer100: 14, fatPer100: 0.2 },
];

function makeUsdaBatch(count: number): FoodSeed[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `usda_test_${i}`,
    nameCs: `USDA food ${i}`,
    nameEn: `USDA food ${i}`,
    category: 'other',
    baseUnit: 'g' as const,
    kcalPer100: 100,
    proteinPer100: 5,
    carbsPer100: 10,
    fatPer100: 3,
    source: 'usda_sr_legacy',
    needsReview: true,
  }));
}

describe('seedIfEmpty', () => {
  it('leaves curated foods with needsReview false', async () => {
    const db = createTestDb();
    await seedIfEmpty(db, smallCuratedSeed, []);
    const [food] = await db.select().from(foods).where(eq(foods.seedKey, 'test_apple'));
    expect(food.needsReview).toBe(false);
  });

  it('is idempotent - a second call does not duplicate rows', async () => {
    const db = createTestDb();
    await seedIfEmpty(db, smallCuratedSeed, []);
    await seedIfEmpty(db, smallCuratedSeed, []);
    const rows = await db.select().from(foods);
    expect(rows).toHaveLength(1);
  });
});

describe('seedUsdaFoodsIfEmpty', () => {
  it('inserts bulk foods flagged needsReview, batching beyond a single chunk', async () => {
    const db = createTestDb();
    const batch = makeUsdaBatch(40); // > the 25-row chunk size, exercises multi-batch insert
    const inserted = await seedUsdaFoodsIfEmpty(db, batch);
    expect(inserted).toBe(true);
    const rows = await db.select().from(foods);
    expect(rows).toHaveLength(40);
    expect(rows.every((r) => r.needsReview === true)).toBe(true);
  });

  it('is idempotent - skips when the batch is already seeded', async () => {
    const db = createTestDb();
    const batch = makeUsdaBatch(3);
    await seedUsdaFoodsIfEmpty(db, batch);
    const secondRun = await seedUsdaFoodsIfEmpty(db, batch);
    expect(secondRun).toBe(false);
    const rows = await db.select().from(foods);
    expect(rows).toHaveLength(3);
  });

  it('does not touch curated foods already seeded by seedIfEmpty', async () => {
    const db = createTestDb();
    await seedIfEmpty(db, smallCuratedSeed, []);
    await seedUsdaFoodsIfEmpty(db, makeUsdaBatch(2));
    const rows = await db.select().from(foods);
    expect(rows).toHaveLength(3);
  });
});
