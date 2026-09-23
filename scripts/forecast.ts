#!/usr/bin/env node
/**
 * Phase 5's command.
 *
 *   npm run forecast                     backtest, forecast, write everything
 *   npm run forecast -- --dry-run        compute and print; touch no file
 *   npm run forecast -- --site <id>      the reservoir whose level is forecast (default mazar)
 *   npm run forecast -- --api <path>     where forecast.json goes
 *   npm run forecast -- --report <path>  where the backtest report goes
 *   npm run forecast -- --no-variant     skip the ENSO comparison and the experiments below
 *
 * M4, the boosted-tree rung, is not backtested here: that takes minutes, so `npm run backtest:m4`
 * runs it and commits `data/reports/m4-backtest.json`, which this command renders into the
 * report. What this command does run is the one M4 design the backtest earned, at the live
 * origin and for seven days only: its median is published at that horizon, banded by the
 * residuals the snapshot recorded, and every other horizon stays M3. If the snapshot no longer
 * covers the ladder's origins, seven days falls back to M3 and `forecast.json` says why
 * (`src/lib/models/m4-live.ts`). M4 was backtested on Mazar only, so no other site uses it.
 *
 * The backtest always runs, because the published band *is* the backtest: the p10 and p90 are
 * the model's own out-of-sample residual quantiles at that horizon. There is no mode that
 * forecasts without measuring, which is deliberate — a band with nothing behind it would be
 * indistinguishable in the JSON from one that had been earned.
 *
 * Besides the level, the Mazar run publishes two blocks from the same tables: `inflow_forecasts`
 * for the six plants whose level is not worth forecasting (§5.3, `data/reports/inflow.md`), and
 * `scorecard`, how every earlier published run did once its horizon passed (§5.1). The
 * experiments the report records (§5.4's rain upper bound, §5.7's shared ensemble members) are
 * rerun each time on the ladder's own origins, so a negative that turns positive once the data
 * changes — the verified catchment centroids' ERA5, above all — is seen the day it does.
 *
 * Exit code is 1 if the forecast could not be produced, so the daily workflow can gate on it
 * without parsing the output.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadSeries } from "../src/lib/features/series.ts";
import { readOni, phaseAt } from "../src/lib/features/enso.ts";
import {
  MAZAR_PRECIP_BASIN,
  PLANT_PRECIP_BASIN,
  PROVISIONAL_PRECIP_BASIN,
  readEra5ByBasin,
  selectPrecipBasin,
} from "../src/lib/features/weather.ts";
import { climatologicalDrift, persistence, seasonalAnomalyDecay } from "../src/lib/models/baselines.ts";
import { createFitCache, DEFAULT_WATER_BALANCE, waterBalanceModel } from "../src/lib/models/water-balance.ts";
import {
  crisisEpisodes,
  crisisLeadTime,
  DEFAULT_BACKTEST,
  monthlyOrigins,
  runBacktest,
  type ModelScore,
} from "../src/lib/models/backtest.ts";
import { buildForecast, crossingCallsByOrigin, falseAlarms } from "../src/lib/models/forecast.ts";
import {
  renderBacktestReport,
  scoreTable,
  type CrisisReport,
  type ExperimentSection,
  type PublishedSwitch,
} from "../src/lib/models/report.ts";
import { readM4Snapshot } from "../src/lib/models/m4-scoring.ts";
import {
  fitM4Live,
  m4HorizonSwitch,
  m4SwitchCheck,
  PUBLISHED_M4_HORIZON,
  PUBLISHED_M4_ID,
  PUBLISHED_M4_SITE,
  type M4LiveForecast,
} from "../src/lib/models/m4-live.ts";
import { DEFAULT_M4 } from "../src/lib/models/boosted.ts";
import { perfectForesightRain, RAIN_WINDOW_DAYS } from "../src/lib/models/rain.ts";
import { backtestInflow, inflowEntry, INFLOW_PLANTS } from "../src/lib/models/inflow.ts";
import { renderInflowReport } from "../src/lib/models/inflow-report.ts";
import { criticalMarker, thresholdsFor } from "../src/lib/models/thresholds.ts";
import { readCuratedTable, scorecardBlock, scoreLevelForecasts } from "../src/lib/models/scorecard.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { FORECAST_RUNS, FORECAST_VALUES } from "../src/lib/contracts/tables.ts";
import { isSiteId } from "../src/lib/registry.ts";
import { repoPath } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";
import { publicJson } from "../src/lib/publish/contract.ts";

const DEFAULT_SITE = "mazar";
const VARIABLE = "cota_masl";

/**
 * A candidate against the shipped model on one backtest: better only if its MAE is lower at
 * every horizon and its band no further from the nominal 80% anywhere — the ladder's rule.
 */
