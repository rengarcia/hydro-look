/**
 * What every rung of the ladder looks like from the outside, so the backtest drives them all
 * the same way and a comparison between them means something.
 *
 * The context a model receives is already truncated to the origin. That is deliberate and it is
 * the only defence against look-ahead that actually holds: a model cannot accidentally read
 * next month's level if next month's level is not in the map it was handed. The backtest does
 * the truncating once per origin.
 */

import type { IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";

export interface ForecastContext {
  /** The last day whose observations the model may use. */
  origin: IsoDate;
  horizonDays: readonly number[];
  /** All series end at `origin`; nothing later is reachable. */
  levels: DailySeries;
  inflow: DailySeries;
  production: DailySeries;
  /** Level the reservoir spills at, taken from what the record shows it has reached. */
  crestM: number;
}

export interface HorizonForecast {
  horizonDays: number;
  targetDate: IsoDate;
  p50: number;
  /**
   * The model's own spread, when it has one. Empty for a point model, and never the published
   * band on its own: every rung is widened by its backtest residuals before it is published,
   * because an ensemble over inflow alone knows nothing about the model's own error.
   */
  ensemble: readonly number[];
  /**
   * A model's own p10 and p90 when it predicts them directly rather than through an ensemble —
   * M4's quantile regressions. Scored where the ensemble's spread would be, and, like it, never
   * the published band on its own.
   */
  quantiles?: { p10: number; p90: number };
}

export interface Model {
  id: string;
  label: string;
  /** Returns one entry per horizon, or fewer when the training data cannot support the rung. */
  forecast(context: ForecastContext): HorizonForecast[];
}
