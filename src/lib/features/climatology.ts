/**
 * "What this river normally does on this day of the year", defined once.
 *
 * Two things need it and they must not drift apart: `latest.json` publishes the band for the
 * current day, and the site draws it as a ribbon behind a year of readings. If each computed
 * its own pooling the tile could say a day was unremarkable while the chart drew it outside
 * the band, and nothing in either would be wrong on its own terms.
 *
 * The pooling is a window either side of the target day of the year, circular, over every year
 * in the series. Circular because `dayOfYearDistance` measures it that way and a band that
 * broke at 31 December would put a step in the middle of the wet season. Over every year
 * including the current one, because this is a description of the record and not a forecast:
 * withholding the present year would be leakage control for a model and a distortion here.
 */

import { dayOfYear, dayOfYearDistance, quantile } from "../util/stats.ts";
import { yearOf, type IsoDate } from "../util/dates.ts";
import type { DailySeries } from "./series.ts";

/** Days either side of the target day of the year that a quantile is pooled over. */
export const HALF_WINDOW_DAYS = 7;

/**
 * Below this many distinct years no band is published at all.
 *
 * Three years of a fortnight-wide window is around forty values, which will produce a p10 and
 * a p90 quite happily and mean almost nothing: with an El Niño and a La Niña among three
 * years, "normal" lands wherever the third year fell. Null is the honest answer for the plants
 * whose history is short, and the site says so rather than drawing an empty ribbon.
 */
export const MIN_YEARS = 5;

export interface Band {
  p10: number;
  p50: number;
  p90: number;
  /** Distinct calendar years contributing to the window. */
  years: number;
  /** Readings in the window, across all those years. */
  n: number;
}

/**
 * `dayOfYear -> every reading within the window of it`, computed in one pass.
 *
 * A reading lands in each of the 2·window+1 days it is within reach of, so the map costs
 * fifteen times the series in memory and saves a scan per day charted. At a year of points
 * against six thousand readings that is the difference between one pass and three hundred.
 */
export function binByDayOfYear(series: DailySeries, halfWindow = HALF_WINDOW_DAYS): Map<number, { values: number[]; years: Set<number> }> {
  const bins = new Map<number, { values: number[]; years: Set<number> }>();
  for (const [date, value] of series) {
    const doy = dayOfYear(date);
    const year = yearOf(date);
    for (let offset = -halfWindow; offset <= halfWindow; offset++) {
      // Wrap into 1..365 so late December reaches early January and back.
      const target = ((doy + offset - 1 + 365) % 365) + 1;
      const bin = bins.get(target) ?? bins.set(target, { values: [], years: new Set() }).get(target)!;
      bin.values.push(value);
      bin.years.add(year);
    }
  }
  return bins;
}

/** The band for one day of the year, or null when too few years back it. */
export function bandForDayOfYear(
  bins: Map<number, { values: number[]; years: Set<number> }>,
  doy: number,
  minYears = MIN_YEARS,
): Band | null {
  const bin = bins.get(doy);
  if (!bin || bin.years.size < minYears) return null;
  const p10 = quantile(bin.values, 0.1);
  const p50 = quantile(bin.values, 0.5);
  const p90 = quantile(bin.values, 0.9);
  if (p10 === null || p50 === null || p90 === null) return null;
  return { p10, p50, p90, years: bin.years.size, n: bin.values.length };
}

/** The sample a day of the year pools, for placing a reading inside it. */
export function sampleForDate(series: DailySeries, date: IsoDate, halfWindow = HALF_WINDOW_DAYS): number[] {
  const target = dayOfYear(date);
  const out: number[] = [];
  for (const [day, value] of series) {
    if (dayOfYearDistance(dayOfYear(day), target) <= halfWindow) out.push(value);
  }
  return out;
}
