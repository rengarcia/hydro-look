import { describe, expect, it } from "vitest";
import { dayOfYear, dayOfYearDistance, mean, median, pinballLoss, quantile } from "../src/lib/util/stats.ts";
import { availableAt, phaseOf, type OniSeries } from "../src/lib/features/enso.ts";

describe("quantile", () => {
  it("interpolates between neighbours", () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
    expect(quantile([0, 10, 20, 30], 0.1)).toBeCloseTo(3, 6);
  });

  it("has no answer for an empty sample, rather than zero", () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(median([])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("ignores input order", () => {
    expect(quantile([30, 0, 20, 10], 0.5)).toBe(15);
  });
});

describe("pinballLoss", () => {
  it("charges an under-forecast p90 more than an over-forecast one", () => {
    // Actual above the p90 is the expensive direction for a high quantile.
    expect(pinballLoss(110, 100, 0.9)).toBeCloseTo(9, 6);
    expect(pinballLoss(90, 100, 0.9)).toBeCloseTo(1, 6);
    // ...and the other way round for a low quantile.
    expect(pinballLoss(110, 100, 0.1)).toBeCloseTo(1, 6);
    expect(pinballLoss(90, 100, 0.1)).toBeCloseTo(9, 6);
  });

  it("reduces to half the absolute error at the median", () => {
    expect(pinballLoss(110, 100, 0.5)).toBeCloseTo(5, 6);
    expect(pinballLoss(90, 100, 0.5)).toBeCloseTo(5, 6);
  });
});

describe("dayOfYear", () => {
  it("folds 29 February onto 28 February so every year has 365 shapes", () => {
    expect(dayOfYear("2024-02-28")).toBe(59);
    expect(dayOfYear("2024-02-29")).toBe(59);
    expect(dayOfYear("2024-03-01")).toBe(60);
    expect(dayOfYear("2023-03-01")).toBe(60);
    expect(dayOfYear("2024-12-31")).toBe(365);
    expect(dayOfYear("2023-12-31")).toBe(365);
  });

  it("wraps around the new year", () => {
    expect(dayOfYearDistance(1, 365)).toBe(1);
    expect(dayOfYearDistance(360, 5)).toBe(10);
    expect(dayOfYearDistance(100, 120)).toBe(20);
  });
});

describe("ONI availability", () => {
  const oni: OniSeries = new Map([
    ["2024-05", 0.9],
    ["2024-06", 0.7],
    ["2024-07", 0.2],
    ["2024-08", -0.6],
  ]);

  it("never returns a label newer than the publication lag allows", () => {
    // Standing on 2024-08-15, the newest three-month mean that can exist is June's.
    expect(availableAt(oni, "2024-08-15")).toEqual({ month: "2024-06", oni: 0.7 });
    expect(availableAt(oni, "2024-10-01")).toEqual({ month: "2024-08", oni: -0.6 });
  });

  it("has no answer before the series starts", () => {
    expect(availableAt(oni, "2024-06-01")).toBeNull();
  });

  it("uses NOAA's own thresholds for the phase", () => {
    expect(phaseOf(0.5)).toBe("el_nino");
    expect(phaseOf(0.49)).toBe("neutral");
    expect(phaseOf(-0.5)).toBe("la_nina");
  });
});
