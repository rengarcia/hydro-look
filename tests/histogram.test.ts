/**
 * The histogram binning, checked where it is easy to be plausibly wrong: an edge that drifts in
 * floating point, a flood that falls off the right of the axis, a zero that falls off the left.
 */

import { describe, expect, it } from "vitest";
import { binsFor, histogram, niceStep, percentBelow } from "../src/lib/chart/histogram.ts";

describe("niceStep", () => {
  it("snaps up to 1/2/5 × 10^n", () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(0.03)).toBeCloseTo(0.05, 12);
  });

  it("falls back to 1 for a step with no nice value", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe("binsFor", () => {
  it("starts at zero and stops just past the cap quantile, in nice steps", () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const bins = binsFor(values, 10, 1)!;
    expect(bins.edges[0]).toBe(0);
    expect(bins.width).toBe(10);
    expect(bins.edges.at(-1)).toBe(100);
    expect(bins.open).toBe(false);
  });

  it("leaves a flood beyond the cap to the last bar and says so", () => {
    const values = [...Array.from({ length: 200 }, (_, i) => i % 50), 1000];
    const bins = binsFor(values, 10)!;
    expect(bins.edges.at(-1)!).toBeLessThan(1000);
    expect(bins.open).toBe(true);
  });

  it("prints edges without floating-point noise", () => {
    const bins = binsFor(
      Array.from({ length: 50 }, (_, i) => i * 0.02),
      10,
      1,
    )!;
    for (const edge of bins.edges) expect(String(edge).length).toBeLessThan(6);
  });

  it("has nothing to bin without a finite value", () => {
    expect(binsFor([])).toBeNull();
    expect(binsFor([Number.NaN])).toBeNull();
  });

  it("still bins a plant that never ran", () => {
    expect(binsFor([0, 0, 0])).toEqual({ edges: [0, 1], width: 1, open: false });
  });
});

describe("histogram", () => {
  it("counts every value once, zeros in the first bar and the tail in the last", () => {
    const bins = { edges: [0, 10, 20, 30], width: 10, open: true };
    const out = histogram([0, 0, 5, 10, 19.99, 29, 30, 500], bins);
    expect(out.map((b) => b.count)).toEqual([3, 2, 3]);
    expect(out.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1, 12);
  });

  it("puts a value on an edge in the bin above it", () => {
    const bins = { edges: [0, 0.1, 0.2, 0.3], width: 0.1, open: false };
    // 0.3 / 0.1 is 2.9999999999999996 in floating point.
    expect(histogram([0.1, 0.2], bins).map((b) => b.count)).toEqual([0, 1, 1]);
  });
});

describe("percentBelow", () => {
  it("is the share strictly below, as a percentage", () => {
    expect(percentBelow([1, 2, 3, 4], 3)).toBe(50);
    expect(percentBelow([1, 2, 3, 4], 0)).toBe(0);
    expect(percentBelow([], 3)).toBeNull();
  });
});
