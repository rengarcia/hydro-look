/**
 * The reservoir physics the forecast needs, fitted from this repository's own data.
 *
 * Two things have to be known before a level can be projected forward: how much water a metre
 * of level is worth, and how much water leaves each day. Neither is published. CELEC declares
 * an operating band and a storage figure, and the plan's `plants.csv` carries 410 hm3 for Mazar
 * marked `unverified` because it came from press; nothing upstream gives an area-elevation
 * table. Both are recoverable from the series we already hold, and the recovery is checkable,
 * which is the point of doing it here rather than digitising a number out of a PDF.
 *
 * **The curve.** Take the days when Mazar generates almost nothing: outflow is near zero, so
 * the level rise is the inflow spread over the reservoir surface, and the surface area falls
 * out as `A = Q_in * 86400 / dLevel`. Doing that by level band gives roughly 4.2 km2 at 2110
 * rising to 11.2 km2 at 2150 — a smooth, increasing, entirely ordinary hypsometry. It also
 * shows where the method stops: above 2153 the same arithmetic returns about 103 km2, which is
 * not a reservoir that suddenly grew tenfold but a reservoir that is spilling, with the level
 * pinned at the crest while water pours through. Those days are excluded from the fit and the
 * simulation caps there instead.
 *
 * That estimate is biased high, and badly, which is why it is the sanity check and not the fit.
 * A day with "almost no" generation still releases plenty: Mazar's job in the cascade is to
 * regulate for Molino downstream, so water leaves through the outlet whether or not Mazar's own
 * machines are turning, and attributing all of the inflow to storage inflates the area by
 * whatever share left. Measured against the fit below it is high by about 1.7x. Read it for the
 * *shape* — area rising smoothly with level, and the regime break at the crest — not the level.
 *
 * **The fit.** `A(level) = a * (level - datum)^b`, so storage is the integral,
 * `V(level) = a * (level - datum)^(b+1) / (b+1)`, and the balance over one local day is
 *
 *     V(level_{t+1}) - V(level_t) = 86400 * (Q_in(t) - k * P(t))
 *
 * with `P` the day's mean power in MW and `k` the turbined m3/s each MW costs. For a fixed
 * `b` and `datum` this is *linear* in `a` and `k`, which is why the search below is a small
 * grid over the two awkward parameters with an exact least-squares solve inside it rather than
 * a general optimiser nobody can audit. The weights matter: solved plainly, the residual is in
 * cubic metres and a flood day counts for a hundred quiet ones. Weighting each day by `1/A^2`
 * puts the residual back into metres of level, the units the forecast is scored in. That is the
 * iteration: solve, re-weight, repeat.
 *
 * **`datum` and `b` are not separately identified, and it does not matter.** Many pairs describe
 * the same curve over the fifty metres the reservoir actually occupies, so the grid's choice
 * between them is close to arbitrary and lands wherever it likes, including on an edge. What is
 * determined is the curve: across datums from 1906 to 2096 and exponents from 0.5 to 6, the fit
 * residual moves by 0.001 m, the area at 2130 by 0.05 km2, and the storage from 2100 to 2153 by
 * 4 hm3 out of 208. Nothing downstream reads `datum` or `b` on their own — only `areaAt`,
 * `volumeAt` and `levelAt`, which is the part that is real.
 *
 * **What comes out, and what it agrees with.** The fitted curve puts 2100 -> 2153 at about
 * 208 hm3 and `k` at about 0.67 m3/s per MW, so 170 MW turbines roughly 114 m3/s. Two
 * independent readings exist to hold that against. The 113 days of `repDiaPotQTurb` put turbined
 * flow at a maximum of 129 m3/s, which fits. The unverified 410 hm3 in `plants.csv` does not,
 * and it is worth seeing why the disagreement cannot be resolved by simply believing the larger
 * figure: `a` and `k` are fitted *together*, and doubling the area to match the quiet-day
 * estimate would force `k` down through zero to keep the balance closed — a turbine that
 * consumes no water. The balance only closes at one scale, and this is it. Whether 410 hm3 is
 * gross storage including the dead pool, or simply wrong, is not settled here.
 *
 * None of this is treated as confirmation. The curve is used because the forecast built on it is
 * backtested, and every number above is republished in `forecast.json` so it can be argued with.
 */

import type { IsoDate } from "../util/dates.ts";
import { addDays } from "../util/dates.ts";
import type { DailySeries } from "./series.ts";

const SECONDS_PER_DAY = 86_400;

/**
 * `addDays(date, 1)`, memoised. The balance, the implied releases and the analogue paths all
 * step through the record a day at a time, once per origin and per variant, and `addDays` is a
 * `Date` parse and format each time: it was a third of a forecast run's CPU before this. The
 * memo holds one entry per distinct day ever asked about, which is bounded by the record.
 */
