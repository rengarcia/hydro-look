/**
 * ONI, read the way it is actually available rather than the way it is labelled.
 *
 * The Oceanic Niño Index is a three-month mean centred on the month it is labelled with, so the
 * value labelled July is June-July-August and cannot exist before August has ended. Add NOAA's
 * own publication delay and the newest label available on any given day is about two months
 * back — on 2026-09-22 it was 2026-07, which is the 83-day "staleness" the Phase 4 freshness
 * limit had to be widened for.
 *
 * Section 4 makes the consequence explicit: a backtest must not assume a month's value was
 * available at the start of that month. `availableAt` is the whole defence. It never returns a
 * label newer than two months before the date asked about, so a model reading it at a 2018
 * origin sees what a forecaster standing there would have seen.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../store/csv.ts";
import { DATA_CURATED } from "../util/paths.ts";
import { ENSO_MONTHLY } from "../contracts/tables.ts";
import type { IsoDate } from "../util/dates.ts";

export type EnsoPhase = "el_nino" | "neutral" | "la_nina";

/** NOAA's own thresholds on the index. */
export function phaseOf(oni: number): EnsoPhase {
  if (oni >= 0.5) return "el_nino";
  if (oni <= -0.5) return "la_nina";
  return "neutral";
}

/** `YYYY-MM` -> ONI. */
export type OniSeries = Map<string, number>;

export function readOni(root: string = DATA_CURATED): OniSeries {
  const directory = join(root, ENSO_MONTHLY.name);
  const out: OniSeries = new Map();
  if (!existsSync(directory)) return out;
  for (const file of readdirSync(directory)
    .filter((f) => f.endsWith(".csv"))
    .sort()) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      const month = row["month"] ?? "";
      const oni = Number(row["oni"] ?? "");
      if (month && Number.isFinite(oni)) out.set(month, oni);
    }
  }
  return out;
}

/** The publication lag, in whole months, that `availableAt` refuses to look through. */
export const ONI_PUBLICATION_LAG_MONTHS = 2;

function shiftMonth(date: IsoDate, months: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) + months;
  const shiftedYear = year + Math.floor((month - 1) / 12);
  const shiftedMonth = ((((month - 1) % 12) + 12) % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

/** The newest ONI a forecaster standing on `date` could have read, or null if there is none. */
export function availableAt(oni: OniSeries, date: IsoDate): { month: string; oni: number } | null {
  const newest = shiftMonth(date, -ONI_PUBLICATION_LAG_MONTHS);
  let best: { month: string; oni: number } | null = null;
  for (const [month, value] of oni) {
    if (month > newest) continue;
    if (!best || month > best.month) best = { month, oni: value };
  }
  return best;
}

export function phaseAt(oni: OniSeries, date: IsoDate): EnsoPhase | null {
  const reading = availableAt(oni, date);
  return reading ? phaseOf(reading.oni) : null;
}
