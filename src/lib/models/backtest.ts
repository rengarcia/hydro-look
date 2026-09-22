/**
 * Rolling-origin backtest — the thing that decides which rung of section 7's ladder ships.
 *
 * Three rules hold the whole exercise up, and each of them is here because breaking it produces
 * a number that looks better and means nothing.
 *
 * 1. **A model sees only its own past.** Every origin hands the models a series truncated at
 *    that origin, so the hypsometry, the rule curve, the seasonal climatology and M2's decay
 *    are all refitted from scratch on data a forecaster standing there would have had.
 *    Refitting rather than fitting once costs about nothing in score — the water balance's
 *    skill at ninety days moves from 34.6% to 34.2% — and that near-identity is itself the
 *    evidence that the curve is a property of the reservoir and not of the sample.
 * 2. **The band is calibrated out of sample too.** Quantiles come from the spread of this
 *    model's *own past errors at this horizon*, over origins strictly earlier than the one
 *    being scored. An expanding window, never the whole record.
 * 3. **Models are compared on the same origins.** A rung that quietly declines the hard months
 *    — too few analogue years, too little training history — would win by not playing. Scoring
 *    runs on the intersection: an origin counts only if every model produced a forecast there.
 *
 * Reported per model and horizon: MAE and RMSE, pinball loss at each published quantile,
 * observed coverage of the p10-p90 band, bias, and skill against persistence. The ensemble's
 * own coverage is reported next to the calibrated one because the gap between them is the
 * finding: an ensemble over analogue inflow years alone covers about half of what it should,
 * since inflow is not the only thing a reservoir forecast can be wrong about.
 */

import { addDays } from "../util/dates.ts";
import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { mean, pinballLoss, quantile } from "../util/stats.ts";
import type { ForecastContext, Model } from "./types.ts";

export const PUBLISHED_QUANTILES = [0.1, 0.5, 0.9] as const;

export interface BacktestOptions {
  firstOrigin: IsoDate;
  lastOrigin: IsoDate;
  horizonDays: readonly number[];
  /** Days of level history a model must have before an origin is used at all. */
  minTrainingDays: number;
  /** Earlier origins needed before a horizon's band can be calibrated from residuals. */
  minCalibrationOrigins: number;
  crestM: number;
}

export const DEFAULT_BACKTEST: Omit<BacktestOptions, "crestM"> = {
  // Section 7: monthly origins from 2018-01, which puts the 2018, 2020, 2022, 2023 and 2024
  // lows inside the evaluation window and leaves 2014-09 onward as training history.
  firstOrigin: "2018-01-01",
  lastOrigin: "2099-12-01",
  horizonDays: [7, 14, 30, 60, 90],
  minTrainingDays: 730,
  minCalibrationOrigins: 12,
};

export interface Prediction {
  modelId: string;
  origin: IsoDate;
  horizonDays: number;
  targetDate: IsoDate;
  actual: number;
  p50: number;
  /** Spread of the model's own ensemble, before calibration. Null for a point model. */
  ensembleP10: number | null;
  ensembleP90: number | null;
  /** Calibrated band; null until enough earlier origins exist to calibrate from. */
  p10: number | null;
  p90: number | null;
}

export interface HorizonScore {
  horizonDays: number;
  n: number;
  maeM: number;
  rmseM: number;
  biasM: number;
  skillVsPersistence: number | null;
  /** Origins with a calibrated band; the rest are warm-up. */
  nBand: number;
  pinballMeanM: number | null;
  coverageP10P90: number | null;
  /** What the model's own ensemble covered, uncalibrated. */
  ensembleCoverage: number | null;
  meanBandWidthM: number | null;
}

export interface ModelScore {
  modelId: string;
  label: string;
  horizons: HorizonScore[];
}

/** Residual quantiles per horizon, which is what a live forecast turns a p50 into a band with. */
export type Calibration = Map<string, Map<number, { q10: number; q50: number; q90: number; n: number }>>;

export interface BacktestResult {
  origins: IsoDate[];
  predictions: Prediction[];
  scores: ModelScore[];
  calibration: Calibration;
}

/** A copy of `series` holding nothing after `through`, so look-ahead is impossible, not merely avoided. */
export function truncate(series: DailySeries, through: IsoDate): DailySeries {
  const out: DailySeries = new Map();
  for (const [date, value] of series) {
    if (date > through) break;
    out.set(date, value);
  }
  return out;
}

/** First of each month that the level series actually covers. */
export function monthlyOrigins(levels: DailySeries, from: IsoDate, to: IsoDate): IsoDate[] {
  return [...levels.keys()].filter((date) => date.endsWith("-01") && date >= from && date <= to);
}

interface Inputs {
  levels: DailySeries;
  inflow: DailySeries;
  production: DailySeries;
}

