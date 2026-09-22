/**
 * The check that makes a model-written paragraph publishable: it may only name numbers and
 * dates the payload already contains.
 *
 * The zod schema guarantees the *shape* — a string, a list, one of three words — and says
 * nothing about whether "Mazar llegará a 2.112 m el 3 de noviembre" is true. That sentence is
 * the failure §8 names ("contradicts the numbers or invents a forecast"), it is perfectly
 * well-formed, and it is exactly what a fluent model produces when it extrapolates. So every
 * figure in the output is looked up in the payload, and one miss rejects the narrative: the
 * site keeps the previous one and the snapshot row records what was invented.
 *
 * Matching is strict about values and lenient about typography, because the model writes
 * Spanish and the payload is JSON:
 *
 * - **Separators are read every way they could be meant.** Ecuador writes `2.138,37`; a model
 *   may write `2138,37`, `2138.37` or `2,138.37`. A lone separator followed by exactly three
 *   digits is genuinely ambiguous — `2.115` is two thousand one hundred and fifteen in Quito and
 *   two point one one five in the JSON — so both readings are tried and either may match.
 * - **Rounding is allowed, to the precision written.** `38,4` matches 38.37 because rounding a
 *   published number is quoting it; `38,5` does not. Below ten, only an exact integer matches
 *   an integer token: rounding 2.6 to "3" would let almost any small count through.
 * - **Sign is ignored.** "baja 0,21 m al día" quotes a slope of −0.2129 correctly, and the
 *   direction is carried by the verb, not the minus.
 * - **A percentage may be a fraction ×100**, but only when the token is followed by `%` or
 *   "por ciento": 0.7419 written as "74 %" is formatting, 74 anywhere else is a new number.
 * - **Dates are dates, not three numbers.** ISO dates, "21 de septiembre de 2026", "21 de
 *   septiembre", "septiembre de 2026" and 21/09/2026 are recognised first and checked against
 *   the payload's dates (a day and month without a year matches any payload date on that
 *   day); what remains is checked as numbers. A bare year is a number, and passes only if the
 *   payload names that year somewhere.
 *
 * What it does not catch, stated so nobody relies on it: numbers written as words ("quince
 * días"), and a true number attached to the wrong thing ("2.130 m a 7 días" when 2130.95 is the
 * 14-day p50). The first is rare in this register; the second is why the page renders the
 * numbers beside the text.
 */

import { isCalendarDate, type IsoDate } from "../util/dates.ts";
import { roundTo } from "../util/numbers.ts";
import type { NarrativePayload } from "./payload.ts";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Month name (with the old spelling "setiembre" too) -> "01".."12". */
const MONTH_NUMBER = new Map<string, string>([
  ...MONTHS.map((name, i) => [name, String(i + 1).padStart(2, "0")] as [string, string]),
  ["setiembre", "09"],
]);
const MONTH_PATTERN = [...MONTH_NUMBER.keys()].join("|");

/** Everything the payload lets the text say. */
export interface AllowedSet {
  numbers: number[];
  dates: Set<IsoDate>;
  monthDays: Set<string>;
  yearMonths: Set<string>;
}

/** One number as written, with every value it could be read as. */
export interface NumberReading {
  value: number;
  /** Digits after the decimal separator in this reading; 0 for an integer. */
  decimals: number;
}

/**
 * Every value a written number could mean. Returns an empty list for something that is not a
 * plausible number (`1.2.3`), which the caller treats as unmatched rather than guessing.
 */
