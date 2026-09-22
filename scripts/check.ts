#!/usr/bin/env node
/**
 * Quality gates over the committed data.
 *
 *   npm run check                       shape, ranges and reference integrity; writes nothing
 *   npm run check -- --freshness        also fail when a feed has stopped arriving
 *   npm run check -- --out public/api/status.json   write the public status document
 *
 * The split matters. Everything but `--freshness` is a function of the files alone, so it runs
 * in CI on every push and stays true for as long as the commit does. Freshness is a function of
 * the clock: in CI it would turn every pull request red the moment the data aged a few days,
 * which teaches people to ignore a red build. It runs after an ingest instead, where a stale
 * feed is news.
 *
 * Exit code is 1 if anything failed, so both CI and the ingest job can gate on it.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ENSO_MONTHLY,
  NATIONAL_BALANCE_DAILY,
  OBSERVATIONS_DAILY,
  OPERATING_BANDS,
  OPERATIVA_SNAPSHOTS,
  WEATHER_DAILY,
  type TableSpec,
} from "../src/lib/contracts/tables.ts";
import {
  checkFreshness,
  checkNationalBalance,
  checkObservationRanges,
  checkReference,
  checkTableShape,
  widestBands,
  worstLevel,
  type Finding,
  type FreshnessRule,
  type Rows,
} from "../src/lib/quality/checks.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED, DATA_REFERENCE } from "../src/lib/util/paths.ts";
import { nowUtc, todayEc } from "../src/lib/util/dates.ts";

/**
 * How long each feed may go without a new row before it counts as stopped.
 *
 * These are each source's own publication lag plus room for one missed run — they are not
 * targets, and they are not guesses. The ORDS reports land the morning after the local day;
 * SMEC closes a day at D+1 around 11:15 local; ERA5 runs about six days behind by design, which
 * is why the ingest stops six days short of today.
 *
 * ONI is the one that looks alarming and is not. Its month label is the *centre* of a
 * three-month mean, so the value labelled July is June–July–August and cannot exist until
 * August has ended; add NOAA's own publication delay and the newest label available on any
 * given day is roughly two months old. On 2026-09-22 the newest was 2026-07, 83 days back, with
 * the feed working normally. The limit is therefore set past a full extra publication cycle:
 * under it, a genuinely stopped ONI still trips within about a month.
 *
 * A feed that has never produced a row is reported, not failed — see `checkFreshness`.
 */
const FRESHNESS_LIMIT_DAYS: Record<string, number> = {
  "ORDS levels and inflows (repDiaHid12m)": 3,
  "ORDS CELEC Sur energy (repDiaEner12m)": 3,
  "ORDS historian (pointValues)": 3,
  "CENACE SMEC national balance": 4,
  "CENACE Información Operativa": 3,
  "Open-Meteo ERA5": 10,
  "NOAA ONI": 110,
};

function readTable(name: string): { rows: Rows; header: string[] | null; mismatches: string[] } {
  const directory = join(DATA_CURATED, name);
  const single = join(DATA_CURATED, `${name}.csv`);
  const paths = existsSync(directory)
    ? readdirSync(directory).filter((f) => f.endsWith(".csv")).sort().map((f) => join(directory, f))
    : existsSync(single)
      ? [single]
      : [];

  const rows: Rows = [];
  let header: string[] | null = null;
  const mismatches: string[] = [];
  for (const path of paths) {
    const text = readFileSync(path, "utf8");
    // Every year partition of a table must carry the same header. The first one stands for the
    // table only because any partition that disagrees with it is reported by name.
    const firstLine = text.split("\n", 1)[0] ?? "";
    if (header === null) header = firstLine.split(",");
    else if (header.join(",") !== firstLine) mismatches.push(path);
    rows.push(...parseCsv(text));
  }
  return { rows, header, mismatches };
}

function readReference(name: string): Rows {
  const path = join(DATA_REFERENCE, name);
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

function latestWhere(rows: Rows, column: string, predicate: (row: Record<string, string>) => boolean): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (!predicate(row)) continue;
    const value = (row[column] ?? "").slice(0, 10);
    if (!value) continue;
    if (latest === null || value > latest) latest = value;
  }
  return latest;
}

