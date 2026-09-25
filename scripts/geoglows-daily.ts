#!/usr/bin/env node
/**
 * Keep GEOGLOWS' forecast for the inflow ensemble's member plants: every 00 UTC issue's
 * high-resolution member, as daily means at leads 1–10, into `data/curated/geoglows_forecasts`.
 * See `src/lib/features/geoglows.ts` for which plants and why.
 *
 * Runs in the daily model step before `npm run forecast` (a missed day only means the ensemble
 * has two members that day), and once by hand with `--from 2024-07-01` to backfill the archive
 * the backtest scores. Also writes `data/reference/geoglows_simulated_climatology.csv` — the
 * model's own median window mean per calendar day, from the retrospective simulation 1940–2023 —
 * when it is missing or `--climatology` is given.
 *
 *   npm run geoglows:daily                       # issues since the last one stored, to today
 *   npm run geoglows:daily -- --from 2024-07-01  # backfill
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { GEOGLOWS_FORECASTS } from "../src/lib/contracts/tables.ts";
import {
  GEOGLOWS_CLIMATOLOGY_HORIZONS,
  GEOGLOWS_CLIMATOLOGY_LAST_YEAR,
  GEOGLOWS_MAX_LEAD,
  GEOGLOWS_MEMBER_PLANTS,
  readGeoglowsForecasts,
  SIMULATED_CLIMATOLOGY_FILE,
} from "../src/lib/features/geoglows.ts";
import { forecastPositions, forecastStore, readForecastMember, readSimulated } from "../src/lib/geo/geoglows-stores.ts";
import { dailyMeans } from "../src/lib/models/geoglows-forecast.ts";
import { windowClimatology } from "../src/lib/models/geoglows-inflow.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { parseCsv, toCsv } from "../src/lib/store/csv.ts";
import { addDays, nowUtc, type IsoDate } from "../src/lib/util/dates.ts";
import { roundTo } from "../src/lib/util/numbers.ts";
import { DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";

const FIRST_YEAR = 1940;
const CONCURRENCY = 8;

function rivers(): { site: string; riverId: number }[] {
  const rows = parseCsv(readFileSync(repoPath("data", "reference", "geoglows_return_periods.csv"), "utf8"));
  return GEOGLOWS_MEMBER_PLANTS.flatMap((site) => {
    const row = rows.find((r) => r["site"] === site);
    return row ? [{ site, riverId: Number(row["river_id"]) }] : [];
  });
}

async function climatology(sites: { site: string; riverId: number }[]): Promise<void> {
  const { series } = await readSimulated(sites.map((s) => s.riverId));
  const rows: Record<string, unknown>[] = [];
  // Every calendar day, as origins in the year after the last one used: 1940–2023 are "earlier years".
  for (let d = `${GEOGLOWS_CLIMATOLOGY_LAST_YEAR + 1}-01-01`; d < `${GEOGLOWS_CLIMATOLOGY_LAST_YEAR + 2}-01-01`; d = addDays(d, 1)) {
    if (d.endsWith("02-29")) continue;
    for (const { site, riverId } of sites) {
      for (const h of GEOGLOWS_CLIMATOLOGY_HORIZONS) {
        const median = windowClimatology(series.get(riverId)!, d, h, FIRST_YEAR);
        if (median === null) continue;
        rows.push({
          site,
          river_id: riverId,
          month_day: d.slice(5),
          horizon_days: h,
          first_year: FIRST_YEAR,
          last_year: GEOGLOWS_CLIMATOLOGY_LAST_YEAR,
          median_m3s: roundTo(median, 3),
        });
      }
    }
  }
  const columns = ["site", "river_id", "month_day", "horizon_days", "first_year", "last_year", "median_m3s"];
  writeFileSync(join(DATA_REFERENCE, SIMULATED_CLIMATOLOGY_FILE), toCsv(columns, rows));
  console.log(`wrote data/reference/${SIMULATED_CLIMATOLOGY_FILE} (${rows.length} rows)`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { from: { type: "string" }, to: { type: "string" }, climatology: { type: "boolean", default: false } },
  });
  const sites = rivers();
  if (sites.length === 0) throw new Error("no member plant has a river in geoglows_return_periods.csv: run npm run geoglows");
  if (values.climatology || !existsSync(join(DATA_REFERENCE, SIMULATED_CLIMATOLOGY_FILE))) await climatology(sites);

  const stored = readGeoglowsForecasts();
  const have = (issued: IsoDate) => sites.every((s) => stored.get(s.site)?.has(issued));
  const latest = [...new Set(sites.flatMap((s) => [...(stored.get(s.site)?.keys() ?? [])]))].sort().at(-1);
  const today = nowUtc().slice(0, 10);
  const from = values.from ?? (latest ? addDays(latest, 1) : addDays(today, -3));
  const to = values.to ?? today;
  const issues: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (!have(d)) issues.push(d);
  console.log(`${sites.map((s) => s.site).join(", ")}: ${issues.length} issues to fetch (${from} → ${to})`);
  if (issues.length === 0) return;

  // Positions from the newest issue in the range that exists; each issue checks them by ETag.
  let positions: Awaited<ReturnType<typeof forecastPositions>> | null = null;
  for (const d of [...issues].reverse()) {
    try {
      positions = await forecastPositions(
        d,
        sites.map((s) => s.riverId),
      );
      break;
    } catch {
      continue;
    }
  }
  if (!positions) {
    console.log("no forecast in the bucket for the range yet");
    return;
  }

  const store = new CuratedStore();
  let fetched = 0;
  let batch: Record<string, unknown>[] = [];
  const rowsFor = async (issued: IsoDate): Promise<Record<string, unknown>[] | null> => {
    const got = await readForecastMember(
      issued,
      sites.map((s) => s.riverId),
      positions,
    );
    if (!got) return null;
    const key = forecastStore(issued).replace(/^https:\/\/([^.]+)\.s3[^/]*\//, "s3://$1/");
    // The ETag of the forecast chunk the values came from (the member's blocks are read by range from it).
    const etag = ([...got.source.etags].find(([k]) => k.startsWith("Qout/"))?.[1] ?? "").replace(/"/g, "");
    const fetchedAt = nowUtc();
    return sites.flatMap(({ site, riverId }) =>
      dailyMeans(got.run.hours, got.run.values.get(riverId)!, GEOGLOWS_MAX_LEAD).flatMap((q, k) =>
        q === null || !(q >= 0)
          ? []
          : [
              {
                issued,
                site,
                river_id: riverId,
                member: "high_res",
                lead_days: k + 1,
                q_m3s: roundTo(q, 3),
                store_key: key,
                etag,
                fetched_at: fetchedAt,
              },
            ],
      ),
    );
  };
  // A few issues at a time: each is ~30 small range requests, and the latency, not the bytes, is the cost.
  for (let i = 0; i < issues.length; i += CONCURRENCY) {
    const group = issues.slice(i, i + CONCURRENCY);
    for (const rows of await Promise.all(group.map(rowsFor))) {
      if (!rows) continue;
      fetched++;
      batch.push(...rows);
    }
    // Written as it goes, so a long backfill that stops keeps what it read.
    if (batch.length >= 300) {
      store.upsert(GEOGLOWS_FORECASTS, batch);
      batch = [];
      console.log(`  ${Math.min(i + CONCURRENCY, issues.length)}/${issues.length} issues, ${fetched} in the bucket`);
    }
  }
  if (batch.length > 0) store.upsert(GEOGLOWS_FORECASTS, batch);
  console.log(`stored ${fetched} issues in data/curated/${GEOGLOWS_FORECASTS.name}`);
}

await main();
