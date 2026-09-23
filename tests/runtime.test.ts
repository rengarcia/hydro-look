/**
 * §5.7's promise: the cheaper run publishes the same numbers. Every horizon read off one
 * simulation per analogue year must equal a separate simulation per horizon, and a fit served
 * from the per-run cache must equal one fitted from scratch — to the last digit, because M4's
 * residual anchor is checked against the shipped M3 to the last digit.
 */

import { describe, expect, it } from "vitest";
import { buildSeries } from "../src/lib/features/series.ts";
import { levelAt, nextDay, volumeAt, type Hypsometry } from "../src/lib/features/hydrology.ts";
import {
  analogPaths,
  analogPathsUpTo,
  createFitCache,
  DEFAULT_WATER_BALANCE,
  fitAt,
  horizonEnsembles,
  simulatePath,
  waterBalanceModel,
} from "../src/lib/models/water-balance.ts";
import { truncate } from "../src/lib/models/backtest.ts";
import { addDays } from "../src/lib/util/dates.ts";
import type { ForecastContext } from "../src/lib/models/types.ts";

const TRUTH: Hypsometry = {
  areaCoefficient: 1277,
  areaExponent: 1.9,
  datumM: 2060,
  turbineM3sPerMw: 0.65,
  rmseDeltaLevelM: 0,
  days: 0,
  fitCeilingM: 2150,
};

/** Ten years of a reservoir that obeys the balance, with inflow gaps so members differ in length. */
function series() {
  const rows: Record<string, string>[] = [];
  let level = 2130;
  for (let i = 0; i < 10 * 365; i++) {
    const date = addDays("2015-01-01", i);
    const inflowM3s = 60 + 55 * Math.sin((i / 365) * 2 * Math.PI) + 12 * Math.sin(i / 3.3);
    const powerMw = Math.min(170, Math.max(0, 95 + 6 * (level - 2128) + 18 * Math.sin(i / 11)));
    const gap = (i % 365 > 300 && i % 365 < 304 && i < 2000) || date === "2021-10-20";
    for (const [variable, value] of [
      ["cota_masl", level],
      ["caudal_m3s", inflowM3s],
      ["produccion_mwh", powerMw * 24],
    ] as const) {
      if (gap && variable === "caudal_m3s") continue;
      rows.push({ date, site: "mazar", variable, value: String(value), source: "ords:repDiaHid12m", mrid: "", fetched_at: "2026-09-22T00:00:00Z", raw_ref: "x" });
    }
    level = levelAt(TRUTH, volumeAt(TRUTH, level) + 86_400 * (inflowM3s - TRUTH.turbineM3sPerMw * powerMw));
  }
  return buildSeries(rows);
}

const set = series();
const levels = set.get("mazar", "cota_masl");
const inflow = set.get("mazar", "caudal_m3s");
const production = set.get("mazar", "produccion_mwh");
const crestM = Math.max(...levels.values());
const origin = "2024-09-01";
const context: ForecastContext = {
  origin,
  horizonDays: [7, 14, 30, 60, 90],
  levels: truncate(levels, origin),
  inflow: truncate(inflow, origin),
  production: truncate(production, origin),
  crestM,
};

describe("one simulation per analogue year", () => {
  it("builds exactly the members analogPaths builds at each horizon", () => {
    const upTo = analogPathsUpTo(context.inflow, origin, 90);
    for (const h of context.horizonDays) {
      const direct = analogPaths(context.inflow, origin, h);
      const read = upTo.filter((p) => p.inflowM3s.length >= h);
      expect(read.map((p) => p.year)).toEqual(direct.map((p) => p.year));
      expect(read.map((p) => p.inflowM3s.slice(0, h))).toEqual(direct.map((p) => p.inflowM3s));
    }
  });

  it("reads every horizon off one run and gets the levels a run per horizon gets", () => {
    const fit = fitAt(context)!;
    expect(fit).not.toBeNull();
    const ensembles = horizonEnsembles(fit, context.inflow, origin, context.horizonDays, crestM);
    for (const { horizonDays, ends, years } of ensembles) {
      const paths = analogPaths(context.inflow, origin, horizonDays);
      expect(years).toEqual(paths.map((p) => p.year));
      const separate = paths.map(
        (p) => simulatePath(fit.curve, fit.rule, fit.startLevel, origin, p.inflowM3s, fit.stance, crestM).at(-1)!.level,
      );
      expect(ends).toEqual(separate);
    }
  });

  it("with shared members, reads every horizon off the same years", () => {
    const fit = fitAt(context)!;
    const ensembles = horizonEnsembles(fit, context.inflow, origin, context.horizonDays, crestM, DEFAULT_WATER_BALANCE, undefined, true);
    const years = ensembles.map((e) => e.years.join(","));
    expect(new Set(years).size).toBe(1);
    expect(ensembles[0]!.years.length).toBeLessThanOrEqual(horizonEnsembles(fit, context.inflow, origin, [7], crestM)[0]!.years.length);
  });
});

describe("the per-run fit cache", () => {
  it("serves a fit identical to one made from scratch", () => {
    const cache = createFitCache();
    const cold = fitAt(context);
    const warm1 = fitAt(context, DEFAULT_WATER_BALANCE, cache);
    const warm2 = fitAt(context, DEFAULT_WATER_BALANCE, cache);
    expect(warm1).toEqual(cold);
    expect(warm2).toBe(warm1);
  });

  it("does not serve one origin's fit for another", () => {
    const cache = createFitCache();
    const earlier = "2023-09-01";
    const a = fitAt(context, DEFAULT_WATER_BALANCE, cache)!;
    const b = fitAt(
      { ...context, origin: earlier, levels: truncate(levels, earlier), inflow: truncate(inflow, earlier), production: truncate(production, earlier) },
      DEFAULT_WATER_BALANCE,
      cache,
    )!;
    expect(b.startLevel).toBe(levels.get(earlier));
    expect(a.startLevel).toBe(levels.get(origin));
  });

  it("leaves the model's forecast unchanged", () => {
    const plain = waterBalanceModel().forecast(context);
    const cached = waterBalanceModel(DEFAULT_WATER_BALANCE, undefined, createFitCache()).forecast(context);
    expect(cached).toEqual(plain);
  });
});

describe("nextDay", () => {
  it("is addDays(date, 1), across month, year and leap-day boundaries", () => {
    for (const date of ["2024-02-28", "2024-02-29", "2023-02-28", "2025-12-31", "2026-09-30"]) {
      expect(nextDay(date)).toBe(addDays(date, 1));
    }
  });
});
