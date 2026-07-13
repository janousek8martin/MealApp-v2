import { mergeMacroOverrides } from '../macroOverrides';

describe('mergeMacroOverrides', () => {
  it('day override wins per-field over profile-wide', () => {
    const result = mergeMacroOverrides(
      { proteinPerKgLbm: 2, surplusKcal: 200, fatShareOfTdci: 0.25 },
      { proteinPerKgLbm: 2.5 },
    );
    expect(result).toEqual({ proteinPerKgLbm: 2.5, surplusKcal: 200, fatShareOfTdci: 0.25 });
  });

  it('profile-wide fills gaps the day override leaves', () => {
    const result = mergeMacroOverrides({ proteinPerKgLbm: 1.8 }, { surplusKcal: 300 });
    expect(result).toEqual({ proteinPerKgLbm: 1.8, surplusKcal: 300, fatShareOfTdci: undefined });
  });

  it('returns the profile-wide override unchanged when there is no day override', () => {
    const profileWide = { proteinPerKgLbm: 1.6 };
    expect(mergeMacroOverrides(profileWide, undefined)).toBe(profileWide);
  });

  it('both empty stays empty', () => {
    expect(mergeMacroOverrides({}, undefined)).toEqual({});
    expect(mergeMacroOverrides({}, {})).toEqual({ proteinPerKgLbm: undefined, surplusKcal: undefined, fatShareOfTdci: undefined });
  });
});