export function readNumber(token: string): NumberReading[] {
  const cleaned = token.replace(/[\u00a0\u202f]/gu, "");
  const hadSpaceGroups = cleaned !== token;
  if (/^\d+$/.test(cleaned)) return [{ value: Number(cleaned), decimals: 0 }];

  const dots = (cleaned.match(/\./g) ?? []).length;
  const commas = (cleaned.match(/,/g) ?? []).length;
  const groupsOk = (parts: string[]) => parts.slice(1).every((p) => p.length === 3);

  if (dots > 0 && commas > 0) {
    // Both present: the last one is the decimal separator, the other groups thousands.
    const decimalSep = cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",") ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    const [whole, fraction] = cleaned.split(decimalSep) as [string, string | undefined];
    if (fraction === undefined || cleaned.split(decimalSep).length !== 2) return [];
    const groups = whole.split(thousandsSep);
    if (!groupsOk(groups)) return [];
    return [{ value: Number(`${groups.join("")}.${fraction}`), decimals: fraction.length }];
  }

  const sep = dots > 0 ? "." : ",";
  const parts = cleaned.split(sep);
  if (parts.length > 2) return groupsOk(parts) ? [{ value: Number(parts.join("")), decimals: 0 }] : [];
  const [whole, fraction] = parts as [string, string];
  const asDecimal = { value: Number(`${whole}.${fraction}`), decimals: fraction.length };
  // Thin-space grouping plus a separator means the separator is the decimal one.
  if (fraction.length === 3 && !hadSpaceGroups) return [{ value: Number(`${whole}${fraction}`), decimals: 0 }, asDecimal];
  return [asDecimal];
}

/**
 * A number: digits, optionally grouped by `.`/`,`/non-breaking spaces followed by more digits.
 * Not preceded or followed by a letter or digit, so `p10`, `d7`, `m3s` and the `12` inside
 * `repDiaHid12m` are identifiers, not numbers.
 */
const NUMBER_TOKEN = /(?<![\p{L}\d])\d+(?:[.,\u00a0\u202f]\d+)*(?![\p{L}\d])/gu;

const ISO_DATE = /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d])/g;
const ISO_MONTH = /(?<![\d-])(\d{4})-(\d{2})(?![\d-])/g;

