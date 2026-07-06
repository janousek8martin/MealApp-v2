import {
  computeShoppingNeeds,
  deductFromPantryBatches,
  MONTHLY_SHELF_LIFE_THRESHOLD_DAYS,
  sumWeeklyNeeds,
  type FoodShelfInfo,
  type PantryBatch,
} from '../shopping';

describe('sumWeeklyNeeds', () => {
  it('aggregates repeated foods across meals', () => {
    const totals = sumWeeklyNeeds([
      { foodId: 'rice', amount: 150 },
      { foodId: 'chicken', amount: 200 },
      { foodId: 'rice', amount: 100 },
    ]);
    expect(totals.get('rice')).toBe(250);
    expect(totals.get('chicken')).toBe(200);
  });

  it('returns an empty map for no needs', () => {
    expect(sumWeeklyNeeds([]).size).toBe(0);
  });
});

describe('computeShoppingNeeds', () => {
  const fresh: FoodShelfInfo = { id: 'spinach', shelfLifeDays: 4, baseUnit: 'g' };
  const shelfStable: FoodShelfInfo = {
    id: 'rice',
    shelfLifeDays: MONTHLY_SHELF_LIFE_THRESHOLD_DAYS,
    baseUnit: 'g',
  };
  const foodsById = new Map([
    ['spinach', fresh],
    ['rice', shelfStable],
  ]);

  it('classifies a short-shelf-life food as weekly with no batching', () => {
    const needs = computeShoppingNeeds(new Map([['spinach', 300]]), foodsById, new Map());
    expect(needs).toEqual([{ foodId: 'spinach', horizon: 'weekly', quantity: 300, unit: 'g' }]);
  });

  it('projects a long-shelf-life food to a monthly batch quantity', () => {
    const needs = computeShoppingNeeds(new Map([['rice', 500]]), foodsById, new Map());
    expect(needs).toEqual([{ foodId: 'rice', horizon: 'monthly', quantity: 2000, unit: 'g' }]);
  });

  it('nets the need against existing pantry stock', () => {
    const needs = computeShoppingNeeds(
      new Map([['spinach', 300]]),
      foodsById,
      new Map([['spinach', 100]]),
    );
    expect(needs[0].quantity).toBe(200);
  });

  it('omits a food when pantry stock fully covers the need', () => {
    const needs = computeShoppingNeeds(
      new Map([['spinach', 100]]),
      foodsById,
      new Map([['spinach', 500]]),
    );
    expect(needs).toHaveLength(0);
  });

  it('skips foods with no matching entry in foodsById', () => {
    const needs = computeShoppingNeeds(new Map([['unknown', 100]]), foodsById, new Map());
    expect(needs).toHaveLength(0);
  });

  it('treats a null shelf life as weekly (unknown, not assumed long-life)', () => {
    const unknownShelf: FoodShelfInfo = { id: 'mystery', shelfLifeDays: null, baseUnit: 'g' };
    const needs = computeShoppingNeeds(
      new Map([['mystery', 50]]),
      new Map([['mystery', unknownShelf]]),
      new Map(),
    );
    expect(needs[0].horizon).toBe('weekly');
  });
});

describe('deductFromPantryBatches', () => {
  it('takes from a single batch that covers the need', () => {
    const batches: PantryBatch[] = [{ id: 'a', quantity: 500, expiresAt: '2026-08-01' }];
    expect(deductFromPantryBatches(batches, 300)).toEqual([{ id: 'a', quantity: 200 }]);
  });

  it('draws from the soonest-expiring batch first', () => {
    const batches: PantryBatch[] = [
      { id: 'later', quantity: 200, expiresAt: '2026-09-01' },
      { id: 'sooner', quantity: 200, expiresAt: '2026-08-01' },
    ];
    expect(deductFromPantryBatches(batches, 100)).toEqual([{ id: 'sooner', quantity: 100 }]);
  });

  it('spills over into the next batch once the first is exhausted', () => {
    const batches: PantryBatch[] = [
      { id: 'first', quantity: 100, expiresAt: '2026-08-01' },
      { id: 'second', quantity: 200, expiresAt: '2026-09-01' },
    ];
    expect(deductFromPantryBatches(batches, 250)).toEqual([
      { id: 'first', quantity: 0 },
      { id: 'second', quantity: 50 },
    ]);
  });

  it('uses batches with no expiry date last', () => {
    const batches: PantryBatch[] = [
      { id: 'no-expiry', quantity: 100, expiresAt: null },
      { id: 'expiring', quantity: 50, expiresAt: '2026-08-01' },
    ];
    expect(deductFromPantryBatches(batches, 120)).toEqual([
      { id: 'expiring', quantity: 0 },
      { id: 'no-expiry', quantity: 30 },
    ]);
  });

  it('deducts only what is available when the need exceeds total stock', () => {
    const batches: PantryBatch[] = [{ id: 'a', quantity: 50, expiresAt: null }];
    expect(deductFromPantryBatches(batches, 300)).toEqual([{ id: 'a', quantity: 0 }]);
  });

  it('returns no updates when there is nothing to deduct', () => {
    const batches: PantryBatch[] = [{ id: 'a', quantity: 50, expiresAt: null }];
    expect(deductFromPantryBatches(batches, 0)).toEqual([]);
  });
});
