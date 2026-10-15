/**
 * The Paute cascade, as the narrative may describe it (`NARRATIVE_PLAN.md` §2.2–2.3).
 *
 * Mazar's operational minimum matters for more than Mazar's 170 MW. Its water runs on through
 * Amaluza to Molino (1,100 MW) and then Sopladora (487 MW), and each m³ released at Mazar makes
 * several times more energy below it than at Mazar itself. In October–November 2024, with Mazar
 * at 2,111–2,116 m, Molino and Sopladora together fell from 23–27 GWh a day to a few. Payload
 * version 3 said none of that, and gave Amaluza's inflow a percentile that read as rain when it
 * is mostly Mazar's own release passing through.
 *
 * Everything here is computed from this repository's tables and handed to the model, which may
 * only quote it (decision 8). Each number is a plain statistic of recorded days:
 *
 * - **Mazar's turbined flow** is its daily energy times the m³/s per MW `forecast.json` fits from
 *   the record (`turbine_m3s_per_mw`). Spill is left out; this is water through the turbines.
 * - **The local inflow** is Amaluza's recorded inflow minus that turbined flow: the river between
 *   the two dams. Over 4,001 days each m³/s through Mazar's turbines arrives at Amaluza at
 *   1.03 m³/s, which is what makes the subtraction meaningful.
 * - **Downstream output** is Molino plus Sopladora, against the same days of the year in the
 *   record, pooled as `features/climatology.ts` pools every other "normal".
 * - **Energy per hm³** adds each plant's MW per m³/s: Mazar's from the fitted turbine factor, and
 *   Molino's and Sopladora's as a ratio of sums over the days the per-day report publishes their
 *   turbined flow. That flow is a midnight snapshot (README), which is why it is pooled over many
 *   days rather than read day by day.
 * - **Storage above the operational minimum** integrates the area-elevation curve `forecast.json`
 *   fits. Not `storage_above_lowest_threshold_hm3`: that one is measured above 2,098 m.
 * - **The last episode below the minimum** is the latest run of days with Mazar under it, with
 *   gaps of up to `EPISODE_GAP_DAYS` bridged, and what Molino and Sopladora made across it.
 *
 * Amaluza's floors are passed with the source that declares each, because CELEC publishes three
 * (1,960, 1,970 and 1,975 m) and none is confirmed as the one it operates to (§4.3).
 */

import { addDays, eachDay, type IsoDate } from "../util/dates.ts";
import { roundOrNull, roundTo } from "../util/numbers.ts";
import { dayOfYear } from "../util/stats.ts";
import { bandForDayOfYear, binByDayOfYear } from "../features/climatology.ts";
import { storedHm3, type AreaCurve } from "../site/shape.ts";
import type { DailySeries } from "../features/series.ts";

/** The window the "this week" means cover, ending on the origin. */
export const CASCADE_WINDOW_DAYS = 7;

/** A week's mean needs most of its days; fewer and it is a mean of whatever happened to publish. */
export const MIN_WINDOW_DAYS = 5;

/** Days above the minimum that still belong to the same episode, so one bad week is one episode. */
export const EPISODE_GAP_DAYS = 14;

/** Below this many days with both turbined flow and energy, a plant's MW per m³/s is not published. */
export const MIN_PRODUCTIVITY_DAYS = 30;

/** A turbined-flow snapshot below this is a unit stopping at midnight, not a day's flow. */
const MIN_TURBINED_M3S = 5;

const SECONDS_PER_HOUR = 3600;

export interface CascadeSeries {
  mazarLevel: DailySeries;
  mazarInflow: DailySeries;
  mazarEnergyMwh: DailySeries;
  amaluzaLevel: DailySeries;
  amaluzaInflow: DailySeries;
  molinoEnergyMwh: DailySeries;
  molinoTurbinedM3s: DailySeries;
  sopladoraEnergyMwh: DailySeries;
  sopladoraTurbinedM3s: DailySeries;
}

export interface CascadeInputs {
  origin: IsoDate;
  series: CascadeSeries;
  /** `forecast.json` `reservoir.turbine_m3s_per_mw`; null before it was published. */
  turbineM3sPerMw: number | null;
  /** `forecast.json` `reservoir.area_elevation`. */
  areaCurve: AreaCurve | null;
  /** Mazar's operational minimum, from the forecast's thresholds. */
  operationalMinMasl: number | null;
  /** Amaluza's declared bands, folded by source as the payload folds Mazar's. */
  amaluzaFloors: { floor_masl: number; declared_by: string[] }[];
}

export interface PayloadAmaluza {
  level_masl: number;
  observed_on: IsoDate;
  /** The lowest reading in the window, and its day. */
  low_7d_masl: number;
  low_7d_on: IsoDate;
  /** Days before the window whose level was below `low_7d_masl`; the record starts on `record_from`. */
  days_lower_in_record: number;
  /** The latest of those days, when there is one. */
  last_lower_on: IsoDate | null;
  record_from: IsoDate;
  /** Every floor CELEC declares for Amaluza, with where. None is confirmed as operational. */
  declared_floors: { floor_masl: number; declared_by: string[] }[];
}

