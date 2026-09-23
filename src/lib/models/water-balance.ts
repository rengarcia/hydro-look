/**
 * M3 — the water balance, closed around the operator.
 *
 * Section 7 specifies `V(t+1) = V(t) + 86400 * (Q_in - Q_turb - Q_spill)` with turbined flow
 * taken from generation. Built that way it is much *worse* than doing nothing: over the same
 * backtest it loses 25% to persistence at a week and 69% at ninety days, and the reason is
 * visible in the failure. Running the balance open-loop holds the release fixed at whatever it
 * recently was, and then the simulated reservoir either fills until it spills or empties until
 * it is dry, because nothing in it ever reacts. The real reservoir reacts constantly. Mazar's
 * level is not a hydrological outcome, it is an operating decision, and the decision responds
 * to the level: the implied release climbs from about 12 m3/s when the reservoir is near 2110
 * to about 106 m3/s when it is near the crest.
 *
 * So the release is modelled as what it is — a rule curve, fitted from the record, release as a
 * function of level — and the simulation reads it back on every simulated day. That one change
 * is the difference between the worst rung on the ladder and the only one worth shipping: a
 * tie with persistence out to a month, and 23% and 34% better at sixty and ninety days, where
 * an open-loop balance was 55% and 69% worse.
 *
 * Two further pieces:
 *
 * - **The operator's current stance.** The rule curve is the average of years of behaviour, and
 *   in any given fortnight the operator is above or below it — holding water back before a dry
 *   season, or running hard through a shortage. The median gap over the trailing month is
 *   carried into the simulation and allowed to decay back to the rule with a half-life of about
 *   three weeks. Keeping it forever, or dropping it at once, both score worse.
 * - **Inflow by analogue.** The same calendar window in every earlier year of record, each an
 *   equally weighted member. This is what makes the forecast probabilistic without assuming a
 *   distribution, and it is what the days-to-threshold scenarios in section 7 are drawn from:
 *   a dry year, a median year and a wet year are three real years, nameable in the output.
 *
 * What is *not* here, and is marked deferred rather than done: conditioning the analogue draw
 * on ONI phase or on the 16-day precipitation forecast. ONI is held back to 1950 and could be
 * used today; basin precipitation could not when this was written, because `basins.csv` carried
 * one provisional sampling point for Paute and nothing for the other six catchments. It now has
 * verified catchment centroids for all seven (Phase 4, 2026-09-23), but no ERA5 history at them
 * yet, and the conditioner has not been tried against the backtest. ENSO phase on its own is available,
 * so it was tried rather than argued about: `M3-water-balance-enso` keeps only the analogue
 * years whose ENSO phase matches the phase in effect at the origin — using the phase a
 * forecaster could actually have read, two months stale, never the label of the month itself.
 * It is worse at every horizon, by 3.5% at sixty days and 15% at a month, and it can only
 * forecast at 60 of the 105 origins because matching on phase starves a pool that had barely a
 * dozen members to begin with. It stays in the backtest as a recorded negative, not in the
 * shipped model. Precipitation is the conditioner worth having, and it waits on `basins.csv`.
 */

import { addDays, isCalendarDate } from "../util/dates.ts";
import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import type { Hypsometry } from "../features/hydrology.ts";
import {
  balanceDays,
  fitHypsometry,
  impliedReleases,
  levelAt,
  nextDay,
  trimReleases,
  volumeAt,
} from "../features/hydrology.ts";
import { median, quantile } from "../util/stats.ts";
import type { ForecastContext, HorizonForecast, Model } from "./types.ts";

const SECONDS_PER_DAY = 86_400;

export interface RulePoint {
  level: number;
  releaseM3s: number;
}

export interface ReleaseRule {
  /** Ascending by level; each point is the median implied release in that level band. */
  points: readonly RulePoint[];
  /** Below this the reservoir releases nothing; the taper keeps a draining simulation physical. */
  zeroAtM: number;
  /** Days of record behind the curve. */
  days: number;
}

