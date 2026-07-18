import { eq } from 'drizzle-orm';

import { confirmFoodReviewed, upsertFood } from '../repositories/library';
import { foods } from '../schema';
import { createTestDb } from '../testing/testDb';

const baseFoodInput = {
  nameCs: 'Test',
  nameEn: 'Test',
  category: 'other',
  baseUnit: 'g' as const,
  kcalPer100: 100,
  proteinPer100: 5,
  carbsPer100: 10,
  fatPer100: 3,
  budget: 'average' as const,
  snackSuitable: false,
  dietFlags: [],
  allergens: [],
};

describe('upsertFood provenance fields', () => {
  it('defaults needsReview to false and source to user for a manual add', async () => {
    const db = createTestDb();
    const foodId = await upsertFood(db, baseFoodInput);
    const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
    expect(food.needsReview).toBe(false);
    expect(food.source).toBe('user');
  });

  it('sets needsReview, source and NOVA/Nutri-Score/Eco-Score for a scanned product', async () => {
    const db = createTestDb();
    const foodId = await upsertFood(db, {
      ...baseFoodInput,
      needsReview: true,
      source: 'off_label',
      novaGroup: 4,
      nutriScoreGrade: 'd',
      ecoScoreGrade: 'c',
    });
    const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
    expect(food.needsReview).toBe(true);
    expect(food.source).toBe('off_label');
    expect(food.novaGroup).toBe(4);
    expect(food.nutriScoreGrade).toBe('d');
    expect(food.ecoScoreGrade).toBe('c');
  });

  it('a later edit never silently resets an existing needsReview flag', async () => {
    const db = createTestDb();
    const foodId = await upsertFood(db, { ...baseFoodInput, needsReview: true, source: 'off_label' });
    await upsertFood(db, { ...baseFoodInput, kcalPer100: 150 }, foodId);
    const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
    expect(food.kcalPer100).toBe(150);
    expect(food.needsReview).toBe(true);
  });
});

describe('confirmFoodReviewed', () => {
  it('clears the needsReview flag', async () => {
    const db = createTestDb();
    const foodId = await upsertFood(db, { ...baseFoodInput, needsReview: true, source: 'off_label' });
    await confirmFoodReviewed(db, foodId);
    const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
    expect(food.needsReview).toBe(false);
  });
});
