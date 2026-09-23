/**
 * §5.3: inflow forecasts for the plants whose level is not worth forecasting.
 *
 * Six plants besides Mazar publish a level and an inflow. For the run-of-river and daily-storage
 * ones — Coca Codo Sinclair, Agoyán, Manduriacu, Minas San Francisco, Delsitanisagua, and
 * Amaluza below Mazar — the level is an operating decision taken within the day, and the
 * quantity worth forecasting is the water arriving: the mean inflow over the next 7 and 14
 * days, from which energy follows.
 *
 * Three rungs, scored on the same weekly origins per plant:
 *
 * - **persistence**: the origin day's inflow, held.
 * - **climatology**: the median, over every earlier year, of the same calendar window's mean.
 * - **analogue**: each earlier year's window mean, scaled by where the river is now against
 *   where it was in that year — the ratio of the trailing seven days at the origin to the same
 *   seven days of that year. It is the seasonal shape of a real year, started from today's flow.
 *   When the plant's own catchment centroid has adequate ERA5 (§1.1), the pool is first narrowed
 *   to the years whose 16 days of rain before the origin (read with ERA5's five-day latency)
 *   were nearest today's; until then it is unconditioned, and every row says which.
 *
 * The published band is the analogue median widened by its own out-of-sample residual
 * quantiles at that horizon, calibrated on strictly earlier origins — the rule every level
 * forecast in this repository follows. A plant's inflow is published only at a horizon where the
 * analogue rung beats *both* persistence and climatology on MAE; everywhere else the negative is
 * recorded in `data/reports/inflow.md` and the plant is listed as not published, with the reason.
 */

import { addDays, type IsoDate } from "../util/dates.ts";
import type { DailySeries } from "../features/series.ts";
import { ERA5_LATENCY_DAYS } from "../features/weather.ts";
import { nextDay } from "../features/hydrology.ts";
import { mean, pinballLoss, quantile } from "../util/stats.ts";
import { roundOrNull, roundTo } from "../util/numbers.ts";

export const INFLOW_PLANTS = [
  "amaluza",
  "coca_codo_sinclair",
  "agoyan",
  "manduriacu",
  "minas_san_francisco",
  "delsitanisagua",
] as const;

export const INFLOW_HORIZONS = [7, 14] as const;

export interface InflowOptions {
  horizonDays: readonly number[];
  /** Days between origins. Weekly: inflow a week out is noisy, and monthly origins give too few. */
  originStepDays: number;
  firstOrigin: IsoDate;
  /** Inflow days a plant must have before an origin is used. */
  minTrainingDays: number;
  minCalibrationOrigins: number;
  /** Fewest earlier years for a climatology or an analogue ensemble. */
  minYears: number;
  /** Trailing days today's flow is compared over. */
  stateDays: number;
  /** Ratio of today's flow to the analogue year's is clamped to this range, so a dry-season zero cannot explode it. */
  ratioBounds: readonly [number, number];
  /** Rain conditioning: the window, and the share of the pool kept. */
  rainDays: number;
  rainKeepShare: number;
}

export const DEFAULT_INFLOW: InflowOptions = {
  horizonDays: INFLOW_HORIZONS,
  originStepDays: 7,
  firstOrigin: "2018-01-01",
  minTrainingDays: 730,
  minCalibrationOrigins: 12,
  minYears: 3,
  stateDays: 7,
  ratioBounds: [0.33, 3],
  rainDays: 16,
  rainKeepShare: 0.5,
};

export type InflowModelId = "persistence" | "climatology" | "analogue";
export const INFLOW_MODELS: readonly InflowModelId[] = ["persistence", "climatology", "analogue"];

/** Mean over `(start, start + days]`, or null if any day is missing. */
export function windowMean(series: DailySeries, start: IsoDate, days: number): number | null {
  let total = 0;
  let date = start;
  for (let day = 1; day <= days; day++) {
    date = nextDay(date);
    const value = series.get(date);
    if (value === undefined) return null;
    total += value;
  }
  return total / days;
}