export interface WaterBalanceOptions {
  /** Width of the level bands the rule curve is fitted in, m. */
  binWidthM: number;
  /** Bands with fewer days than this are dropped rather than fitted to noise. */
  minDaysPerBin: number;
  /** Trailing days the operator's current stance is read from. */
  stanceWindowDays: number;
  /** Per-day decay of that stance back toward the rule curve. */
  stanceDecay: number;
  /** Levels at or above this are excluded from the hypsometry fit; the reservoir is spilling. */
  fitCeilingM: number;
  /** Fewest analogue years that make an ensemble worth publishing. */
  minAnalogYears: number;
}

export const DEFAULT_WATER_BALANCE: WaterBalanceOptions = {
  binWidthM: 2.5,
  minDaysPerBin: 10,
  stanceWindowDays: 30,
  stanceDecay: 0.97,
  fitCeilingM: 2150,
  minAnalogYears: 4,
};

/**
 * Median implied release per level band. No monotonicity is imposed: the record has a dip
 * around 2140 that a smoother would erase, and there is no reason yet to believe it is noise
 * rather than two operating regimes at the same level in different years.
 */
export function fitReleaseRule(
  curve: Hypsometry,
  levels: DailySeries,
  inflow: DailySeries,
  before: IsoDate,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): ReleaseRule | null {
  const readings = trimReleases(impliedReleases(curve, levels, inflow, before));
  if (readings.length < options.minDaysPerBin) return null;

  const bins = new Map<number, number[]>();
  for (const reading of readings) {
    const band = Math.round(reading.level / options.binWidthM) * options.binWidthM;
    (bins.get(band) ?? bins.set(band, []).get(band)!).push(reading.releaseM3s);
  }

  const points: RulePoint[] = [];
  for (const [level, sample] of [...bins].sort(([a], [b]) => a - b)) {
    if (sample.length < options.minDaysPerBin) continue;
    const centre = median(sample);
    if (centre !== null) points.push({ level, releaseM3s: centre });
  }
  if (points.length < 2) return null;
  return { points, zeroAtM: curve.datumM, days: readings.length };
}

/**
 * Release at a level. Flat above the highest fitted band — above it the reservoir is spilling
 * and the crest cap, not this curve, is what limits the level — and tapering linearly to
 * nothing at the datum below the lowest, so a simulation that drains does not keep releasing
 * water it no longer has.
 */
export function releaseAt(rule: ReleaseRule, level: number): number {
  const first = rule.points[0]!;
  const last = rule.points[rule.points.length - 1]!;
  if (level <= rule.zeroAtM) return 0;
  if (level <= first.level) {
    return Math.max(0, (first.releaseM3s * (level - rule.zeroAtM)) / (first.level - rule.zeroAtM));
  }
  if (level >= last.level) return last.releaseM3s;
  for (let i = 1; i < rule.points.length; i++) {
    const upper = rule.points[i]!;
    if (level > upper.level) continue;
    const lower = rule.points[i - 1]!;
    const share = (level - lower.level) / (upper.level - lower.level);
    return lower.releaseM3s + share * (upper.releaseM3s - lower.releaseM3s);
  }
  return last.releaseM3s;
}

/** How far the last month's releases sat above or below the rule curve, in m3/s. */
export function recentStance(
  curve: Hypsometry,
  rule: ReleaseRule,
  levels: DailySeries,
  inflow: DailySeries,
  origin: IsoDate,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): number {
  const window = trimReleases(impliedReleases(curve, levels, inflow, addDays(origin, 1))).filter(
    (reading) => reading.date > addDays(origin, -options.stanceWindowDays),
  );
  return median(window.map((reading) => reading.releaseM3s - releaseAt(rule, reading.level))) ?? 0;
}

export interface AnalogPath {
  year: number;
  startDate: IsoDate;
  inflowM3s: readonly number[];
  totalHm3: number;
}

