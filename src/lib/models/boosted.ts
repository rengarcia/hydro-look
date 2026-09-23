/**
 * M4 — gradient-boosted quantile regression, the last rung of section 7's ladder.
 *
 * One model per horizon and per quantile (p10, p50, p90), refitted from scratch at every
 * backtest origin on the rows a forecaster standing there could have assembled: a feature row
 * for each earlier day `t`, and as its target what the level did over the next `h` days — only
 * for days whose `t + h` had already been observed. Nothing is tuned against the backtest; the
 * learner's settings below were fixed before the first scored run.
 *
 * **Features, all read at or before `t`.** Level and its changes over 1–60 days and its
 * departure from its own trailing year; inflow and its trailing means; production and its
 * trailing means; day of year as a circle; ONI *as it could have been read on `t`* (two months
 * stale, `enso.availableAt`) and its three-month change; and ERA5 precipitation at the Paute's
 * single provisional sampling point, summed over trailing windows that end five days before
 * `t` because ERA5 is published about five days late. That last group is one grid cell, not a
 * basin, and is named so everywhere it appears.
 *
 * **Three ways to use M3, measured rather than chosen.**
 *
 * - `M4-gbm-direct` predicts the level change `level(t+h) − level(t)` from the features alone.
 * - `M4-gbm-direct-m3` predicts the same change with M3's own forecast among the features —
 *   its predicted change, its ensemble's spread and the operator's stance it read.
 * - `M4-gbm-m3-residual` predicts what M3 will get wrong, `level(t+h) − M3(t, h)`, and adds it
 *   back. If the trees find nothing, this rung *is* M3.
 *
 * M3's forecast as a feature has to be M3's forecast as it would have been made on each training
 * day, not a forecast made from the origin looking back — otherwise the trees learn to trust a
 * model that was fitted on the answers. It is: the storage curve and the release rule come from
 * a fit at the first of `t`'s month on data before it (the same fit, from the same cache, the
 * shipped M3 uses at a monthly origin), the operator's stance is read over the thirty days to
 * `t`, and the analogue years are years before `t`. At a first-of-month origin this reproduces
 * the shipped M3's median exactly, which the backtest script checks.
 *
 * **Look-ahead.** Every feature at `t` is a function of data at or before `t`, so a feature
 * computed at one origin is the same number at every later origin, and the caches below are
 * safe across origins. That is a claim the tests check directly — the row for `t` built from a
 * series cut at `t` is identical to the row built from one cut a year later — rather than a
 * comment to be believed.
 */

import { addDays, isCalendarDate } from "../util/dates.ts";
import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { availableAt, type OniSeries } from "../features/enso.ts";
import { ERA5_LATENCY_DAYS, PROVISIONAL_PRECIP_BASIN } from "../features/weather.ts";
import { impliedReleases, trimReleases, volumeAt } from "../features/hydrology.ts";
import { dayOfYear, median, quantile } from "../util/stats.ts";
import { truncate } from "./backtest.ts";
import { binMatrix, DEFAULT_GBM, fitGbmBinned, predictGbm, type GbmOptions } from "./gbm.ts";
import {
  DEFAULT_WATER_BALANCE,
  fitAt,
  releaseAt,
  simulateLevels,
  type FitCache,
  type WaterBalanceFit,
  type WaterBalanceOptions,
} from "./water-balance.ts";
import type { ForecastContext, HorizonForecast, Model } from "./types.ts";

const SECONDS_PER_DAY = 86_400;
const DAY_MS = 86_400_000;

/** Horizons M3's forecast is computed for at every training day; the longest bounds the simulation. */
export const M3_FEATURE_HORIZONS = [7, 14, 30, 60, 90] as const;
const LONGEST = Math.max(...M3_FEATURE_HORIZONS);

export const BASE_FEATURES = [
  "level_m",
  "level_change_1d_m",
  "level_change_3d_m",
  "level_change_7d_m",
  "level_change_14d_m",
  "level_change_30d_m",
  "level_change_60d_m",
  "level_minus_trailing_365d_mean_m",
  "inflow_m3s",
  "inflow_mean_3d_m3s",
  "inflow_mean_7d_m3s",
  "inflow_mean_30d_m3s",
  "inflow_mean_90d_m3s",
  "production_mwh",
  "production_mean_7d_mwh",
  "production_mean_30d_mwh",
  "day_of_year_sin",
  "day_of_year_cos",
  "oni_as_available",
  "oni_change_3m_as_available",
  "era5_precip_paute_provisional_point_7d_mm",
  "era5_precip_paute_provisional_point_30d_mm",
  "era5_precip_paute_provisional_point_90d_mm",
] as const;

