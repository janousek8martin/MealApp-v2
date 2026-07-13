import { resolveChipSelectTap } from '../chipSelectLogic';

describe('resolveChipSelectTap', () => {
  it('selects a new option when nothing is selected', () => {
    expect(resolveChipSelectTap(null, 'a', true)).toBe('a');
  });

  it('deselects when tapping the already-selected option and allowDeselect is true', () => {
    expect(resolveChipSelectTap('a', 'a', true)).toBeNull();
  });

  it('switches selection when tapping a different option', () => {
    expect(resolveChipSelectTap('a', 'b', true)).toBe('b');
  });

  it('never deselects when allowDeselect is false (existing single-select behavior)', () => {
    expect(resolveChipSelectTap('a', 'a', false)).toBe('a');
  });
});
