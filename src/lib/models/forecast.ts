/**
 * Phase 5's deliverable, assembled: the published forecast for Mazar's level, the days-to-
 * threshold estimate under three inflow scenarios, and the rows that record how it was made.
 *
 * The band is not the ensemble. The analogue years say what inflow has done at this time of
 * year, and the backtest says what this model gets wrong on top of that, and only the second
 * one knows about the operator changing their mind, the rule curve being an average of six
 * years of different regimes, or a level published against the wrong day. Measured over the
 * same origins, the raw ensemble covers about 55% of outcomes inside its own p10-p90; the
 * published band is the model's median widened by its own out-of-sample residuals at that
 * horizon, which is what brings coverage back to roughly the 80% it claims.
 */

import { createHash } from "node:crypto";
import { addDays, nowUtc } from "../util/dates.ts";
import type { IsoDate } from "../util/dates.ts";
import type { DailySeries, SeriesSet } from "../features/series.ts";
import { areaAt, balanceDays, storageHm3 } from "../features/hydrology.ts";
import type { ForecastRunRow, ForecastValueRow } from "../contracts/tables.ts";
import { truncate, type Calibration, type ModelScore } from "./backtest.ts";
import { quantile } from "../util/stats.ts";
import { round6, roundOrNull, roundTo } from "../util/numbers.ts";
import {
  crossingDistribution,
  DEFAULT_WATER_BALANCE,
  firstCrossing,
  fitAt,
  horizonEnsembles,
  inflowScenarios,
  type FitCache,
  type WaterBalanceFit,
  type WaterBalanceOptions,
} from "./water-balance.ts";
import type { ForecastContext } from "./types.ts";

/** Levels arrive at 0.01 m; publishing more digits than that publishes arithmetic, not readings. */
const LEVEL_DIGITS = 2;

/**
 * Bumped when the method changes in a way that makes old rows incomparable to new ones.
 * 2: the 7-day row may come from `M4-gbm-m3-residual` rather than M3 (see `m4-live.ts`).
 */
export const MODEL_VERSION = "2";

/** How far the days-to-threshold simulation runs before it gives up and says "not within". */
export const THRESHOLD_HORIZON_DAYS = 365;

export interface ThresholdRef {
  name: string;
  levelMasl: number;
  /** Who says so. Empty provenance is itself the finding — see `status`. */
  source: string;
  status: "published" | "unverified";
  note: string;
}

export interface ScenarioSummary {
  scenario: "dry" | "median" | "wet";
  analogYear: number;
  inflowMeanM3s: number;
  inflowTotalHm3: number;
  crossesOn: IsoDate | null;
  days: number | null;
  minimumLevelMasl: number;
}

export interface HorizonOutput {
  horizonDays: number;
  targetDate: IsoDate;
  p10: number;
  p50: number;
  p90: number;
  ensembleP10: number | null;
  ensembleP90: number | null;
  ensembleN: number;
  analogYears: number[];
  /** Median backtest residual at this horizon: the model's bias, published rather than absorbed. */
  medianResidualM: number | null;
  /** The model whose median is published at this horizon. */
  modelId: string;
  bandSource: string;
  /** Extra fields a horizon published from another model carries into its forecast entry. */
  detail: Record<string, unknown> | null;
}

/**
 * One horizon published from a model other than the run's own. The p10/p90 must already be the
 * banded ones; `buildForecast` keeps what M3 would have published beside them.
 */
export interface HorizonOverride {
  horizonDays: number;
  modelId: string;
  p10: number;
  p50: number;
  p90: number;
  medianResidualM: number | null;
  bandSource: string;
  /** The published model's backtest numbers at this horizon, as the `backtest` block states them. */
  backtest: {
    n: number;
    mae_m: number;
    skill_vs_persistence: number | null;
    coverage_p10_p90: number | null;
    ensemble_coverage_p10_p90: number | null;
  };
  detail: Record<string, unknown>;
}

/** Which horizons publish another model, and `forecast.json`'s account of why (or why not). */
export interface HorizonSwitch {
  overrides: HorizonOverride[];
  summary: Record<string, unknown>;
}