/** Mean over the `days` days ending on `end` inclusive, or null if any is missing. */
export function trailingMean(series: DailySeries, end: IsoDate, days: number): number | null {
  return windowMean(series, addDays(end, -days), days);
}

export interface InflowPrediction {
  p50: number;
  /** The analogue members, for the ensemble spread; empty for the point rungs. */
  members: number[];
  /** Earlier years behind it. */
  years: number;
  rainConditioned: boolean;
}

interface Earlier {
  year: number;
  start: IsoDate;
}

function earlierYears(inflow: DailySeries, origin: IsoDate): Earlier[] {
  const first = inflow.keys().next().value as IsoDate | undefined;
  if (first === undefined) return [];
  const out: Earlier[] = [];
  const monthDay = origin.slice(5);
  // 29 February has no counterpart in most years; those origins use 28 February's.
  const md = monthDay === "02-29" ? "02-28" : monthDay;
  for (let year = Number(first.slice(0, 4)); year < Number(origin.slice(0, 4)); year++) out.push({ year, start: `${year}-${md}` });
  return out;
}

/**
 * One rung at one origin. `inflow` must already stop at the origin; `precip`, when given, is the
 * plant's own centroid and is read only up to `origin − ERA5_LATENCY_DAYS`.
 */
export function predictInflow(
  model: InflowModelId,
  inflow: DailySeries,
  origin: IsoDate,
  horizonDays: number,
  options: InflowOptions = DEFAULT_INFLOW,
  precip: DailySeries | null = null,
): InflowPrediction | null {
  if (model === "persistence") {
    const today = inflow.get(origin);
    return today === undefined ? null : { p50: today, members: [], years: 0, rainConditioned: false };
  }

  const candidates = earlierYears(inflow, origin).flatMap((e) => {
    const future = windowMean(inflow, e.start, horizonDays);
    return future === null ? [] : [{ ...e, future }];
  });

  if (model === "climatology") {
    if (candidates.length < options.minYears) return null;
    return { p50: quantile(candidates.map((c) => c.future), 0.5)!, members: [], years: candidates.length, rainConditioned: false };
  }

  const now = trailingMean(inflow, origin, options.stateDays);
  if (now === null) return null;
  let pool = candidates.flatMap((c) => {
    const then = trailingMean(inflow, c.start, options.stateDays);
    return then === null || !(then > 0) ? [] : [{ ...c, ratio: Math.min(options.ratioBounds[1], Math.max(options.ratioBounds[0], now / then)) }];
  });

  let rainConditioned = false;
  if (precip && precip.size > 0) {
    const readable = addDays(origin, -ERA5_LATENCY_DAYS);
    const rainNow = trailingMean(precip, readable, options.rainDays);
    if (rainNow !== null) {
      const ranked = pool.flatMap((c) => {
        const rain = trailingMean(precip, addDays(c.start, -ERA5_LATENCY_DAYS), options.rainDays);
        return rain === null ? [] : [{ c, distance: Math.abs(rain - rainNow) }];
      });
      const keep = Math.max(options.minYears, Math.ceil(ranked.length * options.rainKeepShare));
      if (ranked.length >= options.minYears) {
        pool = ranked
          .sort((a, b) => a.distance - b.distance || a.c.year - b.c.year)
          .slice(0, keep)
          .map((r) => r.c);
        rainConditioned = true;
      }
    }
  }
  if (pool.length < options.minYears) return null;
  const members = pool.map((c) => c.future * c.ratio);
  return { p50: quantile(members, 0.5)!, members, years: members.length, rainConditioned };
}

/** Origins every `originStepDays` from `firstOrigin`, each with enough history behind it. */
export function inflowOrigins(inflow: DailySeries, options: InflowOptions = DEFAULT_INFLOW): IsoDate[] {
  const dates = [...inflow.keys()];
  if (dates.length === 0) return [];
  const first = dates[0]!;
  const last = dates.at(-1)!;
  const out: IsoDate[] = [];
  let origin = options.firstOrigin > first ? options.firstOrigin : first;
  const earliest = addDays(first, options.minTrainingDays);
  while (origin <= last) {
    if (origin >= earliest && inflow.has(origin)) out.push(origin);
    origin = addDays(origin, options.originStepDays);
  }
  return out;
}

