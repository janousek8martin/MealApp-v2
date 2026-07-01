/** ISO 8601 UTC timestamp for created_at / updated_at columns. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 'YYYY-MM-DD' in the device's local calendar (plan dates, metric dates). */
export function todayIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
