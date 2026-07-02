/** Weeks always start on Monday, per the approved plan. */

function parseIsoDate(dateIso: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO weekday of `dateIso`: 1 = Monday .. 7 = Sunday. */
export function isoWeekday(dateIso: string): number {
  const day = parseIsoDate(dateIso).getDay();
  return day === 0 ? 7 : day;
}

/** The Monday ('YYYY-MM-DD') of the week containing `dateIso`. */
export function startOfWeek(dateIso: string): string {
  const date = parseIsoDate(dateIso);
  const isoDay = isoWeekday(dateIso);
  date.setDate(date.getDate() - (isoDay - 1));
  return formatIsoDate(date);
}

/** The 7 calendar dates (Monday..Sunday) of the week starting at `mondayIso`. */
export function weekDates(mondayIso: string): string[] {
  const monday = parseIsoDate(mondayIso);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return formatIsoDate(day);
  });
}

/** The calendar date immediately before `dateIso`. */
export function previousDay(dateIso: string): string {
  const date = parseIsoDate(dateIso);
  date.setDate(date.getDate() - 1);
  return formatIsoDate(date);
}

export function addDays(dateIso: string, days: number): string {
  const date = parseIsoDate(dateIso);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}
