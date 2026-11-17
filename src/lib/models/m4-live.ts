/**
 * M4 in the daily forecast: one design's median published at the horizons the backtest earned
 * it, and nowhere else.
 *
 * The M4 backtest (`npm run backtest:m4`, committed as `data/reports/m4-backtest.json`) scores
 * three boosted designs and their blend with M3 against M3 at every ladder origin. The history
 * of what was published:
 *
 * - 2026-09-22: `M4-gbm-m3-residual` at seven days, which won on the provisional rain point.
 * - 2026-10-03: `M4-gbm-direct` at seven days, chosen by the owner on the verified centroid.
 * - 2026-10-13: back to M3 at seven days, once M3's years started from today's river.
 * - 2026-11-17: `M4-blend-m3-direct` — half M3's median, half `M4-gbm-direct`'s — wherever it
 *   meets the ladder's rule among seven, fourteen and thirty days. That date the ladder moved
 *   to weekly origins (462 of them), and on those the picture under a month is no longer a
 *   coin toss: the blend beats M3 at fourteen days by 0.29 m and at thirty by 0.25 m, both with
 *   the paired interval below zero and a band at least as near 80%. At seven days every boosted
 *   design is 0.26–0.30 m closer than M3, interval below zero, and its band is the sharper one
 *   by pinball loss — but its coverage sits two points further from 80% than M3's 79.8%, which
 *   is the rule's second clause, so seven days stays M3 until the owner says otherwise. At sixty
 *   and ninety days nothing boosted beats the water balance, and those are not candidates.
 *
 * So the switch is by horizon: each candidate horizon publishes the blend when the committed
 * snapshot says it wins there, and M3 when it does not — and everything that needs a daily
 * simulated path (sixty and ninety days, the three named scenarios, days-to-threshold) is M3.
 *
 * Three rules keep the published number the one that was scored.
 *
 * 1. **Same configuration.** The live fit uses `DEFAULT_M4` and the feature lists in
 *    `boosted.ts`; the switch is refused if the snapshot was produced with anything else, so a
 *    change to the learner's settings cannot publish a configuration nobody backtested.
 * 2. **Same band method.** The p10 and p90 are the live median plus the residual quantiles the
 *    harness measured for this model at this horizon over every scored origin — exactly how M3's
 *    band is made from the ladder's calibration, clamped the same way so it contains the median.
 * 3. **A current backtest.** The snapshot must have been scored on the ladder's own origins, and
 *    recently: its origins have to be the ladder's, in order, up to an origin no more than
 *    `M4_SNAPSHOT_MAX_LAG_DAYS` before the ladder's last. At monthly origins that was "exactly the
 *    ladder's origins", which let the evidence trail the ladder by up to a month between reruns;
 *    at weekly origins the same month of slack is stated in days, because a twenty-thousand-fit
 *    backtest every Monday would buy nothing a monthly one does not. Past that, seven days falls
 *    back to M3 — saying so in `forecast.json` — until the M4 backtest is rerun. The same happens
 *    if a rerun no longer shows the win: a run never picks another design by itself.
 *
 * Every feature at the live origin is read as the backtest read it: series cut at the origin,
 * ONI as it could have been read that day, ERA5 lagged five days (see `boosted.ts`).
 */

import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { truncate } from "./backtest.ts";
import {
  baseFeatures,
  boostedModel,
  createM4Cache,
  DEFAULT_M4,
  M3_FEATURES,
  M4_BLEND,
  M4_VARIANTS,
  type Covariates,
  type M4Settings,
} from "./boosted.ts";
import { m4Decisions, type M4Snapshot } from "./m4-scoring.ts";
import { DEFAULT_WATER_BALANCE, waterBalanceModel, type FitCache } from "./water-balance.ts";
import { quantile } from "../util/stats.ts";
import type { HorizonSwitch } from "./forecast.ts";
import { PROVISIONAL_PRECIP_BASIN } from "../features/weather.ts";

/** The design the daily run may publish, and the horizons at which the snapshot is asked whether it has earned it. */
export const PUBLISHED_M4_ID: string = M4_BLEND.id;
export const PUBLISHED_M4_HORIZONS: readonly number[] = [7, 14, 30];
/** The shortest candidate horizon: what `horizon_switch.horizon_days` has always named. */
export const PUBLISHED_M4_HORIZON = PUBLISHED_M4_HORIZONS[0]!;
/** The one site the M4 backtest was run on; no other site publishes it. */
export const PUBLISHED_M4_SITE = "mazar";

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

/**
 * How far the ladder may run ahead of the snapshot before the snapshot stops being evidence for
 * it: five weeks, which is the month a monthly ladder allowed plus the week a new origin waits
 * for its seven-day outcome.
 */
