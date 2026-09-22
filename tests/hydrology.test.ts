/**
 * The fit is checked by building a reservoir whose answer is known and seeing whether the
 * fitter finds it. That is worth more than asserting the numbers it happens to produce on the
 * real data: those would pass whether the method were right or merely stable.
 */

import { describe, expect, it } from "vitest";
import {
  areaAt,
  balanceDays,
  fitHypsometry,
  impliedReleases,
  levelAt,
  storageHm3,
  trimReleases,
  volumeAt,
  type Hypsometry,
} from "../src/lib/features/hydrology.ts";
import { addDays } from "../src/lib/util/dates.ts";
import type { DailySeries } from "../src/lib/features/series.ts";

const TRUTH: Hypsometry = {
  areaCoefficient: 1277,
  areaExponent: 1.9,
  datumM: 2060,
  turbineM3sPerMw: 0.65,
  rmseDeltaLevelM: 0,
  days: 0,
  fitCeilingM: 2150,
};

/**
 * A synthetic reservoir obeying `TRUTH` exactly. Generation responds to the level, the way a
 * real operator does, so the reservoir stays inside a sensible band on its own — clamping it
 * instead would make water vanish on the days the clamp bit, and the fitter would be scored on
 * a balance that does not close. Both drivers move, because a reservoir held at one level
 * constrains nothing and any curve would fit it.
 */
function synthetic(days: number): {
  levels: DailySeries;
  inflow: DailySeries;
  production: DailySeries;
  occupied: { low: number; high: number };
} {
  const levels: DailySeries = new Map();
  const inflow: DailySeries = new Map();
  const production: DailySeries = new Map();
  let level = 2120;
  let date = "2020-01-01";
  let low = level;
  let high = level;

  for (let i = 0; i < days; i++) {
    const inflowM3s = 60 + 55 * Math.sin((i / 365) * 2 * Math.PI) + 12 * Math.sin(i / 3.3);
    // A proportional rule: generate harder the fuller it is. Keeps the level in band without
    // a clamp, and exercises the fit across that band rather than at one point.
    const powerMw = Math.min(170, Math.max(0, 95 + 6 * (level - 2128) + 18 * Math.sin(i / 11)));
    levels.set(date, level);
    inflow.set(date, inflowM3s);
    production.set(date, powerMw * 24);
    const volume = volumeAt(TRUTH, level) + 86_400 * (inflowM3s - TRUTH.turbineM3sPerMw * powerMw);
    level = levelAt(TRUTH, volume);
    low = Math.min(low, level);
    high = Math.max(high, level);
    date = addDays(date, 1);
  }
  return { levels, inflow, production, occupied: { low, high } };
}

describe("level and volume", () => {
  it("round-trips through the curve", () => {
    for (const level of [2100, 2117.5, 2130, 2153]) {
      expect(levelAt(TRUTH, volumeAt(TRUTH, level))).toBeCloseTo(level, 6);
    }
  });

  it("gives an area that grows with level, and a storage that matches the integral", () => {
    expect(areaAt(TRUTH, 2150)).toBeGreaterThan(areaAt(TRUTH, 2110));
    const numeric = Array.from({ length: 10_000 }, (_, i) => areaAt(TRUTH, 2100 + (i + 0.5) * (53 / 10_000)))
      .reduce((a, b) => a + b, 0) * (53 / 10_000);
    expect(storageHm3(TRUTH, 2100, 2153)).toBeCloseTo(numeric / 1e6, 1);
  });
});

describe("fitHypsometry", () => {
  it("recovers the curve and the flow-per-MW of a reservoir that obeys the balance exactly", () => {
    const { levels, inflow, production, occupied } = synthetic(1200);
    expect(occupied.high - occupied.low).toBeGreaterThan(8);
    const fitted = fitHypsometry(balanceDays(levels, inflow, production), { fitCeilingM: 2150 });

    // `datum` and `exponent` are not separately identified, so the assertion is on the curve —
    // and only where the reservoir actually went. Two pairs that agree across the occupied band
    // may diverge sharply outside it, which is extrapolation, not a fitting error.
    for (const share of [0.1, 0.5, 0.9]) {
      const level = occupied.low + share * (occupied.high - occupied.low);
      expect(areaAt(fitted, level) / areaAt(TRUTH, level)).toBeCloseTo(1, 1);
    }
    expect(fitted.turbineM3sPerMw).toBeCloseTo(TRUTH.turbineM3sPerMw, 2);
    expect(storageHm3(fitted, occupied.low, occupied.high) / storageHm3(TRUTH, occupied.low, occupied.high))
      .toBeCloseTo(1, 1);
    expect(fitted.rmseDeltaLevelM).toBeLessThan(0.01);
  });

  it("refuses rather than guessing when there is almost no history", () => {
    const { levels, inflow, production } = synthetic(20);
    expect(() => fitHypsometry(balanceDays(levels, inflow, production), { fitCeilingM: 2150 })).toThrow(
      /at least 60/,
    );
  });
});

describe("balanceDays", () => {
  it("drops a day whose neighbour or driver is missing rather than interpolating it", () => {
    const { levels, inflow, production } = synthetic(10);
    inflow.delete("2020-01-03");
    levels.delete("2020-01-06");
    const days = balanceDays(levels, inflow, production);
    expect(days.map((d) => d.date)).not.toContain("2020-01-03");
    // 01-05 loses its next level, 01-06 is gone entirely.
    expect(days.map((d) => d.date)).not.toContain("2020-01-05");
    expect(days.map((d) => d.date)).not.toContain("2020-01-06");
  });

  it("honours the training cutoff", () => {
    const { levels, inflow, production } = synthetic(30);
    const days = balanceDays(levels, inflow, production, "2020-01-10");
    expect(days.every((d) => d.date < "2020-01-10")).toBe(true);
  });
});

describe("impliedReleases", () => {
  it("returns the outflow that closes the balance", () => {
    const levels: DailySeries = new Map([
      ["2024-01-01", 2130],
      ["2024-01-02", 2130],
    ]);
    // A level that does not move means everything that arrived also left.
    const [reading] = impliedReleases(TRUTH, levels, new Map([["2024-01-01", 80]]));
    expect(reading!.releaseM3s).toBeCloseTo(80, 6);
  });

  it("reports more leaving than arriving when the level falls", () => {
    const levels: DailySeries = new Map([
      ["2024-01-01", 2130],
      ["2024-01-02", 2129],
    ]);
    const [reading] = impliedReleases(TRUTH, levels, new Map([["2024-01-01", 80]]));
    expect(reading!.releaseM3s).toBeGreaterThan(80);
  });
});

describe("trimReleases", () => {
  it("drops the tails, so one jumped level reading cannot move a median", () => {
    const readings = Array.from({ length: 100 }, (_, i) => ({
      date: addDays("2024-01-01", i),
      level: 2130,
      releaseM3s: 60 + (i % 5),
    }));
    readings[0]!.releaseM3s = -900_000;
    readings[1]!.releaseM3s = 900_000;
    const trimmed = trimReleases(readings);
    expect(trimmed.map((r) => r.releaseM3s)).not.toContain(-900_000);
    expect(trimmed.map((r) => r.releaseM3s)).not.toContain(900_000);
  });

  it("leaves a short sample alone rather than trimming it to nothing", () => {
    const readings = [{ date: "2024-01-01", level: 2130, releaseM3s: 5 }];
    expect(trimReleases(readings)).toHaveLength(1);
  });
});
