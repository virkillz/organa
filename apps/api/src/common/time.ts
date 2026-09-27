import { sql } from 'drizzle-orm';

/** Business dates are Asia/Jakarta (UTC+7, no DST). */
const OFFSET_MS = 7 * 3600_000;

/** YYYY-MM-DD in Jakarta for an instant. */
export function jakartaDate(at: Date = new Date()): string {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM in Jakarta for an instant. */
export function jakartaMonth(at: Date = new Date()): string {
  return jakartaDate(at).slice(0, 7);
}

/** Start of a Jakarta calendar day as a UTC instant. */
export function jakartaDayStart(date: string): Date {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - OFFSET_MS);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
}

/** [start, end) instants covering a Jakarta month (YYYY-MM) or year (YYYY). */
export function periodRange(period: string): { start: Date; end: Date } {
  if (/^\d{4}$/.test(period)) {
    return { start: jakartaDayStart(`${period}-01-01`), end: jakartaDayStart(`${Number(period) + 1}-01-01`) };
  }
  return { start: jakartaDayStart(`${period}-01`), end: jakartaDayStart(`${addMonths(period, 1)}-01`) };
}

/** A Date as a timestamptz literal for raw sql`` fragments (the driver only binds strings there). */
export function ts(d: Date) {
  return sql`${d.toISOString()}::timestamptz`;
}
