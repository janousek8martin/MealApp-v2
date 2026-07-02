import {
  computeShoppingNeeds,
  MONTHLY_SHELF_LIFE_THRESHOLD_DAYS,
  sumWeeklyNeeds,
  type FoodShelfInfo,
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
