/**
 * Section 7's third target: expected deficit in GWh per day, and the risk tiers read off it.
 *
 * The identity the whole module computes is one line —
 *
 *     deficit(h) = unsuppressed load(h) − hydro(h) − thermal − imports − other
 *
 * — and every term in it is either forecast with a backtest attached or an explicit input a
 * reader can change. What follows is why each term is the quantity it is, because three of the
 * four are not the obvious choice and the obvious choice is wrong in each case.
 *
 * **Load, not `demanda_distribucion`.** See `features/balance.ts`: the distribution utilities'
 * metering misses transmission losses and every consumer who buys outside them, which is 3 to
 * 11 GWh a day — more than the whole Colombian interconnection. What supply has to cover is
 * `total_generacion + total_importacion − total_exportacion`.
 *
 * **Unsuppressed load, not measured load.** Section 7 says so and the 2024 episode shows why:
 * measured load fell from 78 GWh/day in September to 55 in late October, and a model fitted
 * through that would learn that Ecuador needs less electricity during a drought. The demand
 * model is fitted on days outside the rationing episodes in `rationing_episodes.csv`, plus a
 * fortnight's recovery tail, and the difference between what it says and what was metered is
 * the suppression — which is also the only quantity in this module that can be checked against
 * an outcome, and is (`crisisCheck`).
 *
 * **Hydro normalised by the demand trend, not by measured load.** Ecuador's hydro energy has
 * grown with the fleet and with demand, so raw GWh is not stationary and a day-of-year
 * climatology of it is biased low by 6 to 12 GWh — measured, and kept in the report as a
 * negative. Dividing by measured load fixes the trend and breaks the crisis: during rationing
 * both fall together, so the ratio holds up and projecting it against unsuppressed demand
 * would have claimed 48 GWh of hydro in November 2024 against the 34 that was actually
 * generated. Dividing instead by the *fitted unsuppressed demand trend* — a smooth curve that
 * knows nothing about the drought — removes the growth and leaves the drought in, which is the
 * whole signal.
 *
 * **What is not here.** Section 7 specifies fleet hydro energy "from levels, inflows and plant
 * limits". That link is not in this model because it is not in the data: national hydro energy
 * correlates with the sum of this repository's measured inflows at r = 0.27 daily and r = 0.47
 * on 30-day means, and the implied GWh per m³/s drifts from 0.090 in 2016 to 0.165 in 2026.
 * The measured basins are the Amazon slope; Daule-Peripa, Pucará, San Francisco, Toachi-Pilatón
 * and the private fleet are not measured here at all, and the Pacific slope runs in the
 * opposite phase, which is the reason the interconnected system works. Wiring a 0.47
 * correlation into an adequacy number would be inventing precision. It is a recorded negative,
 * not a to-do.
 */

import { createHash } from "node:crypto";
import { addDays, daysBetween, nowUtc, type IsoDate } from "../util/dates.ts";
import { dayOfYear, quantile } from "../util/stats.ts";
import { roundOrNull, roundTo } from "../util/numbers.ts";
import {
  suppressed,
  type BalanceDay,
  type RationingEpisode,
} from "../features/balance.ts";

/** Bumped when the method changes in a way that makes old rows incomparable to new ones. */
export const MODEL_VERSION = "1";

export const HORIZON_DAYS = [7, 14, 30, 60, 90] as const;

/* ------------------------------------------------------------------ demand */

export interface DemandOptions {
  /** Days of history the trend is fitted over. Four years beat two and three on the backtest. */
  windowDays: number;
  /** Fewest unsuppressed days in the window before a fit is attempted at all. */
  minDays: number;
  /** Half-width of the circular day-of-year window the seasonal factor is pooled over. */
  seasonHalfWindow: number;
  /** Fewest residuals in a day-of-year bin before it gets a factor rather than zero. */
  minSeasonSamples: number;
  /** Unsuppressed days the level anchor is measured over. See `DemandFit.anchor`. */
  anchorDays: number;
  /** How far back the search for those days may reach before it gives up and anchors at 1. */
  anchorSearchDays: number;
  /** Fewest days the anchor may be computed from. */
  minAnchorDays: number;
}

export const DEFAULT_DEMAND: DemandOptions = {
  windowDays: 1460,
  minDays: 365,
  seasonHalfWindow: 10,
  minSeasonSamples: 20,
  anchorDays: 14,
  anchorSearchDays: 180,
  minAnchorDays: 7,
};

export interface DemandFit {
  /** `log(load) = intercept + slope·(days from origin) + weekday + season`, times `anchor`. */
  intercept: number;
  slopePerDay: number;
  weekday: Map<number, number>;
  season: Map<number, number>;
  /**
   * Where demand actually is right now, against where the fitted curve says it should be.
   *
   * Without this the model is a four-year trend evaluated at a date, and a trend fitted over
   * four years can sit two or three GWh away from today — which is why, before it was added, a
   * plain trailing 28-day mean beat the whole apparatus by 70% at a week and 15% at ninety days
   * despite the model being the less biased of the two. The anchor is the ratio of observed to
   * fitted load over the last `anchorDays` *unsuppressed* days, so it carries the current level
   * without carrying the current rationing: anchoring on suppressed days would drag the
   * unsuppressed demand curve down to the rationed load, which is the one thing this model
   * exists not to do.
   */
  anchor: number;
  anchorDays: number;
  origin: IsoDate;
  days: number;
  /** Compound annual growth implied by the slope, as a percentage. */
  growthPctPerYear: number;
  predict(date: IsoDate): number;
}

/**
 * Days since the epoch. Integer arithmetic on a date string, so no `Date` object survives into
 * the regression and no timezone can shift a day into its neighbour.
 */
