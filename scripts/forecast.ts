#!/usr/bin/env node
/**
 * Phase 5's command.
 *
 *   npm run forecast                     backtest, forecast, write everything
 *   npm run forecast -- --dry-run        compute and print; touch no file
 *   npm run forecast -- --api <path>     where forecast.json goes
 *   npm run forecast -- --report <path>  where the backtest report goes
 *   npm run forecast -- --no-variant     skip the ENSO comparison (about a third of the runtime)
 *
 * M4, the boosted-tree rung, is not backtested here: that takes minutes, so `npm run backtest:m4`
 * runs it and commits `data/reports/m4-backtest.json`, which this command renders into the
 * report. What this command does run is the one M4 design the backtest earned, at the live
 * origin and for seven days only: its median is published at that horizon, banded by the
 * residuals the snapshot recorded, and every other horizon stays M3. If the snapshot no longer
 * covers the ladder's origins, seven days falls back to M3 and `forecast.json` says why
 * (`src/lib/models/m4-live.ts`).
 *
 * The backtest always runs, because the published band *is* the backtest: the p10 and p90 are
 * the model's own out-of-sample residual quantiles at that horizon. There is no mode that
 * forecasts without measuring, which is deliberate — a band with nothing behind it would be
 * indistinguishable in the JSON from one that had been earned.
 *
 * Exit code is 1 if the forecast could not be produced, so the daily workflow can gate on it
 * without parsing the output.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadSeries } from "../src/lib/features/series.ts";
import { readOni, phaseAt } from "../src/lib/features/enso.ts";
import { readEra5Precip } from "../src/lib/features/weather.ts";
import { climatologicalDrift, persistence, seasonalAnomalyDecay } from "../src/lib/models/baselines.ts";
import {
  createFitCache,
  DEFAULT_WATER_BALANCE,
  waterBalanceModel,
} from "../src/lib/models/water-balance.ts";
import {
  crisisEpisodes,
  crisisLeadTime,
  DEFAULT_BACKTEST,
  monthlyOrigins,
  runBacktest,
} from "../src/lib/models/backtest.ts";
import {
  buildForecast,
  crossingCallsByOrigin,
  falseAlarms,
  type ThresholdRef,
} from "../src/lib/models/forecast.ts";
import { renderBacktestReport, type CrisisReport, type PublishedSwitch } from "../src/lib/models/report.ts";
import { readM4Snapshot } from "../src/lib/models/m4-scoring.ts";
import {
  fitM4Live,
  m4HorizonSwitch,
  m4SwitchCheck,
  PUBLISHED_M4_HORIZON,
  PUBLISHED_M4_ID,
  type M4LiveForecast,
} from "../src/lib/models/m4-live.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { FORECAST_RUNS, FORECAST_VALUES } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

const SITE = "mazar";
const VARIABLE = "cota_masl";

/**
 * The level section 7 calls critical. It is in the plan and nowhere else: `thresholds.csv`
 * carries 2098 from the dashboard's chart title and 2100 from both report endpoints, and no
 * upstream source publishes 2115 at all. It is forecast against because the plan asks for it,
 * and it is labelled `unverified` in the output so nobody downstream mistakes it for a CELEC
 * declaration.
 */
const PLAN_CRITICAL_LEVEL = 2115;