export interface InflowScore {
  model: InflowModelId;
  horizonDays: number;
  n: number;
  maeM3s: number;
  biasM3s: number;
  nBand: number;
  coverageP10P90: number | null;
  pinballMeanM3s: number | null;
}

export interface InflowBacktest {
  site: string;
  origins: number;
  firstOrigin: IsoDate | null;
  lastOrigin: IsoDate | null;
  rainConditionedShare: number;
  scores: InflowScore[];
  /** Residual quantiles (actual − p50) of the analogue rung per horizon, over every scored origin. */
  calibration: Map<number, { q10: number; q50: number; q90: number; n: number }>;
  /** Per horizon: does the analogue rung beat both baselines on MAE? */
  decisions: { horizonDays: number; ships: boolean; reason: string }[];
}

/**
 * The three rungs at every origin, scored on the origins all three reached (the ladder's rule 3),
 * with the analogue band calibrated from strictly earlier residuals only (rule 2).
 */
export function backtestInflow(
  site: string,
  inflow: DailySeries,
  options: InflowOptions = DEFAULT_INFLOW,
  precip: DailySeries | null = null,
): InflowBacktest {
  type Row = { origin: IsoDate; h: number; actual: number; p: Record<InflowModelId, number>; rain: boolean };
  const rows: Row[] = [];
  const origins = inflowOrigins(inflow, options);
  const dates = [...inflow.keys()];
  for (const origin of origins) {
    const cut: DailySeries = new Map();
    for (const date of dates) {
      if (date > origin) break;
      cut.set(date, inflow.get(date)!);
    }
    const cutPrecip = precip ? new Map([...precip].filter(([date]) => date <= origin)) : null;
    for (const h of options.horizonDays) {
      const actual = windowMean(inflow, origin, h);
      if (actual === null) continue;
      const predictions = INFLOW_MODELS.map((m) => predictInflow(m, cut, origin, h, options, cutPrecip));
      if (predictions.some((p) => p === null)) continue;
      rows.push({
        origin,
        h,
        actual,
        p: { persistence: predictions[0]!.p50, climatology: predictions[1]!.p50, analogue: predictions[2]!.p50 },
        rain: predictions[2]!.rainConditioned,
      });
    }
  }

  const scores: InflowScore[] = [];
  const calibration = new Map<number, { q10: number; q50: number; q90: number; n: number }>();
  const decisions: InflowBacktest["decisions"] = [];
  for (const h of options.horizonDays) {
    const atH = rows.filter((r) => r.h === h).sort((a, b) => (a.origin < b.origin ? -1 : 1));
    for (const model of INFLOW_MODELS) {
      const residuals: number[] = [];
      const banded: { actual: number; p10: number; p50: number; p90: number }[] = [];
      for (const row of atH) {
        const p50 = row.p[model];
        if (residuals.length >= options.minCalibrationOrigins) {
          banded.push({
            actual: row.actual,
            p50,
            p10: Math.min(p50 + quantile(residuals, 0.1)!, p50),
            p90: Math.max(p50 + quantile(residuals, 0.9)!, p50),
          });
        }
        residuals.push(row.actual - p50);
      }
      if (model === "analogue" && residuals.length > 0) {
        calibration.set(h, { q10: quantile(residuals, 0.1)!, q50: quantile(residuals, 0.5)!, q90: quantile(residuals, 0.9)!, n: residuals.length });
      }
      scores.push({
        model,
        horizonDays: h,
        n: atH.length,
        maeM3s: mean(atH.map((r) => Math.abs(r.actual - r.p[model]))) ?? Number.NaN,
        biasM3s: mean(atH.map((r) => r.actual - r.p[model])) ?? Number.NaN,
        nBand: banded.length,
        coverageP10P90: banded.length === 0 ? null : banded.filter((b) => b.actual >= b.p10 && b.actual <= b.p90).length / banded.length,
        pinballMeanM3s:
          banded.length === 0
            ? null
            : mean(banded.flatMap((b) => [pinballLoss(b.actual, b.p10, 0.1), pinballLoss(b.actual, b.p50, 0.5), pinballLoss(b.actual, b.p90, 0.9)])),
      });
    }
    const mae = (m: InflowModelId) => scores.find((s) => s.model === m && s.horizonDays === h)?.maeM3s ?? Number.NaN;
    const [a, p, c] = [mae("analogue"), mae("persistence"), mae("climatology")];
    const enough = atH.length >= options.minCalibrationOrigins * 2;
    const ships = enough && a < p && a < c;
    decisions.push({
      horizonDays: h,
      ships,
      reason: !enough
        ? `only ${atH.length} scored origins`
        : ships
          ? `analogue MAE ${a.toFixed(1)} m3/s beats persistence ${p.toFixed(1)} and climatology ${c.toFixed(1)}`
          : `analogue MAE ${a.toFixed(1)} m3/s does not beat ${a >= p ? `persistence (${p.toFixed(1)})` : ""}${a >= p && a >= c ? " or " : ""}${a >= c ? `climatology (${c.toFixed(1)})` : ""}`,
    });
  }

  return {
    site,
    origins: new Set(rows.map((r) => r.origin)).size,
    firstOrigin: rows[0]?.origin ?? null,
    lastOrigin: rows.at(-1)?.origin ?? null,
    rainConditionedShare: rows.length === 0 ? 0 : rows.filter((r) => r.rain).length / rows.length,
    scores,
    calibration,
    decisions,
  };
}

