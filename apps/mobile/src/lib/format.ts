import { formatQty, type BaseUnit } from '@organa/shared';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Business dates are Asia/Jakarta (UTC+7). */
const toJakarta = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000);
const parts = (date: string) => {
  // Accepts YYYY-MM-DD (a business date) or a full ISO instant.
  const d = date.length === 10 ? new Date(`${date}T00:00:00Z`) : toJakarta(date);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
};

/** "Rabu, 14 Juli 2023" */
export function longDate(date: string): string {
  const p = parts(date);
  return `${DAYS[p.wd]}, ${p.d} ${MONTHS[p.m]} ${p.y}`;
}

/** "31 Des 2024" */
export function shortDate(date: string): string {
  const p = parts(date);
  return `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}`;
}

/** "14:05" in Jakarta time. */
export function time(iso: string): string {
  const p = parts(iso);
  return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
}

/** YYYY-MM-DD for today in Jakarta. */
export function todayJakarta(): string {
  return toJakarta(new Date().toISOString()).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** "Agu" / "Agustus" for YYYY-MM. */
export function monthLabel(month: string, long = false): string {
  const i = Number(month.slice(5, 7)) - 1;
  return (long ? MONTHS : MONTHS_SHORT)[i]!;
}

export function qty(n: number, unit: BaseUnit): string {
  return formatQty(n, unit);
}

/** Days from today (Jakarta) until a YYYY-MM-DD date; negative when past. */
export function daysUntil(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayJakarta()}T00:00:00Z`)) / 86400_000);
}
