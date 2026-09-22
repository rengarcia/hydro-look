/**
 * Scoring M4 against the rung it has to beat.
 *
 * The harness scores every rung the same way (`backtest.ts`); what follows is what the M4
 * decision needs on top of that — the model's own quantiles before widening, a paired
 * comparison with an honest interval, and the crisis check read at M4's resolution — and all of
 * it is computed from the harness's own predictions rather than from a second run.
 */

import { existsSync, readFileSync } from "node:fs";
import type { IsoDate } from "../util/dates.ts";
import { repoPath } from "../util/paths.ts";
import { pinballLoss, quantile } from "../util/stats.ts";
import type { ModelScore, Prediction } from "./backtest.ts";
import type { M4Settings } from "./boosted.ts";
import { seededRandom } from "./gbm.ts";

/**
 * Where a forecast read on the horizon grid puts a crossing of `thresholdM`: the first horizon
 * at which the chosen quantile is at or below it. M4 only forecasts at five horizons out to 90
 * days, so this is coarser than M3's day-by-day crossing distribution; M3 is read the same way
 * beside it so the two are compared at the same resolution.
 */
export function gridCrossings(
  predictions: readonly Prediction[],
  modelId: string,
  thresholdM: number,
  pick: (prediction: Prediction) => number | null,
): { origin: IsoDate; predictedCrossing: IsoDate | null }[] {
  const byOrigin = new Map<IsoDate, Prediction[]>();
  for (const p of predictions) {
    if (p.modelId !== modelId) continue;
    (byOrigin.get(p.origin) ?? byOrigin.set(p.origin, []).get(p.origin)!).push(p);
  }
  return [...byOrigin]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([origin, list]) => {
      const hit = [...list]
        .sort((a, b) => a.horizonDays - b.horizonDays)
        .find((p) => {
          const value = pick(p);
          return value !== null && value <= thresholdM;
        });
      return { origin, predictedCrossing: hit ? hit.targetDate : null };
    });
}

/**
 * A moving-block bootstrap of the mean of paired differences, over origins in date order.
 * Monthly origins with horizons up to ninety days overlap, so neighbouring differences are not
 * independent, and resampling them one at a time would draw an interval far too narrow to mean
 * anything. Blocks of `block` consecutive origins keep that dependence inside each draw.
 *
 * The blocks wrap around the end of the record (the circular block bootstrap). Without that the
 * first and last few origins are drawn less often than the rest, which biases the resampled mean
 * away from the observed one — and the last origins are the 2024 crisis, exactly the ones that
 * must not be under-weighted.
 */
export function pairedBlockBootstrap(
  differences: readonly number[],
  block: number,
  draws: number,
  seed: number,
): { mean: number; low: number; high: number } | null {
  const n = differences.length;
  if (n === 0) return null;
  const mean = differences.reduce((a, b) => a + b, 0) / n;
  const size = Math.max(1, Math.min(block, n));
  const random = seededRandom(seed);
  const means: number[] = [];
  for (let d = 0; d < draws; d++) {
    let total = 0;
    let taken = 0;
    while (taken < n) {
      const start = Math.floor(random() * n);
      for (let k = 0; k < size && taken < n; k++, taken++) total += differences[(start + k) % n]!;
    }
    means.push(total / n);
  }
  return { mean, low: quantile(means, 0.05)!, high: quantile(means, 0.95)! };
}

export interface NativeBandScore {
  horizonDays: number;
  /** Scored over the origins the harness gave a calibrated band, so it compares like for like. */
  n: number;
  coverage: number | null;
  pinballMeanM: number | null;
}

/** Coverage and pinball of a model's own p10/p50/p90, before the harness's residual widening. */
export function nativeBandScores(
  predictions: readonly Prediction[],
  modelId: string,
  horizons: readonly number[],
): NativeBandScore[] {
  return horizons.map((horizonDays) => {
    const list = predictions.filter(
      (p) =>
        p.modelId === modelId &&
        p.horizonDays === horizonDays &&
        p.p10 !== null &&
        p.ensembleP10 !== null &&
        p.ensembleP90 !== null,
    );
    if (list.length === 0) return { horizonDays, n: 0, coverage: null, pinballMeanM: null };
    const inside = list.filter((p) => p.actual >= p.ensembleP10! && p.actual <= p.ensembleP90!).length;
    const losses = list.flatMap((p) => [
      pinballLoss(p.actual, p.ensembleP10!, 0.1),
      pinballLoss(p.actual, p.p50, 0.5),
      pinballLoss(p.actual, p.ensembleP90!, 0.9),
    ]);
    return {
      horizonDays,
      n: list.length,
      coverage: inside / list.length,
      pinballMeanM: losses.reduce((a, b) => a + b, 0) / losses.length,
    };
  });
}

export interface PairedComparison {
  horizonDays: number;
  n: number;
  /** Mean of |error of the model| − |error of the reference|; negative means the model is closer. */
  maeDifferenceM: number;
  low90: number;
  high90: number;
  /** Share of origins where the model's error was the smaller. */
  winShare: number;
}

/** Six monthly origins per block spans a ninety-day forecast's overlap twice over. */
export const BOOTSTRAP_BLOCK_ORIGINS = 6;