function collect(value: unknown, into: AllowedSet): void {
  if (typeof value === "number") {
    if (Number.isFinite(value)) into.numbers.push(Math.abs(value));
    return;
  }
  if (typeof value === "string") {
    let rest = value.replace(ISO_DATE, (match, y: string, m: string, d: string) => {
      into.dates.add(match);
      into.monthDays.add(`${m}-${d}`);
      into.yearMonths.add(`${y}-${m}`);
      into.numbers.push(Number(y));
      return " ";
    });
    rest = rest.replace(ISO_MONTH, (match, y: string) => {
      into.yearMonths.add(match);
      into.numbers.push(Number(y));
      return " ";
    });
    for (const token of rest.match(NUMBER_TOKEN) ?? []) {
      for (const reading of readNumber(token)) into.numbers.push(reading.value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collect(item, into);
  }
}

export function allowedSet(payload: NarrativePayload): AllowedSet {
  const out: AllowedSet = { numbers: [], dates: new Set(), monthDays: new Set(), yearMonths: new Set() };
  collect(payload, out);
  out.numbers = [...new Set(out.numbers)];
  return out;
}

/** Whether a written number quotes something in the payload. See the module note for the rules. */
export function numberAllowed(readings: readonly NumberReading[], allowed: AllowedSet, percent: boolean): boolean {
  for (const { value, decimals } of readings) {
    for (const p of allowed.numbers) {
      const candidates = percent && p <= 1.5 ? [p, p * 100] : [p];
      for (const candidate of candidates) {
        if (decimals === 0 && value < 10) {
          if (candidate === value) return true;
          continue;
        }
        if (Math.abs(roundTo(candidate, decimals) - value) < 1e-9) return true;
      }
    }
  }
  return false;
}

/** Strip accents and case, for comparing a tier name in prose with its identifier. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Every problem with one piece of text; empty means it may be published. */
export function inventedFigures(text: string, allowed: AllowedSet): string[] {
  const problems: string[] = [];
  let rest = text.normalize("NFC");
  const blank = (match: string) => " ".repeat(match.length);

  rest = rest.replace(ISO_DATE, (match) => {
    if (!allowed.dates.has(match)) problems.push(`date ${match}`);
    return blank(match);
  });

  const checkDay = (match: string, day: string, month: string, year: string | undefined) => {
    const mm = MONTH_NUMBER.get(month.toLowerCase())!;
    const dd = day.padStart(2, "0");
    if (year) {
      const iso = `${year}-${mm}-${dd}`;
      if (!isCalendarDate(iso) || !allowed.dates.has(iso)) problems.push(`date "${match.trim()}"`);
    } else if (!allowed.monthDays.has(`${mm}-${dd}`)) {
      problems.push(`date "${match.trim()}"`);
    }
  };

  // "del 21 al 28 de septiembre (de 2026)": both ends are dates, and the first carries no month.
  const dayRange = new RegExp(
    `(?<![\\p{L}\\d])(\\d{1,2})\\s+(?:al|a|y)\\s+(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})(?:\\s+(?:de|del)\\s+(\\d{4}))?(?![\\p{L}\\d])`,
    "giu",
  );
  rest = rest.replace(dayRange, (match, first: string, second: string, month: string, year: string | undefined) => {
    checkDay(match, first, month, year);
    checkDay(match, second, month, year);
    return blank(match);
  });

  // "21 de septiembre de 2026", "21 de septiembre", "1.º de octubre".
  const dayMonth = new RegExp(
    `(?<![\\p{L}\\d])(\\d{1,2})(?:\\.?\\s?[º°])?\\s+de\\s+(${MONTH_PATTERN})(?:\\s+(?:de|del)\\s+(\\d{4}))?(?![\\p{L}\\d])`,
    "giu",
  );
  rest = rest.replace(dayMonth, (match, day: string, month: string, year: string | undefined) => {
    checkDay(match, day, month, year);
    return blank(match);
  });

  // "septiembre de 2026": a month is claimed, so some payload date must fall in it.
  const monthYear = new RegExp(`(?<![\\p{L}])(${MONTH_PATTERN})\\s+(?:de|del)\\s+(\\d{4})(?![\\d])`, "giu");
  rest = rest.replace(monthYear, (match, month: string, year: string) => {
    const mm = MONTH_NUMBER.get(month.toLowerCase())!;
    if (!allowed.yearMonths.has(`${year}-${mm}`)) problems.push(`month "${match.trim()}"`);
    return blank(match);
  });

  rest = rest.replace(/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g, (match, d: string, m: string, y: string) => {
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!allowed.dates.has(iso)) problems.push(`date ${match}`);
    return blank(match);
  });

  rest = rest.replace(ISO_MONTH, (match) => {
    if (!allowed.yearMonths.has(match)) problems.push(`month ${match}`);
    return blank(match);
  });

  for (const found of rest.matchAll(NUMBER_TOKEN)) {
    const token = found[0];
    const after = rest.slice((found.index ?? 0) + token.length);
    const percent = /^\s?(?:%|por\s+ciento)/iu.test(after);
    if (!numberAllowed(readNumber(token), allowed, percent)) problems.push(`number ${token}${percent ? " %" : ""}`);
  }
  return problems;
}

export interface NarrativeText {
  outlook_es: string;
  drivers: string[];
}

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/**
 * The whole narrative against its payload. Besides the figures, the outlook must name the risk
 * tier it was given: decision 8 makes the tier an input the text explains, and a paragraph that
 * never mentions it has explained nothing.
 */
export function validateNarrative(narrative: NarrativeText, payload: NarrativePayload): ValidationResult {
  const allowed = allowedSet(payload);
  const problems: string[] = [];
  for (const problem of inventedFigures(narrative.outlook_es, allowed)) problems.push(`outlook_es: ${problem}`);
  narrative.drivers.forEach((driver, i) => {
    for (const problem of inventedFigures(driver, allowed)) problems.push(`drivers[${i}]: ${problem}`);
  });
  const tier = payload.adequacy?.risk_tier;
  if (tier && !fold(narrative.outlook_es).includes(fold(tier))) {
    problems.push(`outlook_es: does not name the risk tier "${tier}"`);
  }
  return { ok: problems.length === 0, problems };
}