export const M3_FEATURES = ["m3_p50_change_m", "m3_ensemble_p10_p90_width_m", "m3_release_stance_m3s"] as const;

/**
 * The base feature names with the precipitation columns named after the basin they read. The
 * provisional point keeps the names every committed snapshot was scored under, so a snapshot
 * scored on one basin can never be mistaken for one scored on another: the names differ, and
 * `m4SwitchCheck` compares them.
 */
export function baseFeatures(precipBasin: string = PROVISIONAL_PRECIP_BASIN): string[] {
  if (precipBasin === PROVISIONAL_PRECIP_BASIN) return [...BASE_FEATURES];
  return BASE_FEATURES.map((name) => name.replace("era5_precip_paute_provisional_point_", `era5_precip_${precipBasin}_`));
}

/** Covariates the backtest harness does not carry in its context. */
export interface Covariates {
  oni: OniSeries;
  /** ERA5 daily precipitation at one basin point (`precipBasin`); read with `ERA5_LATENCY_DAYS` of lag. */
  precip: DailySeries;
  /** Which `basins.csv` row `precip` is; the provisional `paute` point when absent. */
  precipBasin?: string;
}

export interface M4Variant {
  id: string;
  label: string;
  /** `change`: predict level(t+h) − level(t). `m3-residual`: predict level(t+h) − M3(t, h). */
  target: "change" | "m3-residual";
  m3Features: boolean;
}

export const M4_VARIANTS: readonly M4Variant[] = [
  { id: "M4-gbm-direct", label: "Boosted quantile trees on the level change, no M3", target: "change", m3Features: false },
  { id: "M4-gbm-direct-m3", label: "Boosted quantile trees on the level change, M3 as a feature", target: "change", m3Features: true },
  { id: "M4-gbm-m3-residual", label: "Boosted quantile trees on M3's residual", target: "m3-residual", m3Features: true },
];

export interface M4Settings {
  gbm: Omit<GbmOptions, "loss">;
  /** Keep one training day in this many; neighbouring days share almost all of their target. */
  strideDays: number;
  /** A horizon with fewer training rows than this is declined rather than fitted. */
  minRows: number;
  quantiles: readonly [number, number, number];
}

/**
 * Fixed before the first full scored run and not revisited after it. The stride of two days is
 * a runtime choice made on a six-origin trial, not a tuned one: a training row every other day
 * halves the ~4,700 fits' cost, and neighbouring days share all but a day or two of an h-day
 * target anyway. `minRows` is low enough that the first origin, 2018-01, can still fit its
 * 90-day residual model on the ~300 rows M3's history allows there — a rung that declined the
 * early origins would shrink the set every other rung is scored on.
 */
export const DEFAULT_M4: M4Settings = {
  gbm: { ...DEFAULT_GBM, trees: 200, learningRate: 0.05, maxDepth: 3, minLeaf: 20, subsample: 0.8, maxBins: 32, seed: 20260922 },
  strideDays: 2,
  minRows: 200,
  quantiles: [0.1, 0.5, 0.9],
};

// ----------------------------------------------------------------------------------------------
// Day arithmetic. Features are read off dense day-indexed arrays; parsing a date string per
// lookup would be most of the runtime.

const dayNumbers = new Map<IsoDate, number>();
const dayDates = new Map<number, IsoDate>();

export function dayNumber(date: IsoDate): number {
  let n = dayNumbers.get(date);
  if (n === undefined) {
    n = Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
    dayNumbers.set(date, n);
  }
  return n;
}

function dateOfDay(day: number): IsoDate {
  let date = dayDates.get(day);
  if (date === undefined) {
    date = new Date(day * DAY_MS).toISOString().slice(0, 10);
    dayDates.set(day, date);
  }
  return date;
}

/** Every series the features read, laid out by day from `start` to the origin, NaN where missing. */
interface Frame {
  start: number;
  end: number;
  level: Float64Array;
  inflow: Float64Array;
  production: Float64Array;
  precip: Float64Array;
}

