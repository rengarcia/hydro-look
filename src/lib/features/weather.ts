/**
 * ERA5 daily precipitation, read for a model rather than for display.
 *
 * Two things make this series weaker than its name suggests, and both travel with it into any
 * model that reads it:
 *
 * - **It is one point, not a basin.** What this reads by default is `basins.csv`'s `paute` row, a
 *   *provisional* Phase 0 sampling point (-2.6, -78.6), not a catchment centroid or an area
 *   average. A model that uses it is using rain at one grid cell of a 0.25° reanalysis, and every
 *   table it appears in says so. The verified catchment centroids added on 2026-09-23
 *   (`paute_mazar` and six more, `data/reports/catchments.md`) are separate rows so that M4, which
 *   was backtested on this point, does not change under anyone's feet; moving it onto
 *   `paute_mazar` is a change to the shipped model and needs its own backtest.
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
import type { DailySeries } from "./series.ts";

/** Days between an ERA5 day and the first day it can be read. */
export const ERA5_LATENCY_DAYS = 5;

/** The only basin with a sampling point, and that point is provisional. */
export const PROVISIONAL_PRECIP_BASIN = "paute";

/** `date -> precip_mm` from the reanalysis rows only; forecast rows are a different product. */
export function readEra5Precip(basin: string = PROVISIONAL_PRECIP_BASIN, root: string = DATA_CURATED): DailySeries {
  const directory = join(root, WEATHER_DAILY.name);
  const out: DailySeries = new Map();
  if (!existsSync(directory)) return out;
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      if ((row["basin"] ?? "") !== basin || (row["kind"] ?? "") !== "era5") continue;
      const raw = row["precip_mm"] ?? "";
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) continue;
      out.set(row["date"]!, value);
    }
  }
  return new Map([...out].sort(([a], [b]) => (a < b ? -1 : 1)));
}
