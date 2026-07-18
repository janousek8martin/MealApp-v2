import { isTrustedForAllergySafety } from '../nutrientProvenance';

describe('isTrustedForAllergySafety', () => {
  it('trusts a reviewed food', () => expect(isTrustedForAllergySafety(false)).toBe(true));
  it('does not trust an unreviewed food', () => expect(isTrustedForAllergySafety(true)).toBe(false));
});
