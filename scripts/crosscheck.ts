#!/usr/bin/env node
/**
 * Cross-check our levels against the community dataset that has been scraping the same
 * reservoirs daily since 2022 (jordanvt18/cotas-embalses-ecuador, 1,668 days x 3 reservoirs).
 *
 * That dataset reads the historian mrids; we read the daily report endpoints. They should
 * agree, and where they do not, the difference is a fact about the sources worth recording —
 * not something to paper over. The comparison also tries a one-day shift in each direction,
 * to test whether the two routes date a reading alike.
 *
 * Result of the first full run (2026-09-22, 1,668 overlapping days per reservoir): they do.
 * Mazar and Amaluza agree at offset 0 on every single day to the mirror's published precision
 * of 0.01 m, while a one-day shift in either direction costs 0.5-0.65 m of mean error. Two
 * independent routes into the same historian, parsed by two people, land on the same numbers
 * and the same dates.
 *
 *   npm run crosscheck            writes data/crosschecks/jordanvt18.md and .json
 *
 * The mirror is on raw.githubusercontent.com, which is reachable from anywhere this runs.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED, DATA_ROOT } from "../src/lib/util/paths.ts";
import { addDays, nowUtc, type IsoDate } from "../src/lib/util/dates.ts";
import { USER_AGENT } from "../src/lib/http/client.ts";
import type { SiteId } from "../src/lib/registry.ts";

const MIRROR = "https://raw.githubusercontent.com/jordanvt18/cotas-embalses-ecuador/main/data/raw/cotas_historico.csv";

const MIRROR_SITE: Record<string, SiteId> = {
  Mazar: "mazar",
  Amaluza: "amaluza",
  Sopladora: "sopladora",
};

/** Above this, a day is listed individually in the report rather than just counted. */
const NOTABLE_DIFF_M = 0.5;

/** Below this many overlapping days, the winning offset says more about backfill ranges than data. */
const MIN_DAYS_FOR_ALIGNMENT = 30;

interface Comparison {
  site: SiteId;
  source: string;
  offset_days: number;
  compared: number;
  mean_abs_diff_m: number;
  p95_abs_diff_m: number;
  max_abs_diff_m: number;
  exact: number;
  worst: { date: IsoDate; ours: number; theirs: number; diff: number }[];
}

function ourLevels(): Map<string, Map<IsoDate, number>> {
  const directory = join(DATA_CURATED, "observations_daily");
  if (!existsSync(directory)) throw new Error(`no curated observations yet at ${directory}; run the ingest first`);
  const bySourceSite = new Map<string, Map<IsoDate, number>>();
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv"))) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      if (row["variable"] !== "cota_masl") continue;
      const site = row["site"] as SiteId;
      if (!Object.values(MIRROR_SITE).includes(site)) continue;
      const key = `${site}|${row["source"]}`;
      const series = bySourceSite.get(key) ?? bySourceSite.set(key, new Map()).get(key)!;
      series.set(row["date"]!, Number(row["value"]));
    }
  }
  return bySourceSite;
}

async function theirLevels(): Promise<Map<SiteId, Map<IsoDate, number>>> {
  const response = await fetch(MIRROR, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`mirror returned HTTP ${response.status}`);
  const out = new Map<SiteId, Map<IsoDate, number>>();
  for (const row of parseCsv(await response.text())) {
    const site = MIRROR_SITE[row["embalse"] ?? ""];
    if (!site) continue;
    const series = out.get(site) ?? out.set(site, new Map()).get(site)!;
    series.set(row["fecha"]!, Number(row["cota_msnm"]));
  }
  return out;
}

function compare(site: SiteId, source: string, ours: Map<IsoDate, number>, theirs: Map<IsoDate, number>, offset: number): Comparison {
  const diffs: { date: IsoDate; ours: number; theirs: number; diff: number }[] = [];
  for (const [date, ourValue] of ours) {
    const theirValue = theirs.get(addDays(date, offset));
    if (theirValue === undefined) continue;
    diffs.push({ date, ours: ourValue, theirs: theirValue, diff: ourValue - theirValue });
  }
  const absolute = diffs.map((d) => Math.abs(d.diff)).sort((a, b) => a - b);
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return {
    site,
    source,
    offset_days: offset,
    compared: diffs.length,
    mean_abs_diff_m: round(absolute.reduce((a, b) => a + b, 0) / (absolute.length || 1)),
    p95_abs_diff_m: round(absolute[Math.floor(absolute.length * 0.95)] ?? 0),
    max_abs_diff_m: round(absolute.at(-1) ?? 0),
    // The mirror publishes two decimals, so agreement to 0.01 m is agreement.
    exact: diffs.filter((d) => Math.abs(d.diff) < 0.011).length,
    worst: diffs
      .filter((d) => Math.abs(d.diff) >= NOTABLE_DIFF_M)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 10)
      .map((d) => ({ ...d, ours: round(d.ours), theirs: round(d.theirs), diff: round(d.diff) })),
  };
}

