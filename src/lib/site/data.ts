/**
 * What the site reads, and when.
 *
 * Every function here runs at build time, in Node, inside `next build`. There is no request
 * path: the page is rendered to static HTML once per commit and served as a file, which is
 * decision 6 made literal — Vercel holds no credentials, runs no ingestion and queries nothing.
 * A number changes on the site when a number changes in this repository, and not otherwise.
 *
 * The documents under `public/api/` are the small, stable ones a third party can fetch. The
 * charts need more than those carry — a year of inflow, six months of the national balance —
 * and take it straight from `data/curated`, which costs nothing at build time and keeps a
 * 150 kB file from being rewritten and committed every day for the sake of one chart.
 *
 * Paths come from `process.cwd()` rather than the repository's own `repoPath()`, because
 * `repoPath` resolves against `import.meta.url` and Next bundles these modules into
 * `.next/server` where that no longer points at the repository. `next build` runs at the
 * project root, so `cwd` is the root.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSeries, type DailySeries, type SeriesSet } from "../features/series.ts";
import { bandForDayOfYear, binByDayOfYear, type Band } from "../features/climatology.ts";
import { parseCsv } from "../store/csv.ts";
import { dayOfYear } from "../util/stats.ts";
import { addDays, type IsoDate } from "../util/dates.ts";
import { dataDateOf, type LatestDocument } from "../publish/latest.ts";
import { daysFrom, firstPendingTarget, type DayRecord } from "./days.ts";

/**
 * `HYDRO_LOOK_SITE_ROOT` points the reads at another tree with the same `data/curated` and
 * `public/api` layout — which is how the render test builds the page from `tests/fixtures/site/`
 * instead of from whatever the repository holds today.
 */
const ROOT = process.env["HYDRO_LOOK_SITE_ROOT"] ?? process.cwd();
const CURATED = join(ROOT, "data", "curated");

/** Every row of a curated table, partitions in year order. */
export function readTable(name: string): Record<string, string>[] {
  const directory = join(CURATED, name);
  if (!existsSync(directory)) return [];
  const rows: Record<string, string>[] = [];
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    rows.push(...parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  return rows;
}

/**
 * The observations, resolved across sources once per build.
 *
 * Next renders each page in its own module instance but the page is one file, so this is read
 * once. It is the expensive call on this module — ninety thousand rows — and everything the
 * charts need comes out of it.
 */
let seriesCache: SeriesSet | null = null;
export function series(): SeriesSet {
  seriesCache ??= buildSeries(readTable("observations_daily"));
  return seriesCache;
}

/** A document under `public/api/`, or null when it has not been generated yet. */
export function apiDocument<T>(name: string): T | null {
  const path = join(ROOT, "public", "api", name);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

export function latest(): LatestDocument | null {
  return apiDocument<LatestDocument>("latest.json");
}

export interface SeriesPoint {
  date: IsoDate;
  value: number;
}

/**
 * The last `days` calendar days of a series, oldest first.
 *
 * Gaps are left as gaps: a day with no reading is simply absent from the result rather than
 * carried forward from the day before. A chart that interpolates across a fortnight of missing
 * inflow draws a fortnight of readings that were never taken, and it draws them in the same
 * ink as the real ones.
 */
export function window(daily: DailySeries, days: number, endingOn?: IsoDate): SeriesPoint[] {
  let last: IsoDate | null = endingOn ?? null;
  if (last === null) for (const date of daily.keys()) last = date;
  if (last === null) return [];
  const first = addDays(last, -(days - 1));
  const out: SeriesPoint[] = [];
  for (const [date, value] of daily) if (date >= first && date <= last) out.push({ date, value });
  return out;
}

export interface RibbonPoint {
  date: IsoDate;
  band: Band;
}

/**
 * The climatology band evaluated on each of `dates`, for drawing behind a run of readings.
 *
 * Days the band cannot be computed for are dropped, which matters at the edges of a short
 * history: Minas San Francisco has eight years and every day of the year clears the gate,
 * while Sopladora has 114 days and this returns nothing at all rather than a ribbon built
 * from one season.
 */
export function ribbon(daily: DailySeries, dates: readonly IsoDate[]): RibbonPoint[] {
  const bins = binByDayOfYear(daily);
  const out: RibbonPoint[] = [];
  for (const date of dates) {
    const band = bandForDayOfYear(bins, dayOfYear(date));
    if (band !== null) out.push({ date, band });
  }
  return out;
}

export interface MixDay {
  date: IsoDate;
  /** Concept -> GWh for the day. Missing concepts are absent, not zero. */
  values: Record<string, number>;
}

/**
 * The national balance over the last `days` closed days, oldest first, in GWh.
 *
 * SMEC's own gaps stay gaps — 0.40% of days since 2016-05-01 were re-asked on 2026-09-22 and
 * never arrived — so the stacked area has holes in it where the source has holes. That is the
 * intended reading: a missing day is missing, not a day the country generated nothing.
 */
export function mix(days: number): MixDay[] {
  const byDate = new Map<IsoDate, Record<string, number>>();
  for (const row of readTable("national_balance_daily")) {
    const date = row["date"] ?? "";
    const concept = row["concepto"] ?? "";
    const kwh = Number(row["dia_kwh"] ?? "");
    if (!date || !concept || !Number.isFinite(kwh)) continue;
    const day = byDate.get(date) ?? byDate.set(date, {}).get(date)!;
    day[concept] = kwh / 1e6;
  }
  const dates = [...byDate.keys()].sort();
  const last = dates.at(-1);
  if (last === undefined) return [];
  const first = addDays(last, -(days - 1));
  return dates.filter((d) => d >= first).map((date) => ({ date, values: byDate.get(date)! }));
}

/** Every day a model stood on, newest first, for the permalinks under `/dia/`. */
let daysCache: DayRecord[] | null = null;
export function days(): DayRecord[] {
  daysCache ??= daysFrom({
    forecastRuns: readTable("forecast_runs"),
    forecastValues: readTable("forecast_values"),
    adequacyRuns: readTable("adequacy_runs"),
    adequacyValues: readTable("adequacy_values"),
    narrativeSnapshots: readTable("narrative_snapshots"),
  });
  return daysCache;
}

/**
 * The day the first still-pending published row falls due, for the forecast's or the adequacy
 * model's scorecard. See `firstPendingTarget`.
 */
export function nextScoreDue(kind: "forecast" | "adequacy", observedThrough: IsoDate | null): IsoDate | null {
  return kind === "forecast"
    ? firstPendingTarget(readTable("forecast_runs"), readTable("forecast_values"), observedThrough)
    : firstPendingTarget(readTable("adequacy_runs"), readTable("adequacy_values"), observedThrough);
}

/** Where a reservoir's own page lives. Every reservoir `latest.json` carries has one. */
export function reservoirHref(site: string): string {
  return `/embalses/${site}/`;
}

/**
 * The date the newest number on the page describes: the latest reading or closed balance day.
 * `latest.json` has carried it as `data_date` since schema version 1; a document written before
 * then is dated the same way from its readings.
 */
export function dataDate(now: LatestDocument | null = latest()): string | null {
  if (now === null) return null;
  return now.data_date ?? dataDateOf(now.reservoirs, now.national) ?? now.as_of;
}