/** `forecast.json`'s entry for one plant: the live forecast where it ships, the reason where not. */
export function inflowEntry(
  backtest: InflowBacktest,
  inflow: DailySeries,
  precipBasin: string | null,
  precip: DailySeries | null,
  options: InflowOptions = DEFAULT_INFLOW,
): Record<string, unknown> {
  const origin = [...inflow.keys()].at(-1) ?? null;
  const horizons = options.horizonDays.map((h) => {
    const decision = backtest.decisions.find((d) => d.horizonDays === h)!;
    const score = (m: InflowModelId) => backtest.scores.find((s) => s.model === m && s.horizonDays === h);
    const base = {
      horizon_days: h,
      published: false as boolean,
      reason: decision.reason,
      backtest: {
        n: score("analogue")?.n ?? 0,
        mae_m3s: roundOrNull(score("analogue")?.maeM3s, 2),
        persistence_mae_m3s: roundOrNull(score("persistence")?.maeM3s, 2),
        climatology_mae_m3s: roundOrNull(score("climatology")?.maeM3s, 2),
        coverage_p10_p90: roundOrNull(score("analogue")?.coverageP10P90, 4),
      },
    };
    if (!decision.ships || origin === null) return base;
    const live = predictInflow("analogue", inflow, origin, h, options, precip);
    const cal = backtest.calibration.get(h);
    if (!live || !cal) return { ...base, reason: `${decision.reason}; no forecast at the live origin` };
    return {
      ...base,
      published: true,
      target_date: addDays(origin, h),
      p10: roundTo(Math.max(0, Math.min(live.p50 + cal.q10, live.p50)), 1),
      p50: roundTo(live.p50, 1),
      p90: roundTo(Math.max(live.p50 + cal.q90, live.p50), 1),
      ensemble_years: live.years,
      rain_conditioned: live.rainConditioned,
    };
  });
  return {
    site: backtest.site,
    origin_date: origin,
    variable: "caudal_m3s",
    target: "mean inflow over the horizon, m3/s",
    precip_basin: precipBasin,
    rain_conditioned: backtest.rainConditionedShare > 0,
    horizons,
  };
}