/**
 * The same calendar window in every earlier year that has a complete inflow record for it.
 * A year missing a single day is dropped rather than patched: a gap filled with a neighbour's
 * value would be a synthetic member of an ensemble whose whole claim is that its members are
 * real years.
 */
export function analogPaths(
  inflow: DailySeries,
  origin: IsoDate,
  days: number,
  accept?: (startDate: IsoDate) => boolean,
): AnalogPath[] {
  return analogPathsUpTo(inflow, origin, days, accept).filter((path) => path.inflowM3s.length === days);
}

/**
 * Every earlier year's window, each followed for as many of `maxDays` as its record runs
 * without a gap. `analogPaths(h)` is exactly the members here that reach `h`, so one call to
 * this serves every horizon: a member is built once and simulated once, and each horizon reads
 * the members long enough to reach it.
 */
export function analogPathsUpTo(
  inflow: DailySeries,
  origin: IsoDate,
  maxDays: number,
  accept?: (startDate: IsoDate) => boolean,
): AnalogPath[] {
  const firstYear = Number(inflow.keys().next().value?.slice(0, 4) ?? origin.slice(0, 4));
  const originYear = Number(origin.slice(0, 4));
  const monthDay = origin.slice(5);
  const out: AnalogPath[] = [];

  for (let year = firstYear; year <= originYear; year++) {
    const startDate = `${year}-${monthDay}`;
    // 29 February exists in the origin year but not in every analogue year, and an unchecked
    // `2021-02-29` parses cheerfully as 1 March rather than failing.
    if (!isCalendarDate(startDate)) continue;
    if (startDate >= origin) continue;
    if (accept && !accept(startDate)) continue;
    const path: number[] = [];
    let date = startDate;
    for (let day = 1; day <= maxDays; day++) {
      date = nextDay(date);
      const value = inflow.get(date);
      if (value === undefined) break;
      path.push(value);
    }
    if (path.length === 0) continue;
    out.push({
      year,
      startDate,
      inflowM3s: path,
      totalHm3: (path.reduce((a, b) => a + b, 0) * SECONDS_PER_DAY) / 1e6,
    });
  }
  return out;
}

export interface HorizonEnsemble {
  horizonDays: number;
  /** Simulated level at the horizon, one per member that reaches it. */
  ends: number[];
  years: number[];
}

/**
 * The analogue ensemble at every horizon from one simulation per member (§5.7 of ENHANCEMENTS).
 *
 * Each year is run once, to the longest horizon its record covers, and each horizon reads the
 * members that reach it. The arithmetic is `simulateLevels`, which a test holds to
 * `simulatePath` line for line, so the levels are the ones a separate simulation per horizon
 * produced — the 90-day path used to be simulated about 2.2 times over.
 *
 * `sharedMembers` keeps only the years that reach the *longest* horizon, so every horizon is
 * read off the same ensemble. It is a recorded experiment, not the default: it drops the years
 * whose record stops short of ninety days from the short horizons too (see the backtest report).
 */
export function horizonEnsembles(
  fit: WaterBalanceFit,
  inflow: DailySeries,
  origin: IsoDate,
  horizons: readonly number[],
  crestM: number,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
  accept?: (startDate: IsoDate) => boolean,
  sharedMembers = false,
): HorizonEnsemble[] {
  const longest = Math.max(0, ...horizons);
  let paths = analogPathsUpTo(inflow, origin, longest, accept);
  if (sharedMembers) paths = paths.filter((path) => path.inflowM3s.length === longest);
  const runs = paths.map((path) => ({
    year: path.year,
    levels: simulateLevels(fit.curve, fit.rule, fit.startLevel, path.inflowM3s, fit.stance, crestM, options),
  }));
  return horizons.map((horizonDays) => {
    const reaching = runs.filter((run) => run.levels.length >= horizonDays);
    return { horizonDays, ends: reaching.map((run) => run.levels[horizonDays - 1]!), years: reaching.map((run) => run.year) };
  });
}

export interface SimulationStep {
  date: IsoDate;
  level: number;
  inflowM3s: number;
  releaseM3s: number;
  spilled: boolean;
}