const NEXT_DAY = new Map<IsoDate, IsoDate>();

export function nextDay(date: IsoDate): IsoDate {
  let next = NEXT_DAY.get(date);
  if (next === undefined) {
    next = addDays(date, 1);
    NEXT_DAY.set(date, next);
  }
  return next;
}

export interface Hypsometry {
  /** `A(level) = areaCoefficient * (level - datumM)^areaExponent`, in m2. */
  areaCoefficient: number;
  areaExponent: number;
  /** The level the power law is measured from; below the reservoir, never a real elevation. */
  datumM: number;
  /** Turbined flow per MW of daily-mean power, m3/s per MW. */
  turbineM3sPerMw: number;
  /** Fit residual in the units the forecast is scored in. */
  rmseDeltaLevelM: number;
  /** Days that entered the fit, after the spill regime was excluded. */
  days: number;
  /** Days at or above this level were left out: the level is pinned and the balance is not closed. */
  fitCeilingM: number;
}

export function areaAt(curve: Hypsometry, level: number): number {
  return curve.areaCoefficient * Math.pow(Math.max(level - curve.datumM, 1e-6), curve.areaExponent);
}

export function volumeAt(curve: Hypsometry, level: number): number {
  const exponent = curve.areaExponent + 1;
  return (curve.areaCoefficient * Math.pow(Math.max(level - curve.datumM, 1e-6), exponent)) / exponent;
}

export function levelAt(curve: Hypsometry, volume: number): number {
  const exponent = curve.areaExponent + 1;
  return curve.datumM + Math.pow((Math.max(volume, 1) * exponent) / curve.areaCoefficient, 1 / exponent);
}

/** Storage between two levels, in hm3, which is the unit CELEC publishes. */
export function storageHm3(curve: Hypsometry, fromLevel: number, toLevel: number): number {
  return (volumeAt(curve, toLevel) - volumeAt(curve, fromLevel)) / 1e6;
}

export interface BalanceDay {
  date: IsoDate;
  level: number;
  nextLevel: number;
  inflowM3s: number;
  powerMw: number;
}

/**
 * Consecutive local days carrying everything the balance needs. A gap in any series drops the
 * day rather than interpolating it: an invented level would be fitted as though it were read.
 */
export function balanceDays(levels: DailySeries, inflow: DailySeries, production: DailySeries, before?: IsoDate): BalanceDay[] {
  const out: BalanceDay[] = [];
  for (const [date, level] of levels) {
    if (before !== undefined && date >= before) continue;
    const nextLevel = levels.get(nextDay(date));
    const inflowM3s = inflow.get(date);
    const producedMwh = production.get(date);
    if (nextLevel === undefined || inflowM3s === undefined || producedMwh === undefined) continue;
    out.push({ date, level, nextLevel, inflowM3s, powerMw: producedMwh / 24 });
  }
  return out;
}

const EXPONENT_GRID = Array.from({ length: 13 }, (_, i) => 0.5 + i * 0.25);
/** How far below the lowest level ever seen the power law is anchored. */
const DATUM_OFFSETS_M = [10, 30, 50, 70];

/**
 * Least squares for `a` and `k` at a fixed shape, weighted so the residual is in metres.
 * Returns null when the pair is not identifiable, which a degenerate grid corner can be.
 */
function solveAt(days: BalanceDay[], exponent: number, datum: number, iterations = 8): { coefficient: number; perMw: number } | null {
  const power = exponent + 1;
  const storageDelta = days.map((d) => (Math.pow(d.nextLevel - datum, power) - Math.pow(d.level - datum, power)) / power);
  const inflowVolume = days.map((d) => d.inflowM3s * SECONDS_PER_DAY);
  const powerVolume = days.map((d) => d.powerMw * SECONDS_PER_DAY);
  let weights = days.map(() => 1);
  let coefficient = 0;
  let perMw = 0;

  for (let pass = 0; pass < iterations; pass++) {
    let uu = 0;
    let up = 0;
    let pp = 0;
    let uq = 0;
    let pq = 0;
    for (let i = 0; i < days.length; i++) {
      const w = weights[i]!;
      const u = storageDelta[i]!;
      const p = powerVolume[i]!;
      const q = inflowVolume[i]!;
      uu += w * u * u;
      up += w * u * p;
      pp += w * p * p;
      uq += w * u * q;
      pq += w * p * q;
    }
    const determinant = uu * pp - up * up;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) return null;
    coefficient = (uq * pp - pq * up) / determinant;
    perMw = (uu * pq - up * uq) / determinant;
    if (!(coefficient > 0)) return null;
    weights = days.map((d) => 1 / Math.pow(Math.max(coefficient * Math.pow(d.level - datum, exponent), 1e3), 2));
  }
  return { coefficient, perMw };
}