function comparison(scores: readonly ModelScore[], shippedId: string, candidateId: string): { better: boolean; worseAt: number[] } {
  const shipped = scores.find((s) => s.modelId === shippedId);
  const candidate = scores.find((s) => s.modelId === candidateId);
  if (!shipped || !candidate) return { better: false, worseAt: [] };
  const worseAt: number[] = [];
  for (const h of candidate.horizons) {
    const ref = shipped.horizons.find((r) => r.horizonDays === h.horizonDays);
    if (!ref) continue;
    const bandWorse =
      h.coverageP10P90 !== null &&
      ref.coverageP10P90 !== null &&
      Math.abs(h.coverageP10P90 - 0.8) > Math.abs(ref.coverageP10P90 - 0.8) + 1e-9;
    if (!(h.maeM < ref.maeM) || bandWorse) worseAt.push(h.horizonDays);
  }
  return { better: worseAt.length === 0, worseAt };
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      "no-variant": { type: "boolean", default: false },
      site: { type: "string" },
      api: { type: "string" },
      report: { type: "string" },
    },
  });

  const site = values.site?.trim() || DEFAULT_SITE;
  if (!isSiteId(site)) {
    console.error(`unknown site "${site}"`);
    process.exitCode = 1;
    return;
  }
  // Mazar's documents keep the names every consumer already reads; another site gets its own.
  const primary = site === DEFAULT_SITE;
  const apiPath = values.api?.trim() || repoPath("public", "api", primary ? "forecast.json" : `forecast-${site}.json`);
  const reportPath = values.report?.trim() || repoPath("data", "reports", primary ? "backtest.md" : `backtest-${site}.md`);
  const inflowReportPath = repoPath("data", "reports", "inflow.md");
  const dryRun = values["dry-run"] ?? false;
  const generatedAt = nowUtc();

  const series = loadSeries();
  const levels = series.get(site, VARIABLE);
  const inflow = series.get(site, "caudal_m3s");
  const production = series.get(site, "produccion_mwh");
  if (levels.size === 0 || inflow.size === 0 || production.size === 0) {
    console.error(
      `${site} needs ${VARIABLE}, caudal_m3s and produccion_mwh under its own id to be forecast; it has ${levels.size}, ${inflow.size} and ${production.size} days`,
    );
    process.exitCode = 1;
    return;
  }

  const dates = [...levels.keys()];
  const crestM = Math.max(...levels.values());
  const cache = createFitCache();
  const shipped = waterBalanceModel(DEFAULT_WATER_BALANCE, undefined, cache);
  const options = { ...DEFAULT_BACKTEST, crestM };
  const inputs = { levels, inflow, production };

  // §1.1: rain at the verified catchment centroid once its ERA5 climatology is adequate, at the
  // provisional point until then. Decided from the table on every run.
  const era5 = readEra5ByBasin();
  const precip = selectPrecipBasin(era5, PLANT_PRECIP_BASIN[site] ?? MAZAR_PRECIP_BASIN, PROVISIONAL_PRECIP_BASIN);

  console.log(`${site}: ${levels.size} level days ${dates[0]} → ${dates.at(-1)}, crest ${crestM.toFixed(2)} m`);
  console.log(
    `precipitation: ${precip.basin}, ${precip.series.size} ERA5 days` +
      (precip.fallbackReason ? ` (not the verified centroid — ${precip.fallbackReason})` : " (verified catchment centroid)"),
  );

  // The ladder, on its own shared origin set. The ENSO variant is scored separately below
  // because it declines about half the origins, and folding it in here would shrink the set
  // every other rung is judged on.
  const ladder = runBacktest(inputs, [persistence, climatologicalDrift, seasonalAnomalyDecay, shipped], options);
  console.log(`ladder: ${ladder.origins.length} origins`);
  for (const score of ladder.scores) {
    console.log(`  ${score.modelId.padEnd(26)}` + score.horizons.map((h) => `${h.horizonDays}d ${h.maeM.toFixed(2)}m`).join("  "));
  }

  let variant: { scores: ReturnType<typeof runBacktest>["scores"]; sharedOrigins: number } | null = null;
  const experiments: ExperimentSection[] = [];
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
    const run = runBacktest(inputs, [shipped, matched], options);
    variant = { scores: run.scores, sharedOrigins: run.scores[0]?.horizons[0]?.n ?? 0 };
    console.log(`enso variant: scored on ${variant.sharedOrigins} shared origins`);

    experiments.push(rainExperiment(inputs, options, shipped, cache, precip));
    experiments.push(sharedMembersExperiment(inputs, options, shipped, cache));
  }

  // Seven days: the M4 design the backtest earned, if its committed snapshot still covers the
  // ladder, was scored with the settings this code fits and read rain where the forecast now
  // reads it; otherwise M3, and the reason. Only for the site M4 was backtested on.
  const m4 = site === PUBLISHED_M4_SITE ? readM4Snapshot() : null;
  if (m4) {
    const aligned = m4.origins.length === ladder.origins.length && m4.origins.every((o, i) => o === ladder.origins[i]);
    console.log(`M4 snapshot ${m4.generatedAt}: ${m4.origins.length} origins, ${aligned ? "aligned with" : "stale against"} the ladder`);
  }
  const check =
    site === PUBLISHED_M4_SITE
      ? m4SwitchCheck(m4, ladder.origins, DEFAULT_M4, PUBLISHED_M4_ID, PUBLISHED_M4_HORIZON, precip.basin)
      : ({ ok: false, reason: `M4 was backtested on ${PUBLISHED_M4_SITE} only` } as const);
  let live: M4LiveForecast | null = null;
  let fallback: string | null = check.ok ? null : check.reason;
  if (check.ok) {
    const started = performance.now();
    live = fitM4Live({
      origin: dates.at(-1)!,
      levels,
      inflow,
      production,
      covariates: { oni: readOni(), precip: precip.series, precipBasin: precip.basin },
      crestM,
      fits: cache,
    });
    console.log(
      `${PUBLISHED_M4_ID} at ${PUBLISHED_M4_HORIZON} d fitted at the live origin in ${((performance.now() - started) / 1000).toFixed(1)} s`,
    );
    if (!live) fallback = `${PUBLISHED_M4_ID} could not be fitted at the origin ${dates.at(-1)} (no M3 anchor or too few training rows)`;
  }
  if (fallback) console.log(`${PUBLISHED_M4_HORIZON} d falls back to ${shipped.id}: ${fallback}`);
  const horizonSwitch = m4HorizonSwitch(check.ok ? check.evidence : null, live, fallback, shipped.id, {
    basin: precip.basin,
    fallbackReason: precip.fallbackReason,
  });
  const published: PublishedSwitch = {
    published: fallback === null,
    modelId: PUBLISHED_M4_ID,
    horizonDays: PUBLISHED_M4_HORIZON,
    reason: fallback,
  };

  const thresholds = thresholdsFor(site);
  const forecast = buildForecast({
    series,
    site,
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

  // Section 7's crisis check, run against the plan's critical level — the unverified marker in
  // `thresholds.csv` — or, for a site with no marker, its highest declared floor.
  const critical = criticalMarker(site) ?? thresholds[0] ?? null;
  if (critical === null) {
    console.error(`${site} has no row in thresholds.csv to run the crisis check against; nothing written`);
    process.exitCode = 1;
    return;
  }
  const origins = monthlyOrigins(levels, DEFAULT_BACKTEST.firstOrigin, DEFAULT_BACKTEST.lastOrigin);
  const calls = crossingCallsByOrigin(levels, inflow, production, origins, critical.levelMasl, crestM, DEFAULT_WATER_BALANCE, cache);
  const crisis: CrisisReport = {
    thresholdM: critical.levelMasl,
    thresholdSource: critical.status === "unverified" ? `${critical.source}; no upstream source publishes it` : critical.source,
    episodes: crisisEpisodes(levels, critical.levelMasl).map((episode) => ({
      crossedOn: episode.crossedOn,
      p50: crisisLeadTime(
        episode,
        calls.map((c) => ({ origin: c.origin, predictedCrossing: c.p50 })),
      ),
      p10: crisisLeadTime(
        episode,
        calls.map((c) => ({ origin: c.origin, predictedCrossing: c.p10 })),
      ),
      // Six months of run-up is enough to show the model turning, without burying the table.
      runUp: calls.filter((c) => c.origin < episode.crossedOn).slice(-6),
    })),
    falseAlarms: falseAlarms(calls, levels, critical.levelMasl).length,
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
    generatedAt,
    site,
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
    experiments,
  });

  // §5.3, from the Mazar run only: one document, one report, whichever site's level is asked for.
  let inflowBlock: Record<string, unknown> | null = null;
  let inflowReport: string | null = null;
  if (primary) {
    const backtests = [];
    const entries = [];
    const precipUsed = [];
    for (const plant of INFLOW_PLANTS) {
      const plantInflow = series.get(plant, "caudal_m3s");
      if (plantInflow.size === 0) continue;
      const choice = selectPrecipBasin(era5, PLANT_PRECIP_BASIN[plant] ?? "", "");
      const plantPrecip = choice.preferred ? choice.series : null;
      const backtest = backtestInflow(plant, plantInflow, undefined, plantPrecip);
      backtests.push(backtest);
      entries.push(inflowEntry(backtest, plantInflow, choice.preferred ? choice.basin : null, plantPrecip));
      precipUsed.push({ site: plant, basin: PLANT_PRECIP_BASIN[plant] ?? "—", used: choice.preferred, reason: choice.fallbackReason });
      console.log(
        `inflow ${plant}: ${backtest.origins} origins; ` +
          backtest.decisions.map((d) => `${d.horizonDays}d ${d.ships ? "ships" : "no"}`).join(", "),
      );
    }
    inflowBlock = {
      report: "data/reports/inflow.md",
      note:
        "Caudal medio de entrada en los próximos días, por central, donde el pronóstico por años análogos supera a la " +
        "persistencia y a la climatología en el backtest; en las demás se indica por qué no se publica.",
      plants: entries,
    };
    inflowReport = renderInflowReport({ generatedAt, backtests, precip: precipUsed });
  }

  const document: Record<string, unknown> = {
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
    precipitation_basin: {
      basin: precip.basin,
      verified_centroid: precip.preferred,
      era5_days: precip.series.size,
      share_since_1990: Number(precip.coverage.share.toFixed(4)),
      fallback_reason: precip.fallbackReason,
    },
    ...(inflowBlock ? { inflow_forecasts: inflowBlock } : {}),
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
    console.log(
      `  (${shipped.id} would have published +${PUBLISHED_M4_HORIZON}d p10 ${m3.p10.toFixed(2)}  p50 ${m3.p50.toFixed(2)}  p90 ${m3.p90.toFixed(2)})`,
    );
  }

  if (dryRun) {
    console.log(
      `dry run: would write ${apiPath} and ${reportPath}${inflowReport ? ` and ${inflowReportPath}` : ""}, ` +
        `and ${forecast.valueRows.length + 1} curated rows`,
    );
    return;
  }

  const store = new CuratedStore();
  store.upsert(FORECAST_RUNS, [forecast.runRow]);
  store.upsert(FORECAST_VALUES, forecast.valueRows);

  // §5.1, read back from the tables this run has just written to, so today's rows count as pending.
  const scorecard = scoreLevelForecasts(
    readCuratedTable(FORECAST_RUNS.name).filter((r) => r["site"] === site),
    readCuratedTable(FORECAST_VALUES.name),
    (s) => series.get(s, VARIABLE),
  );
  document["scorecard"] = scorecardBlock(scorecard, generatedAt);

  const outputs: [string, string][] = [
    [apiPath, publicJson("forecast", document)],
    [reportPath, report],
  ];
  if (inflowReport) outputs.push([inflowReportPath, inflowReport]);
  for (const [path, body] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    console.log(`wrote ${path}`);
  }
}

