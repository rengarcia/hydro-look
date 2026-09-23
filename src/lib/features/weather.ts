/**
 * ERA5 daily precipitation, read for a model rather than for display.
 *
 * Two things make this series weaker than its name suggests, and both travel with it into any
 * model that reads it:
 *
 * - **It is one point, not a basin.** Until the verified catchment centroids have a climatology,
 *   what this reads is `basins.csv`'s `paute` row, a *provisional* Phase 0 sampling point
 *   (-2.6, -78.6), not a catchment centroid or an area average. The verified centroids added on
 *   2026-09-23 (`paute_mazar` and six more, `data/reports/catchments.md`) are separate rows so
 *   that nothing fitted on the provisional point changes under anyone's feet; `selectPrecipBasin`
 *   below moves the Mazar models and the narrative onto `paute_mazar` on its own, the first run
 *   after that row's ERA5 history is adequate — and even the centroid is still one grid cell of
 *   a 0.25° reanalysis, which every table it appears in says.
 * - **It arrives late.** ERA5 is published about five days behind real time, so on any day the
 *   newest value a forecaster could have read is five days old. `ERA5_LATENCY_DAYS` is that lag,
 *   and features built from this series never read inside it. The values themselves are today's
 *   reanalysis, not what was on the server in 2018 (the preliminary ERA5T is revised once);
 *   that residual optimism is small and is stated rather than modelled.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../store/csv.ts";
import { DATA_CURATED } from "../util/paths.ts";
import { WEATHER_DAILY } from "../contracts/tables.ts";
import { addDays, daysBetween, type IsoDate } from "../util/dates.ts";
import type { DailySeries } from "./series.ts";

/** Days between an ERA5 day and the first day it can be read. */
export const ERA5_LATENCY_DAYS = 5;

/** The Phase 0 sampling point: provisional, and the only basin with history before §1.1. */
export const PROVISIONAL_PRECIP_BASIN = "paute";

/** The verified centroid of the catchment above Presa Mazar, which replaces it once adequate. */
export const MAZAR_PRECIP_BASIN = "paute_mazar";

/**
 * The verified centroid each forecast plant's inflow is conditioned on (§5.3), from
 * `basins.csv`. Amaluza is the cascade below Mazar; its inter-dam catchment has no centroid of
 * its own, so it reads Mazar's, which is the nearest honest proxy and is labelled so.
 */
export const PLANT_PRECIP_BASIN: Readonly<Record<string, string>> = {
  mazar: MAZAR_PRECIP_BASIN,
  amaluza: MAZAR_PRECIP_BASIN,
  coca_codo_sinclair: "coca_ccs",
  agoyan: "pastaza_agoyan",
  manduriacu: "guayllabamba_manduriacu",
  minas_san_francisco: "jubones_msf",
  delsitanisagua: "zamora_delsitanisagua",
};

/**
 * What "adequate ERA5 coverage" means, concretely. The narrative's percentiles and M4's
 * features compare today against the same window in every earlier year, so a basin is usable
 * only when that climatology exists: a first day in January 1990 (the backfill's start), at
 * least 95% of the days from then to its newest day present, and a newest day no more than
 * `maxLagDays` behind the provisional point's, so a centroid that was backfilled once and then
 * stopped being sampled does not win on history it no longer extends.
 */
export const ERA5_ADEQUATE = {
  climatologyFrom: "1990-01-01",
  firstDayBy: "1990-01-31",
  minShare: 0.95,
  maxLagDays: 30,
} as const;

/** `date -> precip_mm` from the reanalysis rows only; forecast rows are a different product. */
export function readEra5Precip(basin: string = PROVISIONAL_PRECIP_BASIN, root: string = DATA_CURATED): DailySeries {
  return readEra5ByBasin(root).get(basin) ?? new Map();
}

