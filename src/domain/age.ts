const MIN_AGE_YEARS = 1;
const MAX_AGE_YEARS = 120;

/** Clamps to a plausible human age – guards the energy/nutrition formulas against a malformed birth date. */
export function clampAgeYears(age: number): number {
  return Math.min(MAX_AGE_YEARS, Math.max(MIN_AGE_YEARS, age));
}

/** Whole years between birth date ('YYYY-MM-DD') and the reference date. */
export function ageYears(birthDate: string, on: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = on.getFullYear() - year;
  const hadBirthdayThisYear =
    on.getMonth() + 1 > month || (on.getMonth() + 1 === month && on.getDate() >= day);
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return clampAgeYears(age);
}
