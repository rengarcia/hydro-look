/**
 * Daily series, assembled from the curated observations for the models to read.
 *
 * The curated table is deliberately long and keeps every source that published a reading, so
 * one site-day-variable can carry four rows. A model needs one number, which means choosing.
 * The order below is not arbitrary and not a guess about quality: the levels cross-check
 * (`data/crosschecks/jordanvt18.md`) showed the report endpoints and the historian carry the
 * *same* series to the mirror's published precision on 100% of 1,668 overlapping days, so the
 * choice almost never changes a value. It decides coverage, not truth — `repDiaHid12m` reaches
 * back to 2014-09-20 for levels while `pointValues` reaches back to 2010 for inflow — and it
 * makes the assembled series reproducible rather than dependent on CSV row order.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../store/csv.ts";
import { DATA_CURATED } from "../util/paths.ts";
import { OBSERVATIONS_DAILY } from "../contracts/tables.ts";
import type { IsoDate } from "../util/dates.ts";

/**
 * Most specific first. The two per-day reports publish one site-day each and are the closest
 * thing to a primary record; the 12-month reports are the same numbers in bulk; the historian
 * (`pointValues`) is last because it is the route the plan demoted in decision 9, kept here for
 * the years and the plants the reports do not reach.
 */
export const SOURCE_PREFERENCE = [
  "ords:repDiaNivQIng",
  "ords:repDiaVolAlm",
  "ords:repDiaPotQTurb",
  "ords:repDiaHid12m",
  "ords:repDiaEner12m",
  "ords:mazEnerDia",
  "ords:molEnerDia",
  "ords:sopEnerDia",
  "ords:msfEnerDia",
  "ords:agoEnerDia",
  "ords:manEnerDia",
  "ords:ccsEnerDia",
  "ords:pointValues",
] as const;

const RANK = new Map<string, number>(SOURCE_PREFERENCE.map((source, index) => [source, index]));

/** An unlisted source still loads; it simply loses every tie to a listed one. */
function rankOf(source: string): number {
  return RANK.get(source) ?? SOURCE_PREFERENCE.length;
}

/** `date -> value`, one entry per day, already resolved across sources. */
export type DailySeries = Map<IsoDate, number>;

export interface SeriesSet {
  /** `site -> variable -> series`. */
  get(site: string, variable: string): DailySeries;
  /** Which source each day was taken from, for the provenance line in the forecast document. */
  sourcesFor(site: string, variable: string): Set<string>;
  dates(site: string, variable: string): IsoDate[];
}

interface Chosen {
  value: number;
  rank: number;
  source: string;
}

/**
 * Reads every year partition of `observations_daily`. `HYDRO_LOOK_DATA_ROOT` moves the root,
 * which is how the tests drive this against a small table instead of the repository's own.
 */
export function readObservationRows(root: string = DATA_CURATED): Record<string, string>[] {
  const directory = join(root, OBSERVATIONS_DAILY.name);
  if (!existsSync(directory)) return [];
  const rows: Record<string, string>[] = [];
  for (const file of readdirSync(directory)
    .filter((f) => f.endsWith(".csv"))
    .sort()) {
    rows.push(...parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  return rows;
}

export function buildSeries(rows: Record<string, string>[]): SeriesSet {
  const chosen = new Map<string, Map<IsoDate, Chosen>>();

  for (const row of rows) {
    const site = row["site"] ?? "";
    const variable = row["variable"] ?? "";
    const date = row["date"] ?? "";
    const raw = row["value"] ?? "";
    if (!site || !variable || !date || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    const key = `${site}\u0000${variable}`;
    const byDate = chosen.get(key) ?? chosen.set(key, new Map()).get(key)!;
    const rank = rankOf(row["source"] ?? "");
    const current = byDate.get(date);
    if (!current || rank < current.rank) byDate.set(date, { value, rank, source: row["source"] ?? "" });
  }

  const seriesCache = new Map<string, DailySeries>();
  const key = (site: string, variable: string) => `${site}\u0000${variable}`;

  return {
    get(site, variable) {
      const k = key(site, variable);
      const cached = seriesCache.get(k);
      if (cached) return cached;
      const out: DailySeries = new Map();
      for (const [date, pick] of chosen.get(k) ?? []) out.set(date, pick.value);
      const sorted: DailySeries = new Map([...out].sort(([a], [b]) => (a < b ? -1 : 1)));
      seriesCache.set(k, sorted);
      return sorted;
    },
    sourcesFor(site, variable) {
      const out = new Set<string>();
      for (const pick of (chosen.get(key(site, variable)) ?? new Map<IsoDate, Chosen>()).values()) out.add(pick.source);
      return out;
    },
    dates(site, variable) {
      return [...this.get(site, variable).keys()];
    },
  };
}

/** Convenience for the CLI: read the committed table and resolve it in one call. */
export function loadSeries(root?: string): SeriesSet {
  return buildSeries(readObservationRows(root));
}