export function runBacktest(inputs: Inputs, models: readonly Model[], options: BacktestOptions): BacktestResult {
  const allDates = [...inputs.levels.keys()];
  const first = allDates[0];
  if (first === undefined) return { origins: [], predictions: [], scores: [], calibration: new Map() };

  const last = allDates[allDates.length - 1]!;
  // How many level days precede each date, walked once: doing it per candidate re-scans the
  // whole series for every origin and turns a linear pass into a quadratic one.
  const precedingDays = new Map<IsoDate, number>();
  allDates.forEach((date, index) => precedingDays.set(date, index));
  const candidates = monthlyOrigins(inputs.levels, options.firstOrigin, options.lastOrigin).filter(
    (origin) => (precedingDays.get(origin) ?? 0) >= options.minTrainingDays,
  );

  // Pass one: every model at every origin, points only. Nothing is scored yet, because a band
  // needs residuals and residuals need earlier origins.
  const raw = new Map<string, Prediction[]>();
  const usedOrigins: IsoDate[] = [];

  for (const origin of candidates) {
    const context: Omit<ForecastContext, "horizonDays"> = {
      origin,
      levels: truncate(inputs.levels, origin),
      inflow: truncate(inputs.inflow, origin),
      production: truncate(inputs.production, origin),
      crestM: options.crestM,
    };
    // A horizon only counts if the day it lands on was actually observed.
    const horizons = options.horizonDays.filter((h) => inputs.levels.has(addDays(origin, h)) && addDays(origin, h) <= last);
    if (horizons.length === 0) continue;

    let produced = false;
    for (const model of models) {
      const forecasts = model.forecast({ ...context, horizonDays: horizons });
      const list = raw.get(model.id) ?? raw.set(model.id, []).get(model.id)!;
      for (const forecast of forecasts) {
        const actual = inputs.levels.get(forecast.targetDate);
        if (actual === undefined) continue;
        const ensemble = [...forecast.ensemble];
        list.push({
          modelId: model.id,
          origin,
          horizonDays: forecast.horizonDays,
          targetDate: forecast.targetDate,
          actual,
          p50: forecast.p50,
          ensembleP10: ensemble.length > 0 ? quantile(ensemble, 0.1) : null,
          ensembleP90: ensemble.length > 0 ? quantile(ensemble, 0.9) : null,
          p10: null,
          p90: null,
        });
        produced = true;
      }
    }
    if (produced) usedOrigins.push(origin);
  }

  // Rule 3: score on the origins every model reached, at each horizon, so nobody wins by
  // sitting out the months that were hard to forecast.
  const common = new Map<number, Set<IsoDate>>();
  for (const horizon of options.horizonDays) {
    let shared: Set<IsoDate> | undefined;
    for (const model of models) {
      const here = new Set<IsoDate>(
        (raw.get(model.id) ?? []).filter((p) => p.horizonDays === horizon).map((p) => p.origin),
      );
      if (shared === undefined) shared = here;
      else shared = new Set<IsoDate>([...shared].filter((origin) => here.has(origin)));
    }
    common.set(horizon, shared ?? new Set<IsoDate>());
  }

  // Pass two: calibrate each prediction from the residuals of strictly earlier origins.
  const predictions: Prediction[] = [];
  const calibration: Calibration = new Map();

  for (const model of models) {
    const byHorizon = new Map<number, Prediction[]>();
    for (const prediction of raw.get(model.id) ?? []) {
      if (!common.get(prediction.horizonDays)?.has(prediction.origin)) continue;
      (byHorizon.get(prediction.horizonDays) ?? byHorizon.set(prediction.horizonDays, []).get(prediction.horizonDays)!).push(prediction);
    }

    const perHorizon = new Map<number, { q10: number; q50: number; q90: number; n: number }>();
    for (const [horizon, list] of byHorizon) {
      list.sort((a, b) => (a.origin < b.origin ? -1 : 1));
      const residuals: number[] = [];
      for (const prediction of list) {
        if (residuals.length >= options.minCalibrationOrigins) {
          prediction.p10 = prediction.p50 + (quantile(residuals, 0.1) ?? 0);
          prediction.p90 = prediction.p50 + (quantile(residuals, 0.9) ?? 0);
        }
        // Only now does this origin's outcome join the pool the next origin will use.
        residuals.push(prediction.actual - prediction.p50);
        predictions.push(prediction);
      }
      perHorizon.set(horizon, {
        q10: quantile(residuals, 0.1) ?? 0,
        q50: quantile(residuals, 0.5) ?? 0,
        q90: quantile(residuals, 0.9) ?? 0,
        n: residuals.length,
      });
    }
    calibration.set(model.id, perHorizon);
  }

  return {
    origins: usedOrigins,
    predictions,
    scores: scoreAll(predictions, models, options.horizonDays),
    calibration,
  };
}

const PERSISTENCE_ID = "M0-persistence";