export interface PayloadEpisode {
  from: IsoDate;
  to: IsoDate;
  days_below: number;
  /** Molino plus Sopladora, mean over the episode's days. */
  downstream_gwh_day: number | null;
  /** The same, for the same days of the year across the record. */
  downstream_normal_gwh_day: number | null;
}

export interface PayloadCascade {
  window_from: IsoDate;
  window_to: IsoDate;
  mazar_inflow_m3s: number | null;
  mazar_turbined_m3s: number | null;
  local_inflow_m3s: number | null;
  local_inflow_normal_m3s: number | null;
  downstream_gwh_day: number | null;
  downstream_normal_gwh_day: number | null;
  energy_per_hm3_gwh: number | null;
  storage_above_operational_min_hm3: number | null;
  storage_above_operational_min_gwh: number | null;
  amaluza: PayloadAmaluza | null;
  last_episode_below_operational_min: PayloadEpisode | null;
  note: string;
}

/* ------------------------------------------------------------- statistics */

/** The mean of `series` over `days`, or null when fewer than `minDays` of them have a value. */
export function windowMean(series: DailySeries, days: readonly IsoDate[], minDays = MIN_WINDOW_DAYS): number | null {
  const values = days.map((d) => series.get(d)).filter((v): v is number => v !== undefined);
  if (values.length < minDays) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** `a(d) op b(d)` on every day both have a value. */
export function combine(a: DailySeries, b: DailySeries, op: (x: number, y: number) => number): DailySeries {
  const out: DailySeries = new Map();
  for (const [date, x] of a) {
    const y = b.get(date);
    if (y !== undefined) out.set(date, op(x, y));
  }
  return out;
}

/** Daily energy as turbined flow: MWh / 24 h is mean MW, times m³/s per MW. */
export function turbinedFromEnergy(energyMwh: DailySeries, m3sPerMw: number): DailySeries {
  const out: DailySeries = new Map();
  for (const [date, mwh] of energyMwh) out.set(date, (mwh / 24) * m3sPerMw);
  return out;
}

/**
 * MW per m³/s as a ratio of sums: total energy over total turbined volume, on the days both are
 * published and the flow is a running plant. Null below `MIN_PRODUCTIVITY_DAYS` such days.
 */
export function productivityMwPerM3s(energyMwh: DailySeries, turbinedM3s: DailySeries, minDays = MIN_PRODUCTIVITY_DAYS): number | null {
  let energy = 0;
  let flowHours = 0;
  let days = 0;
  for (const [date, q] of turbinedM3s) {
    const mwh = energyMwh.get(date);
    if (mwh === undefined || !(mwh > 0) || !(q > MIN_TURBINED_M3S)) continue;
    energy += mwh;
    flowHours += q * 24;
    days++;
  }
  return days >= minDays && flowHours > 0 ? energy / flowHours : null;
}

/** GWh made by one hm³ passing every plant: Σ MW per m³/s × 10⁶ m³ / 3,600 s/h / 1,000. */
export function gwhPerHm3(mwPerM3s: readonly number[]): number {
  return (mwPerM3s.reduce((a, b) => a + b, 0) * 1e6) / SECONDS_PER_HOUR / 1000;
}

/** The record's p50 for `date`'s day of the year, or null with too few years. */
export function normalFor(series: DailySeries, date: IsoDate): number | null {
  return bandForDayOfYear(binByDayOfYear(series), dayOfYear(date))?.p50 ?? null;
}

/** The mean of the record's p50 over `days`, one band computation for the lot. */
export function normalOver(series: DailySeries, days: readonly IsoDate[]): number | null {
  const bins = binByDayOfYear(series);
  const values = days.map((d) => bandForDayOfYear(bins, dayOfYear(d))?.p50).filter((v): v is number => v !== undefined);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * The latest run of days with `level` below `floor`, on or before `origin`. Below-days up to
 * `gap` days apart belong to one episode. Null when the record never went below.
 */
export function lastEpisodeBelow(
  level: DailySeries,
  floor: number,
  origin: IsoDate,
  gap = EPISODE_GAP_DAYS,
): { from: IsoDate; to: IsoDate; daysBelow: number } | null {
  const below = [...level]
    .filter(([date, value]) => date <= origin && value < floor)
    .map(([date]) => date)
    .sort();
  const last = below.at(-1);
  if (last === undefined) return null;
  let from = last;
  let count = 1;
  for (let i = below.length - 2; i >= 0; i--) {
    const day = below[i]!;
    if (addDays(day, gap + 1) < from) break;
    from = day;
    count++;
  }
  return { from, to: last, daysBelow: count };
}

/** Amaluza's week against its own record. Null without a reading in the window. */
export function amaluzaBlock(
  level: DailySeries,
  window: readonly IsoDate[],
  floors: { floor_masl: number; declared_by: string[] }[],
): PayloadAmaluza | null {
  const inWindow = window.filter((d) => level.has(d));
  const latest = inWindow.at(-1);
  const first = [...level.keys()].sort()[0];
  if (latest === undefined || first === undefined) return null;
  let lowOn = inWindow[0]!;
  for (const d of inWindow) if (level.get(d)! < level.get(lowOn)!) lowOn = d;
  const low = level.get(lowOn)!;
  const lower = [...level]
    .filter(([date, value]) => date < window[0]! && value < low)
    .map(([date]) => date)
    .sort();
  return {
    level_masl: roundTo(level.get(latest)!, 2),
    observed_on: latest,
    low_7d_masl: roundTo(low, 2),
    low_7d_on: lowOn,
    days_lower_in_record: lower.length,
    last_lower_on: lower.at(-1) ?? null,
    record_from: first,
    declared_floors: floors
      .map((f) => ({ floor_masl: f.floor_masl, declared_by: [...f.declared_by] }))
      .sort((a, b) => a.floor_masl - b.floor_masl),
  };
}

/* ----------------------------------------------------------------- block */

export function cascadeBlock(inputs: CascadeInputs): PayloadCascade | null {
  const { origin, series: s } = inputs;
  const window = eachDay(addDays(origin, -(CASCADE_WINDOW_DAYS - 1)), origin);
  const factor = inputs.turbineM3sPerMw !== null && inputs.turbineM3sPerMw > 0 ? inputs.turbineM3sPerMw : null;

  const turbined = factor === null ? null : turbinedFromEnergy(s.mazarEnergyMwh, factor);
  const mazarTurbined = turbined === null ? null : windowMean(turbined, window);
  const amaluzaInflow = windowMean(s.amaluzaInflow, window);
  const local = turbined === null ? null : combine(s.amaluzaInflow, turbined, (a, t) => a - t);

  const downstream = combine(s.molinoEnergyMwh, s.sopladoraEnergyMwh, (m, p) => (m + p) / 1000);
  const downstreamNow = windowMean(downstream, window);

  const productivities = [
    factor === null ? null : 1 / factor,
    productivityMwPerM3s(s.molinoEnergyMwh, s.molinoTurbinedM3s),
    productivityMwPerM3s(s.sopladoraEnergyMwh, s.sopladoraTurbinedM3s),
  ];
  const perHm3 = productivities.every((p): p is number => p !== null) ? gwhPerHm3(productivities) : null;

  const mazarLevel = s.mazarLevel.get(origin) ?? null;
  const min = inputs.operationalMinMasl;
  const stored =
    inputs.areaCurve === null || min === null || mazarLevel === null ? null : Math.max(0, storedHm3(inputs.areaCurve, min, mazarLevel));

  const episode = min === null ? null : lastEpisodeBelow(s.mazarLevel, min, origin);
  const episodeDays = episode === null ? [] : eachDay(episode.from, episode.to);

  const amaluza = amaluzaBlock(s.amaluzaLevel, window, inputs.amaluzaFloors);
  const anything = [mazarTurbined, amaluzaInflow, downstreamNow, stored].some((v) => v !== null) || amaluza !== null;
  if (!anything) return null;

  return {
    window_from: window[0]!,
    window_to: origin,
    mazar_inflow_m3s: roundOrNull(windowMean(s.mazarInflow, window), 1),
    mazar_turbined_m3s: roundOrNull(mazarTurbined, 1),
    local_inflow_m3s: mazarTurbined === null || amaluzaInflow === null ? null : roundTo(amaluzaInflow - mazarTurbined, 1),
    local_inflow_normal_m3s: local === null ? null : roundOrNull(normalFor(local, origin), 1),
    downstream_gwh_day: roundOrNull(downstreamNow, 1),
    downstream_normal_gwh_day: roundOrNull(normalFor(downstream, origin), 1),
    energy_per_hm3_gwh: roundOrNull(perHm3, 2),
    storage_above_operational_min_hm3: roundOrNull(stored, 1),
    storage_above_operational_min_gwh: stored === null || perHm3 === null ? null : roundTo(stored * perHm3, 0),
    amaluza,
    last_episode_below_operational_min:
      episode === null
        ? null
        : {
            from: episode.from,
            to: episode.to,
            days_below: episode.daysBelow,
            downstream_gwh_day: roundOrNull(windowMean(downstream, episodeDays, 1), 1),
            downstream_normal_gwh_day: roundOrNull(normalOver(downstream, episodeDays), 1),
          },
    note:
      "Promedios de los últimos 7 días. Lo turbinado por Mazar sale de su energía y de los m³/s por MW que ajusta el " +
      "pronóstico; el caudal local es lo que llega a Amaluza menos eso. Abajo = Molino + Sopladora. Lo normal es la " +
      "mediana del registro para estas fechas.",
  };
}