function main(): void {
  const argv = process.argv.slice(2);
  const wantFreshness = argv.includes("--freshness");
  const outIndex = argv.indexOf("--out");
  const outPath = outIndex >= 0 ? argv[outIndex + 1] : undefined;

  const observations = readTable(OBSERVATIONS_DAILY.name);
  const national = readTable(NATIONAL_BALANCE_DAILY.name);
  const operativa = readTable(OPERATIVA_SNAPSHOTS.name);
  const bands = readTable(OPERATING_BANDS.name);
  const weather = readTable(WEATHER_DAILY.name);
  const enso = readTable(ENSO_MONTHLY.name);

  const thresholds = readReference("thresholds.csv");
  const findings: Finding[] = [];

  const tables: [TableSpec<unknown>, { rows: Rows; header: string[] | null; mismatches: string[] }][] = [
    [OBSERVATIONS_DAILY as TableSpec<unknown>, observations],
    [NATIONAL_BALANCE_DAILY as TableSpec<unknown>, national],
    [OPERATIVA_SNAPSHOTS as TableSpec<unknown>, operativa],
    [OPERATING_BANDS as TableSpec<unknown>, bands],
    [WEATHER_DAILY as TableSpec<unknown>, weather],
    [ENSO_MONTHLY as TableSpec<unknown>, enso],
  ];
  for (const [spec, table] of tables) {
    findings.push(...checkTableShape(spec, table.rows, table.header));
    for (const path of table.mismatches) {
      findings.push({ check: `shape:${spec.name}`, level: "fail", message: `${path} has a different header from the rest of the table` });
    }
  }

  findings.push(...checkObservationRanges(observations.rows, widestBands(thresholds)));
  findings.push(...checkNationalBalance(national.rows));
  findings.push(
    ...checkReference({
      plants: readReference("plants.csv"),
      thresholds,
      rationing: readReference("rationing_episodes.csv"),
    }),
  );

  const bySource = (source: string) => (row: Record<string, string>) => row["source"] === source;
  const rules: FreshnessRule[] = [
    ["ORDS levels and inflows (repDiaHid12m)", latestWhere(observations.rows, "date", bySource("ords:repDiaHid12m"))],
    ["ORDS CELEC Sur energy (repDiaEner12m)", latestWhere(observations.rows, "date", bySource("ords:repDiaEner12m"))],
    ["ORDS historian (pointValues)", latestWhere(observations.rows, "date", bySource("ords:pointValues"))],
    ["CENACE SMEC national balance", latestWhere(national.rows, "date", () => true)],
    ["CENACE Información Operativa", latestWhere(operativa.rows, "fetched_at", () => true)],
    ["Open-Meteo ERA5", latestWhere(weather.rows, "date", (row) => row["kind"] === "era5")],
    // ONI is a month, not a day; its first day stands in for it so the arithmetic is uniform.
    ["NOAA ONI", latestWhere(enso.rows.map((r) => ({ ...r, month: `${r["month"]}-01` })), "month", () => true)],
  ].map(([label, latest]) => ({ label: label!, latest: latest ?? null, maxAgeDays: FRESHNESS_LIMIT_DAYS[label!] ?? 7 }));

  const freshness = checkFreshness(rules, todayEc());
  if (wantFreshness) findings.push(...freshness);

  for (const finding of findings) {
    if (finding.level === "info") continue;
    console.log(`${finding.level.toUpperCase()} [${finding.check}] ${finding.message}`);
  }
  const failures = findings.filter((f) => f.level === "fail");
  console.log(
    `${findings.length} checks: ${failures.length} fail, ${findings.filter((f) => f.level === "warn").length} warn, ` +
      `${findings.filter((f) => f.level === "info").length} info${wantFreshness ? "" : " (freshness not checked)"}`,
  );

  if (outPath) {
    // The public document always reports freshness, whether or not this run gated on it: the
    // site's job is to show how old the data is, and a viewer cannot pass a flag.
    const document = {
      generated_at: nowUtc(),
      as_of: todayEc(),
      ok: failures.length === 0,
      status: worstLevel(findings),
      feeds: rules.map((rule) => {
        const finding = freshness.find((f) => f.message.startsWith(rule.label));
        return {
          feed: rule.label,
          latest: rule.latest,
          limit_days: rule.maxAgeDays,
          state: rule.latest === null ? "not_ingested" : finding?.level === "fail" ? "stale" : "current",
        };
      }),
      tables: Object.fromEntries(tables.map(([spec, table]) => [spec.name, { rows: table.rows.length }])),
      findings: findings.filter((f) => f.level !== "info").map((f) => ({ check: f.check, level: f.level, message: f.message })),
      counts: findings.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.level]: (acc[f.level] ?? 0) + 1 }), {}),
    };
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
    console.log(`wrote ${outPath}`);
  }

  process.exitCode = failures.length > 0 ? 1 : 0;
}

main();