function epochDay(date: IsoDate): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** 0 = Sunday. 1970-01-01 was a Thursday, which is where the 4 comes from. */
export function weekdayOf(date: IsoDate): number {
  return (epochDay(date) + 4) % 7;
}

/**
 * The unsuppressed demand model.
 *
 * Multiplicative rather than additive: demand grows by a percentage a year, and a Sunday is a
 * fraction of a Tuesday rather than a fixed number of GWh below it, so the whole thing is fitted
 * in logs. The trend is least squares; the weekday and day-of-year factors are *medians* of the
 * residuals, because the sample still contains whatever the rationing labels missed and a mean
 * would carry it into the factor.
 */
export function fitDemand(
  history: readonly BalanceDay[],
  origin: IsoDate,
  episodes: readonly RationingEpisode[],
  options: DemandOptions = DEFAULT_DEMAND,
): DemandFit | null {
  const from = addDays(origin, -options.windowDays);
  const sample = history.filter((d) => d.date >= from && d.date <= origin && !suppressed(episodes, d.date));
  if (sample.length < options.minDays) return null;

  const t0 = epochDay(origin);
  const x = sample.map((d) => epochDay(d.date) - t0);
  const y = sample.map((d) => Math.log(d.loadGwh));
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXX = x.reduce((a, b) => a + b * b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i]!, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const residual = sample.map((_, i) => y[i]! - (intercept + slope * x[i]!));

  const weekday = new Map<number, number>();
  for (let day = 0; day < 7; day++) {
    const bucket = residual.filter((_, i) => weekdayOf(sample[i]!.date) === day);
    weekday.set(day, bucket.length > 0 ? quantile(bucket, 0.5)! : 0);
  }

  const deweekdayed = residual.map((r, i) => r - weekday.get(weekdayOf(sample[i]!.date))!);
  const bins = new Map<number, number[]>();
  deweekdayed.forEach((r, i) => {
    const doy = dayOfYear(sample[i]!.date);
    for (let offset = -options.seasonHalfWindow; offset <= options.seasonHalfWindow; offset++) {
      const target = ((doy + offset - 1 + 365) % 365) + 1;
      (bins.get(target) ?? bins.set(target, []).get(target)!).push(r);
    }
  });
  const season = new Map<number, number>();
  for (const [doy, values] of bins) {
    season.set(doy, values.length >= options.minSeasonSamples ? quantile(values, 0.5)! : 0);
  }

  const shape = (date: IsoDate): number =>
    Math.exp(
      intercept +
        slope * (epochDay(date) - t0) +
        (weekday.get(weekdayOf(date)) ?? 0) +
        (season.get(dayOfYear(date)) ?? 0),
    );

  // The anchor walks back day by day taking only unsuppressed days, so a rationing episode
  // sitting on the origin is stepped over rather than averaged into the current level.
  const byDate = new Map(sample.map((d) => [d.date, d]));
  const observed: number[] = [];
  const fitted: number[] = [];
  for (let back = 0; back < options.anchorSearchDays && observed.length < options.anchorDays; back++) {
    const date = addDays(origin, -back);
    const day = byDate.get(date);
    if (!day) continue;
    observed.push(day.loadGwh);
    fitted.push(shape(date));
  }
  const meanFitted = fitted.length > 0 ? fitted.reduce((a, b) => a + b, 0) / fitted.length : 0;
  const anchor =
    observed.length >= options.minAnchorDays && meanFitted > 0
      ? observed.reduce((a, b) => a + b, 0) / observed.length / meanFitted
      : 1;

  return {
    intercept,
    slopePerDay: slope,
    weekday,
    season,
    anchor,
    anchorDays: observed.length,
    origin,
    days: sample.length,
    growthPctPerYear: (Math.exp(slope * 365) - 1) * 100,
    predict(date: IsoDate): number {
      return shape(date) * anchor;
    },
  };
}

/* ------------------------------------------------------------------- hydro */

export interface HydroOptions {
  /**
   * Half-width of the day-of-year window the normalised-hydro climatology pools over.
   *
   * Twenty-one days. A grid over {10, 15, 21, 30} × trailing {14, 28, 45} was run on the same
   * origins that report the skill, and the surface is monotone in both directions rather than
   * spiky — wider pooling is better, shorter anomaly windows are better — so this is a point on
   * a smooth slope and not a lucky cell. Within the winning trailing-14 row the spread at 90
   * days is 23.2% to 24.2%, which bounds what the selection is worth.
   */
  seasonHalfWindow: number;
  /** Fewest samples in a day-of-year bin before it can be used. */
  minSeasonSamples: number;
  /** Trailing days the current anomaly is measured over. */
  anomalyDays: number;
  /**
   * Days over which the current anomaly decays halfway back to climatology.
   *
   * A dry fortnight is evidence about the next fortnight and much weaker evidence about the
   * month after that, because catchments refill. Persisting the anomaly flat to ninety days
   * made this rung 12% *worse* than a trailing 28-day mean there while still winning at a week;
   * the half-life is what buys the long horizons back without giving up the short ones.
   *
   * Ninety days, so the anomaly is half gone by the end of the longest published horizon. The
   * trade-off is smooth and monotone — over half-lives of 21 to 180 days the net requirement's
   * skill at 90 days runs from +13% to +4% while its skill at 30 days runs from −7% to +7% —
   * and 90 is the shortest half-life at which nothing loses. It is also the conservative side
   * of the trade: damping harder makes the forecast wetter and the deficit smaller, which is
   * the wrong direction for a number whose job is to notice a drought.
   *
   * `Infinity` restores the undamped rung, which is how the report's comparison is produced.
   */
  anomalyHalfLifeDays: number;
}

