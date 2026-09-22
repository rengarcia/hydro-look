/**
 * M4 in the daily forecast: `M4-gbm-m3-residual`'s median published at seven days, and nowhere
 * else.
 *
 * The M4 backtest (`npm run backtest:m4`, committed as `data/reports/m4-backtest.json`) found
 * one horizon where a rung beats M3 under the ladder's rule: seven days, where the residual
 * design's MAE is 2.03 m against M3's 2.29 m with a paired 90% interval wholly below zero, and
 * its band is no worse calibrated. At 14 and 30 days the gain is noise or costs the band; at 60
 * and 90 it loses by a metre. So the switch is by horizon: seven days publishes M4, everything
 * else — 14 to 90 days, the three named scenarios and days-to-threshold, which need a daily
 * simulated path M4 does not produce — stays M3.
 *
 * Three rules keep the published number the one that was scored.
 *
 * 1. **Same configuration.** The live fit uses `DEFAULT_M4` and the feature lists in
 *    `boosted.ts`; the switch is refused if the snapshot was produced with anything else, so a
 *    change to the learner's settings cannot publish a configuration nobody backtested.
 * 2. **Same band method.** The p10 and p90 are the live median plus the residual quantiles the
 *    harness measured for this model at this horizon over every scored origin — exactly how M3's
 *    band is made from the ladder's calibration, clamped the same way so it contains the median.
 * 3. **A current backtest.** The snapshot must have been scored on exactly the ladder's origins.
 *    Once the ladder gains a month the snapshot lacks, the evidence no longer covers the ladder
 *    and seven days falls back to M3 — saying so in `forecast.json` — until the M4 backtest is
 *    rerun. The same happens if a rerun no longer shows the win.
 *
 * Every feature at the live origin is read as the backtest read it: series cut at the origin,
 * ONI as it could have been read that day, ERA5 lagged five days (see `boosted.ts`).
 */

import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { truncate } from "./backtest.ts";
import {
  BASE_FEATURES,
  boostedModel,
  createM4Cache,
  DEFAULT_M4,
  M3_FEATURES,
  M4_VARIANTS,
  type Covariates,
  type M4Settings,
} from "./boosted.ts";
import { m4Decisions, type M4Snapshot } from "./m4-scoring.ts";
import type { FitCache } from "./water-balance.ts";
import type { HorizonSwitch } from "./forecast.ts";

/** The design and horizon the M4 backtest earned, and the only ones published. */
export const PUBLISHED_M4_ID = "M4-gbm-m3-residual";
export const PUBLISHED_M4_HORIZON = 7;

export interface M4Evidence {
  snapshotGeneratedAt: string;
  snapshotCommand: string;
  origins: number;
  referenceId: string;
  /** The scored numbers the published median rests on, at `PUBLISHED_M4_HORIZON`. */
  n: number;
  maeM: number;
  referenceMaeM: number;
  skillVsPersistence: number | null;
  coverageP10P90: number | null;
  referenceCoverageP10P90: number | null;
  /**
   * Coverage of the model's own quantile regressions before widening, over every scored origin —
   * the harness's `ensembleCoverage`, the column M3's analogue ensemble fills.
   */
  ownCoverageP10P90: number | null;
  paired: { maeDifferenceM: number; low90: number; high90: number; winShare: number } | null;
  /** Residual quantiles (actual − p50) over every scored origin: the band. */
  calibration: { q10: number; q50: number; q90: number; n: number };
}

export type M4SwitchCheck = { ok: true; evidence: M4Evidence } | { ok: false; reason: string };

function sameOrigins(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((origin, i) => origin === b[i]);
}

/**
 * Whether the committed snapshot still earns the seven-day switch against today's ladder.
 * Returns the evidence it rests on, or the reason it does not.
 */