type Inputs = Parameters<typeof runBacktest>[0];
type Options = Parameters<typeof runBacktest>[2];

/**
 * §5.4's upper bound: the analogue years nearest the rain that actually fell over the next
 * sixteen days. If perfect knowledge of the rain does not improve the level forecast, a forecast
 * of the rain will not, and nothing is wired.
 */
function rainExperiment(
  inputs: Inputs,
  options: Options,
  shipped: ReturnType<typeof waterBalanceModel>,
  cache: ReturnType<typeof createFitCache>,
  precip: ReturnType<typeof selectPrecipBasin>,
): ExperimentSection {
  const candidate = waterBalanceModel(DEFAULT_WATER_BALANCE, perfectForesightRain(precip.series, precip.basin), cache);
  const run = runBacktest(inputs, [persistence, shipped, candidate], options);
  const verdict = comparison(run.scores, shipped.id, candidate.id);
  const at = (id: string, h: number) => run.scores.find((s) => s.modelId === id)?.horizons.find((x) => x.horizonDays === h);
  const shipped14 = at(shipped.id, 14);
  const candidate14 = at(candidate.id, 14);
  console.log(
    `rain experiment (${precip.basin}, perfect foresight): 14 d MAE ${candidate14?.maeM.toFixed(3)} vs ${shipped14?.maeM.toFixed(3)} — ` +
      (verdict.better ? "better at every horizon" : `not better at ${verdict.worseAt.join(", ")} d`),
  );
  const helps14 = candidate14 !== undefined && shipped14 !== undefined && candidate14.maeM < shipped14.maeM;
  return {
    heading: `Does knowing the next ${RAIN_WINDOW_DAYS} days of rain help? (§5.4, perfect foresight)`,
    body: [
      `The upper bound first. At each origin the analogue pool is narrowed to the half of the years whose ERA5 rain over ` +
        `the ${RAIN_WINDOW_DAYS} days after the same calendar day was nearest the rain that *actually fell* after the origin, at ` +
        `\`${precip.basin}\` (${precip.preferred ? "the verified catchment centroid" : `the provisional point; ${precip.fallbackReason}`}). ` +
        "No forecaster has that; it is the most a rain forecast could ever be worth to this model. Same origins as the ladder:",
      scoreTable(run.scores, options.horizonDays, (h) => `${h.maeM.toFixed(3)} (${((h.skillVsPersistence ?? 0) * 100).toFixed(1)}%)`),
      "MAE in metres, skill against persistence in brackets. Coverage of the calibrated p10–p90 band:",
      scoreTable(run.scores.slice(1), options.horizonDays, (h) =>
        h.coverageP10P90 === null ? "—" : `${(h.coverageP10P90 * 100).toFixed(1)}%`,
      ),
      helps14
        ? `**Perfect foresight helps at 14 days** (${candidate14.maeM.toFixed(3)} m against ${shipped14.maeM.toFixed(3)} m). The next step is ` +
          "to replay Open-Meteo's previous-runs archive for the real forecast's skill before anything is published; nothing is wired until then."
        : `**Negative: even perfect foresight of the rain does not improve the 14-day level** (${candidate14?.maeM.toFixed(3) ?? "—"} m against ` +
          `${shipped14?.maeM.toFixed(3) ?? "—"} m${verdict.worseAt.length > 0 ? `; worse at ${verdict.worseAt.join(", ")} d` : ""}). Narrowing a pool of ` +
          "about fifteen years to the half with the nearest rain costs more in ensemble size than one point's rain buys in " +
          "information, so the experiment stops here and the 16-day forecast stays unwired. It reruns every day, so the answer " +
          "on the verified centroid will appear here the first run after its ERA5 backfill.",
      "Scheduling note for when it does help: `covariates.yml` collects the forecast at 17:00 UTC, after both daily runs, so a " +
        "model would read yesterday's vintage. The forecast fetch would have to move ahead of the 12:15 run, or into it.",
    ],
  };
}