export const DEFAULT_HYDRO: HydroOptions = {
  seasonHalfWindow: 21,
  minSeasonSamples: 40,
  anomalyDays: 14,
  anomalyHalfLifeDays: 90,
};

export interface HydroFit {
  /** `dayOfYear -> median of hydro / fitted demand trend`. */
  climatology: Map<number, number>;
  /** Where the last `anomalyDays` sit against that climatology. 1.0 is a normal fortnight. */
  anomaly: number;
  days: number;
  predict(date: IsoDate, demand: number): number | null;
}

export function fitHydro(
  history: readonly BalanceDay[],
  origin: IsoDate,
  demand: DemandFit,
  options: HydroOptions = DEFAULT_HYDRO,
): HydroFit | null {
  const bins = new Map<number, number[]>();
  const normalised = new Map<IsoDate, number>();
  for (const day of history) {
    if (day.date > origin) break;
    const trend = demand.predict(day.date);
    if (!(trend > 0)) continue;
    const value = day.hydroGwh / trend;
    normalised.set(day.date, value);
    const doy = dayOfYear(day.date);
    for (let offset = -options.seasonHalfWindow; offset <= options.seasonHalfWindow; offset++) {
      const target = ((doy + offset - 1 + 365) % 365) + 1;
      (bins.get(target) ?? bins.set(target, []).get(target)!).push(value);
    }
  }

  const climatology = new Map<number, number>();
  for (const [doy, values] of bins) {
    if (values.length >= options.minSeasonSamples) climatology.set(doy, quantile(values, 0.5)!);
  }
  if (climatology.size === 0) return null;

  const observed: number[] = [];
  const expected: number[] = [];
  for (let back = 0; back < options.anomalyDays; back++) {
    const date = addDays(origin, -back);
    const value = normalised.get(date);
    const norm = climatology.get(dayOfYear(date));
    if (value !== undefined && norm !== undefined && norm > 0) {
      observed.push(value);
      expected.push(norm);
    }
  }
  if (observed.length === 0) return null;
  const meanObserved = observed.reduce((a, b) => a + b, 0) / observed.length;
  const meanExpected = expected.reduce((a, b) => a + b, 0) / expected.length;
  if (!(meanExpected > 0)) return null;
  const anomaly = meanObserved / meanExpected;

  return {
    climatology,
    anomaly,
    days: normalised.size,
    predict(date: IsoDate, demandGwh: number): number | null {
      const norm = climatology.get(dayOfYear(date));
      if (norm === undefined) return null;
      const ahead = Math.max(0, daysBetween(origin, date));
      const decayed =
        options.anomalyHalfLifeDays === Infinity
          ? anomaly
          : 1 + (anomaly - 1) * Math.pow(2, -ahead / options.anomalyHalfLifeDays);
      return norm * decayed * demandGwh;
    },
  };
}

/* --------------------------------------------------------------- ceilings */

export interface Ceilings {
  /** GWh/day the thermal fleet has been shown to deliver. */
  thermalGwhDay: number;
  /** GWh/day the interconnections have been shown to deliver under normal regional conditions. */
  importGwhDay: number;
  /**
   * GWh/day of imports to assume in the stressed case.
   *
   * Not a hypothetical. Between 2024-10-01 and 2024-11-10, with Ecuador rationing 14 hours a
   * day, imports from Colombia ran at 0.11 to 0.14 GWh/day against the 10.7 they had reached
   * that August, because Colombia was short of water at the same time. Any adequacy number
   * that treats the interconnection as firm is wrong in exactly the fortnight it matters.
   */
  stressedImportGwhDay: number;
  /** Solar, wind, biomass and the rest of SMEC's "otros tipos". */
  otherGwhDay: number;
  basis: string;
}

export interface CeilingRow {
  quantity: string;
  gwh_day: string;
  basis: string;
  source: string;
}

/**
 * What the fleet has demonstrated, over the usable days in a trailing window.
 *
 * The maximum, not a percentile: this is a question about capability and the largest day the
 * record holds is the least arguable evidence that the capability exists. Over the three years
 * to 2026-09-20 that is 25.83 GWh/day of thermal and 10.78 of imports; taking the whole ten
 * years would put thermal at 30.69, on 2016-12-27, from a fleet that has since been retired in
 * part, which is why the window is bounded rather than the record.
 */
export function demonstratedCeilings(days: readonly BalanceDay[], asOf: IsoDate, windowDays = 1095): Ceilings {
  const from = addDays(asOf, -windowDays);
  const window = days.filter((d) => d.date >= from && d.date <= asOf);
  const max = (pick: (day: BalanceDay) => number): number =>
    window.reduce((best, day) => Math.max(best, pick(day)), 0);
  const median = (pick: (day: BalanceDay) => number): number => quantile(window.map(pick), 0.5) ?? 0;

  return {
    thermalGwhDay: max((d) => d.thermalGwh),
    importGwhDay: max((d) => d.importGwh),
    stressedImportGwhDay: 0,
    otherGwhDay: median((d) => d.otherGwh),
    basis:
      `largest day in the ${window.length} usable days from ${from} to ${asOf} ` +
      `(median for "otros tipos", which is not dispatchable capacity)`,
  };
}

/**
 * An assumptions table overrides whichever rows it carries; the rest stay as demonstrated.
 *
 * The resulting `basis` names the source of every term, because a reader who wants to argue
 * with the deficit will want to argue with the ceilings first, and a single sentence saying
 * "demonstrated maxima" would hide which of the four came from a file somebody edited.
 */
export const CEILING_QUANTITIES = ["thermal", "import", "import_stressed", "other"] as const;
export type CeilingQuantity = (typeof CEILING_QUANTITIES)[number];

