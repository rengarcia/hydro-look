/**
 * The chart geometry, checked where it is easy to be plausibly wrong: a tick that drifts in
 * floating point, a band that closes with a diagonal across the figure, a stack that silently
 * shortens when a day is missing a concept.
 */

import { describe, expect, it } from "vitest";
import { bandPath, linePath, linearScale, niceTicks, stack, stackMax } from "../src/lib/chart/scale.ts";

describe("linearScale", () => {
  it("maps the domain onto the range, including an inverted range for SVG's downward y", () => {
    const y = linearScale([2100, 2153], [200, 0]);
    expect(y(2100)).toBe(200);
    expect(y(2153)).toBe(0);
    expect(y(2126.5)).toBeCloseTo(100, 6);
  });

  it("puts a reservoir that has not moved in the middle rather than dividing by zero", () => {
    const y = linearScale([2138, 2138], [200, 0]);
    expect(y(2138)).toBe(100);
  });
});

describe("niceTicks", () => {
  it("snaps to 1/2/5 steps and stays inside the domain", () => {
    expect(niceTicks(2106, 2156, 5)).toEqual([2110, 2120, 2130, 2140, 2150]);
  });

  it("does not print floating-point noise as an axis label", () => {
    // Accumulating with `value += step` turns the fourth tick into 0.30000000000000004.
    for (const tick of niceTicks(0, 1, 10)) expect(String(tick).length).toBeLessThan(6);
  });

  it("has one tick for a flat domain and none for a nonsensical one", () => {
    expect(niceTicks(5, 5)).toEqual([5]);
    expect(niceTicks(Number.NaN, 10)).toEqual([]);
  });
});

describe("linePath", () => {
  it("moves once and then draws", () => {
    expect(
      linePath([
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ]),
    ).toBe("M0 1 L2 3");
  });

  it("draws nothing from a single point, rather than a zero-length stroke", () => {
    expect(linePath([{ x: 0, y: 1 }])).toBe("");
  });
});

describe("bandPath", () => {
  it("walks the lower edge backwards so the band closes along itself", () => {
    const upper = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const lower = [
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ];
    expect(bandPath(upper, lower)).toBe("M0 0 L10 0 L10 5 L0 5 Z");
  });

  it("refuses edges of different lengths rather than resampling one to fit", () => {
    expect(
      bandPath(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [{ x: 0, y: 1 }],
      ),
    ).toBe("");
  });
});

describe("stack", () => {
  const keys = ["hidraulica", "gas", "importacion"];

  it("accumulates upward in the order given, not in the order of the day's values", () => {
    const [hydro, gas, imports] = stack([{ hidraulica: 60, gas: 20, importacion: 20 }], keys);
    expect(hydro!.extents[0]).toEqual([0, 60]);
    expect(gas!.extents[0]).toEqual([60, 80]);
    expect(imports!.extents[0]).toEqual([80, 100]);
  });

  it("keeps the order when the mix inverts, so a band can be followed across days", () => {
    const bands = stack(
      [
        { hidraulica: 10, gas: 90 },
        { hidraulica: 90, gas: 10 },
      ],
      keys,
    );
    expect(bands.map((b) => b.key)).toEqual(keys);
    expect(bands[0]!.extents).toEqual([
      [0, 10],
      [0, 90],
    ]);
  });

  it("treats a missing concept as zero so every band keeps the same length", () => {
    const bands = stack([{ hidraulica: 60 }, { hidraulica: 60, gas: 10 }], keys);
    for (const band of bands) expect(band.extents).toHaveLength(2);
    expect(bands[1]!.extents[0]).toEqual([60, 60]);
  });

  it("ignores a negative value rather than stacking downward through the band below it", () => {
    const bands = stack([{ hidraulica: 60, gas: -5, importacion: 10 }], keys);
    expect(bands[2]!.extents[0]).toEqual([60, 70]);
  });

  it("reports the tallest top edge as the y domain", () => {
    expect(stackMax(stack([{ hidraulica: 60, gas: 20 }, { hidraulica: 90 }], keys))).toBe(90);
  });
});