function readThresholds(): ThresholdRef[] {
  const path = join(DATA_REFERENCE, "thresholds.csv");
  const rows = existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
  const out: ThresholdRef[] = [
    {
      name: "critical (plan)",
      levelMasl: PLAN_CRITICAL_LEVEL,
      source: "PLAN.md section 7",
      status: "unverified",
      note: "No upstream source publishes this level; it is this project's own critical marker.",
    },
  ];

  const seen = new Set<number>([PLAN_CRITICAL_LEVEL]);
  for (const row of rows) {
    if ((row["site"] ?? "") !== SITE) continue;
    const level = Number(row["cota_min_masl"] ?? "");
    if (!Number.isFinite(level) || seen.has(level)) continue;
    seen.add(level);
    out.push({
      name: `declared minimum (${row["declaration"] ?? "unknown"})`,
      levelMasl: level,
      source: row["source"] ?? "",
      status: "published",
      note: `Observed ${row["observed_from"] ?? "?"} → ${row["observed_to"] ?? "?"}.`,
    });
  }
  return out.sort((a, b) => b.levelMasl - a.levelMasl);
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      "no-variant": { type: "boolean", default: false },
      api: { type: "string" },
      report: { type: "string" },
    },
  });

  const apiPath = values.api?.trim() || repoPath("public", "api", "forecast.json");
  const reportPath = values.report?.trim() || repoPath("data", "reports", "backtest.md");
  const dryRun = values["dry-run"] ?? false;

  const series = loadSeries();
  const levels = series.get(SITE, VARIABLE);
  const inflow = series.get(SITE, "caudal_m3s");
  const production = series.get(SITE, "produccion_mwh");
  if (levels.size === 0) {
    console.error(`no ${VARIABLE} for ${SITE}: nothing to forecast`);
    process.exitCode = 1;
    return;
  }

  const dates = [...levels.keys()];
  const crestM = Math.max(...levels.values());
  const cache = createFitCache();
  const shipped = waterBalanceModel(DEFAULT_WATER_BALANCE, undefined, cache);
  const options = { ...DEFAULT_BACKTEST, crestM };

  console.log(`${SITE}: ${levels.size} level days ${dates[0]} → ${dates.at(-1)}, crest ${crestM.toFixed(2)} m`);

  // The ladder, on its own shared origin set. The ENSO variant is scored separately below
  // because it declines about half the origins, and folding it in here would shrink the set
  // every other rung is judged on.
  const ladder = runBacktest({ levels, inflow, production }, [persistence, climatologicalDrift, seasonalAnomalyDecay, shipped], options);
  console.log(`ladder: ${ladder.origins.length} origins`);
  for (const score of ladder.scores) {
    console.log(
      `  ${score.modelId.padEnd(26)}` +
        score.horizons.map((h) => `${h.horizonDays}d ${h.maeM.toFixed(2)}m`).join("  "),
    );
  }

  let variant: { scores: ReturnType<typeof runBacktest>["scores"]; sharedOrigins: number } | null = null;
  if (!values["no-variant"]) {
    const oni = readOni();
    const matched = waterBalanceModel(
      DEFAULT_WATER_BALANCE,
      {
        idSuffix: "-enso",
        labelSuffix: ", analogue years matched on ENSO phase",
        accept: (startDate, origin) => {
          const analogue = phaseAt(oni, startDate);
          const here = phaseAt(oni, origin);
          return analogue !== null && here !== null && analogue === here;
        },
      },
      cache,
    );
    const run = runBacktest({ levels, inflow, production }, [shipped, matched], options);
    variant = { scores: run.scores, sharedOrigins: run.scores[0]?.horizons[0]?.n ?? 0 };
    console.log(`enso variant: scored on ${variant.sharedOrigins} shared origins`);
  }

  // Seven days: the M4 design the backtest earned, if its committed snapshot still covers the
  // ladder and was scored with the settings this code fits; otherwise M3, and the reason.
  const m4 = readM4Snapshot();
  if (m4) {
    const aligned = m4.origins.length === ladder.origins.length && m4.origins.every((o, i) => o === ladder.origins[i]);
    console.log(`M4 snapshot ${m4.generatedAt}: ${m4.origins.length} origins, ${aligned ? "aligned with" : "stale against"} the ladder`);
  }
  const check = m4SwitchCheck(m4, ladder.origins);
  let live: M4LiveForecast | null = null;
  let fallback: string | null = check.ok ? null : check.reason;
  if (check.ok) {
    const started = performance.now();
    live = fitM4Live({
      origin: dates.at(-1)!,
      levels,
      inflow,
      production,
      covariates: { oni: readOni(), precip: readEra5Precip() },
      crestM,
      fits: cache,
    });
    console.log(`${PUBLISHED_M4_ID} at ${PUBLISHED_M4_HORIZON} d fitted at the live origin in ${((performance.now() - started) / 1000).toFixed(1)} s`);
    if (!live) fallback = `${PUBLISHED_M4_ID} could not be fitted at the origin ${dates.at(-1)} (no M3 anchor or too few training rows)`;
  }
  if (fallback) console.log(`${PUBLISHED_M4_HORIZON} d falls back to ${shipped.id}: ${fallback}`);
  const horizonSwitch = m4HorizonSwitch(check.ok ? check.evidence : null, live, fallback, shipped.id);
  const published: PublishedSwitch = {
    published: fallback === null,
    modelId: PUBLISHED_M4_ID,
    horizonDays: PUBLISHED_M4_HORIZON,
    reason: fallback,
  };

  const thresholds = readThresholds();
  const forecast = buildForecast({
    series,
    site: SITE,
    variable: VARIABLE,
    horizonDays: DEFAULT_BACKTEST.horizonDays,
    thresholds,
    calibration: ladder.calibration,
    scores: ladder.scores,
    modelId: shipped.id,
    modelLabel: shipped.label,
    backtestOrigins: ladder.origins.length,
    horizonSwitch,
    cache,
  });
  if (!forecast) {
    console.error("the model could not be fitted on the committed data; nothing written");
    process.exitCode = 1;
    return;
  }

  // Section 7's crisis check, run against the plan's critical level.
  const origins = monthlyOrigins(levels, DEFAULT_BACKTEST.firstOrigin, DEFAULT_BACKTEST.lastOrigin);
  const calls = crossingCallsByOrigin(
    levels,
    inflow,
    production,
    origins,
    PLAN_CRITICAL_LEVEL,
    crestM,
    DEFAULT_WATER_BALANCE,
    cache,
  );
  const crisis: CrisisReport = {
    thresholdM: PLAN_CRITICAL_LEVEL,
    thresholdSource: "PLAN.md section 7; no upstream source publishes it",
    episodes: crisisEpisodes(levels, PLAN_CRITICAL_LEVEL).map((episode) => ({
      crossedOn: episode.crossedOn,
      p50: crisisLeadTime(episode, calls.map((c) => ({ origin: c.origin, predictedCrossing: c.p50 }))),
      p10: crisisLeadTime(episode, calls.map((c) => ({ origin: c.origin, predictedCrossing: c.p10 }))),
      // Six months of run-up is enough to show the model turning, without burying the table.
      runUp: calls.filter((c) => c.origin < episode.crossedOn).slice(-6),
    })),
    falseAlarms: falseAlarms(calls, levels, PLAN_CRITICAL_LEVEL).length,
    originsConsidered: calls.length,
  };
  for (const episode of crisis.episodes) {
    console.log(
      `crisis ${episode.crossedOn}: P50 ${episode.p50.calledFrom ? `${episode.p50.leadTimeDays}d lead` : "never called"}, ` +
        `P10 ${episode.p10.calledFrom ? `${episode.p10.leadTimeDays}d lead` : "never called"}`,
    );
  }
  console.log(`false alarms at P50: ${crisis.falseAlarms} of ${crisis.originsConsidered} origins`);

  const report = renderBacktestReport({
    generatedAt: nowUtc(),
    site: SITE,
    horizonDays: DEFAULT_BACKTEST.horizonDays,
    ladder: ladder.scores,
    shippedModelId: shipped.id,
    variant,
    crisis,
    fit: forecast.fit,
    crestM,
    levelRange: { first: dates[0]!, last: dates.at(-1)!, days: levels.size },
    m4: m4 ? { snapshot: m4, ladderOrigins: ladder.origins } : null,
    published,
  });

  const document = {
    ...forecast.document,
    crisis_check: {
      threshold_masl: crisis.thresholdM,
      threshold_source: crisis.thresholdSource,
      origins_considered: crisis.originsConsidered,
      false_alarms_p50: crisis.falseAlarms,
      episodes: crisis.episodes.map((episode) => ({
        crossed_on: episode.crossedOn,
        p50_called_from: episode.p50.calledFrom,
        p50_lead_time_days: episode.p50.leadTimeDays,
        p10_called_from: episode.p10.calledFrom,
        p10_lead_time_days: episode.p10.leadTimeDays,
      })),
    },
  };

  for (const horizon of [...forecast.valueRows].sort((a, b) => a.horizon_days - b.horizon_days)) {
    console.log(
      `  +${String(horizon.horizon_days).padStart(2)}d ${horizon.target_date}  ` +
        `p10 ${horizon.p10.toFixed(2)}  p50 ${horizon.p50.toFixed(2)}  p90 ${horizon.p90.toFixed(2)}  ${horizon.model_id ?? ""}`,
    );
  }
  const switched = (forecast.document["forecast"] as Record<string, unknown>[]).find((h) => h["would_have_published"]);
  if (switched) {
    const m3 = switched["would_have_published"] as { p10: number; p50: number; p90: number };
    console.log(`  (${shipped.id} would have published +${PUBLISHED_M4_HORIZON}d p10 ${m3.p10.toFixed(2)}  p50 ${m3.p50.toFixed(2)}  p90 ${m3.p90.toFixed(2)})`);
  }

  if (dryRun) {
    console.log(`dry run: would write ${apiPath} and ${reportPath}, and ${forecast.valueRows.length + 1} curated rows`);
    return;
  }

  const store = new CuratedStore();
  store.upsert(FORECAST_RUNS, [forecast.runRow]);
  store.upsert(FORECAST_VALUES, forecast.valueRows);

  for (const [path, body] of [
    [apiPath, `${JSON.stringify(document, null, 2)}\n`],
    [reportPath, report],
  ] as const) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    console.log(`wrote ${path}`);
  }
}

main();
