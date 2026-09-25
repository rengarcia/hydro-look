/**
 * Does GEOGLOWS' forecast, the one INAMHI's Hydroviewer shows, forecast the inflow CELEC measures?
 *
 * The arithmetic of the backtest `scripts/geoglows-forecast.ts` runs: one forecast per origin (the
 * high-resolution member, hourly to ten days), turned into daily means by lead, and scored against
 * the measured inflow of the day each lead lands on, next to persistence — the last measured day,
 * which is what a reader of CELEC's reports already knows when the forecast is issued at 00 UTC.
 *
 * Three readings of the forecast are scored, because the model's volume is off by up to 2.8× at
 * these rivers (`data/reports/return-periods.md`) and a raw comparison would only measure that:
 *
 * - **raw** — the forecast as published;
 * - **scaled** — multiplied by measured ÷ simulated mean flow, fitted on the retrospective before the
 *   first origin, so no origin is scored with a factor that saw its own day;
 * - **relative** — the last measured day times the forecast's own change from its first day: it
 *   keeps what the model says about rising or falling and none of what it says about level.
 */

import type { DailySeries } from "../features/series.ts";
import { addDays, type IsoDate } from "../util/dates.ts";

export const LEADS = [1, 2, 3, 5, 7, 10] as const;
export const METHODS = ["raw", "scaled", "relative", "persistence"] as const;
export type Method = (typeof METHODS)[number];

/** One forecast at one river: its origin day and the daily mean for each lead (lead 1 = the origin's own UTC day). */
export interface ForecastRun {
  origin: IsoDate;
  daily: (number | null)[];
}

/** Hourly (or any-step) values at hours from the origin, to daily means per lead; a day needs `minSteps` values. */
export function dailyMeans(hours: readonly number[], values: ArrayLike<number>, leads: number, minSteps = 18): (number | null)[] {
  const out: (number | null)[] = [];
  for (let k = 1; k <= leads; k++) {
    const day: number[] = [];
    hours.forEach((h, i) => {
      const v = values[i]!;
      if (h >= 24 * (k - 1) && h < 24 * k && Number.isFinite(v)) day.push(v);
    });
    out.push(day.length >= minSteps ? day.reduce((a, b) => a + b, 0) / day.length : null);
  }
  return out;
}

export interface LeadScore {
  lead: number;
  n: number;
  /** Mean absolute error per method, m³/s, on the same cases. */
  mae: Record<Method, number>;
  /** 1 − MAE ÷ persistence MAE: above zero beats persistence. */
  skill: Record<Exclude<Method, "persistence">, number>;
}

export interface Case {
  origin: IsoDate;
  lead: number;
  target: IsoDate;
  observed: number;
  forecast: Record<Method, number>;
}

/** Every origin × lead with a forecast, the target day's measured inflow, and the day before the origin measured. */
export function cases(runs: readonly ForecastRun[], observed: DailySeries, scale: number): Case[] {
  const out: Case[] = [];
  for (const run of runs) {
    const last = observed.get(addDays(run.origin, -1));
    const first = run.daily[0];
    if (last === undefined || first === null || first === undefined || !(first > 0)) continue;
    for (const lead of LEADS) {
      const f = run.daily[lead - 1];
      const target = addDays(run.origin, lead - 1);
      const obs = observed.get(target);
      if (f === null || f === undefined || obs === undefined) continue;
      out.push({
        origin: run.origin,
        lead,
        target,
        observed: obs,
        forecast: { raw: f, scaled: f * scale, relative: last * (f / first), persistence: last },
      });
    }
  }
  return out;
}

export function scoreByLead(all: readonly Case[]): LeadScore[] {
  return LEADS.map((lead) => {
    const cs = all.filter((c) => c.lead === lead);
    const mae = Object.fromEntries(
      METHODS.map((m) => [m, cs.length ? cs.reduce((a, c) => a + Math.abs(c.forecast[m] - c.observed), 0) / cs.length : NaN]),
    ) as Record<Method, number>;
    const skill = Object.fromEntries(
      METHODS.filter((m) => m !== "persistence").map((m) => [m, 1 - mae[m] / mae.persistence]),
    ) as LeadScore["skill"];
    return { lead, n: cs.length, mae, skill };
  });
}

/** Threshold events on the target days: how often each method crossed `threshold` when the measured inflow did or did not. */
export interface EventTable {
  threshold: number;
  observedEvents: number;
  byMethod: Record<Method, { hits: number; misses: number; falseAlarms: number }>;
}

export function eventTable(all: readonly Case[], threshold: number): EventTable {
  const byMethod = Object.fromEntries(
    METHODS.map((m) => {
      let hits = 0;
      let misses = 0;
      let falseAlarms = 0;
      for (const c of all) {
        const o = c.observed >= threshold;
        const f = c.forecast[m] >= threshold;
        if (o && f) hits++;
        else if (o) misses++;
        else if (f) falseAlarms++;
      }
      return [m, { hits, misses, falseAlarms }];
    }),
  ) as EventTable["byMethod"];
  return { threshold, observedEvents: all.filter((c) => c.observed >= threshold).length, byMethod };
}

// ------------------------------------------------------------------------------------------
// Any set of named forecasts, scored on the cases they all cover
// ------------------------------------------------------------------------------------------

/** Daily means by lead (index 0 = lead 1) for each origin. */
export type RunsByOrigin = Map<IsoDate, (number | null)[]>;

export interface NamedLeadScore {
  lead: number;
  n: number;
  /** Mean absolute error per forecast and for persistence, m³/s, on the same cases. */
  mae: Record<string, number>;
  /** 1 − MAE ÷ persistence MAE per forecast. */
  skill: Record<string, number>;
  /** Mean of forecast − measured per forecast: the sign says which way it leans. */
  bias: Record<string, number>;
}

/**
 * Every lead in `leads`, on the origins where every named forecast has that lead, the target day
 * was measured and so was the day before the origin (persistence's value). Comparing on common
 * cases only is what makes the MAE columns comparable.
 */
export function scoreNamed(named: Record<string, RunsByOrigin>, observed: DailySeries, leads: readonly number[] = LEADS): NamedLeadScore[] {
  const names = Object.keys(named);
  const origins = [...new Set(names.flatMap((n) => [...named[n]!.keys()]))].sort();
  return leads.map((lead) => {
    const err: Record<string, number[]> = Object.fromEntries([...names, "persistence"].map((n) => [n, []]));
    const signed: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
    for (const origin of origins) {
      const last = observed.get(addDays(origin, -1));
      const obs = observed.get(addDays(origin, lead - 1));
      if (last === undefined || obs === undefined) continue;
      const values = names.map((n) => named[n]!.get(origin)?.[lead - 1]);
      if (values.some((v) => v === null || v === undefined || !Number.isFinite(v))) continue;
      names.forEach((n, i) => {
        err[n]!.push(Math.abs(values[i]! - obs));
        signed[n]!.push(values[i]! - obs);
      });
      err["persistence"]!.push(Math.abs(last - obs));
    }
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
    const mae = Object.fromEntries(Object.entries(err).map(([n, xs]) => [n, mean(xs)]));
    return {
      lead,
      n: err["persistence"]!.length,
      mae,
      skill: Object.fromEntries(names.map((n) => [n, 1 - mae[n]! / mae["persistence"]!])),
      bias: Object.fromEntries(names.map((n) => [n, mean(signed[n]!)])),
    };
  });
}