export function applyOverrides(base: Ceilings, rows: readonly CeilingRow[]): Ceilings {
  const out = { ...base };
  const overridden = new Map<CeilingQuantity, string>();
  for (const row of rows) {
    const value = Number(row.gwh_day);
    const quantity = CEILING_QUANTITIES.find((q) => q === row.quantity);
    if (!Number.isFinite(value) || quantity === undefined) continue;
    switch (quantity) {
      case "thermal":
        out.thermalGwhDay = value;
        break;
      case "import":
        out.importGwhDay = value;
        break;
      case "import_stressed":
        out.stressedImportGwhDay = value;
        break;
      case "other":
        out.otherGwhDay = value;
        break;
    }
    overridden.set(quantity, `${quantity} = ${value} (${row.basis})`);
  }
  if (overridden.size === 0) return out;

  const remaining = CEILING_QUANTITIES.filter((q) => !overridden.has(q));
  out.basis =
    [...overridden.values()].join("; ") +
    (remaining.length > 0 ? `; ${remaining.join(", ")} from the ${base.basis}` : "");
  return out;
}

/* --------------------------------------------------------------- forecast */

export interface AdequacyHorizon {
  horizonDays: number;
  targetDate: IsoDate;
  /** Mean over the horizon window, GWh/day, of unsuppressed demand. */
  demandGwhDay: number;
  hydroGwhDay: number;
  /** `demand − hydro`: what thermal, imports and the rest have to cover. */
  requirementGwhDay: number;
  /** The requirement's calibrated band, from this model's own out-of-sample residuals. */
  requirementP10: number | null;
  requirementP90: number | null;
  /** Requirement minus the ceilings. Negative is surplus; the site shows zero, not a negative deficit. */
  deficitGwhDay: number;
  deficitP10: number | null;
  deficitP90: number | null;
  /** The same, with imports at their 2024 stressed value instead of their demonstrated one. */
  stressedDeficitGwhDay: number;
  /** Supply margin as a share of demand: `(supply − demand) / demand`, ×100. */
  marginPct: number;
  tier: RiskTier;
}

/**
 * The tiers, and the one number that separates each pair.
 *
 * They are cuts on the *deficit distribution*, not on the median alone, because the median is
 * the statistic that missed both 2024 crossings in the level forecast and there is no reason to
 * expect it to do better here. A system whose p90 case is short of energy is not a comfortable
 * system, whatever its median says.
 *
 * `holgado`   — even the p90 requirement is covered.
 * `vigilancia`— the p90 is short but the central case is covered.
 * `ajustado`  — the central case is short by less than `TIGHT_GWH_DAY`.
 * `deficit`   — the central case is short by `TIGHT_GWH_DAY` or more.
 *
 * `TIGHT_GWH_DAY` is 5 GWh/day, which is about 5% of 2026 demand and roughly an hour of
 * national consumption. The 2024 episode ran at a measured suppression of 20 to 25 GWh/day,
 * four to five times this, so the cut is not drawn where the crisis was — it is drawn where
 * a shortfall stops being absorbable by dispatch and starts being visible to consumers.
 */
export type RiskTier = "holgado" | "vigilancia" | "ajustado" | "deficit";

export const TIGHT_GWH_DAY = 5;

export function tierFor(deficitP50: number, deficitP90: number | null): RiskTier {
  if (deficitP50 >= TIGHT_GWH_DAY) return "deficit";
  if (deficitP50 > 0) return "ajustado";
  if (deficitP90 !== null && deficitP90 > 0) return "vigilancia";
  return "holgado";
}

export const TIER_LABELS_ES: Record<RiskTier, string> = {
  holgado: "Holgado",
  vigilancia: "Vigilancia",
  ajustado: "Ajustado",
  deficit: "Déficit",
};

/** Residual quantiles of the requirement, per horizon — what turns a point into a band. */
export type RequirementCalibration = Map<number, { q10: number; q50: number; q90: number; n: number }>;

export interface AdequacyInputs {
  days: readonly BalanceDay[];
  episodes: readonly RationingEpisode[];
  ceilings: Ceilings;
  origin: IsoDate;
  horizonDays?: readonly number[];
  calibration?: RequirementCalibration;
  demandOptions?: DemandOptions;
  hydroOptions?: HydroOptions;
}

export interface AdequacyForecast {
  origin: IsoDate;
  demand: DemandFit;
  hydro: HydroFit;
  horizons: AdequacyHorizon[];
  ceilings: Ceilings;
}

