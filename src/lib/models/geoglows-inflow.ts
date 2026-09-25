/**
 * Can GEOGLOWS' forecast improve this repository's own inflow forecasts (§5.3)?
 *
 * On its own the forecast loses to persistence at every dam (`data/reports/geoglows-forecast.md`),
 * mostly because the model's volume is wrong by up to 2.8×. Used as a covariate it need not be
 * right about volume, only about *change*: this module turns each forecast into an anomaly against
 * the model's own climatology for the same calendar window — which cancels the volume bias — and
 * applies it to the measured climatology, then blends the result with the analogue rung. INAMHI's
 * hydropower forecast is already on the measured scale, so it is used as it stands and blended the
 * same way.
 *
 * All candidates are scored against the existing rungs on the same origins and windows, with a
 * block bootstrap on the paired error differences, because overlapping windows make neighbouring
 * origins far from independent. Pure functions; `scripts/geoglows-experiment.ts` runs them.
 */

import type { DailySeries } from "../features/series.ts";
import { addDays, type IsoDate } from "../util/dates.ts";
import { quantile } from "../util/stats.ts";
import { windowMean } from "./inflow.ts";

/** Mean of daily forecast values for leads 1..h (index 0 = lead 1), or null if any is missing. */
export function forecastWindowMean(daily: readonly (number | null)[], h: number): number | null {
  if (daily.length < h) return null;
  let total = 0;
  for (let k = 0; k < h; k++) {
    const v = daily[k];
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    total += v;
  }
  return total / h;
}

/**
 * The median over earlier years of a series' mean over the same calendar window `(origin, origin + h]`,
 * from `firstYear` to the year before the origin's. For the simulation, which reaches back to 1940,
 * this is the model's own sense of what is usual for those days.
 */
export function windowClimatology(series: DailySeries, origin: IsoDate, h: number, firstYear: number, minYears = 5): number | null {
  const md = origin.slice(5) === "02-29" ? "02-28" : origin.slice(5);
  const values: number[] = [];
  for (let year = firstYear; year < Number(origin.slice(0, 4)); year++) {
    const v = windowMean(series, `${year}-${md}`, h);
    if (v !== null) values.push(v);
  }
  return values.length >= minYears ? quantile(values, 0.5)! : null;
}

/**
 * The forecast as an anomaly on the measured climatology: `measuredClimatology × forecast ÷
 * simulatedClimatology`. The ratio is clamped like the analogue rung's, so a model that forecasts
 * a flood on a dry-season baseline cannot multiply the measured median tenfold.
 */
export function anomalyForecast(
  measuredClimatology: number,
  forecastMean: number,
  simulatedClimatology: number,
  bounds: readonly [number, number] = [0.33, 3],
): number | null {
  if (!(simulatedClimatology > 0) || !(forecastMean >= 0)) return null;
  return measuredClimatology * Math.min(bounds[1], Math.max(bounds[0], forecastMean / simulatedClimatology));
}

/** A paired comparison of two rungs' absolute errors, cases in origin order. */
export interface PairedDifference {
  /** Mean of |error A| − |error B|: negative means A is better. */
  meanDiff: number;
  /** 90% interval of that mean from a moving-block bootstrap. */
  lo: number;
  hi: number;
  n: number;
}

/**
 * Moving-block bootstrap of the mean paired difference. `block` consecutive cases are drawn
 * together, so the interval respects the correlation overlapping windows put between neighbours.
 * Deterministic (a fixed linear congruential stream), so the report does not change between runs.
 */
export function blockBootstrap(diffs: readonly number[], block: number, draws = 2000, seed = 12345): PairedDifference {
  const n = diffs.length;
  const meanDiff = n ? diffs.reduce((a, b) => a + b, 0) / n : Number.NaN;
  if (n < block * 2) return { meanDiff, lo: Number.NaN, hi: Number.NaN, n };
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const means: number[] = [];
  for (let d = 0; d < draws; d++) {
    let total = 0;
    let count = 0;
    while (count < n) {
      const start = Math.floor(next() * (n - block + 1));
      for (let i = 0; i < block && count < n; i++, count++) total += diffs[start + i]!;
    }
    means.push(total / n);
  }
  return { meanDiff, lo: quantile(means, 0.05)!, hi: quantile(means, 0.95)!, n };
}

/** The UTC day a forecast issued on `issued` starts on is the day after the last one CELEC has published. */
export const originForIssue = (issued: IsoDate): IsoDate => addDays(issued, -1);
