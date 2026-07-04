import { checkCompositionMatch } from '../wizardComposition';

describe('checkCompositionMatch', () => {
  it('matches when created profile types line up with the planned split', () => {
    const result = checkCompositionMatch(['adult', 'adult', 'child', 'child'], { adults: 2, children: 2 });
    expect(result).toEqual({ adults: 2, children: 2, matches: true });
  });

  it('flags a mismatch when the adult/child boundary shifted after going back', () => {
    // Planned 2 adults + 2 children, but profiles 0-1 were created as adult
    // and profiles 2-3 as child under the OLD split before the user went back
    // and changed composition to 1 adult + 3 children.
    const result = checkCompositionMatch(['adult', 'adult', 'child', 'child'], { adults: 1, children: 3 });
    expect(result).toEqual({ adults: 2, children: 2, matches: false });
  });

  it('flags a mismatch when only the total changed', () => {
    const result = checkCompositionMatch(['adult', 'child'], { adults: 1, children: 2 });
    expect(result.matches).toBe(false);
  });

  it('matches trivially for an empty composition', () => {
    const result = checkCompositionMatch([], { adults: 0, children: 0 });
    expect(result).toEqual({ adults: 0, children: 0, matches: true });
  });
});
