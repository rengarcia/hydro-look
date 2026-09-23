/**
 * §5.3's inflow rungs and §5.4's rain conditioner, on series whose answer is known.
 */

import { describe, expect, it } from "vitest";
import {
  backtestInflow,
  DEFAULT_INFLOW,
  inflowEntry,
  inflowOrigins,
  predictInflow,
  windowMean,
} from "../src/lib/models/inflow.ts";
import { nearestByRain, perfectForesightRain, rainAfter } from "../src/lib/models/rain.ts";
import type { AnalogPath } from "../src/lib/models/water-balance.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { addDays } from "../src/lib/util/dates.ts";

/** A seasonal river with a year-specific wetness, so an analogue started from today's flow can win. */
function river(years: number, from = "2012-01-01"): DailySeries {
  const out: DailySeries = new Map();
  for (let i = 0; i < years * 365; i++) {
    const date = addDays(from, i);
    const year = Math.floor(i / 365);
    const wetness = 1 + 0.4 * Math.sin(year * 1.7);
    out.set(date, wetness * (100 + 60 * Math.sin((i / 365) * 2 * Math.PI)));
  }
  return out;
}

describe("predictInflow", () => {
  const inflow = river(8);
  const cut = new Map([...inflow].filter(([date]) => date <= "2018-06-01"));

  it("holds the origin's flow for persistence", () => {
    expect(predictInflow("persistence", cut, "2018-06-01", 7)!.p50).toBe(inflow.get("2018-06-01"));
  });

  it("takes the median of earlier years' window means for climatology", () => {
    const expected = [2012, 2013, 2014, 2015, 2016, 2017].map((y) => windowMean(inflow, `${y}-06-01`, 7)!).sort((a, b) => a - b);
    const p = predictInflow("climatology", cut, "2018-06-01", 7)!;
    expect(p.years).toBe(6);
    expect(p.p50).toBeCloseTo((expected[2]! + expected[3]!) / 2, 9);
  });

  it("scales each year to today's flow, so a wet year is forecast wet", () => {
    const p = predictInflow("analogue", cut, "2018-06-01", 7)!;
    // Every year has the same shape, so every scaled member is today's river a week on.
    expect(p.p50 / windowMean(inflow, "2018-06-01", 7)!).toBeCloseTo(1, 1);
    expect(p.rainConditioned).toBe(false);
  });

  it("never reads past the origin", () => {
    // `cut` stops at the origin; asking for a window that needs the future still works because
    // only earlier years' windows are read.
    expect(predictInflow("analogue", cut, "2018-06-01", 14)).not.toBeNull();
    expect(windowMean(cut, "2018-06-01", 7)).toBeNull();
  });

  it("conditions on antecedent rain when the plant's centroid has it", () => {
    const precip: DailySeries = new Map();
    for (let i = 0; i < 8 * 365; i++) precip.set(addDays("2012-01-01", i), i % 365 < 200 ? 5 : 1);
    const p = predictInflow("analogue", cut, "2018-06-01", 7, DEFAULT_INFLOW, precip)!;
    expect(p.rainConditioned).toBe(true);
    expect(p.years).toBe(3);
  });
});

describe("backtestInflow", () => {
  const inflow = river(9);
  const result = backtestInflow("test", inflow);

  it("scores the three rungs on the same origins", () => {
    const ns = new Set(result.scores.filter((s) => s.horizonDays === 7).map((s) => s.n));
    expect(ns.size).toBe(1);
    // The last origin or two have no complete window after them yet, and are not scored.
    expect(result.origins).toBeGreaterThanOrEqual(inflowOrigins(inflow).length - 2);
  });

  it("ships the analogue where it beats both baselines, as it must on a river this regular", () => {
    expect(result.decisions.every((d) => d.ships)).toBe(true);
  });

  it("refuses a rung that does not beat persistence, and says so", () => {
    const flat: DailySeries = new Map([...inflow].map(([date], i) => [date, 100 + (i % 2)]));
    const decisions = backtestInflow("flat", flat).decisions;
    expect(decisions.some((d) => !d.ships)).toBe(true);
    expect(decisions.find((d) => !d.ships)!.reason).toMatch(/does not beat/);
  });

  it("publishes a live band around the median only where it ships", () => {
    const entry = inflowEntry(result, inflow, null, null) as { horizons: { published: boolean; p10?: number; p50?: number; p90?: number }[] };
    for (const h of entry.horizons) {
      expect(h.published).toBe(true);
      expect(h.p10!).toBeLessThanOrEqual(h.p50!);
      expect(h.p50!).toBeLessThanOrEqual(h.p90!);
    }
    const refused = inflowEntry({ ...result, decisions: result.decisions.map((d) => ({ ...d, ships: false })) }, inflow, null, null) as {
      horizons: { published: boolean; p50?: number }[];
    };
    expect(refused.horizons.every((h) => !h.published && h.p50 === undefined)).toBe(true);
  });
});

describe("the rain conditioner (§5.4)", () => {
  const precip: DailySeries = new Map();
  for (let i = 0; i < 20 * 365; i++) precip.set(addDays("2005-01-01", i), (i % 17) / 3);

  it("sums the sixteen days after a start, and refuses a window with a gap", () => {
    expect(rainAfter(precip, "2010-01-01", 2)).toBeCloseTo(precip.get("2010-01-02")! + precip.get("2010-01-03")!, 12);
    expect(rainAfter(new Map([["2010-01-02", 1]]), "2010-01-01", 2)).toBeNull();
  });

  it("keeps the nearest half by rain total, never fewer than the minimum, in year order", () => {
    const paths: AnalogPath[] = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019].map((year) => ({
      year,
      startDate: `${year}-06-01`,
      inflowM3s: [1],
      totalHm3: 0,
    }));
    const totals = new Map(paths.map((p, i) => [p.startDate, i * 10]));
    const kept = nearestByRain(paths, 42, (start) => totals.get(start) ?? null);
    expect(kept.map((p) => p.year)).toEqual([2012, 2013, 2014, 2015, 2016]);
    expect(nearestByRain(paths.slice(0, 5), 0, (start) => totals.get(start) ?? null)).toHaveLength(4);
  });

  it("leaves an origin with no rain total unconditioned", () => {
    const variant = perfectForesightRain(new Map(), "paute");
    const paths: AnalogPath[] = [{ year: 2010, startDate: "2010-06-01", inflowM3s: [1], totalHm3: 0 }];
    expect(variant.select!(paths, "2020-06-01")).toBe(paths);
  });
});