/** One analogue year run through the balance, day by day, with the operator in the loop. */
export function simulatePath(
  curve: Hypsometry,
  rule: ReleaseRule,
  startLevel: number,
  startDate: IsoDate,
  path: readonly number[],
  stance: number,
  crestM: number,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): SimulationStep[] {
  const ceiling = volumeAt(curve, crestM);
  const floor = volumeAt(curve, curve.datumM + 1);
  let volume = volumeAt(curve, startLevel);
  const steps: SimulationStep[] = [];

  for (let day = 0; day < path.length; day++) {
    const level = levelAt(curve, volume);
    const inflowM3s = path[day]!;
    const releaseM3s = Math.max(0, releaseAt(rule, level) + stance * Math.pow(options.stanceDecay, day + 1));
    const proposed = volume + SECONDS_PER_DAY * (inflowM3s - releaseM3s);
    const spilled = proposed > ceiling;
    volume = Math.min(Math.max(proposed, floor), ceiling);
    steps.push({ date: addDays(startDate, day + 1), level: levelAt(curve, volume), inflowM3s, releaseM3s, spilled });
  }
  return steps;
}

/**
 * `simulatePath`'s levels and nothing else, for callers that run it thousands of times: M4 reads
 * M3's forecast at every training day, and building a dated step object per simulated day is
 * most of the cost of that. The arithmetic is the same line for line, and a test holds the two
 * to identical output.
 */
export function simulateLevels(
  curve: Hypsometry,
  rule: ReleaseRule,
  startLevel: number,
  path: ArrayLike<number>,
  stance: number,
  crestM: number,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): Float64Array {
  const ceiling = volumeAt(curve, crestM);
  const floor = volumeAt(curve, curve.datumM + 1);
  let volume = volumeAt(curve, startLevel);
  const out = new Float64Array(path.length);
  for (let day = 0; day < path.length; day++) {
    const level = levelAt(curve, volume);
    const releaseM3s = Math.max(0, releaseAt(rule, level) + stance * Math.pow(options.stanceDecay, day + 1));
    const proposed = volume + SECONDS_PER_DAY * (path[day]! - releaseM3s);
    volume = Math.min(Math.max(proposed, floor), ceiling);
    out[day] = levelAt(curve, volume);
  }
  return out;
}

/** Everything the fit produced at one origin, kept so the forecast document can report it. */
export interface WaterBalanceFit {
  curve: Hypsometry;
  rule: ReleaseRule;
  stance: number;
  startLevel: number;
}

/**
 * Memo for the hypsometry, which is the expensive part of a fit and depends only on the origin
 * and the data before it — not on how the analogue pool is later narrowed. Two variants of the
 * water balance at the same origin therefore want the same curve, and computing it twice is
 * pure waste.
 *
 * A cache belongs to one site's run. Handing the same one to two reservoirs would serve the
 * first reservoir's curve for the second, so `createFitCache` is per run by construction and
 * never a module-level singleton.
 */
export type FitCache = Map<string, Hypsometry | null>;

export function createFitCache(): FitCache {
  return new Map();
}

/**
 * The rest of a fit — release rule, stance, start level — memoised against the same per-run
 * cache as the curve. The ladder, the ENSO variant, the crisis check, M4's monthly fits and the
 * live forecast all ask for the fit at the same origins; before this each of them refitted the
 * rule and re-read the stance from four thousand implied releases. Hung off the curve cache
 * through a `WeakMap`, so it lives and dies with one run's cache exactly as the curve does.
 */
const FULL_FITS = new WeakMap<FitCache, Map<string, WaterBalanceFit | null>>();

function firstKey(series: DailySeries): string {
  return series.keys().next().value ?? "";
}