export function m4SwitchCheck(
  snapshot: M4Snapshot | null,
  ladderOrigins: readonly IsoDate[],
  settings: M4Settings = DEFAULT_M4,
  modelId: string = PUBLISHED_M4_ID,
  horizon: number = PUBLISHED_M4_HORIZON,
): M4SwitchCheck {
  if (snapshot === null) return { ok: false, reason: "no committed M4 backtest snapshot" };
  if (!sameOrigins(snapshot.origins, ladderOrigins)) {
    return {
      ok: false,
      reason:
        `the M4 snapshot (${snapshot.generatedAt}) was scored on ${snapshot.origins.length} origins ending ` +
        `${snapshot.origins.at(-1) ?? "—"}; the ladder now has ${ladderOrigins.length} ending ${ladderOrigins.at(-1) ?? "—"}. ` +
        `Its backtest no longer covers the ladder; rerun \`${snapshot.command}\`.`,
    };
  }
  if (JSON.stringify(snapshot.settings) !== JSON.stringify(settings)) {
    return { ok: false, reason: "the M4 snapshot was produced with settings other than the ones this code would fit" };
  }
  if (
    JSON.stringify(snapshot.features?.base) !== JSON.stringify(BASE_FEATURES) ||
    JSON.stringify(snapshot.features?.m3) !== JSON.stringify(M3_FEATURES)
  ) {
    return { ok: false, reason: "the M4 snapshot was produced with a different feature set" };
  }
  const calibration = snapshot.calibration
    ?.find((c) => c.modelId === modelId)
    ?.horizons.find((h) => h.horizonDays === horizon);
  if (!calibration) {
    return { ok: false, reason: `the M4 snapshot records no residual calibration for ${modelId} at ${horizon} d` };
  }
  const decision = m4Decisions(snapshot).find((d) => d.modelId === modelId && d.horizonDays === horizon);
  if (!decision?.wins) {
    return {
      ok: false,
      reason: `in the M4 snapshot ${modelId} no longer beats ${snapshot.referenceId} at ${horizon} d under the ladder rule`,
    };
  }
  const score = snapshot.scores.find((s) => s.modelId === modelId)?.horizons.find((h) => h.horizonDays === horizon);
  const reference = snapshot.scores
    .find((s) => s.modelId === snapshot.referenceId)
    ?.horizons.find((h) => h.horizonDays === horizon);
  const paired = snapshot.paired.find((p) => p.modelId === modelId)?.horizons.find((h) => h.horizonDays === horizon);
  if (!score || !reference) return { ok: false, reason: `the M4 snapshot has no score for ${modelId} at ${horizon} d` };
  return {
    ok: true,
    evidence: {
      snapshotGeneratedAt: snapshot.generatedAt,
      snapshotCommand: snapshot.command,
      origins: snapshot.origins.length,
      referenceId: snapshot.referenceId,
      n: score.n,
      maeM: score.maeM,
      referenceMaeM: reference.maeM,
      skillVsPersistence: score.skillVsPersistence,
      coverageP10P90: score.coverageP10P90,
      referenceCoverageP10P90: reference.coverageP10P90,
      ownCoverageP10P90: score.ensembleCoverage,
      paired: paired
        ? { maeDifferenceM: paired.maeDifferenceM, low90: paired.low90, high90: paired.high90, winShare: paired.winShare }
        : null,
      calibration: { q10: calibration.q10, q50: calibration.q50, q90: calibration.q90, n: calibration.n },
    },
  };
}

export interface M4LiveInputs {
  origin: IsoDate;
  levels: DailySeries;
  inflow: DailySeries;
  production: DailySeries;
  covariates: Covariates;
  crestM: number;
  /** Shared with the ladder's M3 fits, so the monthly storage curves are fitted once. */
  fits?: FitCache;
}

export interface M4LiveForecast {
  horizonDays: number;
  p50: number;
  /** The model's own quantile regressions, before any widening: reported, never the band. */
  ownP10: number;
  ownP90: number;
  /** M3's median as the residual design anchors on it at this origin (`m3At` in `boosted.ts`). */
  anchorP50: number | null;
}

/**
 * The residual design fitted at the live origin for one horizon, exactly as the backtest fits
 * it at a monthly origin: training days whose outcome was observed by the origin, every
 * feature read at or before its day. Null when the model cannot be fitted there — no M3 anchor
 * for the origin's month, or too few training rows.
 */
export function fitM4Live(
  inputs: M4LiveInputs,
  horizon: number = PUBLISHED_M4_HORIZON,
  settings: M4Settings = DEFAULT_M4,
  modelId: string = PUBLISHED_M4_ID,
): M4LiveForecast | null {
  const variant = M4_VARIANTS.find((v) => v.id === modelId);
  if (!variant) return null;
  const cache = createM4Cache(inputs.fits);
  const model = boostedModel(variant, inputs.covariates, cache, settings);
  const [forecast] = model.forecast({
    origin: inputs.origin,
    horizonDays: [horizon],
    levels: truncate(inputs.levels, inputs.origin),
    inflow: truncate(inputs.inflow, inputs.origin),
    production: truncate(inputs.production, inputs.origin),
    crestM: inputs.crestM,
  });
  if (!forecast || !forecast.quantiles) return null;
  return {
    horizonDays: horizon,
    p50: forecast.p50,
    ownP10: forecast.quantiles.p10,
    ownP90: forecast.quantiles.p90,
    anchorP50: cache.m3.get(inputs.origin)?.byHorizon.get(horizon)?.p50 ?? null,
  };
}