/**
 * §5.7's other half. The ensemble is now simulated once per analogue year and read at every
 * horizon, which changed no number; reading every horizon off only the years that reach ninety
 * days would also make the horizons share members. Whether that is better is a measurement.
 */
function sharedMembersExperiment(
  inputs: Inputs,
  options: Options,
  shipped: ReturnType<typeof waterBalanceModel>,
  cache: ReturnType<typeof createFitCache>,
): ExperimentSection {
  const candidate = waterBalanceModel(
    DEFAULT_WATER_BALANCE,
    { idSuffix: "-shared-members", labelSuffix: ", every horizon read off the years that reach 90 days", sharedMembers: true },
    cache,
  );
  const run = runBacktest(inputs, [shipped, candidate], options);
  const verdict = comparison(run.scores, shipped.id, candidate.id);
  console.log(`shared-members experiment: ${verdict.better ? "better at every horizon" : `not better at ${verdict.worseAt.join(", ")} d`}`);
  return {
    heading: "Should every horizon share one ensemble? (§5.7)",
    body: [
      "Each analogue year is simulated once and read at every horizon it reaches, which is what the shipped model does and " +
        "changed no published number. Sharing members outright means reading every horizon off only the years whose inflow " +
        "record reaches ninety days, so a 7-day fan and a 90-day fan are the same years. Same origins:",
      scoreTable(run.scores, options.horizonDays, (h) => h.maeM.toFixed(3)),
      "MAE in metres. Coverage of the calibrated band:",
      scoreTable(run.scores, options.horizonDays, (h) => (h.coverageP10P90 === null ? "—" : `${(h.coverageP10P90 * 100).toFixed(1)}%`)),
      verdict.better
        ? "**Shared members are better at every horizon** and should replace the per-horizon pool, with the M4 backtest rerun (its M3 anchor changes)."
        : `**Negative: not better at ${verdict.worseAt.join(", ")} d**, and the ladder's rule asks for every horizon. The shipped ` +
          "model keeps every year a horizon can use; dropping the years whose record stops short of ninety days takes members " +
          "from the short horizons, and whatever it gains elsewhere is not enough to pay for that everywhere.",
    ],
  };
}

main();
