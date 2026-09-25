/**
 * Streamflow return periods from GEOGLOWS, the model INAMHI's portal is built on, and the same
 * statistic computed from the inflow CELEC measures.
 *
 * INAMHI publishes its hydrological forecasts for Ecuador through the INAMHI–GEOGLOWS portal
 * (`inamhi.geoglows.org`), whose Hydroviewer colours every river by the return period its
 * forecast flow reaches. Those thresholds come from the GEOGLOWS River Forecast System v2
 * retrospective simulation: 1940 → present on TDX-Hydro rivers, annual maxima fitted with a Gumbel
 * (type I) distribution by the method of moments, and published as a Zarr store in the public
 * `geoglows-v2` bucket. `scripts/geoglows.ts` reads that store; this module is the arithmetic, all
 * of it pure so that it is tested on numbers small enough to check by hand:
 *
 * - **Which river is the dam's.** GEOGLOWS' discharge is at each river segment's outlet, so the
 *   segment is picked by drainage area against the catchment `npm run catchments` delineated,
 *   among the segments whose reach can hold the pour point. The areas are two independent
 *   delineations (TDX-Hydro and Copernicus GLO-90) agreeing or not, which is the check.
 * - **The same statistic from the record.** Annual maxima of the daily inflow and the same
 *   method-of-moments Gumbel, so the model's thresholds and the measured ones sit side by side.
 */

import type { DailySeries } from "../features/series.ts";
import type { LatLon } from "../probe/basins.ts";
import { kmApart } from "../probe/basins.ts";
import { roundTo } from "../util/numbers.ts";

/** The return periods GEOGLOWS v2 publishes, in years. */
export const RETURN_PERIODS = [2, 5, 10, 25, 50, 100] as const;

export interface ReturnPeriodValue {
  years: number;
  m3s: number;
}

// ------------------------------------------------------------------------------------------
// Gumbel by the method of moments
// ------------------------------------------------------------------------------------------

const EULER_GAMMA = 0.5772156649;

/**
 * The Gumbel frequency factor: how many standard deviations above the mean the `years`-year
 * annual maximum sits. GEOGLOWS writes the same thing as
 * `-ln(-ln(1 - 1/T)) * 0.7797 * std + mean - 0.45 * std`.
 */
export function gumbelFactor(years: number): number {
  if (!(years > 1)) throw new Error(`a return period must exceed one year, got ${years}`);
  return -(Math.sqrt(6) / Math.PI) * (EULER_GAMMA + Math.log(Math.log(years / (years - 1))));
}

/** Method-of-moments Gumbel quantiles of a sample of annual maxima (sample standard deviation). */
export function gumbelReturnPeriods(maxima: readonly number[], periods: readonly number[] = RETURN_PERIODS): ReturnPeriodValue[] {
  if (maxima.length < 2) throw new Error(`a Gumbel fit needs at least two annual maxima, got ${maxima.length}`);
  const mean = maxima.reduce((a, b) => a + b, 0) / maxima.length;
  const sd = Math.sqrt(maxima.reduce((a, b) => a + (b - mean) ** 2, 0) / (maxima.length - 1));
  return periods.map((years) => ({ years, m3s: mean + gumbelFactor(years) * sd }));
}

export interface AnnualMaximum {
  year: number;
  m3s: number;
  date: string;
  /** Days of the year with a reading. */
  days: number;
}

/**
 * The largest daily value of every calendar year with at least `minDays` readings. A year with
 * fewer is left out rather than counted: its maximum may simply be the wet month it is missing.
 */
export function annualMaxima(series: DailySeries, minDays = 330): AnnualMaximum[] {
  const byYear = new Map<number, AnnualMaximum>();
  for (const [date, value] of series) {
    const year = Number(date.slice(0, 4));
    const current = byYear.get(year);
    if (!current) byYear.set(year, { year, m3s: value, date, days: 1 });
    else {
      current.days++;
      if (value > current.m3s) Object.assign(current, { m3s: value, date });
    }
  }
  return [...byYear.values()].filter((y) => y.days >= minDays).sort((a, b) => a.year - b.year);
}