export function scoreAll(
  predictions: readonly Prediction[],
  models: readonly Model[],
  horizonDays: readonly number[],
): ModelScore[] {
  const baseline = new Map<number, number>();
  for (const horizon of horizonDays) {
    const errors = predictions
      .filter((p) => p.modelId === PERSISTENCE_ID && p.horizonDays === horizon)
      .map((p) => Math.abs(p.actual - p.p50));
    const value = mean(errors);
    if (value !== null) baseline.set(horizon, value);
  }

  return models.map((model) => ({
    modelId: model.id,
    label: model.label,
    horizons: horizonDays.flatMap((horizon) => {
      const list = predictions.filter((p) => p.modelId === model.id && p.horizonDays === horizon);
      if (list.length === 0) return [];
      const errors = list.map((p) => p.actual - p.p50);
      const banded = list.filter((p) => p.p10 !== null && p.p90 !== null);
      const withEnsemble = list.filter((p) => p.ensembleP10 !== null && p.ensembleP90 !== null);
      const maeM = mean(errors.map(Math.abs))!;
      const persistenceMae = baseline.get(horizon);

      return [
        {
          horizonDays: horizon,
          n: list.length,
          maeM,
          rmseM: Math.sqrt(mean(errors.map((e) => e * e))!),
          biasM: mean(errors)!,
          skillVsPersistence: persistenceMae !== undefined && persistenceMae > 0 ? 1 - maeM / persistenceMae : null,
          nBand: banded.length,
          pinballMeanM:
            banded.length === 0
              ? null
              : mean(
                  banded.flatMap((p) => [
                    pinballLoss(p.actual, p.p10!, 0.1),
                    pinballLoss(p.actual, p.p50, 0.5),
                    pinballLoss(p.actual, p.p90!, 0.9),
                  ]),
                ),
          coverageP10P90:
            banded.length === 0
              ? null
              : banded.filter((p) => p.actual >= p.p10! && p.actual <= p.p90!).length / banded.length,
          ensembleCoverage:
            withEnsemble.length === 0
              ? null
              : withEnsemble.filter((p) => p.actual >= p.ensembleP10! && p.actual <= p.ensembleP90!).length /
                withEnsemble.length,
          meanBandWidthM: banded.length === 0 ? null : mean(banded.map((p) => p.p90! - p.p10!)),
        },
      ];
    }),
  }));
}

export interface CrisisEpisode {
  /** First day the level was at or below the threshold. */
  crossedOn: IsoDate;
  thresholdM: number;
}

export interface CrisisCall {
  episode: CrisisEpisode;
  /** Earliest origin from which every later origin also predicted the crossing. */
  calledFrom: IsoDate | null;
  leadTimeDays: number | null;
  origins: { origin: IsoDate; predictedCrossing: IsoDate | null }[];
}

/** Every distinct spell at or below `threshold`, separated by at least `gapDays` above it. */
export function crisisEpisodes(levels: DailySeries, threshold: number, gapDays = 30): CrisisEpisode[] {
  const out: CrisisEpisode[] = [];
  let previous: IsoDate | null = null;
  for (const [date, level] of levels) {
    if (level > threshold) continue;
    if (previous === null || date > addDays(previous, gapDays)) out.push({ crossedOn: date, thresholdM: threshold });
    previous = date;
  }
  return out;
}

/** Days a predicted crossing may fall after the real one and still count as a warning. */
export const CRISIS_GRACE_DAYS = 7;

/**
 * Section 7's crisis question: standing at each monthly origin before an episode, how early did
 * the model say the reservoir would reach the critical level?
 *
 * Two rules, and each exists because the obvious version of it gives a misleading answer.
 *
 * A call must be *sustained* — the earliest origin from which this and every later origin also
 * predicted the crossing. A single origin that says yes and is then contradicted by the three
 * after it did not forecast anything; it flickered, and crediting it would flatter the model.
 *
 * A call must land *near* the crossing, not before it. Demanding "on or before the day it
 * happened" sounds strict and is merely brittle: in October 2024 the dry tail of the ensemble
 * put the crossing 8.5 days out against an actual 7, and a rule that rejects a forecast for
 * being thirty-six hours late scores it identically to one that missed by a year. The grace
 * window is one week — long enough that a usable warning counts, short enough that a crossing
 * predicted for next season does not.
 */
export function crisisLeadTime(
  episode: CrisisEpisode,
  calls: { origin: IsoDate; predictedCrossing: IsoDate | null }[],
  graceDays: number = CRISIS_GRACE_DAYS,
): CrisisCall {
  const before = calls
    .filter((call) => call.origin < episode.crossedOn)
    .sort((a, b) => (a.origin < b.origin ? -1 : 1));

  let calledFrom: IsoDate | null = null;
  for (let i = before.length - 1; i >= 0; i--) {
    const call = before[i]!;
    const hit = call.predictedCrossing !== null && call.predictedCrossing <= addDays(episode.crossedOn, graceDays);
    if (!hit) break;
    calledFrom = call.origin;
  }

  const leadTimeDays =
    calledFrom === null
      ? null
      : Math.round(
          (Date.parse(`${episode.crossedOn}T00:00:00Z`) - Date.parse(`${calledFrom}T00:00:00Z`)) / 86_400_000,
        );

  return { episode, calledFrom, leadTimeDays, origins: before };
}
