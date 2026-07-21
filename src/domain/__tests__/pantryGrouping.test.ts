import { EXPIRING_SOON_WINDOW_DAYS, groupPantryItems, type PantryGroupingFood } from '../pantryGrouping';

const TODAY = '2026-07-20';

function food(overrides: Partial<PantryGroupingFood> = {}): PantryGroupingFood {
  return { storage: null, category: 'other', ...overrides };
}

describe('groupPantryItems', () => {
  it('buckets each storage type into its matching section', () => {
    const foodsById = new Map([
      ['f-fridge', food({ storage: 'fridge' })],
      ['f-freezer', food({ storage: 'freezer' })],
      ['f-pantry', food({ storage: 'pantry' })],
    ]);
    const items = [
      { id: '1', foodId: 'f-fridge', expiresAt: null },
      { id: '2', foodId: 'f-freezer', expiresAt: null },
      { id: '3', foodId: 'f-pantry', expiresAt: null },
    ];

    const grouped = groupPantryItems(items, foodsById, TODAY);

    expect(grouped.fresh.map((i) => i.id)).toEqual(['1']);
    expect(grouped.freezer.map((i) => i.id)).toEqual(['2']);
    expect(grouped.staples.map((i) => i.id)).toEqual(['3']);
    expect(grouped.expiringSoon).toEqual([]);
    expect(grouped.other).toEqual([]);
  });

  it('falls back to the category heuristic when storage is null', () => {
    const foodsById = new Map([
      ['f-dairy', food({ storage: null, category: 'dairy' })], // fridge-ish
      ['f-grains', food({ storage: null, category: 'grains' })], // pantry-ish
      ['f-mystery', food({ storage: null, category: 'made_up_category' })], // unmapped
    ]);
    const items = [
      { id: '1', foodId: 'f-dairy', expiresAt: null },
      { id: '2', foodId: 'f-grains', expiresAt: null },
      { id: '3', foodId: 'f-mystery', expiresAt: null },
    ];

    const grouped = groupPantryItems(items, foodsById, TODAY);

    expect(grouped.fresh.map((i) => i.id)).toEqual(['1']);
    expect(grouped.staples.map((i) => i.id)).toEqual(['2']);
    expect(grouped.other.map((i) => i.id)).toEqual(['3']);
  });

  it('pulls an expiring item out of its normal storage bucket, never double-listing it', () => {
    const foodsById = new Map([['f-fridge', food({ storage: 'fridge' })]]);
    const items = [{ id: '1', foodId: 'f-fridge', expiresAt: TODAY }];

    const grouped = groupPantryItems(items, foodsById, TODAY);

    expect(grouped.expiringSoon.map((i) => i.id)).toEqual(['1']);
    expect(grouped.fresh).toEqual([]);
  });

  it('counts an already past-due item as expiring, not double-counted elsewhere', () => {
    const foodsById = new Map([['f-pantry', food({ storage: 'pantry' })]]);
    const items = [{ id: '1', foodId: 'f-pantry', expiresAt: '2026-01-01' }]; // long past today

    const grouped = groupPantryItems(items, foodsById, TODAY);

    expect(grouped.expiringSoon.map((i) => i.id)).toEqual(['1']);
    expect(grouped.staples).toEqual([]);
  });

  it('leaves a non-expiring item (past the window) in its normal bucket', () => {
    const foodsById = new Map([['f-freezer', food({ storage: 'freezer' })]]);
    const farFuture = '2026-12-31';
    const items = [{ id: '1', foodId: 'f-freezer', expiresAt: farFuture }];

    const grouped = groupPantryItems(items, foodsById, TODAY);

    expect(grouped.freezer.map((i) => i.id)).toEqual(['1']);
    expect(grouped.expiringSoon).toEqual([]);
  });

  it('treats the window boundary (exactly EXPIRING_SOON_WINDOW_DAYS ahead) as expiring, and one day beyond as not', () => {
    // TODAY = 2026-07-20, window = 3 days -> cutoff = 2026-07-23
    const foodsById = new Map([['f-pantry', food({ storage: 'pantry' })]]);
    expect(EXPIRING_SOON_WINDOW_DAYS).toBe(3);

    const atBoundary = groupPantryItems(
      [{ id: 'edge', foodId: 'f-pantry', expiresAt: '2026-07-23' }],
      foodsById,
      TODAY,
    );
    expect(atBoundary.expiringSoon.map((i) => i.id)).toEqual(['edge']);
    expect(atBoundary.staples).toEqual([]);

    const beyondBoundary = groupPantryItems(
      [{ id: 'beyond', foodId: 'f-pantry', expiresAt: '2026-07-24' }],
      foodsById,
      TODAY,
    );
    expect(beyondBoundary.expiringSoon).toEqual([]);
    expect(beyondBoundary.staples.map((i) => i.id)).toEqual(['beyond']);
  });

  it('bucketes a food with a missing foodId lookup (unknown food) into other, unless expiring', () => {
    const foodsById = new Map<string, PantryGroupingFood>();
    const items = [{ id: '1', foodId: 'unknown-food', expiresAt: null }];

    const grouped = groupPantryItems(items, foodsById, TODAY);

    expect(grouped.other.map((i) => i.id)).toEqual(['1']);
  });
});