/**
 * The published band around an M4 median: the median widened by the model's own out-of-sample
 * residual quantiles, clamped so it always contains the median — the rule `buildForecast`
 * applies to M3.
 */
export function bandFromResiduals(p50: number, calibration: { q10: number; q90: number }): { p10: number; p90: number } {
  return { p10: Math.min(p50 + calibration.q10, p50), p90: Math.max(p50 + calibration.q90, p50) };
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/**
 * `forecast.json`'s account of the seven-day switch, and the override itself when it is made.
 * The override carries everything a reader needs to weigh the number: the model, where its band
 * came from, the backtest it rests on, and (added by `buildForecast`) what M3 would have said.
 */
export function m4HorizonSwitch(
  evidence: M4Evidence | null,
  live: M4LiveForecast | null,
  fallback: string | null,
  shippedId: string,
): HorizonSwitch {
  const h = PUBLISHED_M4_HORIZON;
  const summary: Record<string, unknown> = {
    horizon_days: h,
    candidate_model: PUBLISHED_M4_ID,
    published_model: fallback === null ? PUBLISHED_M4_ID : shippedId,
    status: fallback === null ? "published" : "fallback",
    reason:
      fallback ??
      `${PUBLISHED_M4_ID} beats ${shippedId} at ${h} d under the ladder's rule (lower MAE, band no worse calibrated) ` +
        "in the committed M4 backtest, which covers exactly this run's ladder origins.",
    other_horizons_model: shippedId,
    scenarios_and_days_to_threshold_model: shippedId,
    snapshot: evidence
      ? { path: "data/reports/m4-backtest.json", generated_at: evidence.snapshotGeneratedAt, origins: evidence.origins, command: evidence.snapshotCommand }
      : null,
  };
  if (fallback !== null || !evidence || !live) return { overrides: [], summary };

  const band = bandFromResiduals(live.p50, evidence.calibration);
  return {
    summary,
    overrides: [
      {
        horizonDays: h,
        modelId: PUBLISHED_M4_ID,
        p10: band.p10,
        p50: live.p50,
        p90: band.p90,
        medianResidualM: evidence.calibration.q50,
        bandSource:
          `${PUBLISHED_M4_ID} out-of-sample residuals at ${h} d over ${evidence.calibration.n} origins of ` +
          `\`${evidence.snapshotCommand}\` (data/reports/m4-backtest.json, ${evidence.snapshotGeneratedAt}): ` +
          "median + the 10th and 90th percentile of actual − forecast, clamped to contain the median",
        backtest: {
          n: evidence.n,
          mae_m: evidence.maeM,
          skill_vs_persistence: evidence.skillVsPersistence,
          coverage_p10_p90: evidence.coverageP10P90,
          ensemble_coverage_p10_p90: evidence.ownCoverageP10P90,
        },
        detail: {
          backtest_skill: {
            source: "data/reports/m4-backtest.json",
            snapshot_generated_at: evidence.snapshotGeneratedAt,
            origins: evidence.origins,
            n: evidence.n,
            mae_m: round(evidence.maeM, 3),
            skill_vs_persistence: evidence.skillVsPersistence === null ? null : round(evidence.skillVsPersistence, 4),
            coverage_p10_p90: evidence.coverageP10P90 === null ? null : round(evidence.coverageP10P90, 4),
            reference_model: evidence.referenceId,
            reference_mae_m: round(evidence.referenceMaeM, 3),
            reference_coverage_p10_p90:
              evidence.referenceCoverageP10P90 === null ? null : round(evidence.referenceCoverageP10P90, 4),
            paired_mae_difference_m: evidence.paired ? round(evidence.paired.maeDifferenceM, 3) : null,
            paired_90_interval_m: evidence.paired ? [round(evidence.paired.low90, 3), round(evidence.paired.high90, 3)] : null,
          },
          own_quantiles: {
            p10: round(live.ownP10, 2),
            p90: round(live.ownP90, 2),
            note: "The model's own quantile regressions before widening; they cover too little to publish.",
          },
          m3_anchor_p50: live.anchorP50 === null ? null : round(live.anchorP50, 2),
          ensemble_note: `This row's \`ensemble\` is ${shippedId}'s analogue inflow years, which this model corrects; it is not this row's band.`,
        },
      },
    ],
  };
}
