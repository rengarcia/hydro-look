/**
 * The pieces behind the two forecast backtests: daily means by lead, the scoring against
 * persistence on common cases, INAMHI's answers parsed, and a Zarr chunk read a few blocks at a
 * time the way the forecast store is read by range request.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cases, dailyMeans, eventTable, scoreByLead, scoreNamed, type RunsByOrigin } from "../src/lib/models/geoglows-forecast.ts";
import { observedDaily, parseForecastCsv, plotMean } from "../src/lib/parse/inamhi-hydropower.ts";
import {
  anomalyForecast,
  blockBootstrap,
  forecastWindowMean,
  originForIssue,
  windowClimatology,
} from "../src/lib/models/geoglows-inflow.ts";
import { readChunk, readChunkRange, type ZarrArrayMeta, type ZarrSource } from "../src/lib/geo/zarr.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { FIXTURES } from "./helpers.ts";

describe("dailyMeans", () => {
  it("averages each lead's own UTC day and drops a day with too few steps", () => {
    const hours = Array.from({ length: 30 }, (_, i) => i);
    const values = hours.map((h) => (h < 24 ? 10 : 20));
    expect(dailyMeans(hours, values, 2, 18)).toEqual([10, null]);
    expect(dailyMeans(hours, values, 2, 6)).toEqual([10, 20]);
  });
});

describe("scoring against persistence", () => {
  const observed: DailySeries = new Map([
    ["2025-01-01", 100],
    ["2025-01-02", 110],
    ["2025-01-03", 130],
  ]);

  it("scores a forecast that is right as full skill, on the cases every forecast covers", () => {
    const good: RunsByOrigin = new Map([["2025-01-02", [110, 130]]]);
    const bad: RunsByOrigin = new Map([["2025-01-02", [90, null]]]);
    const [lead1, lead2] = scoreNamed({ good, bad }, observed, [1, 2]);
    // Lead 1 lands on 01-02 (110); persistence is 01-01 (100).
    expect(lead1).toMatchObject({
      lead: 1,
      n: 1,
      mae: { good: 0, bad: 20, persistence: 10 },
      skill: { good: 1, bad: -1 },
      bias: { bad: -20 },
    });
    // Lead 2: `bad` has no value, so the case is dropped for everyone.
    expect(lead2!.n).toBe(0);
  });

  it("reads the raw, scaled and relative forecasts off one run", () => {
    const cs = cases([{ origin: "2025-01-02", daily: [55, 65] }], observed, 2);
    expect(cs.find((c) => c.lead === 2)).toMatchObject({
      target: "2025-01-03",
      observed: 130,
      forecast: { raw: 65, scaled: 130, relative: 100 * (65 / 55), persistence: 100 },
    });
    expect(scoreByLead(cs).find((s) => s.lead === 2)!.skill.scaled).toBe(1);
    expect(eventTable(cs, 120).byMethod.scaled).toEqual({ hits: 1, misses: 0, falseAlarms: 0 });
  });
});

describe("INAMHI's hydropower answers", () => {
  it("splits the CSV into its three-hourly ensemble columns and hourly high-resolution member", () => {
    const csv = [
      "datetime,flow_max,flow_75,flow_avg,flow_25,flow_min,high_res",
      "2026-09-24 00:00:00,54.8,54.8,54.8,54.8,54.8,54.7",
      "2026-09-24 01:00:00,,,,,,54.8",
      "2026-09-24 03:00:00,55.3,55.2,55.2,55.2,55.2,55.2",
    ].join("\n");
    const parsed = parseForecastCsv(csv, "2026-09-24");
    expect(parsed["flow_avg"]).toEqual({ hours: [0, 3], values: [54.8, 55.2] });
    expect(parsed["high_res"]!.hours).toEqual([0, 1, 3]);
  });

  it("reads the chart's central line and the history's one trace, bare NaN and all", () => {
    const plot = JSON.stringify({
      fp: { data: [{ name: "Pronóstico <br>Media", x: ["2026-09-24T00:00:00", "2026-09-24T03:00:00"], y: [50.26, 50.7] }] },
    }).replace("50.7", "NaN");
    expect(plotMean(plot, "2026-09-24")).toEqual({ hours: [0], values: [50.26] });
    const history =
      '{"hs": {"data": [{"name": "Historical Simulation", "x": ["2012-10-26T00:00:00", "2012-10-27T00:00:00"], "y": [52.9, NaN]}]}}';
    expect([...observedDaily(history)]).toEqual([["2012-10-26", 52.9]]);
  });

  it("refuses an answer that is not a forecast CSV", () => {
    expect(() => parseForecastCsv("<!doctype html>", "2026-09-24")).toThrow(/not a forecast CSV/);
  });
});

describe("readChunkRange", () => {
  // The multi-block Zstd fixture as a chunk of 1,000 doubles, served by byte range.
  const frame = new Uint8Array(readFileSync(join(FIXTURES, "blosc", "zstd-shuffle-f8.blosc")));
  const requests: [number, number][] = [];
  const source: ZarrSource = {
    get: () => Promise.resolve(frame),
    getRange: (_key, from, to) => {
      requests.push([from, to]);
      return Promise.resolve(frame.slice(from, to));
    },
  };
  const meta: ZarrArrayMeta = { shape: [1000], chunks: [1000], dtype: "<f8", fillValue: NaN };

  it("returns the same values as a whole-chunk read, from only the blocks that hold them", async () => {
    const whole = await readChunk(source, "Q", meta, [0]);
    const part = await readChunkRange(source, "Q", meta, [0], 300, 600);
    expect(Array.from(part)).toEqual(Array.from(whole).slice(300, 600));
    // Header, index, then blocks 1 and 2 only — never the whole 7 KB frame.
    const bytes = requests.slice(2).reduce((a, [f, t]) => a + (t - f), 0);
    expect(requests.slice(2)).toHaveLength(2);
    expect(bytes).toBeLessThan(frame.length / 2 + 200);
  });
});

describe("the forecast as a covariate", () => {
  it("averages a window of leads and refuses a gap", () => {
    expect(forecastWindowMean([1, 2, 3, 4], 3)).toBe(2);
    expect(forecastWindowMean([1, null, 3], 3)).toBeNull();
    expect(forecastWindowMean([1, 2], 3)).toBeNull();
  });

  it("takes the model's own climatology for the same calendar window, from earlier years only", () => {
    // Five years whose 10–12 January averages 10, 20, 30, 40, 50; the origin's own year is left out.
    const series: DailySeries = new Map();
    [2019, 2020, 2021, 2022, 2023, 2024].forEach((year, i) => {
      for (const day of ["10", "11", "12"]) series.set(`${year}-01-${day}`, 10 * (i + 1));
    });
    expect(windowClimatology(series, "2024-01-09", 3, 2019)).toBe(30);
    expect(windowClimatology(series, "2024-01-09", 3, 2019, 6)).toBeNull();
  });

  it("carries the forecast's change from usual onto the measured climatology, clamped", () => {
    // The model forecasts twice its own usual: the measured usual doubles, whatever the model's volume.
    expect(anomalyForecast(100, 600, 300)).toBe(200);
    expect(anomalyForecast(100, 6000, 300)).toBe(300);
    expect(anomalyForecast(100, 10, 0)).toBeNull();
  });

  it("puts a clear improvement's bootstrap interval wholly below zero, and noise across it", () => {
    const better = blockBootstrap(
      Array.from({ length: 100 }, (_, i) => -2 + Math.sin(i)),
      5,
    );
    expect(better.hi).toBeLessThan(0);
    const noise = blockBootstrap(
      Array.from({ length: 100 }, (_, i) => Math.sin(i * 1.7) * 3),
      5,
    );
    expect(noise.lo).toBeLessThan(0);
    expect(noise.hi).toBeGreaterThan(0);
    // Deterministic: the same differences give the same interval.
    expect(blockBootstrap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3)).toEqual(blockBootstrap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3));
  });

  it("uses a forecast issued on day F at origin F − 1", () => {
    expect(originForIssue("2026-09-24")).toBe("2026-09-23");
  });
});