export function pairedAgainst(
  predictions: readonly Prediction[],
  modelId: string,
  referenceId: string,
  horizons: readonly number[],
  seed = 7,
): PairedComparison[] {
  return horizons.flatMap((horizonDays) => {
    const reference = new Map(
      predictions.filter((p) => p.modelId === referenceId && p.horizonDays === horizonDays).map((p) => [p.origin, p]),
    );
    const pairs = predictions
      .filter((p) => p.modelId === modelId && p.horizonDays === horizonDays && reference.has(p.origin))
      .sort((a, b) => (a.origin < b.origin ? -1 : 1))
      .map((p) => Math.abs(p.actual - p.p50) - Math.abs(p.actual - reference.get(p.origin)!.p50));
    const interval = pairedBlockBootstrap(pairs, BOOTSTRAP_BLOCK_ORIGINS, 2000, seed);
    if (!interval) return [];
    return [
      {
        horizonDays,
        n: pairs.length,
        maeDifferenceM: interval.mean,
        low90: interval.low,
        high90: interval.high,
        winShare: pairs.filter((d) => d < 0).length / pairs.length,
      },
    ];
  });
}

/** One crisis episode as the M4 run saw it: each model's sustained call, read on the horizon grid. */
export interface GridCrisisEpisode {
  crossedOn: IsoDate;
  models: {
    modelId: string;
    p50CalledFrom: IsoDate | null;
    p50LeadDays: number | null;
    p10CalledFrom: IsoDate | null;
    p10LeadDays: number | null;
    /** The origins before the crossing, and where each quantile put it (null: not within 90 days). */
    runUp: { origin: IsoDate; p50: IsoDate | null; p10: IsoDate | null }[];
  }[];
}

/** Where `npm run backtest:m4` writes its snapshot and `npm run forecast` reads it. */
export const M4_SNAPSHOT_PATH = repoPath("data", "reports", "m4-backtest.json");

/**
 * The committed M4 snapshot, or null when there is none or it does not parse. A missing
 * snapshot is not an error: the report simply has no M4 section until the rung is run.
 */
export function readM4Snapshot(path: string = M4_SNAPSHOT_PATH): M4Snapshot | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<M4Snapshot>;
    if (!Array.isArray(parsed.origins) || !Array.isArray(parsed.scores) || !Array.isArray(parsed.horizonDays)) return null;
    return parsed as M4Snapshot;
  } catch {
    return null;
  }
}

/** Everything the report needs from an M4 run, committed so the daily forecast can render it without rerunning it. */
export interface M4Snapshot {
  generatedAt: string;
  runtimeSeconds: number;
  command: string;
  origins: IsoDate[];
  horizonDays: number[];
  settings: M4Settings;
  features: { base: string[]; m3: string[] };
  referenceId: string;
  scores: ModelScore[];
  native: { modelId: string; horizons: NativeBandScore[] }[];
  paired: { modelId: string; horizons: PairedComparison[] }[];
  crisis: {
    thresholdM: number;
    episodes: GridCrisisEpisode[];
    falseAlarms: { modelId: string; count: number }[];
    originsConsidered: number;
  };
  /** Largest |M4 residual anchor − shipped M3 median| over the origins: zero if the M3 feature is M3. */
  m3AnchorMaxAbsDifferenceM: number | null;
  /**
   * Each model's out-of-sample residual quantiles (actual − p50) per horizon over every scored
   * origin: the harness's own `calibration`, which is what a live forecast turns a median into a
   * band with — exactly as `forecast.json` bands M3. Absent from snapshots written before
   * 2026-09-22, which therefore cannot band a published M4 median.
   */
  calibration?: M4Calibration[];
}

export interface M4Calibration {
  modelId: string;
  horizons: { horizonDays: number; q10: number; q50: number; q90: number; n: number }[];
}

export interface M4Decision {
  modelId: string;
  horizonDays: number;
  maeM: number;
  referenceMaeM: number;
  beatsReferenceOnMae: boolean;
  /** Calibrated p10-p90 coverage no further from the nominal 80% than the reference's. */
  coverageNoWorse: boolean;
  /** The 90% block-bootstrap interval of the MAE difference lies wholly below zero. */
  intervalExcludesZero: boolean;
  wins: boolean;
}

/**
 * The ladder rule, applied: a horizon is won when the MAE is lower *and* the published band is
 * no worse calibrated. Whether the win is distinguishable from noise is reported beside it
 * rather than folded in, so a reader can see both.
 */
export function m4Decisions(snapshot: M4Snapshot): M4Decision[] {
  const reference = snapshot.scores.find((s) => s.modelId === snapshot.referenceId);
  const gap = (c: number | null) => (c === null ? Number.POSITIVE_INFINITY : Math.abs(c - 0.8));
  const out: M4Decision[] = [];
  for (const score of snapshot.scores) {
    if (!score.modelId.startsWith("M4")) continue;
    for (const h of score.horizons) {
      const ref = reference?.horizons.find((r) => r.horizonDays === h.horizonDays);
      if (!ref) continue;
      const paired = snapshot.paired
        .find((p) => p.modelId === score.modelId)
        ?.horizons.find((p) => p.horizonDays === h.horizonDays);
      const beats = h.maeM < ref.maeM;
      const coverageNoWorse = gap(h.coverageP10P90) <= gap(ref.coverageP10P90);
      out.push({
        modelId: score.modelId,
        horizonDays: h.horizonDays,
        maeM: h.maeM,
        referenceMaeM: ref.maeM,
        beatsReferenceOnMae: beats,
        coverageNoWorse,
        intervalExcludesZero: paired !== undefined && paired.high90 < 0,
        wins: beats && coverageNoWorse,
      });
    }
  }
  return out;
}
