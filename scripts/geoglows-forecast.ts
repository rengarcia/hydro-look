#!/usr/bin/env node
/**
 * Backtest GEOGLOWS' river forecast — the one INAMHI's Hydroviewer colours rivers by — against the
 * inflow CELEC measures at each dam. PLAN.md Phase 7, "forecast flow against the thresholds".
 *
 * GEOGLOWS archives every 00 UTC forecast since 2024-07-01 in the public `geoglows-v2-forecasts`
 * bucket, one Zarr store per day. Each origin's high-resolution member (hourly to ten days) is read
 * at the matched rivers by range request — about half a megabyte per river instead of a 15 MB
 * chunk — turned into daily means by lead, and scored with `src/lib/models/geoglows-forecast.ts`:
 * raw, scaled by the retrospective's volume bias fitted before the first origin, and relative to
 * the last measured day, each against persistence.
 *
 * Writes `data/reports/geoglows-forecast.{md,json}`. It publishes nothing: what, if anything, the
 * site shows from GEOGLOWS' forecast is decided by reading the report, in PLAN.md.
 *
 *   npm run geoglows:forecast                          # every 7th day from 2024-07-01
 *   npm run geoglows:forecast -- --from 2025-01-01 --step 3
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadSeries, type DailySeries } from "../src/lib/features/series.ts";
import { annualMaxima, compareFlows, gumbelReturnPeriods } from "../src/lib/geo/geoglows.ts";
import { forecastPositions, HIGH_RES_MEMBER, readForecastMember, readSimulated } from "../src/lib/geo/geoglows-stores.ts";
import {
  cases,
  dailyMeans,
  eventTable,
  LEADS,
  METHODS,
  scoreByLead,
  type Case,
  type ForecastRun,
  type LeadScore,
} from "../src/lib/models/geoglows-forecast.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { addDays, nowUtc, type IsoDate } from "../src/lib/util/dates.ts";
import { repoPath } from "../src/lib/util/paths.ts";

const FIRST_ARCHIVED: IsoDate = "2024-07-01";

interface SiteBacktest {
  site: string;
  riverId: number;
  /** Measured ÷ simulated mean flow before the first origin. */
  scale: number;
  scaleDays: number;
  scores: LeadScore[];
  events: {
    measuredTwoYear: number | null;
    geoglowsTwoYear: number;
    measured: ReturnType<typeof eventTable> | null;
    geoglows: ReturnType<typeof eventTable>;
  };
}

const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });

async function main(): Promise<void> {
  const startedAt = nowUtc();
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { from: { type: "string", default: FIRST_ARCHIVED }, to: { type: "string" }, step: { type: "string", default: "7" } },
  });
  const from = values.from;
  const step = Number(values.step);
  const reference = parseCsv(readFileSync(repoPath("data", "reference", "geoglows_return_periods.csv"), "utf8"));
  const series = loadSeries();
  const sites = reference.filter((r) => series.get(r["site"]!, "caudal_m3s").size > 0);
  const riverIds = sites.map((r) => Number(r["river_id"]));
  const lastObserved = sites
    .map((r) => [...series.get(r["site"]!, "caudal_m3s").keys()].at(-1)!)
    .sort()
    .at(-1)!;
  const to = values.to ?? lastObserved;
  const origins: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, step)) origins.push(d);
  console.log(`${sites.length} rivers, ${origins.length} origins ${origins[0]} → ${origins.at(-1)} every ${step} days`);

  // The volume correction is fitted on the retrospective before the first origin only.
  const simulated = await readSimulated(riverIds);
  const scales = new Map<string, { scale: number; days: number }>();
  for (const r of sites) {
    const measured = series.get(r["site"]!, "caudal_m3s");
    const before: DailySeries = new Map([...measured].filter(([d]) => d < from));
    const agreement = compareFlows(before, simulated.series.get(Number(r["river_id"]))!);
    scales.set(r["site"]!, agreement ? { scale: 1 / agreement.ratio, days: agreement.days } : { scale: 1, days: 0 });
  }

  const positions = await forecastPositions(origins.at(-1)!, riverIds);
  const runs = new Map<number, ForecastRun[]>(riverIds.map((id) => [id, []]));
  const missing: IsoDate[] = [];
  let bytes = 0;
  for (const [i, origin] of origins.entries()) {
    const got = await readForecastMember(origin, riverIds, positions);
    if (!got) {
      missing.push(origin);
      continue;
    }
    bytes += got.source.received();
    for (const id of riverIds) {
      runs.get(id)!.push({ origin, daily: dailyMeans(got.run.hours, got.run.values.get(id)!, Math.max(...LEADS)) });
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${origins.length} origins, ${(bytes / 1e6).toFixed(0)} MB`);
  }

  const results: SiteBacktest[] = [];
  const allCases: Record<string, Case[]> = {};
  for (const r of sites) {
    const site = r["site"]!;
    const riverId = Number(r["river_id"]);
    const measured = series.get(site, "caudal_m3s");
    const { scale, days } = scales.get(site)!;
    const cs = cases(runs.get(riverId)!, measured, scale);
    allCases[site] = cs;
    // The Hydroviewer's own threshold: INAMHI's fit, on the model's scale, like the raw forecast.
    const geoglowsTwoYear = Number(r["q2_inamhi_m3s"]);
    const measuredTwoYear = measuredQ2(measured);
    results.push({
      site,
      riverId,
      scale,
      scaleDays: days,
      scores: scoreByLead(cs),
      events: {
        measuredTwoYear,
        geoglowsTwoYear,
        measured: measuredTwoYear === null ? null : eventTable(cs, measuredTwoYear),
        geoglows: eventTable(cs, geoglowsTwoYear),
      },
    });
  }

  mkdirSync(repoPath("data", "reports"), { recursive: true });
  writeFileSync(repoPath("data", "reports", "geoglows-forecast.md"), `${report(startedAt, origins, step, missing, bytes, results)}\n`);
  writeFileSync(
    repoPath("data", "reports", "geoglows-forecast.json"),
    `${JSON.stringify({ startedAt, finishedAt: nowUtc(), from, to, step, member: HIGH_RES_MEMBER, missing, results, cases: allCases }, null, 1)}\n`,
  );
  console.log(`wrote data/reports/geoglows-forecast.{md,json}; ${(bytes / 1e6).toFixed(0)} MB read, ${missing.length} origins missing`);
}

function measuredQ2(measured: DailySeries): number | null {
  const maxima = annualMaxima(measured);
  return maxima.length >= 5
    ? gumbelReturnPeriods(
        maxima.map((m) => m.m3s),
        [2],
      )[0]!.m3s
    : null;
}

function report(startedAt: string, origins: IsoDate[], step: number, missing: IsoDate[], bytes: number, results: SiteBacktest[]): string {
  const lines: string[] = [
    "# GEOGLOWS' forecast against the measured inflow",
    "",
    `Generated by \`npm run geoglows:forecast\` (\`scripts/geoglows-forecast.ts\`), started ${startedAt}, finished ${nowUtc()}.`,
    `Origins: ${origins.length} (${origins[0]} → ${origins.at(-1)}, every ${step} days) from \`s3://geoglows-v2-forecasts\`, ` +
      `member ${HIGH_RES_MEMBER} (the high-resolution run, hourly to ten days); ${missing.length} not in the bucket` +
      `${missing.length ? ` (${missing.join(", ")})` : ""}. ${fmt(bytes / 1e6)} MB read.`,
    "",
    "Lead 1 is the forecast's own first UTC day, scored against that day's measured inflow; persistence is the measured",
    "inflow of the day before the origin — what CELEC's reports already say when the forecast is issued. **Scaled** multiplies",
    "the forecast by measured ÷ simulated mean flow, fitted on the retrospective simulation before the first origin; **relative**",
    "is the last measured day times the forecast's change from its first day. Skill is 1 − MAE ÷ persistence MAE: above zero",
    "beats persistence.",
    "",
    "## Mean absolute error (m³/s) and skill against persistence",
    "",
    `| site | lead | cases | ${METHODS.map((m) => `MAE ${m}`).join(" | ")} | skill raw | skill scaled | skill relative |`,
    `|---|---|---|${METHODS.map(() => "---").join("|")}|---|---|---|`,
  ];
  for (const r of results) {
    for (const s of r.scores) {
      lines.push(
        `| ${r.site} | ${s.lead} | ${s.n} | ${METHODS.map((m) => fmt(s.mae[m], 1)).join(" | ")} | ` +
          `${fmt(s.skill.raw, 2)} | ${fmt(s.skill.scaled, 2)} | ${fmt(s.skill.relative, 2)} |`,
      );
    }
  }
  lines.push(
    "",
    "## Floods on the scored days",
    "",
    "Cases (origin × lead) whose measured inflow reached the site's measured 2-year flood, and how each method did on them",
    "(hits / misses / false alarms). The last column counts the cases in which the raw forecast reached INAMHI's 2-year flow — the",
    "Hydroviewer's own threshold, on the model's scale — which is when the portal would have coloured the river.",
    "",
    "| site | scale | measured 2 y | cases reaching it | raw | scaled | relative | persistence | INAMHI 2 y | raw ≥ INAMHI 2 y |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const r of results) {
    const e = r.events.measured;
    const cell = (m: (typeof METHODS)[number]) =>
      e ? `${e.byMethod[m].hits} / ${e.byMethod[m].misses} / ${e.byMethod[m].falseAlarms}` : "—";
    const g = r.events.geoglows.byMethod.raw;
    lines.push(
      `| ${r.site} | ${fmt(r.scale, 2)} (${fmt(r.scaleDays)} days) | ${fmt(r.events.measuredTwoYear)} | ${e?.observedEvents ?? "—"} | ${cell("raw")} | ` +
        `${cell("scaled")} | ${cell("relative")} | ${cell("persistence")} | ${fmt(r.events.geoglowsTwoYear)} | ${g.hits + g.falseAlarms} of ${r.scores[0]!.n * LEADS.length} |`,
    );
  }
  return lines.map((l) => l.replace(/\s+$/, "")).join("\n");
}

await main();
