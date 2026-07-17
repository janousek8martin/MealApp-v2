import { MICRONUTRIENT_KEYS, MICRONUTRIENTS, micronutrientRda } from '../micronutrients';

describe('micronutrientRda', () => {
  it('gives premenopausal-age women a higher iron RDA than men', () => {
    expect(micronutrientRda('female', 30).ironMg).toBe(18);
    expect(micronutrientRda('male', 30).ironMg).toBe(8);
  });

  it('lowers the iron RDA for women past 50 (post-menopause reference)', () => {
    expect(micronutrientRda('female', 55).ironMg).toBe(8);
  });

  it('raises the vitamin D RDA for adults 71+', () => {
    expect(micronutrientRda('male', 40).vitaminDUg).toBe(15);
    expect(micronutrientRda('male', 75).vitaminDUg).toBe(20);
  });

  it('uses the same B12 RDA for both sexes', () => {
    expect(micronutrientRda('male', 40).b12Ug).toBe(2.4);
    expect(micronutrientRda('female', 40).b12Ug).toBe(2.4);
  });

  it('raises the calcium RDA for older adults (51+ women, 71+ men)', () => {
    expect(micronutrientRda('female', 30).calciumMg).toBe(1000);
    expect(micronutrientRda('female', 55).calciumMg).toBe(1200);
    expect(micronutrientRda('male', 40).calciumMg).toBe(1000);
    expect(micronutrientRda('male', 75).calciumMg).toBe(1200);
  });

  it('gives men a higher omega-3 (ALA) RDA than women', () => {
    expect(micronutrientRda('male', 30).omega3G).toBe(1.6);
    expect(micronutrientRda('female', 30).omega3G).toBe(1.1);
  });
});

describe('MICRONUTRIENTS registry', () => {
  it('has exactly 20 entries', () => {
    expect(MICRONUTRIENT_KEYS).toHaveLength(20);
  });

  it('every entry has a positive dri and, when set, a driMax greater than dri', () => {
    for (const key of MICRONUTRIENT_KEYS) {
      const entry = MICRONUTRIENTS[key];
      expect(entry.dri).toBeGreaterThan(0);
      if (entry.driMax !== undefined) {
        expect(entry.driMax).toBeGreaterThan(entry.dri);
      }
    }
  });

  it('groups every entry into vitamins, minerals, or lipids', () => {
    const groups = new Set(MICRONUTRIENT_KEYS.map((key) => MICRONUTRIENTS[key].group));
    expect(groups).toEqual(new Set(['vitamins', 'minerals', 'lipids']));
  });

  it('includes the original 5 soft-target keys used by micronutrientRda', () => {
    expect(MICRONUTRIENT_KEYS).toEqual(
      expect.arrayContaining(['ironMg', 'vitaminDUg', 'b12Ug', 'calciumMg', 'omega3G']),
    );
  });
});