/** The longest return period whose flow `m3s` reaches, or null below the shortest one. */
export function returnPeriodReached(m3s: number, table: readonly ReturnPeriodValue[]): number | null {
  let reached: number | null = null;
  for (const row of [...table].sort((a, b) => a.years - b.years)) if (m3s >= row.m3s) reached = row.years;
  return reached;
}

export const roundTable = (table: readonly ReturnPeriodValue[], digits = 1): ReturnPeriodValue[] =>
  table.map((r) => ({ years: r.years, m3s: roundTo(r.m3s, digits) }));

// ------------------------------------------------------------------------------------------
// Matching a dam to a GEOGLOWS river
// ------------------------------------------------------------------------------------------

/** One TDX-Hydro river segment as GEOGLOWS' tables describe it. */
export interface RiverSegment extends LatLon {
  riverId: number;
  downstreamId: number;
  vpu: number;
  /** Drainage area at the segment's upstream and downstream ends, km². */
  upstreamKm2: number;
  downstreamKm2: number;
  lengthKm: number;
}

export interface PourPoint extends LatLon {
  /** The catchment above the pour point, km², from `data/reports/catchments.json`. */
  areaKm2: number;
}

export interface RiverCandidate {
  segment: RiverSegment;
  /** Pour point to the point GEOGLOWS' metadata table gives for the segment, km. */
  distanceKm: number;
  /** `downstreamKm2 / areaKm2 − 1`, as a percentage. */
  areaDiffPct: number;
}

export interface RiverMatch {
  chosen: RiverCandidate | null;
  /** Every segment whose reach could hold the pour point, best area first. */
  candidates: RiverCandidate[];
  rule: string;
}

export interface MatchOptions {
  /** Slack beyond half the segment's length within which the pour point counts as on its reach, km. */
  reachSlackKm: number;
  /** The largest area disagreement accepted, percent. Beyond it the dam has no GEOGLOWS river. */
  maxAreaDiffPct: number;
}

export const MATCH_DEFAULTS: MatchOptions = { reachSlackKm: 2, maxAreaDiffPct: 10 };

/**
 * The GEOGLOWS river whose outlet flow stands for the dam's inflow.
 *
 * The metadata table gives one point per segment, not its line, so "the pour point is on this
 * segment" is approximated by distance: within half the segment's length plus a slack. Among
 * those, the segment whose downstream drainage area is closest to the delineated catchment wins —
 * not the nearest one, because two 90 m networks put a confluence a few hundred metres apart,
 * and at Coca Codo Sinclair, where the Salado joins the Quijos at the intake, the nearest
 * segment drains 26% less than the dam does.
 */
export function matchRiver(pour: PourPoint, segments: readonly RiverSegment[], options: MatchOptions = MATCH_DEFAULTS): RiverMatch {
  const candidates = segments
    .map((segment) => ({
      segment,
      distanceKm: kmApart(pour, segment),
      areaDiffPct: roundTo((segment.downstreamKm2 / pour.areaKm2 - 1) * 100, 2),
    }))
    .filter((c) => c.distanceKm <= c.segment.lengthKm / 2 + options.reachSlackKm)
    .sort((a, b) => Math.abs(a.areaDiffPct) - Math.abs(b.areaDiffPct) || a.distanceKm - b.distanceKm);
  const best = candidates[0];
  return {
    chosen: best && Math.abs(best.areaDiffPct) <= options.maxAreaDiffPct ? best : null,
    candidates,
    rule:
      `segments whose point lies within half their length + ${options.reachSlackKm} km of the pour point; ` +
      `closest downstream drainage area to the delineated catchment, within ±${options.maxAreaDiffPct}%`,
  };
}