/** Every basin's ERA5 precipitation, one pass over the table. */
export function readEra5ByBasin(root: string = DATA_CURATED): Map<string, DailySeries> {
  const directory = join(root, WEATHER_DAILY.name);
  const out = new Map<string, DailySeries>();
  if (!existsSync(directory)) return out;
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      if ((row["kind"] ?? "") !== "era5") continue;
      const raw = row["precip_mm"] ?? "";
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) continue;
      const basin = row["basin"] ?? "";
      (out.get(basin) ?? out.set(basin, new Map()).get(basin)!).set(row["date"]!, value);
    }
  }
  for (const [basin, series] of out) out.set(basin, new Map([...series].sort(([a], [b]) => (a < b ? -1 : 1))));
  return out;
}

export interface Era5Coverage {
  first: IsoDate | null;
  last: IsoDate | null;
  /** Days present from `ERA5_ADEQUATE.climatologyFrom` to `last`. */
  days: number;
  expectedDays: number;
  share: number;
}

export function era5Coverage(series: DailySeries): Era5Coverage {
  let first: IsoDate | null = null;
  let last: IsoDate | null = null;
  let days = 0;
  for (const date of series.keys()) {
    if (first === null || date < first) first = date;
    if (last === null || date > last) last = date;
    if (date >= ERA5_ADEQUATE.climatologyFrom) days++;
  }
  const expectedDays = last === null || last < ERA5_ADEQUATE.climatologyFrom ? 0 : daysBetween(ERA5_ADEQUATE.climatologyFrom, last) + 1;
  return { first, last, days, expectedDays, share: expectedDays > 0 ? days / expectedDays : 0 };
}

/** Why a coverage is not adequate, or null when it is. */
export function inadequacy(coverage: Era5Coverage, newestElsewhere: IsoDate | null = null): string | null {
  if (coverage.first === null || coverage.last === null) return "no ERA5 rows";
  if (coverage.first > ERA5_ADEQUATE.firstDayBy) return `ERA5 starts ${coverage.first}, not by ${ERA5_ADEQUATE.firstDayBy}`;
  if (coverage.share < ERA5_ADEQUATE.minShare) {
    return `${(coverage.share * 100).toFixed(1)}% of days since ${ERA5_ADEQUATE.climatologyFrom}, under ${ERA5_ADEQUATE.minShare * 100}%`;
  }
  if (newestElsewhere !== null && coverage.last < addDays(newestElsewhere, -ERA5_ADEQUATE.maxLagDays)) {
    return `newest ERA5 day ${coverage.last} is more than ${ERA5_ADEQUATE.maxLagDays} days behind ${newestElsewhere}`;
  }
  return null;
}

export interface PrecipChoice {
  basin: string;
  series: DailySeries;
  /** True when `basin` is the preferred verified centroid; false on the provisional fallback. */
  preferred: boolean;
  coverage: Era5Coverage;
  /** Why the preferred basin was not used; null when it was. */
  fallbackReason: string | null;
}

/**
 * The basin a Mazar model or the narrative reads rain from: the verified centroid once its
 * ERA5 history is adequate, the provisional point until then. The decision is recomputed every
 * run from the committed table, so the switch needs no code change — only the backfill — and
 * the `paute` rows stay as history either way.
 */
export function selectPrecipBasin(
  byBasin: ReadonlyMap<string, DailySeries>,
  preferred: string = MAZAR_PRECIP_BASIN,
  fallback: string = PROVISIONAL_PRECIP_BASIN,
): PrecipChoice {
  const fallbackSeries = byBasin.get(fallback) ?? new Map<IsoDate, number>();
  const fallbackCoverage = era5Coverage(fallbackSeries);
  const candidate = byBasin.get(preferred) ?? new Map<IsoDate, number>();
  const coverage = era5Coverage(candidate);
  const reason = inadequacy(coverage, fallbackCoverage.last);
  if (reason === null) return { basin: preferred, series: candidate, preferred: true, coverage, fallbackReason: null };
  return {
    basin: fallback,
    series: fallbackSeries,
    preferred: false,
    coverage: fallbackCoverage,
    fallbackReason: `${preferred}: ${reason}`,
  };
}
