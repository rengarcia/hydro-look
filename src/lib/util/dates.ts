/**
 * Date helpers. Ecuador (America/Guayaquil) is UTC-5 all year with no DST, so every
 * conversion here is plain arithmetic rather than a timezone database lookup.
 *
 * A "day" in this project is always an Ecuadorian local calendar day, written as an
 * ISO `YYYY-MM-DD` string. The ORDS reports timestamp each local midnight as
 * `...T05:00:00Z`; the hourly energy endpoints use hour-ending timestamps, so the
 * 24 points of 2024-10-15 run from `2024-10-15T06:00:00Z` to `2024-10-16T05:00:00Z`.
 */

export const EC_UTC_OFFSET_HOURS = -5;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether `value` is a day that exists. The shape test is not enough and the difference bites
 * exactly once every four years: `Date.parse("2021-02-29T00:00:00Z")` does not fail, it quietly
 * returns 1 March. Anything that *builds* a date string from parts — an analogue year taken
 * from the same calendar day of an earlier year, say — has to check the result before using it,
 * or it will silently compare against the wrong day.
 */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function assertIsoDate(value: string): IsoDate {
  if (!ISO_DATE.test(value)) throw new Error(`not an ISO date (YYYY-MM-DD): ${value}`);
  return value;
}

/** UTC instant -> Ecuadorian wall clock, expressed as a Date whose UTC fields are local fields. */
function toEcWallClock(instant: Date): Date {
  return new Date(instant.getTime() + EC_UTC_OFFSET_HOURS * HOUR_MS);
}

function isoDateOfWallClock(wall: Date): IsoDate {
  return wall.toISOString().slice(0, 10);
}

/** `2026-09-20T05:00:00Z` (local midnight) -> `2026-09-20`. */
export function localDateOf(timestamp: string): IsoDate {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) throw new Error(`unparseable timestamp: ${timestamp}`);
  return isoDateOfWallClock(toEcWallClock(instant));
}

/** Hour-ending timestamp -> the local day the hour belongs to (24:00 belongs to the day that ends). */
export function localDateOfHourEnding(timestamp: string): IsoDate {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) throw new Error(`unparseable timestamp: ${timestamp}`);
  return isoDateOfWallClock(new Date(toEcWallClock(instant).getTime() - HOUR_MS));
}

/** Local hour of an hour-ending timestamp, 1..24. */
export function localHourEnding(timestamp: string): number {
  const wall = toEcWallClock(new Date(timestamp));
  const hour = wall.getUTCHours();
  return hour === 0 ? 24 : hour;
}

/** The instant of local midnight on `date`, as the ORDS writes it. */
export function ordsMidnightZ(date: IsoDate): string {
  return `${assertIsoDate(date)}T05:00:00Z`;
}

/** `2026-09-20` -> `20/09/2026 00:00:00`, the `fecha` query parameter every ORDS report takes. */
export function ordsFecha(date: IsoDate, clock = "00:00:00"): string {
  const [y, m, d] = assertIsoDate(date).split("-");
  return `${d}/${m}/${y} ${clock}`;
}

/** `2026-09-20` -> `2026/09/20`, the `fecha` query parameter SMEC takes. */
export function smecFecha(date: IsoDate): string {
  return assertIsoDate(date).replaceAll("-", "/");
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const t = Date.parse(`${assertIsoDate(date)}T00:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Every date in `[from, to]`, ascending. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = assertIsoDate(from); d <= assertIsoDate(to); d = addDays(d, 1)) out.push(d);
  return out;
}

export interface YearMonth {
  year: number;
  month: number;
}

/** Every calendar month touching `[from, to]`, ascending. Empty when `from` is after `to`. */
export function eachMonth(from: IsoDate, to: IsoDate): YearMonth[] {
  assertIsoDate(from);
  assertIsoDate(to);
  const out: YearMonth[] = [];
  let year = yearOf(from);
  let month = Number(monthOf(from));
  const lastYear = yearOf(to);
  const lastMonth = Number(monthOf(to));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    out.push({ year, month });
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  return out;
}

export function nextMonth({ year, month }: YearMonth): YearMonth {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function previousMonth({ year, month }: YearMonth): YearMonth {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** The month a local day falls in. */
export function monthOfDate(date: IsoDate): YearMonth {
  return { year: yearOf(date), month: Number(monthOf(date)) };
}

/** First local day of a month. */
export function monthStart({ year, month }: YearMonth): IsoDate {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Last local day of a month. */
export function monthEnd(ym: YearMonth): IsoDate {
  return addDays(monthStart(nextMonth(ym)), -1);
}

/** `2026-09`, how a month is written in notes and logs. */
export function monthLabel({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Today in Ecuador. */
export function todayEc(now: Date = new Date()): IsoDate {
  return isoDateOfWallClock(toEcWallClock(now));
}

export function yearOf(date: IsoDate): number {
  return Number(assertIsoDate(date).slice(0, 4));
}

export function monthOf(date: IsoDate): string {
  return assertIsoDate(date).slice(5, 7);
}

/** ISO timestamp with seconds, for `fetched_at` columns. */
export function nowUtc(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 19)}Z`;
}