export const M4_SNAPSHOT_MAX_LAG_DAYS = 35;

export interface SnapshotCoverage {
  /** The snapshot's origins are the ladder's, in order, from the first. */
  prefix: boolean;
  /** Ladder origins the snapshot has not scored. */
  missing: number;
  /** Days from the snapshot's last origin to the ladder's; null when either is empty. */
  lagDays: number | null;
  /** A prefix, and no further behind than `M4_SNAPSHOT_MAX_LAG_DAYS`. */
  covers: boolean;
}

/** Whether a snapshot scored on `snapshotOrigins` still stands for a ladder scored on `ladderOrigins`. */
export function snapshotCoverage(
  snapshotOrigins: readonly string[],
  ladderOrigins: readonly string[],
  maxLagDays: number = M4_SNAPSHOT_MAX_LAG_DAYS,
): SnapshotCoverage {
  const prefix =
    snapshotOrigins.length > 0 &&
    snapshotOrigins.length <= ladderOrigins.length &&
    snapshotOrigins.every((origin, i) => origin === ladderOrigins[i]);
  const last = snapshotOrigins.at(-1);
  const ladderLast = ladderOrigins.at(-1);
  const lagDays =
    last === undefined || ladderLast === undefined
      ? null
      : Math.round((Date.parse(`${ladderLast}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000);
  return {
    prefix,
    missing: Math.max(0, ladderOrigins.length - snapshotOrigins.length),
    lagDays,
    covers: prefix && lagDays !== null && lagDays <= maxLagDays,
  };
}

/**
 * Whether the committed snapshot still earns the switch at one horizon against today's ladder.
 * Returns the evidence it rests on, or the reason it does not.
 */
export function m4SwitchCheck(
  snapshot: M4Snapshot | null,
  ladderOrigins: readonly IsoDate[],
  settings: M4Settings = DEFAULT_M4,
  modelId: string = PUBLISHED_M4_ID,
  horizon: number = PUBLISHED_M4_HORIZON,
  precipBasin: string = PROVISIONAL_PRECIP_BASIN,
): M4SwitchCheck {
  if (snapshot === null) return { ok: false, reason: "no committed M4 backtest snapshot" };
  if (!snapshotCoverage(snapshot.origins, ladderOrigins).covers) {
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
  const scoredOn = snapshot.precipBasin ?? PROVISIONAL_PRECIP_BASIN;
  if (scoredOn !== precipBasin && JSON.stringify(snapshot.features?.base) === JSON.stringify(baseFeatures(scoredOn))) {
    // The one feature change the daily workflow repairs by itself (§1.1): the precipitation
    // basin moved once the verified centroid's ERA5 history became adequate. The wording keeps
    // the phrase `model-and-push.sh` looks for, so the M4 backtest is rerun on the new basin.
    return {
      ok: false,
      reason:
        `the M4 snapshot (${snapshot.generatedAt}) read ERA5 at \`${scoredOn}\`; the forecast now reads \`${precipBasin}\`, ` +
        `so its backtest no longer covers the ladder's inputs; rerun \`${snapshot.command}\`.`,
    };
  }
  if (
    JSON.stringify(snapshot.features?.base) !== JSON.stringify(baseFeatures(precipBasin)) ||
    JSON.stringify(snapshot.features?.m3) !== JSON.stringify(M3_FEATURES)
  ) {
    return { ok: false, reason: "the M4 snapshot was produced with a different feature set" };
  }
  const calibration = snapshot.calibration?.find((c) => c.modelId === modelId)?.horizons.find((h) => h.horizonDays === horizon);
  if (!calibration) {
    return { ok: false, reason: `the M4 snapshot records no residual calibration for ${modelId} at ${horizon} d` };
  }
  const decision = m4Decisions(snapshot).find((d) => d.modelId === modelId && d.horizonDays === horizon);
  if (!decision?.wins) {
    // Which clause of the rule it failed, so the fallback reads as a measurement and not a mystery.
    const mine = snapshot.scores.find((sc) => sc.modelId === modelId)?.horizons.find((h) => h.horizonDays === horizon);
    const ref = snapshot.scores.find((sc) => sc.modelId === snapshot.referenceId)?.horizons.find((h) => h.horizonDays === horizon);
    const share = (c: number | null | undefined) => (c === null || c === undefined ? "—" : `${(c * 100).toFixed(1)}%`);
    const clause = !decision
      ? ""
      : decision.beatsReferenceOnMae
        ? ` (its MAE is lower, ${decision.maeM.toFixed(2)} m against ${decision.referenceMaeM.toFixed(2)} m, but its band covers ` +
          `${share(mine?.coverageP10P90)} against ${share(ref?.coverageP10P90)}, further from the nominal 80%)`
        : ` (MAE ${decision.maeM.toFixed(2)} m against ${decision.referenceMaeM.toFixed(2)} m)`;
    return {
      ok: false,
      reason: `in the M4 snapshot ${modelId} does not beat ${snapshot.referenceId} at ${horizon} d under the ladder rule${clause}`,
    };
  }
  const score = snapshot.scores.find((s) => s.modelId === modelId)?.horizons.find((h) => h.horizonDays === horizon);
  const reference = snapshot.scores.find((s) => s.modelId === snapshot.referenceId)?.horizons.find((h) => h.horizonDays === horizon);
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
  /**
   * M3's median as a design that reads M3 sees it at this origin (`m3At` in `boosted.ts`), or
   * the shipped M3's own median for the blend, which is half made of it; null for
   * `M4-gbm-direct`, which does not read M3. What M3 itself would have published is kept beside
   * the row by `buildForecast` either way.
   */
  anchorP50: number | null;
}

/**
 * One design at the live origin for one horizon, exactly as the backtest makes it at one of its
 * origins — a fitted design from training days whose outcome was observed by the origin, every
 * feature read at or before its day. Null when the model cannot be fitted there — too few
 * training rows, or, for a design that reads M3, no M3 anchor for the origin's month.
 */
export function fitM4Live(
  inputs: M4LiveInputs,
  horizon: number = PUBLISHED_M4_HORIZON,
  settings: M4Settings = DEFAULT_M4,
  modelId: string = PUBLISHED_M4_ID,
): M4LiveForecast | null {
  if (modelId === M4_BLEND.id) return blendLive(inputs, horizon, settings);
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
 * The blend at the live origin, as `blendPredictions` makes it at a backtest origin: the fitted
 * design's median and the shipped M3's, weighted as `M4_BLEND` says, and the same mean of the
 * trees' own quantiles and the analogue ensemble's. Null when either half cannot forecast.
 */
function blendLive(inputs: M4LiveInputs, horizon: number, settings: M4Settings): M4LiveForecast | null {
  const fitted = fitM4Live(inputs, horizon, settings, M4_BLEND.of);
  const [m3] = waterBalanceModel(DEFAULT_WATER_BALANCE, undefined, inputs.fits).forecast({
    origin: inputs.origin,
    horizonDays: [horizon],
    levels: truncate(inputs.levels, inputs.origin),
    inflow: truncate(inputs.inflow, inputs.origin),
    production: truncate(inputs.production, inputs.origin),
    crestM: inputs.crestM,
  });
  if (!fitted || !m3) return null;
  const ensemble = [...m3.ensemble];
  const m3P10 = quantile(ensemble, 0.1);
  const m3P90 = quantile(ensemble, 0.9);
  if (m3P10 === null || m3P90 === null) return null;
  const mix = (a: number, b: number) => (1 - M4_BLEND.weight) * a + M4_BLEND.weight * b;
  return {
    horizonDays: horizon,
    p50: mix(m3.p50, fitted.p50),
    ownP10: mix(m3P10, fitted.ownP10),
    ownP90: mix(m3P90, fitted.ownP90),
    anchorP50: m3.p50,
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

/** One candidate horizon as the daily run found it. */
export interface M4Candidate {
  horizonDays: number;
  evidence: M4Evidence | null;
  live: M4LiveForecast | null;
  /** Why this horizon publishes the shipped model instead; null when it publishes the candidate. */
  fallback: string | null;
}

/**
 * `forecast.json`'s account of the switch, and the overrides themselves where it is made.
 * Each override carries everything a reader needs to weigh the number: the model, where its band
 * came from, the backtest it rests on, and (added by `buildForecast`) what M3 would have said.
 *
 * The summary keeps the keys it has had since 2026-09-22 — `horizon_days`, `status`, `reason`,
 * `published_model` — and since 2026-11-17, when more than one horizon became a candidate, adds
 * `candidate_horizons`, `published_horizons` and one entry per candidate under `horizons`.
 * `status` is `published` when any candidate horizon publishes the candidate, and `fallback`
 * when none does; `horizon_days` is the shortest candidate, as it always was.
 */
export function m4HorizonSwitch(
  candidates: readonly M4Candidate[],
  shippedId: string,
  precip: { basin: string; fallbackReason: string | null } | null = null,
  modelId: string = PUBLISHED_M4_ID,
): HorizonSwitch {
  const made = candidates.filter((c) => c.fallback === null && c.evidence !== null && c.live !== null);
  const refused = candidates.filter((c) => !made.includes(c));
  const days = (list: readonly M4Candidate[]) => list.map((c) => c.horizonDays).join(", ");
  const why = (c: M4Candidate) => c.fallback ?? `${modelId} could not be fitted at the live origin`;
  const earned =
    `${modelId} beats ${shippedId} at ${days(made)} d under the ladder's rule (lower MAE, band no worse calibrated) ` +
    "in the committed M4 backtest, which covers this run's ladder origins.";
  const sameReason = refused.length > 0 && refused.every((c) => why(c) === why(refused[0]!));
  const refusal = sameReason ? why(refused[0]!) : refused.map((c) => `${c.horizonDays} d: ${why(c)}`).join("; ");
  const evidence = candidates.find((c) => c.evidence !== null)?.evidence ?? null;
  const summary: Record<string, unknown> = {
    horizon_days: candidates[0]?.horizonDays ?? PUBLISHED_M4_HORIZON,
    candidate_model: modelId,
    candidate_horizons: candidates.map((c) => c.horizonDays),
    published_horizons: made.map((c) => c.horizonDays),
    published_model: made.length > 0 ? modelId : shippedId,
    status: made.length > 0 ? "published" : "fallback",
    reason: made.length === 0 ? refusal : refused.length === 0 ? earned : `${earned} Not at ${days(refused)} d: ${refusal}`,
    horizons: candidates.map((c) => ({
      horizon_days: c.horizonDays,
      published_model: made.includes(c) ? modelId : shippedId,
      status: made.includes(c) ? "published" : "fallback",
      reason: made.includes(c) ? null : why(c),
    })),
    other_horizons_model: shippedId,
    scenarios_and_days_to_threshold_model: shippedId,
    snapshot: evidence
      ? {
          path: "data/reports/m4-backtest.json",
          generated_at: evidence.snapshotGeneratedAt,
          origins: evidence.origins,
          command: evidence.snapshotCommand,
        }
      : null,
    // Which ERA5 point the precipitation features read (§1.1), and why not the verified centroid
    // if not. Part of the summary so it is part of `features_hash`: the switch is a new run.
    ...(precip ? { precip_basin: precip.basin, precip_basin_fallback_reason: precip.fallbackReason } : {}),
  };

  return {
    summary,
    overrides: made.map((c) => {
      const h = c.horizonDays;
      const live = c.live!;
      const ev = c.evidence!;
      const band = bandFromResiduals(live.p50, ev.calibration);
      return {
        horizonDays: h,
        modelId,
        p10: band.p10,
        p50: live.p50,
        p90: band.p90,
        medianResidualM: ev.calibration.q50,
        bandSource:
          `${modelId} out-of-sample residuals at ${h} d over ${ev.calibration.n} origins of ` +
          `\`${ev.snapshotCommand}\` (data/reports/m4-backtest.json, ${ev.snapshotGeneratedAt}): ` +
          "median + the 10th and 90th percentile of actual − forecast, clamped to contain the median",
        backtest: {
          n: ev.n,
          mae_m: ev.maeM,
          skill_vs_persistence: ev.skillVsPersistence,
          coverage_p10_p90: ev.coverageP10P90,
          ensemble_coverage_p10_p90: ev.ownCoverageP10P90,
        },
        detail: {
          backtest_skill: {
            source: "data/reports/m4-backtest.json",
            snapshot_generated_at: ev.snapshotGeneratedAt,
            origins: ev.origins,
            n: ev.n,
            mae_m: round(ev.maeM, 3),
            skill_vs_persistence: ev.skillVsPersistence === null ? null : round(ev.skillVsPersistence, 4),
            coverage_p10_p90: ev.coverageP10P90 === null ? null : round(ev.coverageP10P90, 4),
            reference_model: ev.referenceId,
            reference_mae_m: round(ev.referenceMaeM, 3),
            reference_coverage_p10_p90: ev.referenceCoverageP10P90 === null ? null : round(ev.referenceCoverageP10P90, 4),
            paired_mae_difference_m: ev.paired ? round(ev.paired.maeDifferenceM, 3) : null,
            paired_90_interval_m: ev.paired ? [round(ev.paired.low90, 3), round(ev.paired.high90, 3)] : null,
          },
          own_quantiles: {
            p10: round(live.ownP10, 2),
            p90: round(live.ownP90, 2),
            note: "The model's own quantiles before widening; they cover too little to publish.",
          },
          m3_anchor_p50: live.anchorP50 === null ? null : round(live.anchorP50, 2),
          ensemble_note: `This row's \`ensemble\` is ${shippedId}'s analogue inflow years, kept for reference; it is not this row's band.`,
        },
      };
    }),
  };
}
