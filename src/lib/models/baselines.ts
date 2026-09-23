/**
 * The bottom of the ladder in section 7: the rungs a physical model has to beat to be worth
 * shipping. They are here to be measured, not to be believed, and the backtest report records
 * that two of the three lose.
 *
 * The thing to know before reading them is that a reservoir level is not a natural series. It
 * is the running total of an operating decision, and an operator who was drawing Mazar down
 * last week is usually still drawing it down this week. That makes plain persistence a much
 * stronger baseline than it looks, and it is the reason section 7's expectation — that
 * climatological drift would improve on it — turns out to be wrong at every horizon out to 60
 * days.
 */

import { addDays } from "../util/dates.ts";
import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { dayOfYear, dayOfYearDistance, median } from "../util/stats.ts";
import type { ForecastContext, HorizonForecast, Model } from "./types.ts";

/** Days either side of the target day-of-year that count as the same time of year. */
const SEASON_WINDOW_DAYS = 7;

function latest(series: DailySeries, on: IsoDate): number | null {
  const exact = series.get(on);
  if (exact !== undefined) return exact;
  // The report can be a day late; walk back rather than refusing to forecast.
  for (let back = 1; back <= 10; back++) {
    const value = series.get(addDays(on, -back));
    if (value !== undefined) return value;
  }
  return null;
}

/** M0 — tomorrow looks like today, at every horizon. */
export const persistence: Model = {
  id: "M0-persistence",
  label: "Persistence (today's level, held)",
  forecast(context: ForecastContext): HorizonForecast[] {
    const level = latest(context.levels, context.origin);
    if (level === null) return [];
    return context.horizonDays.map((horizonDays) => ({
      horizonDays,
      targetDate: addDays(context.origin, horizonDays),
      p50: level,
      ensemble: [],
    }));
  },
};

/**
 * Every `h`-day level change in the training history that started at this time of year.
 * Targeting the h-step change directly, rather than accumulating h daily medians, matters:
 * a sum of 90 medians is not the median of the 90-day sum, and the difference compounds.
 */
function seasonalChanges(levels: DailySeries, origin: IsoDate, horizon: number): number[] {
  const target = dayOfYear(origin);
  const out: number[] = [];
  for (const [date, level] of levels) {
    if (dayOfYearDistance(dayOfYear(date), target) > SEASON_WINDOW_DAYS) continue;
    const later = levels.get(addDays(date, horizon));
    if (later === undefined) continue;
    out.push(later - level);
  }
  return out;
}

/** M1 — today's level plus the move this time of year usually makes over `h` days. */
export const climatologicalDrift: Model = {
  id: "M1-climatological-drift",
  label: "Climatological drift (day-of-year median h-day change)",
  forecast(context: ForecastContext): HorizonForecast[] {
    const level = latest(context.levels, context.origin);
    if (level === null) return [];
    const out: HorizonForecast[] = [];
    for (const horizonDays of context.horizonDays) {
      const changes = seasonalChanges(context.levels, context.origin, horizonDays);
      const centre = median(changes);
      if (centre === null) continue;
      out.push({
        horizonDays,
        targetDate: addDays(context.origin, horizonDays),
        p50: level + centre,
        ensemble: changes.map((change) => level + change),
      });
    }
    return out;
  },
};

/**
 * Median level for every day of the year, built once per forecast.
 *
 * Built naively this is the hot spot of the whole backtest: M2 fits its decay on about a
 * hundred training origins for each of five horizons, and if each of those scans the whole
 * twelve-year series for a seasonal median the run does billions of comparisons and never
 * finishes. Bucketing by day of year first, then combining fifteen buckets per day, is the same
 * number and costs one pass.
 */
export type SeasonalTable = Map<number, number>;

export function seasonalLevelTable(levels: DailySeries): SeasonalTable {
  const buckets = new Map<number, number[]>();
  for (const [date, level] of levels) {
    const day = dayOfYear(date);
    (buckets.get(day) ?? buckets.set(day, []).get(day)!).push(level);
  }
  const table: SeasonalTable = new Map();
  for (let day = 1; day <= 365; day++) {
    const sample: number[] = [];
    for (let offset = -SEASON_WINDOW_DAYS; offset <= SEASON_WINDOW_DAYS; offset++) {
      sample.push(...(buckets.get(((day - 1 + offset + 365) % 365) + 1) ?? []));
    }
    const centre = median(sample);
    if (centre !== null) table.set(day, centre);
  }
  return table;
}

const DECAY_GRID = [0.95, 0.97, 0.98, 0.99, 0.995, 0.998, 1];

/**
 * M2 — the ETS-family rung: a seasonal level plus today's departure from it, decaying.
 *
 * `phi` is fitted at each origin on the training data alone rather than assumed, so when this
 * rung loses it has lost on its own best settings. The fit is a grid because there are seven
 * candidates and an exact search is cheaper to run and to audit than an optimiser.
 */
function fitDecay(levels: DailySeries, table: SeasonalTable, horizon: number, dates: readonly IsoDate[]): number {
  let bestPhi = 1;
  let bestError = Number.POSITIVE_INFINITY;
  for (const phi of DECAY_GRID) {
    const damping = Math.pow(phi, horizon);
    let total = 0;
    let n = 0;
    for (const date of dates) {
      const level = levels.get(date);
      const target = addDays(date, horizon);
      const actual = levels.get(target);
      const here = table.get(dayOfYear(date));
      const there = table.get(dayOfYear(target));
      if (level === undefined || actual === undefined || here === undefined || there === undefined) continue;
      total += Math.abs(there + damping * (level - here) - actual);
      n++;
    }
    if (n > 0 && total / n < bestError) {
      bestError = total / n;
      bestPhi = phi;
    }
  }
  return bestPhi;
}

/** First-of-month days inside the training series, used to fit `phi`. */
function trainingOrigins(levels: DailySeries): IsoDate[] {
  return [...levels.keys()].filter((date) => date.endsWith("-01"));
}

export const seasonalAnomalyDecay: Model = {
  id: "M2-seasonal-anomaly-decay",
  label: "Seasonal level with a decaying anomaly (ETS family)",
  forecast(context: ForecastContext): HorizonForecast[] {
    const level = latest(context.levels, context.origin);
    const table = seasonalLevelTable(context.levels);
    const here = table.get(dayOfYear(context.origin));
    if (level === null || here === undefined) return [];
    const origins = trainingOrigins(context.levels);
    const out: HorizonForecast[] = [];
    for (const horizonDays of context.horizonDays) {
      const targetDate = addDays(context.origin, horizonDays);
      const there = table.get(dayOfYear(targetDate));
      if (there === undefined) continue;
      const phi = fitDecay(context.levels, table, horizonDays, origins);
      out.push({
        horizonDays,
        targetDate,
        p50: there + Math.pow(phi, horizonDays) * (level - here),
        ensemble: [],
      });
    }
    return out;
  },
};

export const BASELINE_MODELS: readonly Model[] = [persistence, climatologicalDrift, seasonalAnomalyDecay];