export interface ForecastInputs {
  series: SeriesSet;
  site: string;
  variable: string;
  horizonDays: readonly number[];
  thresholds: readonly ThresholdRef[];
  calibration: Calibration;
  scores: readonly ModelScore[];
  modelId: string;
  modelLabel: string;
  backtestOrigins: number;
  options?: WaterBalanceOptions;
  /** Horizons published from another model; absent, every horizon is the run's own model. */
  horizonSwitch?: HorizonSwitch;
  /** The run's fit cache, so the live origin's fit is the one the ladder already made. */
  cache?: FitCache;
}

export interface ForecastOutput {
  document: Record<string, unknown>;
  runRow: ForecastRunRow;
  valueRows: ForecastValueRow[];
  fit: WaterBalanceFit;
  origin: IsoDate;
}

/** Mean m/day over the trailing `days`, which is what the narrative panel calls a slope. */
function slope(levels: DailySeries, origin: IsoDate, days: number): number | null {
  const now = levels.get(origin);
  const then = levels.get(addDays(origin, -days));
  return now === undefined || then === undefined ? null : (now - then) / days;
}

function hashOf(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

export function buildForecast(inputs: ForecastInputs): ForecastOutput | null {
  const options = inputs.options ?? DEFAULT_WATER_BALANCE;
  const levels = inputs.series.get(inputs.site, inputs.variable);
  const inflow = inputs.series.get(inputs.site, "caudal_m3s");
  const production = inputs.series.get(inputs.site, "produccion_mwh");

  const origin = [...levels.keys()].at(-1);
  if (origin === undefined) return null;
  const originLevel = levels.get(origin)!;
  const crestM = Math.max(...levels.values());

  const context: ForecastContext = {
    origin,
    horizonDays: inputs.horizonDays,
    levels,
    inflow,
    production,
    crestM,
  };
  const fit = fitAt(context, options, inputs.cache);
  if (!fit) return null;

  const perHorizon = inputs.calibration.get(inputs.modelId) ?? (new Map() as NonNullable<ReturnType<Calibration["get"]>>);
  const overrides = new Map((inputs.horizonSwitch?.overrides ?? []).map((o) => [o.horizonDays, o]));

  const horizons: HorizonOutput[] = [];
  for (const { horizonDays, ends, years } of horizonEnsembles(fit, inflow, origin, inputs.horizonDays, crestM, options)) {
    if (ends.length < options.minAnalogYears) continue;
    const centre = quantile(ends, 0.5)!;
    const residuals = perHorizon.get(horizonDays);

    // The published band must contain the published median: if every residual at this horizon
    // fell on one side, an uncorrected shift would put p10 above p50 and the contract would
    // (rightly) refuse the row. Clamping keeps the band honest about direction without
    // inventing a spread it did not measure.
    const p10 = residuals ? Math.min(centre + residuals.q10, centre) : (quantile(ends, 0.1) ?? centre);
    const p90 = residuals ? Math.max(centre + residuals.q90, centre) : (quantile(ends, 0.9) ?? centre);

    const own = {
      p10: roundTo(p10, LEVEL_DIGITS),
      p50: roundTo(centre, LEVEL_DIGITS),
      p90: roundTo(p90, LEVEL_DIGITS),
      medianResidualM: roundOrNull(residuals?.q50, LEVEL_DIGITS),
    };
    // A horizon published from another model replaces the quantiles only. The analogue
    // ensemble stays M3's and is labelled so; what M3 would have published is kept beside the
    // replacement, so a reader can see the size of the switch.
    const override = overrides.get(horizonDays);
    const published = override
      ? {
          p10: roundTo(override.p10, LEVEL_DIGITS),
          p50: roundTo(override.p50, LEVEL_DIGITS),
          p90: roundTo(override.p90, LEVEL_DIGITS),
          medianResidualM: roundOrNull(override.medianResidualM, LEVEL_DIGITS),
        }
      : own;
    horizons.push({
      horizonDays,
      targetDate: addDays(origin, horizonDays),
      ...published,
      ensembleP10: roundOrNull(quantile(ends, 0.1), LEVEL_DIGITS),
      ensembleP90: roundOrNull(quantile(ends, 0.9), LEVEL_DIGITS),
      ensembleN: ends.length,
      analogYears: years,
      modelId: override?.modelId ?? inputs.modelId,
      bandSource: override?.bandSource ?? `${inputs.modelId} out-of-sample residuals at ${horizonDays} d, this run's ladder backtest`,
      detail: override
        ? {
            ...override.detail,
            would_have_published: {
              model: inputs.modelId,
              p10: own.p10,
              p50: own.p50,
              p90: own.p90,
              median_backtest_residual_m: own.medianResidualM,
            },
          }
        : null,
    });
  }
  if (horizons.length === 0) return null;

  const scenarios = inflowScenarios(fit, inflow, origin, THRESHOLD_HORIZON_DAYS, crestM, options);
  const daysToThreshold = inputs.thresholds.map((threshold) => {
    const spread = crossingDistribution(fit, inflow, origin, THRESHOLD_HORIZON_DAYS, threshold.levelMasl, crestM, options);
    return {
      threshold: threshold.name,
      level_masl: threshold.levelMasl,
      source: threshold.source,
      status: threshold.status,
      note: threshold.note,
      across_all_analogue_years:
        spread === null
          ? null
          : {
              analogue_years: spread.paths,
              years_that_cross: spread.crossed,
              p10_days: roundOrNull(spread.p10Days, 1),
              p50_days: roundOrNull(spread.p50Days, 1),
              p90_days: roundOrNull(spread.p90Days, 1),
            },
      scenarios: scenarios.map((run): ScenarioSummary => {
        const crossing = firstCrossing(run.levels, threshold.levelMasl);
        return {
          scenario: run.name,
          analogYear: run.analogYear,
          inflowMeanM3s: roundTo(run.inflowMeanM3s, 2),
          inflowTotalHm3: roundTo(run.inflowTotalHm3, 1),
          crossesOn: crossing?.date ?? null,
          days: crossing?.days ?? null,
          minimumLevelMasl: roundTo(Math.min(...run.levels.map((step) => step.level)), LEVEL_DIGITS),
        };
      }),
    };
  });

  const balance = balanceDays(levels, inflow, production, addDays(origin, 1));
  const featuresHash = hashOf({
    origin,
    site: inputs.site,
    variable: inputs.variable,
    model: inputs.modelId,
    version: MODEL_VERSION,
    levels: levels.size,
    inflow: inflow.size,
    production: production.size,
    originLevel,
    horizons: [...inputs.horizonDays],
    options,
    // Which model each horizon publishes, and the evidence it stood on, are inputs too: the same
    // data with the seven-day switch made or refused is a different run.
    horizonModels: horizons.map((h) => [h.horizonDays, h.modelId]),
    horizonSwitch: inputs.horizonSwitch?.summary ?? null,
  });
  const runId = `${origin}-${inputs.site}-${MODEL_VERSION}-${featuresHash.slice(0, 8)}`;
  const generatedAt = nowUtc();

  const runRow: ForecastRunRow = {
    run_id: runId,
    generated_at: generatedAt,
    origin_date: origin,
    site: inputs.site,
    variable: inputs.variable,
    model_id: inputs.modelId,
    model_version: MODEL_VERSION,
    features_hash: featuresHash,
    origin_level_masl: roundTo(originLevel, LEVEL_DIGITS),
    train_days: levels.size,
    balance_days: balance.length,
    analog_years: horizons[0]!.ensembleN,
    backtest_origins: inputs.backtestOrigins,
    curve_datum_m: roundTo(fit.curve.datumM, 2),
    curve_area_coefficient: round6(fit.curve.areaCoefficient),
    curve_area_exponent: round6(fit.curve.areaExponent),
    curve_rmse_level_m: round6(fit.curve.rmseDeltaLevelM),
    turbine_m3s_per_mw: round6(fit.curve.turbineM3sPerMw),
    release_stance_m3s: roundTo(fit.stance, 3),
    crest_masl: roundTo(crestM, LEVEL_DIGITS),
  };

  const valueRows: ForecastValueRow[] = horizons.map((h) => ({
    run_id: runId,
    origin_date: origin,
    horizon_days: h.horizonDays,
    target_date: h.targetDate,
    p10: h.p10,
    p50: h.p50,
    p90: h.p90,
    ensemble_p10: h.ensembleP10,
    ensemble_p90: h.ensembleP90,
    ensemble_n: h.ensembleN,
    model_id: h.modelId,
  }));

  const shipped = inputs.scores.find((s) => s.modelId === inputs.modelId);
  const lowest = inputs.thresholds.reduce<ThresholdRef | null>(
    (best, t) => (best === null || t.levelMasl < best.levelMasl ? t : best),
    null,
  );

  const document: Record<string, unknown> = {
    generated_at: generatedAt,
    run_id: runId,
    origin_date: origin,
    site: inputs.site,
    variable: inputs.variable,
    units: "metres above sea level",
    disclaimer:
      "No es una fuente oficial. Pronóstico estadístico generado a partir de datos públicos de CELEC y CENACE; " +
      "no representa la posición de ninguna institución.",
    model: {
      id: inputs.modelId,
      label: inputs.modelLabel,
      version: MODEL_VERSION,
      features_hash: featuresHash,
      backtest_origins: inputs.backtestOrigins,
      // `id` is the run's own model, which every horizon publishes unless this list says
      // otherwise; each forecast entry below also names its model.
      horizon_models: horizons.map((h) => ({ horizon_days: h.horizonDays, model_id: h.modelId })),
    },
    horizon_switch: inputs.horizonSwitch?.summary ?? null,
    current: {
      level_masl: roundTo(originLevel, LEVEL_DIGITS),
      observed_on: origin,
      sources: [...inputs.series.sourcesFor(inputs.site, inputs.variable)].sort(),
      storage_above_lowest_threshold_hm3: lowest === null ? null : roundTo(storageHm3(fit.curve, lowest.levelMasl, originLevel), 2),
      surface_area_km2: roundTo(areaAt(fit.curve, originLevel) / 1e6, 3),
      slope_7d_m_per_day: roundOrNull(slope(levels, origin, 7), 4),
      slope_14d_m_per_day: roundOrNull(slope(levels, origin, 14), 4),
      slope_30d_m_per_day: roundOrNull(slope(levels, origin, 30), 4),
      release_stance_m3s: roundTo(fit.stance, 2),
    },
    thresholds: inputs.thresholds.map((t) => ({
      name: t.name,
      level_masl: t.levelMasl,
      source: t.source,
      status: t.status,
      note: t.note,
      metres_above: roundTo(originLevel - t.levelMasl, LEVEL_DIGITS),
    })),
    forecast: horizons.map((h) => ({
      horizon_days: h.horizonDays,
      target_date: h.targetDate,
      p10: h.p10,
      p50: h.p50,
      p90: h.p90,
      ensemble: { p10: h.ensembleP10, p90: h.ensembleP90, n: h.ensembleN, years: h.analogYears },
      median_backtest_residual_m: h.medianResidualM,
      model: h.modelId,
      band_source: h.bandSource,
      ...(h.detail ?? {}),
    })),
    days_to_threshold: {
      horizon_days: THRESHOLD_HORIZON_DAYS,
      note:
        "Each scenario is one real analogue year of inflow — the driest, median and wettest of the " +
        "years on record for this calendar window — run through the same release rule.",
      thresholds: daysToThreshold,
    },
    reservoir: {
      crest_masl: roundTo(crestM, LEVEL_DIGITS),
      crest_basis: "highest level in the record; the declared maximum is operational, not physical",
      area_elevation: {
        form: "A(level) = coefficient * (level - datum)^exponent, m2",
        coefficient: round6(fit.curve.areaCoefficient),
        exponent: round6(fit.curve.areaExponent),
        datum_m: roundTo(fit.curve.datumM, 2),
        fit_rmse_level_m: round6(fit.curve.rmseDeltaLevelM),
        fit_days: fit.curve.days,
      },
      turbine_m3s_per_mw: round6(fit.curve.turbineM3sPerMw),
      release_rule_m3s: fit.rule.points.map((p) => ({
        level_masl: roundTo(p.level, LEVEL_DIGITS),
        release_m3s: roundTo(p.releaseM3s, 2),
      })),
      release_rule_days: fit.rule.days,
    },
    backtest: {
      report: "data/reports/backtest.md",
      // The skill of what is published at each horizon: a switched horizon carries its own
      // model's backtest, not M3's, so the site's skill column describes the number beside it.
      horizons:
        shipped?.horizons.map((h) => {
          const override = overrides.get(h.horizonDays);
          if (override) {
            return {
              horizon_days: h.horizonDays,
              model: override.modelId,
              n: override.backtest.n,
              mae_m: roundTo(override.backtest.mae_m, 3),
              skill_vs_persistence: roundOrNull(override.backtest.skill_vs_persistence, 4),
              coverage_p10_p90: roundOrNull(override.backtest.coverage_p10_p90, 4),
              ensemble_coverage_p10_p90: roundOrNull(override.backtest.ensemble_coverage_p10_p90, 4),
            };
          }
          return {
            horizon_days: h.horizonDays,
            model: inputs.modelId,
            n: h.n,
            mae_m: roundTo(h.maeM, 3),
            skill_vs_persistence: roundOrNull(h.skillVsPersistence, 4),
            coverage_p10_p90: roundOrNull(h.coverageP10P90, 4),
            ensemble_coverage_p10_p90: roundOrNull(h.ensembleCoverage, 4),
          };
        }) ?? [],
    },
  };

  return { document, runRow, valueRows, fit, origin };
}

export interface OriginCrossing {
  origin: IsoDate;
  level: number;
  analogueYears: number;
  yearsThatCross: number;
  /** Dates the ensemble's 10th, 50th and 90th percentile member reaches the threshold. */
  p10: IsoDate | null;
  p50: IsoDate | null;
  p90: IsoDate | null;
}

/**
 * What each monthly origin said about reaching `thresholdM` — the raw material for section 7's
 * crisis question, "how much lead time did the forecast give?".
 *
 * Quantiles are taken over the *whole* analogue ensemble, not over the year that happens to sit
 * in the middle of the annual inflow ranking. Those are different statistics and only the first
 * answers this question: a year with a median annual total can be wet for the next fortnight,
 * and a crossing a fortnight away is decided by the fortnight. The distribution is censored, so
 * a quantile is null whenever fewer than that share of analogue years cross at all — which is
 * the correct reading of "the expectation at this quantile is no crossing", and not a date.
 *
 * Both p50 and p10 are returned because they answer differently and the difference is the
 * finding. Section 7 asks about the P50; on the P50 this model did not call either 2024
 * crossing. The P10 — the dry tail — put the October crossing 8.5 days out from an origin 7
 * days before it happened.
 */
export function crossingCallsByOrigin(
  levels: DailySeries,
  inflow: DailySeries,
  production: DailySeries,
  origins: readonly IsoDate[],
  thresholdM: number,
  crestM: number,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
  cache?: FitCache,
): OriginCrossing[] {
  const out: OriginCrossing[] = [];
  for (const origin of origins) {
    const context: ForecastContext = {
      origin,
      horizonDays: [],
      levels: truncate(levels, origin),
      inflow: truncate(inflow, origin),
      production: truncate(production, origin),
      crestM,
    };
    const fit = fitAt(context, options, cache);
    if (!fit) continue;
    const spread = crossingDistribution(fit, context.inflow, origin, THRESHOLD_HORIZON_DAYS, thresholdM, crestM, options);
    if (!spread) continue;
    const on = (days: number | null): IsoDate | null => (days === null ? null : addDays(origin, Math.round(days)));
    out.push({
      origin,
      level: fit.startLevel,
      analogueYears: spread.paths,
      yearsThatCross: spread.crossed,
      p10: on(spread.p10Days),
      p50: on(spread.p50Days),
      p90: on(spread.p90Days),
    });
  }
  return out;
}

/**
 * Origins whose forecast named a crossing inside `withinDays` when the level did not in fact
 * reach the threshold within `toleranceDays` of that date. A lead time means nothing without
 * this: a model that predicts a crossing every month has perfect lead time and no information.
 */
export function falseAlarms(
  calls: readonly OriginCrossing[],
  levels: DailySeries,
  thresholdM: number,
  withinDays = 30,
  toleranceDays = 60,
): OriginCrossing[] {
  return calls.filter((call) => {
    if (call.p50 === null || call.p50 > addDays(call.origin, withinDays)) return false;
    for (const [date, level] of levels) {
      if (date < call.origin) continue;
      if (date > addDays(call.p50, toleranceDays)) break;
      if (level <= thresholdM) return false;
    }
    return true;
  });
}