/** Mean of a fitted quantity over the `h` days after the origin, which is what a horizon is here. */
function meanOverWindow(origin: IsoDate, horizonDays: number, of: (date: IsoDate) => number | null): number | null {
  const values: number[] = [];
  for (let day = 1; day <= horizonDays; day++) {
    const value = of(addDays(origin, day));
    if (value === null) return null;
    values.push(value);
  }
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function forecastAdequacy(inputs: AdequacyInputs): AdequacyForecast | null {
  const horizonDays = inputs.horizonDays ?? HORIZON_DAYS;
  const history = inputs.days.filter((d) => d.date <= inputs.origin);
  const demand = fitDemand(history, inputs.origin, inputs.episodes, inputs.demandOptions);
  if (!demand) return null;
  const hydro = fitHydro(history, inputs.origin, demand, inputs.hydroOptions);
  if (!hydro) return null;

  const supplyFloor = inputs.ceilings.thermalGwhDay + inputs.ceilings.otherGwhDay;
  const horizons: AdequacyHorizon[] = [];

  for (const days of horizonDays) {
    const demandGwh = meanOverWindow(inputs.origin, days, (date) => demand.predict(date));
    const hydroGwh = meanOverWindow(inputs.origin, days, (date) => hydro.predict(date, demand.predict(date)));
    if (demandGwh === null || hydroGwh === null) continue;

    const requirement = demandGwh - hydroGwh;
    const residuals = inputs.calibration?.get(days);
    // The band must contain its own centre: if every residual at this horizon fell on one side,
    // an uncorrected shift would put p10 above p50. The level forecast clamps for the same
    // reason and for the same reason it is a clamp rather than a widening.
    const requirementP10 = residuals ? Math.min(requirement + residuals.q10, requirement) : null;
    const requirementP90 = residuals ? Math.max(requirement + residuals.q90, requirement) : null;

    const supply = supplyFloor + inputs.ceilings.importGwhDay;
    const deficit = requirement - supply;
    const deficitP10 = requirementP10 === null ? null : requirementP10 - supply;
    const deficitP90 = requirementP90 === null ? null : requirementP90 - supply;

    horizons.push({
      horizonDays: days,
      targetDate: addDays(inputs.origin, days),
      demandGwhDay: demandGwh,
      hydroGwhDay: hydroGwh,
      requirementGwhDay: requirement,
      requirementP10,
      requirementP90,
      deficitGwhDay: deficit,
      deficitP10,
      deficitP90,
      stressedDeficitGwhDay: requirement - (supplyFloor + inputs.ceilings.stressedImportGwhDay),
      marginPct: ((hydroGwh + supply - demandGwh) / demandGwh) * 100,
      tier: tierFor(deficit, deficitP90),
    });
  }

  return horizons.length === 0 ? null : { origin: inputs.origin, demand, hydro, horizons, ceilings: inputs.ceilings };
}

/* --------------------------------------------------------------- backtest */

export interface HorizonScore {
  horizonDays: number;
  n: number;
  maeGwhDay: number;
  biasGwhDay: number;
  /** MAE of the trailing-28-day mean at the same horizon, over the same targets. */
  baselineMaeGwhDay: number;
  skillVsPersistence: number | null;
  nBand: number;
  coverageP10P90: number | null;
}

export interface ComponentScores {
  component: "demand" | "hydro" | "requirement";
  horizons: HorizonScore[];
}

export interface AdequacyBacktest {
  origins: IsoDate[];
  scores: ComponentScores[];
  calibration: RequirementCalibration;
}

export interface BacktestOptions {
  firstOrigin: IsoDate;
  horizonDays: readonly number[];
  /** Usable balance days a model must have before an origin is used at all. */
  minHistoryDays: number;
  /** Earlier origins needed before a horizon's band can be calibrated from residuals. */
  minCalibrationOrigins: number;
  /** Threaded through to every origin, so a variant can be scored on the same origins. */
  demandOptions?: DemandOptions;
  hydroOptions?: HydroOptions;
}

export const DEFAULT_ADEQUACY_BACKTEST: BacktestOptions = {
  // Section 7's window for the level forecast, kept so the two reports are read on one timeline.
  firstOrigin: "2018-01-01",
  horizonDays: HORIZON_DAYS,
  minHistoryDays: 730,
  minCalibrationOrigins: 12,
};

/** First of each month the usable record covers, from `from` onward. */
export function monthlyOrigins(days: readonly BalanceDay[], from: IsoDate): IsoDate[] {
  return days.map((d) => d.date).filter((date) => date.endsWith("-01") && date >= from);
}

interface Realised {
  demand: number;
  hydro: number;
  requirement: number;
}

/**
 * What actually happened over the `h` days after `origin`, or null if any day is missing or
 * suppressed.
 *
 * Suppressed days are excluded rather than scored, and the exclusion is the honest one: on a day
 * of rationing the realised load is the load that was *allowed*, so a demand model that
 * predicted it correctly would be a model of the rationing schedule. There is nothing here to
 * score against, and pretending otherwise would make the demand model look worst exactly where
 * it is doing its job. What those days are used for instead is `crisisCheck`.
 */
function realisedOver(
  byDate: Map<IsoDate, BalanceDay>,
  episodes: readonly RationingEpisode[],
  origin: IsoDate,
  horizonDays: number,
): Realised | null {
  let demand = 0;
  let hydro = 0;
  for (let day = 1; day <= horizonDays; day++) {
    const date = addDays(origin, day);
    const found = byDate.get(date);
    if (!found || suppressed(episodes, date)) return null;
    demand += found.loadGwh;
    hydro += found.hydroGwh;
  }
  return {
    demand: demand / horizonDays,
    hydro: hydro / horizonDays,
    requirement: (demand - hydro) / horizonDays,
  };
}

/** Trailing 28-day mean, the baseline every component is scored against. */
function trailingMean(
  byDate: Map<IsoDate, BalanceDay>,
  origin: IsoDate,
  pick: (day: BalanceDay) => number,
  days = 28,
): number | null {
  const values: number[] = [];
  for (let back = 0; back < days; back++) {
    const found = byDate.get(addDays(origin, -back));
    if (found) values.push(pick(found));
  }
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

interface Point {
  origin: IsoDate;
  horizonDays: number;
  error: number;
  baselineError: number;
  inBand: boolean | null;
}

/**
 * Rolling-origin backtest over monthly origins, on the same three rules the level forecast
 * uses: every model sees only its own past, the band is calibrated from residuals at strictly
 * earlier origins, and the components are scored on the origins they all reached.
 */
export function backtestAdequacy(
  days: readonly BalanceDay[],
  episodes: readonly RationingEpisode[],
  ceilings: Ceilings,
  options: BacktestOptions = DEFAULT_ADEQUACY_BACKTEST,
): AdequacyBacktest {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const origins = monthlyOrigins(days, options.firstOrigin);
  const points: Record<"demand" | "hydro" | "requirement", Point[]> = { demand: [], hydro: [], requirement: [] };
  const used: IsoDate[] = [];
  // Residuals from strictly earlier origins only: an expanding window, never the whole record.
  const seen = new Map<number, number[]>(options.horizonDays.map((h) => [h, []]));

  for (const origin of origins) {
    const history = days.filter((d) => d.date <= origin);
    if (history.length < options.minHistoryDays) continue;

    const calibration: RequirementCalibration = new Map();
    for (const [horizon, residuals] of seen) {
      if (residuals.length < options.minCalibrationOrigins) continue;
      calibration.set(horizon, {
        q10: quantile(residuals, 0.1)!,
        q50: quantile(residuals, 0.5)!,
        q90: quantile(residuals, 0.9)!,
        n: residuals.length,
      });
    }

    const forecast = forecastAdequacy({
      days: history,
      episodes,
      ceilings,
      origin,
      horizonDays: options.horizonDays,
      calibration,
      demandOptions: options.demandOptions,
      hydroOptions: options.hydroOptions,
    });
    if (!forecast) continue;
    used.push(origin);

    for (const horizon of forecast.horizons) {
      const actual = realisedOver(byDate, episodes, origin, horizon.horizonDays);
      if (!actual) continue;
      const baseDemand = trailingMean(byDate, origin, (d) => d.loadGwh);
      const baseHydro = trailingMean(byDate, origin, (d) => d.hydroGwh);
      if (baseDemand === null || baseHydro === null) continue;

      points.demand.push({
        origin,
        horizonDays: horizon.horizonDays,
        error: horizon.demandGwhDay - actual.demand,
        baselineError: baseDemand - actual.demand,
        inBand: null,
      });
      points.hydro.push({
        origin,
        horizonDays: horizon.horizonDays,
        error: horizon.hydroGwhDay - actual.hydro,
        baselineError: baseHydro - actual.hydro,
        inBand: null,
      });
      points.requirement.push({
        origin,
        horizonDays: horizon.horizonDays,
        error: horizon.requirementGwhDay - actual.requirement,
        baselineError: baseDemand - baseHydro - actual.requirement,
        inBand:
          horizon.requirementP10 === null || horizon.requirementP90 === null
            ? null
            : actual.requirement >= horizon.requirementP10 && actual.requirement <= horizon.requirementP90,
      });

      // Only now, after this origin has been scored, does its residual join the calibration set.
      seen.get(horizon.horizonDays)!.push(actual.requirement - horizon.requirementGwhDay);
    }
  }

  const score = (component: "demand" | "hydro" | "requirement"): ComponentScores => ({
    component,
    horizons: options.horizonDays.map((horizonDays) => {
      const bucket = points[component].filter((p) => p.horizonDays === horizonDays);
      const mae = bucket.reduce((a, p) => a + Math.abs(p.error), 0) / (bucket.length || 1);
      const baseline = bucket.reduce((a, p) => a + Math.abs(p.baselineError), 0) / (bucket.length || 1);
      const banded = bucket.filter((p) => p.inBand !== null);
      return {
        horizonDays,
        n: bucket.length,
        maeGwhDay: mae,
        biasGwhDay: bucket.reduce((a, p) => a + p.error, 0) / (bucket.length || 1),
        baselineMaeGwhDay: baseline,
        skillVsPersistence: baseline > 0 ? 1 - mae / baseline : null,
        nBand: banded.length,
        coverageP10P90: banded.length > 0 ? banded.filter((p) => p.inBand).length / banded.length : null,
      };
    }),
  });

  const calibration: RequirementCalibration = new Map();
  for (const [horizon, residuals] of seen) {
    if (residuals.length < options.minCalibrationOrigins) continue;
    calibration.set(horizon, {
      q10: quantile(residuals, 0.1)!,
      q50: quantile(residuals, 0.5)!,
      q90: quantile(residuals, 0.9)!,
      n: residuals.length,
    });
  }

  return { origins: used, scores: [score("demand"), score("hydro"), score("requirement")], calibration };
}

/* ----------------------------------------------------------- crisis check */

export interface EpisodeCheck {
  start: IsoDate;
  end: IsoDate;
  days: number;
  /** Mean unsuppressed demand the model says those days should have had. */
  modelledDemandGwhDay: number;
  /** Mean load actually metered. */
  measuredLoadGwhDay: number;
  /** The difference: what the rationing took off the system, in GWh/day. */
  measuredSuppressionGwhDay: number;
  /** Mean hydro actually generated during the episode. */
  measuredHydroGwhDay: number;
  /** Deficit implied by the identity, using what imports actually delivered on those days. */
  impliedDeficitGwhDay: number;
  /** Imports actually metered, GWh/day — the number the demonstrated ceiling would have missed. */
  measuredImportGwhDay: number;
  /** Deficit the demonstrated import ceiling would have produced instead. */
  deficitAtDemonstratedImportsGwhDay: number;
}

export interface CrisisCheck {
  episodes: EpisodeCheck[];
  /** Tier the model assigns at each monthly origin, with whether rationing followed. */
  calls: { origin: IsoDate; horizonDays: number; tier: RiskTier; deficit: number; rationedWithin: boolean }[];
}

/**
 * The only outcome in this module that can be checked against reality.
 *
 * A deficit is a counterfactual — it is the energy that would have been short had nobody
 * rationed — so it cannot be verified against a measurement directly. But during an episode it
 * has an observable shadow: the gap between what the demand model says the country wanted and
 * what the meters recorded. If the identity is right, that gap and the computed deficit should
 * be the same size. They are: see `data/reports/adequacy.md`.
 */
export function crisisCheck(
  days: readonly BalanceDay[],
  episodes: readonly RationingEpisode[],
  ceilings: Ceilings,
  backtest: AdequacyBacktest,
  options: BacktestOptions = DEFAULT_ADEQUACY_BACKTEST,
): CrisisCheck {
  const checks: EpisodeCheck[] = [];

  for (const episode of episodes) {
    const end = episode.end === "" ? days.at(-1)!.date : episode.end;
    // Fitted at the origin before the episode, so the trend is not bent by the episode itself.
    const fit = fitDemand(days.filter((d) => d.date < episode.start), addDays(episode.start, -1), episodes);
    if (!fit) continue;
    const inside = days.filter((d) => d.date >= episode.start && d.date <= end);
    if (inside.length === 0) continue;

    const mean = (pick: (day: BalanceDay) => number): number =>
      inside.reduce((a, d) => a + pick(d), 0) / inside.length;
    const modelled = inside.reduce((a, d) => a + fit.predict(d.date), 0) / inside.length;
    const hydro = mean((d) => d.hydroGwh);
    const imports = mean((d) => d.importGwh);
    const floor = ceilings.thermalGwhDay + ceilings.otherGwhDay;

    checks.push({
      start: episode.start,
      end,
      days: inside.length,
      modelledDemandGwhDay: modelled,
      measuredLoadGwhDay: mean((d) => d.loadGwh),
      measuredSuppressionGwhDay: modelled - mean((d) => d.loadGwh),
      measuredHydroGwhDay: hydro,
      measuredImportGwhDay: imports,
      impliedDeficitGwhDay: modelled - hydro - floor - imports,
      deficitAtDemonstratedImportsGwhDay: modelled - hydro - floor - ceilings.importGwhDay,
    });
  }

  const calls: CrisisCheck["calls"] = [];
  for (const origin of backtest.origins) {
    const history = days.filter((d) => d.date <= origin);
    const forecast = forecastAdequacy({
      days: history,
      episodes,
      ceilings,
      origin,
      horizonDays: options.horizonDays,
      calibration: backtest.calibration,
      demandOptions: options.demandOptions,
      hydroOptions: options.hydroOptions,
    });
    if (!forecast) continue;
    for (const horizon of forecast.horizons) {
      let rationed = false;
      for (let day = 1; day <= horizon.horizonDays; day++) {
        if (suppressed(episodes, addDays(origin, day), 0)) {
          rationed = true;
          break;
        }
      }
      calls.push({
        origin,
        horizonDays: horizon.horizonDays,
        tier: horizon.tier,
        deficit: horizon.deficitGwhDay,
        rationedWithin: rationed,
      });
    }
  }

  return { episodes: checks, calls };
}

/* --------------------------------------------------------------- document */

export interface DocumentInputs {
  forecast: AdequacyForecast;
  backtest: AdequacyBacktest;
  crisis: CrisisCheck;
  usableDays: number;
  rejectedDays: number;
  generatedAt?: string;
}

function hashOf(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

export interface AdequacyDocument extends Record<string, unknown> {
  generated_at: string;
  run_id: string;
  origin_date: IsoDate;
  current: Record<string, unknown>;
  horizons: Record<string, unknown>[];
}

export function buildAdequacyDocument(inputs: DocumentInputs): AdequacyDocument {
  const { forecast, backtest, crisis } = inputs;
  const generatedAt = inputs.generatedAt ?? nowUtc();
  // Everything that moves a number, and nothing that does not. `ceilings.basis` is deliberately
  // left out: it is a sentence explaining where the four values came from, and folding it in
  // would give a reworded comment a new run id and a second row for the same day — which is the
  // noise this hash exists to prevent, since an unchanged hash is supposed to mean a rerun would
  // write the same numbers.
  const featuresHash = hashOf({
    origin: forecast.origin,
    version: MODEL_VERSION,
    days: inputs.usableDays,
    demandDays: forecast.demand.days,
    demandAnchor: forecast.demand.anchor,
    hydroDays: forecast.hydro.days,
    hydroAnomaly: forecast.hydro.anomaly,
    thermal: forecast.ceilings.thermalGwhDay,
    imports: forecast.ceilings.importGwhDay,
    stressedImports: forecast.ceilings.stressedImportGwhDay,
    other: forecast.ceilings.otherGwhDay,
    horizons: forecast.horizons.map((h) => h.horizonDays),
  });
  const runId = `${forecast.origin}-adequacy-${MODEL_VERSION}-${featuresHash.slice(0, 8)}`;
  const worst = forecast.horizons.reduce((a, b) => (b.deficitGwhDay > a.deficitGwhDay ? b : a));
  const score = (component: string, horizon: number): HorizonScore | undefined =>
    backtest.scores.find((s) => s.component === component)?.horizons.find((h) => h.horizonDays === horizon);

  return {
    generated_at: generatedAt,
    run_id: runId,
    origin_date: forecast.origin,
    units: "GWh per day",
    disclaimer:
      "No es una fuente oficial. Cálculo estadístico de suficiencia a partir de datos públicos de CELEC y CENACE; " +
      "no representa la posición de ninguna institución ni sustituye la programación del operador.",
    model: {
      id: "adequacy-v1",
      label:
        "Demanda no suprimida (tendencia log-lineal con factores de día de semana y estación) " +
        "menos hidroeléctrica normalizada por esa tendencia, contra techos térmico e de importación demostrados",
      version: MODEL_VERSION,
      features_hash: featuresHash,
      backtest_origins: backtest.origins.length,
    },
    data: {
      usable_days: inputs.usableDays,
      rejected_days: inputs.rejectedDays,
      demand_fit_days: forecast.demand.days,
      demand_growth_pct_per_year: roundTo(forecast.demand.growthPctPerYear, 2),
      hydro_fit_days: forecast.hydro.days,
      hydro_anomaly: roundTo(forecast.hydro.anomaly, 4),
      hydro_anomaly_note:
        "Hidroeléctrica de los últimos 14 días dividida por su propia climatología del mismo período. " +
        "1,00 es una quincena normal; por debajo de 1 el sistema llega seco.",
    },
    assumptions: {
      thermal_gwh_day: roundTo(forecast.ceilings.thermalGwhDay, 3),
      import_gwh_day: roundTo(forecast.ceilings.importGwhDay, 3),
      stressed_import_gwh_day: roundTo(forecast.ceilings.stressedImportGwhDay, 3),
      other_gwh_day: roundTo(forecast.ceilings.otherGwhDay, 3),
      basis: forecast.ceilings.basis,
      editable_at: "data/reference/adequacy_assumptions.csv",
    },
    current: {
      tier: forecast.horizons[0]!.tier,
      worst_tier: worst.tier,
      worst_tier_horizon_days: worst.horizonDays,
      worst_deficit_gwh_day: roundTo(Math.max(0, worst.deficitGwhDay), 3),
    },
    horizons: forecast.horizons.map((h) => ({
      horizon_days: h.horizonDays,
      target_date: h.targetDate,
      demand_gwh_day: roundTo(h.demandGwhDay, 3),
      hydro_gwh_day: roundTo(h.hydroGwhDay, 3),
      requirement_gwh_day: roundTo(h.requirementGwhDay, 3),
      requirement_p10: roundOrNull(h.requirementP10, 3),
      requirement_p90: roundOrNull(h.requirementP90, 3),
      deficit_gwh_day: roundTo(h.deficitGwhDay, 3),
      deficit_p10: roundOrNull(h.deficitP10, 3),
      deficit_p90: roundOrNull(h.deficitP90, 3),
      stressed_deficit_gwh_day: roundTo(h.stressedDeficitGwhDay, 3),
      margin_pct: roundTo(h.marginPct, 2),
      tier: h.tier,
      backtest: {
        demand_mae_gwh_day: roundOrNull(score("demand", h.horizonDays)?.maeGwhDay, 3),
        demand_skill_vs_persistence: roundOrNull(score("demand", h.horizonDays)?.skillVsPersistence, 4),
        hydro_mae_gwh_day: roundOrNull(score("hydro", h.horizonDays)?.maeGwhDay, 3),
        hydro_skill_vs_persistence: roundOrNull(score("hydro", h.horizonDays)?.skillVsPersistence, 4),
        requirement_mae_gwh_day: roundOrNull(score("requirement", h.horizonDays)?.maeGwhDay, 3),
        requirement_skill_vs_persistence: roundOrNull(score("requirement", h.horizonDays)?.skillVsPersistence, 4),
        requirement_coverage_p10_p90: roundOrNull(score("requirement", h.horizonDays)?.coverageP10P90, 4),
        n: score("requirement", h.horizonDays)?.n ?? 0,
      },
    })),
    tiers: {
      definition: {
        holgado: "el caso p90 sigue cubierto",
        vigilancia: "el p90 queda corto, el caso central no",
        ajustado: `el caso central queda corto en menos de ${TIGHT_GWH_DAY} GWh/día`,
        deficit: `el caso central queda corto en ${TIGHT_GWH_DAY} GWh/día o más`,
      },
      tight_gwh_day: TIGHT_GWH_DAY,
    },
    tier_history: (() => {
      // What the tiers said at a 30-day horizon across every backtest origin, and what followed.
      // Two rates rather than one: a model that flags every month has perfect recall and no
      // information, and a model that flags nothing has perfect precision and no use.
      const thirty = crisis.calls.filter((c) => c.horizonDays === 30);
      const flagged = thirty.filter((c) => c.tier === "ajustado" || c.tier === "deficit");
      const followed = thirty.filter((c) => c.rationedWithin);
      const hits = flagged.filter((c) => c.rationedWithin);
      return {
        horizon_days: 30,
        origins: thirty.length,
        origins_followed_by_rationing: followed.length,
        origins_flagged: flagged.length,
        flagged_and_followed: hits.length,
        share_of_flagged_that_preceded_cuts: flagged.length > 0 ? roundTo(hits.length / flagged.length, 4) : null,
        share_of_cuts_that_were_flagged: followed.length > 0 ? roundTo(hits.length / followed.length, 4) : null,
        note:
          "Tres episodios no son una muestra con la que ajustar un umbral, y ningún umbral de aquí " +
          "se ajustó a ellos.",
      };
    })(),
    crisis_check: {
      note:
        "Un déficit es un contrafactual y no se puede medir. Durante un racionamiento sí deja una sombra " +
        "observable: la diferencia entre la demanda que el modelo dice que hubo y la que registraron los medidores.",
      episodes: crisis.episodes.map((e) => ({
        start: e.start,
        end: e.end,
        days: e.days,
        modelled_demand_gwh_day: roundTo(e.modelledDemandGwhDay, 2),
        measured_load_gwh_day: roundTo(e.measuredLoadGwhDay, 2),
        measured_suppression_gwh_day: roundTo(e.measuredSuppressionGwhDay, 2),
        measured_hydro_gwh_day: roundTo(e.measuredHydroGwhDay, 2),
        measured_import_gwh_day: roundTo(e.measuredImportGwhDay, 3),
        implied_deficit_gwh_day: roundTo(e.impliedDeficitGwhDay, 2),
        deficit_at_demonstrated_imports_gwh_day: roundTo(e.deficitAtDemonstratedImportsGwhDay, 2),
      })),
    },
    see_also: {
      report: "data/reports/adequacy.md",
      forecast: "/api/forecast.json",
      latest: "/api/latest.json",
    },
  };
}

/** Days between two dates, exported so the report can state an episode's length without re-deriving it. */
export function spanDays(from: IsoDate, to: IsoDate): number {
  return daysBetween(from, to) + 1;
}
