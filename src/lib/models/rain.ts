/**
 * §5.4: does knowing the next sixteen days of rain improve the level forecast?
 *
 * The 16-day precipitation forecast is collected every day and read by no model. Before wiring
 * it in, the experiment asks the question that can stop it early: give M3 the rain that *actually*
 * fell — ERA5 over the sixteen days after each origin, known perfectly, which no forecaster ever
 * has — and keep only the analogue years whose rain over the same calendar window was nearest.
 * If even perfect foresight of the rain total does not improve the 14-day level forecast, a
 * forecast of it will not either, and the experiment stops there.
 *
 * The conditioning is by ranking, not by a cut: the nearest half of the pool by |rain total −
 * the origin's rain total|, never fewer than the model's minimum ensemble. Years with no ERA5
 * total for the window stay out of the ranking and out of the pool. An origin without a rain
 * total of its own is not conditioned at all, so it scores exactly as the shipped model.
 *
 * This is deliberate look-ahead, used only as an upper bound. Nothing here is published.
 */

import { addDays, type IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { DEFAULT_WATER_BALANCE, type AnalogPath, type AnalogVariant } from "./water-balance.ts";

/** The window the Open-Meteo forecast covers, and so the only one worth conditioning on. */
export const RAIN_WINDOW_DAYS = 16;

/** Sum over the `days` days after `start` (exclusive), or null if any of them is missing. */
export function rainAfter(precip: DailySeries, start: IsoDate, days: number = RAIN_WINDOW_DAYS): number | null {
  let total = 0;
  let date = start;
  for (let day = 1; day <= days; day++) {
    date = addDays(date, 1);
    const mm = precip.get(date);
    if (mm === undefined) return null;
    total += mm;
  }
  return total;
}

/**
 * Keep the years whose rain total over their own window was nearest `target`: the nearest
 * `keepShare` of the ranked pool, but never fewer than `minKeep` (or the whole ranked pool if
 * it is smaller than that).
 */
export function nearestByRain(
  paths: readonly AnalogPath[],
  target: number,
  totalFor: (startDate: IsoDate) => number | null,
  keepShare = 0.5,
  minKeep: number = DEFAULT_WATER_BALANCE.minAnalogYears,
): AnalogPath[] {
  const ranked = paths
    .map((path) => ({ path, total: totalFor(path.startDate) }))
    .filter((entry): entry is { path: AnalogPath; total: number } => entry.total !== null)
    .sort((a, b) => Math.abs(a.total - target) - Math.abs(b.total - target) || a.path.year - b.path.year);
  const keep = Math.min(ranked.length, Math.max(minKeep, Math.ceil(ranked.length * keepShare)));
  // Back into year order, which is the order every other pool is in.
  return ranked
    .slice(0, keep)
    .map((entry) => entry.path)
    .sort((a, b) => a.year - b.year);
}

/** The upper bound: condition on the ERA5 rain that actually fell after the origin. */
export function perfectForesightRain(precip: DailySeries, basin: string, keepShare = 0.5): AnalogVariant {
  const memo = new Map<IsoDate, number | null>();
  const total = (start: IsoDate): number | null => {
    if (!memo.has(start)) memo.set(start, rainAfter(precip, start));
    return memo.get(start)!;
  };
  return {
    idSuffix: "-rain-pf",
    labelSuffix: `, analogue years nearest the ERA5 rain that actually fell over the next ${RAIN_WINDOW_DAYS} days at ${basin} (perfect foresight)`,
    select(paths, origin) {
      const target = total(origin);
      return target === null ? paths : nearestByRain(paths, target, total, keepShare);
    },
  };
}
