import { ageYears, clampAgeYears } from '../age';

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

  it('clamps an implausible age from a malformed birth date rather than returning it raw', () => {
    expect(ageYears('1850-01-01', new Date(2026, 5, 15))).toBe(120);
    expect(ageYears('2026-06-16', new Date(2026, 5, 15))).toBe(1);
  });
});

describe('clampAgeYears', () => {
  it('passes through a plausible age unchanged', () => {
    expect(clampAgeYears(36)).toBe(36);
  });

  it('clamps below the 1-year floor', () => {
    expect(clampAgeYears(0)).toBe(1);
    expect(clampAgeYears(-5)).toBe(1);
  });

  it('clamps above the 120-year ceiling', () => {
    expect(clampAgeYears(150)).toBe(120);
  });
});