export function fitAt(
  context: ForecastContext,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
  cache?: FitCache,
): WaterBalanceFit | null {
  const fullKey = [
    context.origin,
    JSON.stringify(options),
    context.levels.size,
    context.inflow.size,
    context.production.size,
    firstKey(context.levels),
    firstKey(context.inflow),
    firstKey(context.production),
  ].join("|");
  let fits: Map<string, WaterBalanceFit | null> | undefined;
  if (cache) {
    fits = FULL_FITS.get(cache) ?? FULL_FITS.set(cache, new Map()).get(cache)!;
    const hit = fits.get(fullKey);
    if (hit !== undefined) return hit;
  }
  const fit = fitUncached(context, options, cache);
  fits?.set(fullKey, fit);
  return fit;
}

function fitUncached(context: ForecastContext, options: WaterBalanceOptions, cache?: FitCache): WaterBalanceFit | null {
  const after = addDays(context.origin, 1);
  const days = balanceDays(context.levels, context.inflow, context.production, after);
  if (days.length < 60) return null;

  const cacheKey = `${context.origin}|${options.fitCeilingM}|${days.length}|${days[0]!.date}`;
  let curve: Hypsometry | null | undefined = cache?.get(cacheKey);
  if (curve === undefined) {
    try {
      curve = fitHypsometry(days, { fitCeilingM: options.fitCeilingM });
    } catch {
      curve = null;
    }
    cache?.set(cacheKey, curve);
  }
  if (curve === null) return null;
  const rule = fitReleaseRule(curve, context.levels, context.inflow, after, options);
  if (!rule) return null;

  const startLevel = context.levels.get(context.origin) ?? [...context.levels.values()].at(-1);
  if (startLevel === undefined) return null;

  return { curve, rule, stance: recentStance(curve, rule, context.levels, context.inflow, context.origin, options), startLevel };
}

/**
 * How the analogue pool is narrowed, if it is. A variant exists so the question "does knowing
 * the ENSO phase help?" is answered by the same backtest as everything else rather than by
 * argument; narrowing always costs members, and whether it buys more than it costs is a
 * measurement.
 */
export interface AnalogVariant {
  idSuffix: string;
  labelSuffix: string;
  /** True to keep the analogue year starting on `startDate` in the pool for this `origin`. */
  accept?(startDate: IsoDate, origin: IsoDate): boolean;
  /** Read every horizon off the members that reach the longest one; see `horizonEnsembles`. */
  sharedMembers?: boolean;
}

export function waterBalanceModel(
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
  variant?: AnalogVariant,
  cache?: FitCache,
): Model {
  return {
    id: `M3-water-balance${variant ? variant.idSuffix : ""}`,
    label: `Water balance with a fitted release rule and analogue inflow years${variant ? variant.labelSuffix : ""}`,
    forecast(context: ForecastContext): HorizonForecast[] {
      const fit = fitAt(context, options, cache);
      if (!fit) return [];
      const accept = variant?.accept && ((start: IsoDate) => variant.accept!(start, context.origin));
      const out: HorizonForecast[] = [];
      for (const { horizonDays, ends } of horizonEnsembles(
        fit,
        context.inflow,
        context.origin,
        context.horizonDays,
        context.crestM,
        options,
        accept,
        variant?.sharedMembers ?? false,
      )) {
        if (ends.length < options.minAnalogYears) continue;
        const centre = median(ends);
        if (centre === null) continue;
        out.push({ horizonDays, targetDate: addDays(context.origin, horizonDays), p50: centre, ensemble: ends });
      }
      return out;
    },
  };
}

export interface ScenarioRun {
  /** `dry`, `median` or `wet` — the 10th, 50th and 90th percentile of analogue inflow volume. */
  name: "dry" | "median" | "wet";
  analogYear: number;
  inflowTotalHm3: number;
  inflowMeanM3s: number;
  levels: SimulationStep[];
}

/**
 * The three inflow scenarios section 7 asks days-to-threshold to be reported under. They are
 * chosen by total inflow volume over the window, so each one is a real year of weather rather
 * than a quantile assembled day by day out of several — a per-day p10 path would be drier than
 * any year that has ever happened.
 */