async function main(): Promise<void> {
  const ours = ourLevels();
  const theirs = await theirLevels();

  const results: Comparison[] = [];
  for (const [key, series] of ours) {
    const [site, source] = key.split("|") as [SiteId, string];
    const mirror = theirs.get(site);
    if (!mirror) continue;
    for (const offset of [-1, 0, 1]) {
      const result = compare(site, source, series, mirror, offset);
      if (result.compared > 0) results.push(result);
    }
  }
  if (results.length === 0) throw new Error("nothing overlapped; has the backfill run?");

  /**
   * The best alignment per (site, source) is the one with the lowest mean absolute difference —
   * but only where enough days overlap to mean anything. A series we have ingested for a day or
   * two, ending outside the mirror's range, "matches" whichever offset happens to reach an
   * existing date, which reads as a date-convention finding when it is only an artifact of how
   * far each side has been backfilled.
   */
  const best = new Map<string, Comparison>();
  const tooShort = new Map<string, Comparison>();
  for (const result of results) {
    const key = `${result.site}|${result.source}`;
    const table = result.compared >= MIN_DAYS_FOR_ALIGNMENT ? best : tooShort;
    const current = table.get(key);
    if (!current || result.mean_abs_diff_m < current.mean_abs_diff_m) table.set(key, result);
  }
  // A series with a real comparison is never also reported as too short.
  for (const key of best.keys()) tooShort.delete(key);

  const lines = [
    "# Cross-check against jordanvt18/cotas-embalses-ecuador",
    "",
    `Generated ${nowUtc()}. Their series reads the historian mrids; ours reads the daily report`,
    "endpoints. Both claim to be the same reservoir levels, so this is a check on our parsing,",
    "our date convention and their scrape alike — a disagreement is recorded, not corrected.",
    "",
    "## Best alignment per series",
    "",
    "| site | our source | best offset | days compared | agree to 0.01 m | mean abs diff (m) | p95 | max |",
    "|---|---|---|---|---|---|---|---|",
    ...[...best.values()]
      .sort((a, b) => (a.site + a.source < b.site + b.source ? -1 : 1))
      .map(
        (r) =>
          `| ${r.site} | ${r.source} | ${r.offset_days >= 0 ? "+" : ""}${r.offset_days} d | ${r.compared} | ${((r.exact / r.compared) * 100).toFixed(1)}% | ${r.mean_abs_diff_m} | ${r.p95_abs_diff_m} | ${r.max_abs_diff_m} |`,
      ),
    "",
    "`offset` is how far their date must move to line up with ours: a non-zero best offset over a",
    "long overlap would mean the two routes date the same reading differently, which would matter",
    "for every lag feature later.",
    "",
    ...(tooShort.size === 0
      ? []
      : [
          `Series with fewer than ${MIN_DAYS_FOR_ALIGNMENT} overlapping days are listed below without a verdict. With`,
          "an overlap that short, the winning offset is decided by which dates each side happens to",
          "have been backfilled to, not by the data:",
          "",
          "| site | our source | days overlapping | note |",
          "|---|---|---|---|",
          ...[...tooShort.values()].map(
            (r) => `| ${r.site} | ${r.source} | ${r.compared} | not enough overlap to judge alignment |`,
          ),
          "",
        ]),
    "## All alignments tried",
    "",
    "| site | our source | offset | days | mean abs diff (m) |",
    "|---|---|---|---|---|",
    ...results
      .sort((a, b) => (a.site + a.source < b.site + b.source ? -1 : a.site + a.source > b.site + b.source ? 1 : a.offset_days - b.offset_days))
      .map((r) => `| ${r.site} | ${r.source} | ${r.offset_days >= 0 ? "+" : ""}${r.offset_days} d | ${r.compared} | ${r.mean_abs_diff_m} |`),
    "",
  ];

  for (const result of [...best.values()].filter((r) => r.worst.length > 0)) {
    lines.push(
      `## Days over ${NOTABLE_DIFF_M} m apart — ${result.site} (${result.source}, ${result.offset_days >= 0 ? "+" : ""}${result.offset_days} d)`,
      "",
      "| date | ours | theirs | diff |",
      "|---|---|---|---|",
      ...result.worst.map((d) => `| ${d.date} | ${d.ours} | ${d.theirs} | ${d.diff > 0 ? "+" : ""}${d.diff} |`),
      "",
    );
  }

  const directory = join(DATA_ROOT, "crosschecks");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "jordanvt18.md"), `${lines.join("\n")}\n`);
  writeFileSync(
    join(directory, "jordanvt18.json"),
    `${JSON.stringify({ generated_at: nowUtc(), mirror: MIRROR, notable_diff_m: NOTABLE_DIFF_M, results }, null, 2)}\n`,
  );
  console.log(lines.slice(0, 20).join("\n"));
  console.log(`\nwritten to ${directory}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