export interface HypsometryOptions {
  /** Levels at or above this are spilling; they are excluded from the fit. */
  fitCeilingM: number;
}

/**
 * Fits the curve on `days`. Every candidate shape is scored by the error in *level*, the
 * quantity the forecast is judged on, so the grid is not choosing on a different criterion
 * from the one the weights encode.
 */
export function fitHypsometry(days: BalanceDay[], options: HypsometryOptions): Hypsometry {
  const usable = days.filter((d) => Math.max(d.level, d.nextLevel) < options.fitCeilingM);
  if (usable.length < 60) {
    throw new Error(`hypsometry needs at least 60 complete balance days, got ${usable.length}`);
  }
  const lowest = Math.min(...usable.map((d) => Math.min(d.level, d.nextLevel)));

  let best: Hypsometry | null = null;
  for (const offset of DATUM_OFFSETS_M) {
    const datum = lowest - offset;
    for (const exponent of EXPONENT_GRID) {
      const solved = solveAt(usable, exponent, datum);
      if (!solved || !(solved.perMw > 0)) continue;
      const candidate: Hypsometry = {
        areaCoefficient: solved.coefficient,
        areaExponent: exponent,
        datumM: datum,
        turbineM3sPerMw: solved.perMw,
        rmseDeltaLevelM: Number.POSITIVE_INFINITY,
        days: usable.length,
        fitCeilingM: options.fitCeilingM,
      };
      let squared = 0;
      for (const day of usable) {
        const volume = volumeAt(candidate, day.level) + SECONDS_PER_DAY * (day.inflowM3s - candidate.turbineM3sPerMw * day.powerMw);
        squared += Math.pow(levelAt(candidate, volume) - day.nextLevel, 2);
      }
      candidate.rmseDeltaLevelM = Math.sqrt(squared / usable.length);
      if (!best || candidate.rmseDeltaLevelM < best.rmseDeltaLevelM) best = candidate;
    }
  }
  if (!best) throw new Error("hypsometry: no candidate curve was identifiable on this data");
  return best;
}

export interface ImpliedRelease {
  date: IsoDate;
  level: number;
  /** m3/s that must have left the reservoir for the level to move as it did. */
  releaseM3s: number;
}

/**
 * The balance read backwards: given the inflow and the level on both ends of a day, whatever
 * did not stay must have left. This is the *total* release — turbines, spill, ecological flow,
 * leakage and any reading error in the three inputs, all of it lumped together.
 *
 * Lumping is the point. The alternative is to model turbined flow from generation and call the
 * rest zero, and the rest is not zero: over 2023 and 2024 a turbine-only balance drifts high by
 * about 0.27 m a day, which compounds to eight metres over a 30-day forecast. Whatever that
 * water is, it leaves, and a series that measures it beats a model that omits it.
 */
export function impliedReleases(curve: Hypsometry, levels: DailySeries, inflow: DailySeries, before?: IsoDate): ImpliedRelease[] {
  const out: ImpliedRelease[] = [];
  for (const [date, level] of levels) {
    if (before !== undefined && date >= before) continue;
    const nextLevel = levels.get(nextDay(date));
    const inflowM3s = inflow.get(date);
    if (nextLevel === undefined || inflowM3s === undefined) continue;
    const stored = volumeAt(curve, nextLevel) - volumeAt(curve, level);
    out.push({ date, level, releaseM3s: inflowM3s - stored / SECONDS_PER_DAY });
  }
  return out;
}

/**
 * Trims the tails before anything is fitted to them. A release far outside the bulk of the
 * distribution is a level that jumped — a re-survey, a replaced sensor, a reading published
 * against the wrong day — and a median taken over a level band should not be moved by one.
 *
 * Trimming is by *rank*, not by value against a quantile: a value-based bound computed from
 * the same sample is satisfied by its own extremes, so at a hundred readings the p1/p99 cut
 * keeps the very outliers it was written to remove. Dropping a fixed share from each end has
 * no such fixed point. A share rather than a count, because the bounds that suit Mazar's four
 * thousand days do not suit a reservoir with three hundred.
 */
export function trimReleases(readings: ImpliedRelease[], dropLowFraction = 0.01, dropHighFraction = 0.01): ImpliedRelease[] {
  if (readings.length < 20) return readings;
  const dropLow = Math.floor(readings.length * dropLowFraction);
  const dropHigh = Math.floor(readings.length * dropHighFraction);
  if (dropLow === 0 && dropHigh === 0) return readings;
  const sorted = [...readings].sort((a, b) => a.releaseM3s - b.releaseM3s);
  const kept = new Set(sorted.slice(dropLow, sorted.length - dropHigh));
  // Filtering the original preserves date order, which the stance window then relies on.
  return readings.filter((reading) => kept.has(reading));
}
