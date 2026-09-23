#!/usr/bin/env node
/**
 * Section 7's M4 rung, run on the same backtest as the rest of the ladder.
 *
 *   npm run backtest:m4                    run it and write data/reports/m4-backtest.json
 *   npm run backtest:m4 -- --dry-run       run it and print; write nothing
 *   npm run backtest:m4 -- --last-origin 2019-06-01   a short run, for trying things (never written)
 *   npm run backtest:m4 -- --site <id>     another reservoir (default mazar; never written over Mazar's snapshot)
 *
 * Then `npm run forecast` renders the snapshot into `data/reports/backtest.md`.
 *
 * It is a separate command because it is the slow rung: three variants, five horizons and
 * three quantiles, refitted from scratch at each of 105 origins, is about 4,700 boosted models.
 * The CI dry-run and the daily forecast do not run it; they read the committed snapshot, and
 * the report says which run the M4 rows come from. Rerun it when the method or the data
 * changes enough to matter — the snapshot records its own origin set, and the report only
 * splices M4 into the ladder's tables when the two origin sets are identical.
 *
 * The snapshot is also what `npm run forecast` stands on when it publishes
 * `M4-gbm-m3-residual`'s median at seven days: the band comes from the residual quantiles
 * recorded here, and the switch falls back to M3 as soon as the ladder has an origin this
 * snapshot lacks — so rerun this at least monthly, after each new origin's week has passed.
 *
 * The precipitation features read whichever ERA5 point `selectPrecipBasin` chooses today — the
 * verified catchment centroid once its climatology is adequate, the provisional point until then
 * — and the snapshot records which (`precipBasin`), so the daily forecast can refuse a snapshot
 * scored on another basin rather than publish a model nobody backtested on this one.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadSeries } from "../src/lib/features/series.ts";
import { readOni } from "../src/lib/features/enso.ts";
import {
  MAZAR_PRECIP_BASIN,
  PLANT_PRECIP_BASIN,
  PROVISIONAL_PRECIP_BASIN,
  readEra5ByBasin,
  selectPrecipBasin,
} from "../src/lib/features/weather.ts";
import { persistence } from "../src/lib/models/baselines.ts";
import { createFitCache, DEFAULT_WATER_BALANCE, waterBalanceModel } from "../src/lib/models/water-balance.ts";
import { crisisEpisodes, crisisLeadTime, DEFAULT_BACKTEST, runBacktest } from "../src/lib/models/backtest.ts";
import { falseAlarms, type OriginCrossing } from "../src/lib/models/forecast.ts";
import { baseFeatures, boostedModel, createM4Cache, DEFAULT_M4, M3_FEATURES, M4_VARIANTS } from "../src/lib/models/boosted.ts";
import {
  gridCrossings,
  M4_SNAPSHOT_PATH,
  m4Decisions,
  nativeBandScores,
  pairedAgainst,
  type GridCrisisEpisode,
  type M4Snapshot,
} from "../src/lib/models/m4-scoring.ts";
import { PUBLISHED_M4_SITE } from "../src/lib/models/m4-live.ts";
import { criticalMarker, thresholdsFor } from "../src/lib/models/thresholds.ts";
import { isSiteId } from "../src/lib/registry.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

const VARIABLE = "cota_masl";

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      "last-origin": { type: "string" },
      out: { type: "string" },
      site: { type: "string" },
    },
  });
  const SITE = values.site?.trim() || PUBLISHED_M4_SITE;
  if (!isSiteId(SITE)) {
    console.error(`unknown site "${SITE}"`);
    process.exitCode = 1;
    return;
  }
  const started = performance.now();
  const lastOrigin = values["last-origin"]?.trim() || DEFAULT_BACKTEST.lastOrigin;
  // Mazar's snapshot is what the daily forecast stands on; another site's run is written only
  // where it is explicitly asked to go.
  const write =
    !(values["dry-run"] ?? false) && values["last-origin"] === undefined && (SITE === PUBLISHED_M4_SITE || values.out !== undefined);
  const outPath = values.out?.trim() || M4_SNAPSHOT_PATH;
  // The plan's critical marker (`thresholds.csv`, unverified), or the site's highest declared floor.
  const PLAN_CRITICAL_LEVEL = (criticalMarker(SITE) ?? thresholdsFor(SITE)[0])?.levelMasl ?? Number.NaN;

  const series = loadSeries();
  const levels = series.get(SITE, VARIABLE);
  const inflow = series.get(SITE, "caudal_m3s");
  const production = series.get(SITE, "produccion_mwh");
  const precip = selectPrecipBasin(readEra5ByBasin(), PLANT_PRECIP_BASIN[SITE] ?? MAZAR_PRECIP_BASIN, PROVISIONAL_PRECIP_BASIN);
  const covariates = { oni: readOni(), precip: precip.series, precipBasin: precip.basin };
  if (levels.size === 0) {
    console.error(`no ${VARIABLE} for ${SITE}`);
    process.exitCode = 1;
    return;
  }
  const crestM = Math.max(...levels.values());
  const fits = createFitCache();
  const shipped = waterBalanceModel(DEFAULT_WATER_BALANCE, undefined, fits);
  const cache = createM4Cache(fits);
  const variants = M4_VARIANTS.map((variant) => boostedModel(variant, covariates, cache));
  const options = { ...DEFAULT_BACKTEST, lastOrigin, crestM };

  console.log(
    `${SITE}: ${levels.size} level days; ERA5 precipitation at \`${precip.basin}\`: ${covariates.precip.size} days` +
      (precip.fallbackReason ? ` (${precip.fallbackReason})` : ""),
  );
  const run = runBacktest({ levels, inflow, production }, [persistence, shipped, ...variants], options);
  const runtimeSeconds = (performance.now() - started) / 1000;
  console.log(`M4 backtest: ${run.origins.length} origins in ${runtimeSeconds.toFixed(1)} s`);

  const H = options.horizonDays;
  for (const score of run.scores) {
    console.log(
      `  ${score.modelId.padEnd(22)}` +
        score.horizons
          .map(
            (h) =>
              `${h.horizonDays}d ${h.maeM.toFixed(2)}m ${h.skillVsPersistence === null ? "" : `(${(h.skillVsPersistence * 100).toFixed(1)}%)`}`,
          )
          .join("  "),
    );
  }

  // The residual variant is anchored on M3's own median, recomputed inside M4 from the training
  // cache; at the origins it has to be the shipped M3 to the last digit, or the feature is not M3.
  let m3AnchorMaxAbsDifferenceM: number | null = null;
  const m3ById = new Map(run.predictions.filter((p) => p.modelId === shipped.id).map((p) => [`${p.origin}|${p.horizonDays}`, p.p50]));
  for (const [key, m3] of m3ById) {
    const [origin, horizon] = key.split("|") as [string, string];
    const anchor = cache.m3.get(origin)?.byHorizon.get(Number(horizon))?.p50;
    if (anchor === undefined) continue;
    m3AnchorMaxAbsDifferenceM = Math.max(m3AnchorMaxAbsDifferenceM ?? 0, Math.abs(anchor - m3));
  }
  console.log(`M3 feature vs shipped M3 at the origins: max |difference| ${m3AnchorMaxAbsDifferenceM ?? "n/a"} m`);

  // The crisis check at M4's resolution: the first horizon whose quantile is at or below 2115.
  const crisisModels = [shipped.id, ...variants.map((v) => v.id)];
  const episodes = crisisEpisodes(levels, PLAN_CRITICAL_LEVEL).filter(
    (e) => e.crossedOn >= options.firstOrigin && run.origins.some((o) => o < e.crossedOn),
  );
  const calls = new Map(
    crisisModels.map((id) => [
      id,
      {
        p50: gridCrossings(run.predictions, id, PLAN_CRITICAL_LEVEL, (p) => p.p50),
        // The model's own dry tail: M3's ensemble p10, M4's p10 quantile regression.
        p10: gridCrossings(run.predictions, id, PLAN_CRITICAL_LEVEL, (p) => p.ensembleP10),
      },
    ]),
  );
  const crisisEpisodesOut: GridCrisisEpisode[] = episodes.map((episode) => ({
    crossedOn: episode.crossedOn,
    models: crisisModels.map((id) => {
      const { p50, p10 } = calls.get(id)!;
      const at50 = crisisLeadTime(episode, p50);
      const at10 = crisisLeadTime(episode, p10);
      const runUp = p50
        .filter((c) => c.origin < episode.crossedOn)
        .slice(-6)
        .map((c) => ({
          origin: c.origin,
          p50: c.predictedCrossing,
          p10: p10.find((d) => d.origin === c.origin)?.predictedCrossing ?? null,
        }));
      return {
        modelId: id,
        p50CalledFrom: at50.calledFrom,
        p50LeadDays: at50.leadTimeDays,
        p10CalledFrom: at10.calledFrom,
        p10LeadDays: at10.leadTimeDays,
        runUp,
      };
    }),
  }));
  const falseAlarmCounts = crisisModels.map((id) => {
    const asCrossings: OriginCrossing[] = calls.get(id)!.p50.map((c) => ({
      origin: c.origin,
      level: Number.NaN,
      analogueYears: 0,
      yearsThatCross: 0,
      p10: null,
      p50: c.predictedCrossing,
      p90: null,
    }));
    return { modelId: id, count: falseAlarms(asCrossings, levels, PLAN_CRITICAL_LEVEL).length };
  });
  for (const episode of crisisEpisodesOut) {
    for (const m of episode.models) {
      console.log(
        `crisis ${episode.crossedOn} ${m.modelId}: P50 ${m.p50LeadDays === null ? "never" : `${m.p50LeadDays}d`}, P10 ${m.p10LeadDays === null ? "never" : `${m.p10LeadDays}d`}`,
      );
    }
  }

  const snapshot: M4Snapshot = {
    generatedAt: nowUtc(),
    runtimeSeconds: Math.round(runtimeSeconds),
    command: "npm run backtest:m4",
    origins: run.origins,
    horizonDays: [...H],
    settings: DEFAULT_M4,
    features: { base: baseFeatures(precip.basin), m3: [...M3_FEATURES] },
    precipBasin: precip.basin,
    referenceId: shipped.id,
    scores: run.scores,
    native: [shipped.id, ...variants.map((v) => v.id)].map((id) => ({ modelId: id, horizons: nativeBandScores(run.predictions, id, H) })),
    paired: variants.map((v) => ({ modelId: v.id, horizons: pairedAgainst(run.predictions, v.id, shipped.id, H) })),
    crisis: {
      thresholdM: PLAN_CRITICAL_LEVEL,
      episodes: crisisEpisodesOut,
      falseAlarms: falseAlarmCounts,
      originsConsidered: calls.get(shipped.id)!.p50.length,
    },
    m3AnchorMaxAbsDifferenceM,
    // What the daily forecast bands a published M4 median with (see `m4-live.ts`): the same
    // residual quantiles the harness hands M3's live band, from this run's own origins.
    calibration: [...run.calibration].map(([modelId, perHorizon]) => ({
      modelId,
      horizons: [...perHorizon]
        .sort(([a], [b]) => a - b)
        .map(([horizonDays, c]) => ({ horizonDays, q10: c.q10, q50: c.q50, q90: c.q90, n: c.n })),
    })),
  };

  for (const decision of m4Decisions(snapshot)) {
    console.log(
      `  ${decision.modelId.padEnd(22)} ${String(decision.horizonDays).padStart(2)}d ` +
        `MAE ${decision.maeM.toFixed(3)} vs M3 ${decision.referenceMaeM.toFixed(3)}  ` +
        `${decision.wins ? "WINS" : "loses"}${decision.intervalExcludesZero ? " (interval excludes zero)" : ""}`,
    );
  }

  if (!write) {
    console.log("not written (dry run or partial window)");
    return;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(`wrote ${outPath}; run \`npm run forecast\` to render it into the report`);
}

main();
