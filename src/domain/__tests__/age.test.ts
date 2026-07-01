import { ageYears } from '../age';

describe('ageYears', () => {
  it('counts a completed birthday', () => {
    expect(ageYears('1990-05-01', new Date(2026, 5, 15))).toBe(36); // June 15, 2026
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageYears('1990-12-24', new Date(2026, 5, 15))).toBe(35);
  });

  it('handles the birthday itself', () => {
    expect(ageYears('1990-06-15', new Date(2026, 5, 15))).toBe(36);
  });
});
