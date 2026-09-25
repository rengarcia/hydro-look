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

// ------------------------------------------------------------------------------------------
// The model's simulated flow against the measured inflow
// ------------------------------------------------------------------------------------------

export interface QuantileRatio {
  /** Percentile of each series' own distribution over the shared days. */
  percentile: number;
  measured: number;
  simulated: number;
  /** Simulated ÷ measured at that percentile. */
  ratio: number;
}

export interface AnnualPair {
  year: number;
  measured: number;
  measuredDate: string;
  simulated: number;
  simulatedDate: string;
}

export interface FlowAgreement {
  days: number;
  first: string;
  last: string;
  measuredMean: number;
  simulatedMean: number;
  /** Mean simulated ÷ mean measured over every shared day. */
  ratio: number;
  /** Pearson correlation of the daily values. */
  r: number;
  /** The same on monthly means, over months with at least 20 shared days: timing errors of a few days wash out. */
  rMonthly: number | null;
  months: number;
  /** Kling–Gupta efficiency: 1 is perfect, below −0.41 is worse than the measured mean. */
  kge: number;
  /**
   * Each series' own percentiles, compared: independent of timing, so a model that gets the days
   * wrong still reads a flat ratio if its distribution is the measured one scaled. A reading that
   * saturates at high flow shows as a ratio that climbs at the top percentiles, because the
   * model's floods keep growing and the reading does not.
   */
  quantiles: QuantileRatio[];
  /** Annual maxima of both, over the complete measured years and on the shared days only. */
  annual: AnnualPair[];
  /** The Gumbel fit on the simulated maxima of those same years: the model's own answer on the record's years. */
  simulatedSameYears: ReturnPeriodValue[] | null;
}

export const FLOW_PERCENTILES = [10, 50, 90, 99, 99.9] as const;

/** The `p`-th percentile of an ascending array, by linear interpolation. */
function percentileSorted(sorted: readonly number[], p: number): number {
  const at = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(at);
  return sorted[lo]! + (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!) * (at - lo);
}

const meanOf = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function pearson(a: readonly number[], b: readonly number[]): number {
  const ma = meanOf(a);
  const mb = meanOf(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

export function compareFlows(measured: DailySeries, simulated: DailySeries, minYears = 5): FlowAgreement | null {
  const days = [...measured.keys()].filter((d) => simulated.has(d)).sort();
  if (days.length < 30) return null;
  const m = days.map((d) => measured.get(d)!);
  const s = days.map((d) => simulated.get(d)!);
  const mm = meanOf(m);
  const sm = meanOf(s);
  const sdm = Math.sqrt(meanOf(m.map((x) => (x - mm) ** 2)));
  const sds = Math.sqrt(meanOf(s.map((x) => (x - sm) ** 2)));
  const r = meanOf(m.map((x, i) => (x - mm) * (s[i]! - sm))) / (sdm * sds);
  const kge = 1 - Math.sqrt((r - 1) ** 2 + (sds / sdm - 1) ** 2 + (sm / mm - 1) ** 2);

  const byMonth = new Map<string, { m: number[]; s: number[] }>();
  days.forEach((d, i) => {
    const e = byMonth.get(d.slice(0, 7)) ?? byMonth.set(d.slice(0, 7), { m: [], s: [] }).get(d.slice(0, 7))!;
    e.m.push(m[i]!);
    e.s.push(s[i]!);
  });
  const monthly = [...byMonth.values()].filter((e) => e.m.length >= 20).map((e) => [meanOf(e.m), meanOf(e.s)] as const);
  const rMonthly =
    monthly.length >= 12
      ? pearson(
          monthly.map((x) => x[0]),
          monthly.map((x) => x[1]),
        )
      : null;

  const mSorted = [...m].sort((a, b) => a - b);
  const sSorted = [...s].sort((a, b) => a - b);
  const quantiles = FLOW_PERCENTILES.map((percentile) => {
    const measuredQ = percentileSorted(mSorted, percentile);
    const simulatedQ = percentileSorted(sSorted, percentile);
    return { percentile, measured: measuredQ, simulated: simulatedQ, ratio: simulatedQ / measuredQ };
  });

  const shared: DailySeries = new Map(days.map((d) => [d, measured.get(d)!]));
  const years = new Set(annualMaxima(shared).map((y) => y.year));
  const annual: AnnualPair[] = [];
  for (const year of [...years].sort()) {
    const inYear = days.filter((d) => d.startsWith(`${year}-`));
    const mBest = inYear.reduce((a, b) => (measured.get(b)! > measured.get(a)! ? b : a));
    const sBest = inYear.reduce((a, b) => (simulated.get(b)! > simulated.get(a)! ? b : a));
    annual.push({ year, measured: measured.get(mBest)!, measuredDate: mBest, simulated: simulated.get(sBest)!, simulatedDate: sBest });
  }
  return {
    days: days.length,
    first: days[0]!,
    last: days.at(-1)!,
    measuredMean: mm,
    simulatedMean: sm,
    ratio: sm / mm,
    r,
    rMonthly,
    months: monthly.length,
    kge,
    quantiles,
    annual,
    simulatedSameYears: annual.length >= minYears ? gumbelReturnPeriods(annual.map((a) => a.simulated)) : null,
  };
}

// ------------------------------------------------------------------------------------------
// The return periods INAMHI's Hydroviewer draws
// ------------------------------------------------------------------------------------------

/** INAMHI's Hydroviewer fits on the simulation from this year on (its historical series starts here). */
export const INAMHI_FIRST_YEAR = 1980;

/**
 * The return periods INAMHI's Hydroviewer draws for a river: not the GEOGLOWS store's 1940 → fit,
 * but the same method-of-moments Gumbel on the annual maxima of the daily simulation from 1980,
 * every calendar year counted, the current one included however far it has run. Reproduced for
 * Mazar's river to 0.1 m³/s against the portal's own chart (PLAN.md Phase 7).
 */
export function inamhiReturnPeriods(simulated: DailySeries, periods: readonly number[] = RETURN_PERIODS): ReturnPeriodValue[] {
  const fromFirstYear: DailySeries = new Map([...simulated].filter(([d]) => Number(d.slice(0, 4)) >= INAMHI_FIRST_YEAR));
  return gumbelReturnPeriods(
    annualMaxima(fromFirstYear, 1).map((m) => m.m3s),
    periods,
  );
}

/** The thresholds in a Hydroviewer `get-plots` answer: traces named "2 años: 599.6". */
export function portalReturnPeriods(traceNames: readonly string[]): ReturnPeriodValue[] {
  const out: ReturnPeriodValue[] = [];
  for (const name of traceNames) {
    const m = /^(\d+) años: ([\d.]+)$/.exec(name.trim());
    if (m) out.push({ years: Number(m[1]), m3s: Number(m[2]) });
  }
  return out.sort((a, b) => a.years - b.years);
}
