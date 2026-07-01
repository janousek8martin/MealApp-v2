/** Whole years between birth date ('YYYY-MM-DD') and the reference date. */
export function ageYears(birthDate: string, on: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = on.getFullYear() - year;
  const hadBirthdayThisYear =
    on.getMonth() + 1 > month || (on.getMonth() + 1 === month && on.getDate() >= day);
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
