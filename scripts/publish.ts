#!/usr/bin/env node
/**
 * Writes `public/api/latest.json`, the current-state document the site's tiles read.
 *
 *   npm run publish:api                       write public/api/latest.json
 *   npm run publish:api -- --dry-run          build it and print a summary; touch no file
 *   npm run publish:api -- --out path.json    write somewhere else
 *   npm run publish:api -- --restamp          also restamp the other four documents with the
 *                                             current contract block (schema_version, licence,
 *                                             see_also), leaving their numbers untouched
 *
 * It is a pure function of the committed tables, like `check` and `forecast`: no network, no
 * clock beyond the timestamp it stamps on itself. That is what lets the daily job regenerate it
 * after an ingest has landed and lets CI run it on every push to prove it still builds.
 *
 * Exit code is 1 when there is nothing to publish, so a workflow that has lost its data fails
 * rather than committing an empty document over a good one.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { buildLatest, type BalanceRow, type ThresholdRow } from "../src/lib/publish/latest.ts";
import { loadSeries } from "../src/lib/features/series.ts";
import { NATIONAL_BALANCE_DAILY } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { SITES, type SiteId } from "../src/lib/registry.ts";
import { DATA_CURATED, DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";
import { nowUtc, todayEc } from "../src/lib/util/dates.ts";
import { publicJson, type DocumentName } from "../src/lib/publish/contract.ts";

/**
 * Every site the registry calls a reservoir, in the order it declares them — which puts Mazar
 * first, and Mazar is the one the page is about. Deriving the list rather than writing it out
 * means a reservoir added to the registry appears on the site without a second edit here.
 */
function reservoirSites(): SiteId[] {
  return (Object.keys(SITES) as SiteId[]).filter((site) => SITES[site].kind.includes("reservoir"));
}

function readReference(name: string): Record<string, string>[] {
  const path = join(DATA_REFERENCE, name);
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

function readTable(name: string): Record<string, string>[] {
  const directory = join(DATA_CURATED, name);
  if (!existsSync(directory)) return [];
  const rows: Record<string, string>[] = [];
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    rows.push(...parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  return rows;
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      out: { type: "string" },
      restamp: { type: "boolean", default: false },
    },
  });

  const outPath = values.out?.trim() || repoPath("public", "api", "latest.json");
  const dryRun = values["dry-run"] ?? false;

  const adequacyPath = repoPath("public", "api", "adequacy.json");
  const adequacy = existsSync(adequacyPath) ? JSON.parse(readFileSync(adequacyPath, "utf8")) : null;

  const document = buildLatest({
    series: loadSeries(),
    thresholds: readReference("thresholds.csv") as unknown as ThresholdRow[],
    balance: readTable(NATIONAL_BALANCE_DAILY.name) as unknown as BalanceRow[],
    sites: reservoirSites(),
    generatedAt: nowUtc(),
    asOf: todayEc(),
    adequacy,
  });

  const withLevel = document.reservoirs.filter((r) => r.level !== null).length;
  if (withLevel === 0) {
    console.error("no reservoir carries a level: nothing to publish");
    process.exitCode = 1;
    return;
  }

  for (const reservoir of document.reservoirs) {
    const level = reservoir.level;
    const band = reservoir.bands[0];
    console.log(
      `${reservoir.site.padEnd(20)} ${level ? `${level.masl.toFixed(2)} m on ${level.date}` : "no level".padEnd(24)}` +
        `${band?.band_pct === null || band === undefined ? "" : `  ${band.band_pct.toFixed(1)}% of the ${band.declaration} band`}`,
    );
  }
  const national = document.national;
  console.log(
    national
      ? `national ${national.date}: hydro ${national.hydro_share_pct ?? "?"}%, thermal ${national.thermal_share_pct ?? "?"}%, imports ${national.import_share_pct ?? "?"}%`
      : "national: no closed day",
  );
  const adequate = document.adequacy;
  console.log(
    adequate
      ? `adequacy ${adequate.origin_date}: ${adequate.tier}, worst ${adequate.worst_tier} at ${adequate.worst_tier_horizon_days} days`
      : "adequacy: not generated yet (run npm run adequacy)",
  );

  if (dryRun) {
    console.log(`would write ${outPath} (${withLevel}/${document.reservoirs.length} reservoirs with a level)`);
    return;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`wrote ${outPath}`);

  if (values.restamp) restamp(dirname(outPath));
}

/**
 * The other documents are written by their own scripts, each of which stamps the contract as it
 * writes. This is for the day the contract itself changes: it rewrites the stamp on what is
 * already published without rerunning a model, and it is idempotent.
 */
function restamp(directory: string): void {
  for (const name of ["status", "forecast", "adequacy", "narrative"] as DocumentName[]) {
    const path = join(directory, `${name}.json`);
    if (!existsSync(path)) continue;
    const before = readFileSync(path, "utf8");
    const after = publicJson(name, JSON.parse(before) as object);
    if (after === before) continue;
    writeFileSync(path, after);
    console.log(`restamped ${path}`);
  }
}

main();