function dense(series: DailySeries, start: number, end: number): Float64Array {
  const out = new Float64Array(end - start + 1).fill(Number.NaN);
  for (const [date, value] of series) {
    const day = dayNumber(date);
    if (day < start || day > end) continue;
    out[day - start] = value;
  }
  return out;
}

function buildFrame(context: ForecastContext, covariates: Covariates): Frame {
  const firsts = [context.levels, context.inflow, context.production]
    .map((s) => s.keys().next().value)
    .filter((d): d is IsoDate => d !== undefined)
    .map(dayNumber);
  // A trailing precipitation window reaches 95 days behind the first reading it is paired with.
  const start = Math.min(...firsts) - 100;
  const end = dayNumber(context.origin);
  return {
    start,
    end,
    level: dense(context.levels, start, end),
    inflow: dense(context.inflow, start, end),
    production: dense(context.production, start, end),
    precip: dense(covariates.precip, start, end),
  };
}

function at(values: Float64Array, index: number): number {
  return index >= 0 && index < values.length ? values[index]! : Number.NaN;
}

/** Mean over `[index - days + 1, index]`, or NaN when less than `minShare` of it was observed. */
function trailingMean(values: Float64Array, index: number, days: number, minShare = 0.5): number {
  let sum = 0;
  let n = 0;
  for (let i = index - days + 1; i <= index; i++) {
    const v = at(values, i);
    if (!Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n >= Math.max(1, Math.ceil(days * minShare)) ? sum / n : Number.NaN;
}

// ----------------------------------------------------------------------------------------------
// Feature rows.

interface MonthlyFit {
  fit: WaterBalanceFit;
  /** Implied releases that survived the trim, by date, for the stance window. */
  kept: Map<IsoDate, number>;
  low: number;
  high: number;
}

export interface M3AtDate {
  stance: number;
  byHorizon: Map<number, { p50: number; p10: number; p90: number }>;
}

/** Per-run memo. Safe across origins because every entry is a function of data at or before its date. */
export interface M4Cache {
  fits: FitCache;
  base: Map<IsoDate, Float64Array | null>;
  m3: Map<IsoDate, M3AtDate | null>;
  monthly: Map<IsoDate, MonthlyFit | null>;
}

export function createM4Cache(fits: FitCache = new Map()): M4Cache {
  return { fits, base: new Map(), m3: new Map(), monthly: new Map() };
}

function baseRow(frame: Frame, covariates: Covariates, date: IsoDate): Float64Array | null {
  const i = dayNumber(date) - frame.start;
  const level = at(frame.level, i);
  if (Number.isNaN(level)) return null;
  const change = (days: number) => level - at(frame.level, i - days);
  const doy = dayOfYear(date);
  const angle = (2 * Math.PI * (doy - 1)) / 365;
  const oniNow = availableAt(covariates.oni, date);
  const oniBefore = availableAt(covariates.oni, addDays(date, -91));
  const lagged = i - ERA5_LATENCY_DAYS;
  // A precipitation window counts only if nearly complete; rain is too spiky to average over gaps.
  const rain = (days: number) => {
    const mean = trailingMean(frame.precip, lagged, days, 0.9);
    return Number.isNaN(mean) ? mean : mean * days;
  };
  const yearMean = trailingMean(frame.level, i, 365, 0.8);

  return Float64Array.from([
    level,
    change(1),
    change(3),
    change(7),
    change(14),
    change(30),
    change(60),
    Number.isNaN(yearMean) ? Number.NaN : level - yearMean,
    at(frame.inflow, i),
    trailingMean(frame.inflow, i, 3),
    trailingMean(frame.inflow, i, 7),
    trailingMean(frame.inflow, i, 30),
    trailingMean(frame.inflow, i, 90),
    at(frame.production, i),
    trailingMean(frame.production, i, 7),
    trailingMean(frame.production, i, 30),
    Math.sin(angle),
    Math.cos(angle),
    oniNow?.oni ?? Number.NaN,
    oniNow && oniBefore ? oniNow.oni - oniBefore.oni : Number.NaN,
    rain(7),
    rain(30),
    rain(90),
  ]);
}

function monthlyFit(
  context: ForecastContext,
  month: IsoDate,
  cache: M4Cache,
  options: WaterBalanceOptions,
): MonthlyFit | null {
  const cached = cache.monthly.get(month);
  if (cached !== undefined) return cached;
  const cut: ForecastContext = {
    origin: month,
    horizonDays: [],
    levels: truncate(context.levels, month),
    inflow: truncate(context.inflow, month),
    production: truncate(context.production, month),
    crestM: context.crestM,
  };
  const fit = cut.levels.has(month) ? fitAt(cut, options, cache.fits) : null;
  let out: MonthlyFit | null = null;
  if (fit) {
    // The same pool `recentStance` draws from at this origin, trimmed the same way.
    const pool = trimReleases(impliedReleases(fit.curve, cut.levels, cut.inflow, addDays(month, 1)));
    const kept = new Map<IsoDate, number>();
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const reading of pool) {
      low = Math.min(low, reading.releaseM3s);
      high = Math.max(high, reading.releaseM3s);
      if (reading.date > addDays(month, -40)) kept.set(reading.date, reading.releaseM3s);
    }
    out = { fit, kept, low, high };
  }
  cache.monthly.set(month, out);
  return out;
}

/**
 * M3's forecast as it would have been made on `date`: the fit from the first of the month, the
 * stance over the thirty days to `date`, and every earlier year's inflow over the same window.
 * On the first of a month this is the shipped M3 exactly.
 */
function m3At(
  context: ForecastContext,
  frame: Frame,
  date: IsoDate,
  cache: M4Cache,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): M3AtDate | null {
  const cached = cache.m3.get(date);
  if (cached !== undefined) return cached;
  const monthly = monthlyFit(context, `${date.slice(0, 8)}01`, cache, options);
  const i = dayNumber(date) - frame.start;
  const startLevel = at(frame.level, i);
  if (!monthly || Number.isNaN(startLevel)) {
    cache.m3.set(date, null);
    return null;
  }
  const { fit } = monthly;
  const monthStart = dayNumber(`${date.slice(0, 8)}01`) - frame.start;

  // Stance: days d in (date − 30, date − 1], exactly `recentStance`'s window. Days before the
  // month come from the fit's own trimmed pool; days inside it are trimmed against its bounds.
  const gaps: number[] = [];
  for (let d = i - options.stanceWindowDays + 1; d <= i - 1; d++) {
    const level = at(frame.level, d);
    if (Number.isNaN(level)) continue;
    let release: number | undefined;
    if (d < monthStart) {
      release = monthly.kept.get(dateOfDay(d + frame.start));
    } else {
      const next = at(frame.level, d + 1);
      const inflow = at(frame.inflow, d);
      if (Number.isNaN(next) || Number.isNaN(inflow)) continue;
      const r = inflow - (volumeAt(fit.curve, next) - volumeAt(fit.curve, level)) / SECONDS_PER_DAY;
      if (r >= monthly.low && r <= monthly.high) release = r;
    }
    if (release !== undefined) gaps.push(release - releaseAt(fit.rule, level));
  }
  const stance = median(gaps) ?? 0;

  // Analogue years, as `analogPaths` builds them, each run once to the longest horizon.
  const firstInflow = context.inflow.keys().next().value;
  const firstYear = Number(firstInflow?.slice(0, 4) ?? date.slice(0, 4));
  const ends = new Map<number, number[]>(M3_FEATURE_HORIZONS.map((h) => [h, []]));
  for (let year = firstYear; year <= Number(date.slice(0, 4)); year++) {
    const startDate = `${year}-${date.slice(5)}`;
    if (!isCalendarDate(startDate) || startDate >= date) continue;
    const s = dayNumber(startDate) - frame.start;
    const path: number[] = [];
    for (let day = 1; day <= LONGEST; day++) {
      const v = at(frame.inflow, s + day);
      if (Number.isNaN(v)) break;
      path.push(v);
    }
    if (path.length === 0) continue;
    const levels = simulateLevels(fit.curve, fit.rule, startLevel, path, stance, context.crestM, options);
    for (const h of M3_FEATURE_HORIZONS) if (path.length >= h) ends.get(h)!.push(levels[h - 1]!);
  }
  const byHorizon = new Map<number, { p50: number; p10: number; p90: number }>();
  for (const [h, sample] of ends) {
    if (sample.length < options.minAnalogYears) continue;
    byHorizon.set(h, { p50: median(sample)!, p10: quantile(sample, 0.1)!, p90: quantile(sample, 0.9)! });
  }
  const out = { stance, byHorizon };
  cache.m3.set(date, out);
  return out;
}

function cachedBase(frame: Frame, covariates: Covariates, date: IsoDate, cache: M4Cache): Float64Array | null {
  const hit = cache.base.get(date);
  if (hit !== undefined) return hit;
  const row = baseRow(frame, covariates, date);
  cache.base.set(date, row);
  return row;
}

export interface FeatureRow {
  features: number[];
  /** What the target is measured from: level(t) for a change, M3(t, h) for a residual. */
  anchor: number;
}

/**
 * The feature row for `date` at horizon `h`, or null when the variant cannot be anchored there
 * (no level, or no M3 forecast for a residual model).
 */
export function featureRow(
  variant: M4Variant,
  context: ForecastContext,
  covariates: Covariates,
  date: IsoDate,
  horizon: number,
  cache: M4Cache,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
  frame: Frame = buildFrame(context, covariates),
): FeatureRow | null {
  const base = cachedBase(frame, covariates, date, cache);
  if (!base) return null;
  const level = base[0]!;
  const m3 = variant.m3Features || variant.target === "m3-residual" ? m3At(context, frame, date, cache, options) : null;
  const forecast = m3?.byHorizon.get(horizon);
  if (variant.target === "m3-residual" && !forecast) return null;
  const features = [...base];
  if (variant.m3Features) {
    features.push(
      forecast ? forecast.p50 - level : Number.NaN,
      forecast ? forecast.p90 - forecast.p10 : Number.NaN,
      m3 ? m3.stance : Number.NaN,
    );
  }
  return { features, anchor: variant.target === "m3-residual" ? forecast!.p50 : level };
}

export function featureNames(variant: M4Variant, precipBasin: string = PROVISIONAL_PRECIP_BASIN): string[] {
  return [...baseFeatures(precipBasin), ...(variant.m3Features ? M3_FEATURES : [])];
}

export function boostedModel(
  variant: M4Variant,
  covariates: Covariates,
  cache: M4Cache,
  settings: M4Settings = DEFAULT_M4,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): Model {
  return {
    id: variant.id,
    label: variant.label,
    forecast(context: ForecastContext): HorizonForecast[] {
      // The harness truncates only the three series it knows about; the covariates are cut here
      // so that no feature can reach past the origin even by mistake.
      const cutCovariates: Covariates = { oni: covariates.oni, precip: truncate(covariates.precip, context.origin) };
      const frame = buildFrame(context, cutCovariates);
      const originIndex = frame.end - frame.start;
      const firstLevel = context.levels.keys().next().value;
      if (firstLevel === undefined) return [];
      const firstIndex = dayNumber(firstLevel) - frame.start;
      const out: HorizonForecast[] = [];

      for (const horizon of context.horizonDays) {
        const here = featureRow(variant, context, cutCovariates, context.origin, horizon, cache, options, frame);
        if (!here) continue;
        const rows: number[][] = [];
        const targets: number[] = [];
        // Training days: only those whose outcome, h days later, is at or before the origin.
        for (let i = firstIndex; i + horizon <= originIndex; i++) {
          if ((i + frame.start) % settings.strideDays !== 0) continue;
          const outcome = frame.level[i + horizon]!;
          if (Number.isNaN(outcome)) continue;
          const row = featureRow(variant, context, cutCovariates, dateOfDay(i + frame.start), horizon, cache, options, frame);
          if (!row) continue;
          rows.push(row.features);
          targets.push(outcome - row.anchor);
        }
        if (rows.length < settings.minRows) continue;

        const binned = binMatrix(rows, settings.gbm.maxBins);
        const predicted = settings.quantiles
          .map((alpha) =>
            predictGbm(fitGbmBinned(binned, targets, { ...settings.gbm, loss: { kind: "quantile", alpha } }), here.features),
          )
          // Separately fitted quantiles can cross; sorting them is the standard repair and
          // leaves each one's marginal calibration intact.
          .sort((a, b) => a - b);
        out.push({
          horizonDays: horizon,
          targetDate: addDays(context.origin, horizon),
          p50: here.anchor + predicted[1]!,
          ensemble: [],
          quantiles: { p10: here.anchor + predicted[0]!, p90: here.anchor + predicted[2]! },
        });
      }
      return out;
    },
  };
}