export function inflowScenarios(
  fit: WaterBalanceFit,
  inflow: DailySeries,
  origin: IsoDate,
  days: number,
  crestM: number,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): ScenarioRun[] {
  const paths = [...analogPaths(inflow, origin, days)].sort((a, b) => a.totalHm3 - b.totalHm3);
  if (paths.length < options.minAnalogYears) return [];
  const totals = paths.map((p) => p.totalHm3);

  const pick = (q: number): AnalogPath => {
    const target = quantile(totals, q) ?? totals[0]!;
    let closest = paths[0]!;
    for (const path of paths) {
      if (Math.abs(path.totalHm3 - target) < Math.abs(closest.totalHm3 - target)) closest = path;
    }
    return closest;
  };

  return ([
    ["dry", 0.1],
    ["median", 0.5],
    ["wet", 0.9],
  ] as const).map(([name, q]) => {
    const path = pick(q);
    return {
      name,
      analogYear: path.year,
      inflowTotalHm3: path.totalHm3,
      inflowMeanM3s: (path.totalHm3 * 1e6) / (days * SECONDS_PER_DAY),
      levels: simulatePath(fit.curve, fit.rule, fit.startLevel, origin, path.inflowM3s, fit.stance, crestM, options),
    };
  });
}

/** First simulated day at or below `threshold`, or null if it is not reached in the window. */
export function firstCrossing(steps: readonly SimulationStep[], threshold: number): { date: IsoDate; days: number } | null {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.level <= threshold) return { date: step.date, days: i + 1 };
  }
  return null;
}

export interface CrossingDistribution {
  thresholdM: number;
  paths: number;
  crossed: number;
  /** Days until the crossing, at each quantile of the analogue ensemble. */
  p10Days: number | null;
  p50Days: number | null;
  p90Days: number | null;
}

/**
 * When every analogue year, not just three named ones, is run to `days` — and how many reach the
 * threshold at all.
 *
 * The distribution is *censored*, and handling that correctly is the whole point of having it.
 * A year that never crosses has no crossing day; dropping it and taking the median of the rest
 * would answer "among the years that cross, when?", which reads as a forecast of a crossing
 * even when four years in five show none. Non-crossing members are therefore ranked as later
 * than every crossing member, so a quantile past the crossing fraction is reported as null —
 * "not within the window" — rather than as a date.
 *
 * This is the statistic the crisis check reads. The three named scenarios answer a different
 * question: they rank whole years by total inflow, which describes a dry year well but says
 * little about a crossing ten days out, because ten days out is decided by ten days of weather
 * and not by the year's total.
 */
export function crossingDistribution(
  fit: WaterBalanceFit,
  inflow: DailySeries,
  origin: IsoDate,
  days: number,
  thresholdM: number,
  crestM: number,
  options: WaterBalanceOptions = DEFAULT_WATER_BALANCE,
): CrossingDistribution | null {
  const paths = analogPaths(inflow, origin, days);
  if (paths.length < options.minAnalogYears) return null;

  const crossings: number[] = [];
  for (const path of paths) {
    const steps = simulatePath(fit.curve, fit.rule, fit.startLevel, origin, path.inflowM3s, fit.stance, crestM, options);
    const hit = firstCrossing(steps, thresholdM);
    if (hit) crossings.push(hit.days);
  }
  crossings.sort((a, b) => a - b);

  // Rank over the *whole* ensemble, with non-crossers sitting beyond the last crosser. A
  // quantile that lands past the crossing fraction has no date to report, and says so.
  const at = (q: number): number | null => {
    if (crossings.length === 0) return null;
    const position = q * (paths.length - 1);
    if (position > crossings.length - 1) return null;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return crossings[lower]!;
    return crossings[lower]! + (crossings[upper]! - crossings[lower]!) * (position - lower);
  };

  return {
    thresholdM,
    paths: paths.length,
    crossed: crossings.length,
    p10Days: at(0.1),
    p50Days: at(0.5),
    p90Days: at(0.9),
  };
}
