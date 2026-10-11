/**
 * `lib/site/shape.ts`: the geometry that makes a gauge's painted area its stored water. The
 * assertions are the claims the drawing makes — the area of the outline is the volume, the share
 * is of water and not of metres, and a curve that is not a curve draws nothing.
 */

import { describe, expect, it } from "vitest";
import {
  areaM2,
  horizontalPath,
  isAreaCurve,
  outline,
  storedHm3,
  verticalPath,
  volumeShare,
  widthAt,
  type AreaCurve,
} from "../src/lib/site/shape.ts";

/** The curve `forecast.json` published for Mazar on 2026-10-11. */
const MAZAR: AreaCurve = { coefficient: 48.305449, exponent: 2.5, datum_m: 2036.66 };
/** A prism: the same surface at every level, so water and metres agree. */
const PRISM: AreaCurve = { coefficient: 1e6, exponent: 0, datum_m: 0 };

describe("the curve", () => {
  it("accepts what forecast.json publishes and rejects anything else", () => {
    expect(isAreaCurve({ form: "A(level) = …", ...MAZAR, fit_rmse_level_m: 0.69, fit_days: 2016 })).toBe(true);
    expect(isAreaCurve(undefined)).toBe(false);
    expect(isAreaCurve({ ...MAZAR, coefficient: 0 })).toBe(false);
    expect(isAreaCurve({ ...MAZAR, exponent: Number.NaN })).toBe(false);
    expect(isAreaCurve({ coefficient: 1, exponent: 1 })).toBe(false);
  });

  it("integrates to what the backtest report publishes for Mazar, and about 206 hm³ over the declared band", () => {
    // data/reports/backtest.md: "storage, lowest declared minimum → crest | 230.0 hm³".
    expect(storedHm3(MAZAR, 2098, 2155.83)).toBeCloseTo(230, 0);
    expect(storedHm3(MAZAR, 2100, 2153)).toBeCloseTo(206.5, 0);
  });
});

describe("the share of water", () => {
  it("equals the share of metres for a prism", () => {
    expect(volumeShare(PRISM, 100, 200, 150)).toBeCloseTo(50, 9);
  });

  it("falls well below the share of metres in a valley", () => {
    // 2126.44 m is 50.3% of the 2100–2153 band's height, and about a third of its water.
    const share = volumeShare(MAZAR, 2100, 2153, 2126.44)!;
    expect(share).toBeGreaterThan(30);
    expect(share).toBeLessThan(34);
  });

  it("is not clamped, like band_pct, so spill and drawdown stay visible", () => {
    expect(volumeShare(MAZAR, 2100, 2153, 2155)!).toBeGreaterThan(100);
    expect(volumeShare(MAZAR, 2100, 2153, 2099)!).toBeLessThan(0);
  });

  it("is null for a band with no height", () => {
    expect(volumeShare(MAZAR, 2153, 2153, 2153)).toBeNull();
  });
});

describe("the outline", () => {
  it("is 1 wide at the crest and narrows with the lake", () => {
    const points = outline(MAZAR, 2098, 2153);
    expect(points[0]!.t).toBe(0);
    expect(points.at(-1)!).toEqual({ t: 1, w: 1 });
    expect(points[0]!.w).toBeCloseTo(areaM2(MAZAR, 2098) / areaM2(MAZAR, 2153), 9);
    for (let i = 1; i < points.length; i++) expect(points[i]!.w).toBeGreaterThan(points[i - 1]!.w);
  });

  it("stops at the level exactly, not at the nearest sample", () => {
    const points = outline(MAZAR, 2098, 2153, 2126.44);
    expect(points.at(-1)!.t).toBeCloseTo((2126.44 - 2098) / 55, 12);
    expect(points.every((p) => p.t <= points.at(-1)!.t)).toBe(true);
  });

  it("clamps a level outside the axis to the axis", () => {
    expect(outline(MAZAR, 2098, 2153, 2200).at(-1)!.t).toBe(1);
    expect(outline(MAZAR, 2098, 2153, 2000)).toEqual([{ t: 0, w: expect.any(Number) as number }]);
  });

  it("draws nothing for an axis with no height", () => {
    expect(outline(MAZAR, 2153, 2153)).toEqual([]);
    expect(horizontalPath([], 100, 18)).toBe("");
    expect(verticalPath([], 100, 100)).toBe("");
  });

  it("encloses an area in proportion to the water, which is the point of drawing it", () => {
    const area = (points: ReturnType<typeof outline>) =>
      points.slice(1).reduce((sum, p, i) => sum + ((p.w + points[i]!.w) / 2) * (p.t - points[i]!.t), 0);
    const whole = area(outline(MAZAR, 2100, 2153, 2153, 400));
    const water = area(outline(MAZAR, 2100, 2153, 2126.44, 400));
    expect((water / whole) * 100).toBeCloseTo(volumeShare(MAZAR, 2100, 2153, 2126.44)!, 1);
  });

  it("interpolates its width between samples", () => {
    const points = [
      { t: 0, w: 0.2 },
      { t: 0.5, w: 0.6 },
      { t: 1, w: 1 },
    ];
    expect(widthAt(points, 0.25)).toBeCloseTo(0.4, 12);
    expect(widthAt(points, -1)).toBe(0.2);
    expect(widthAt(points, 2)).toBe(1);
  });
});

describe("the paths", () => {
  const points = [
    { t: 0, w: 0.5 },
    { t: 1, w: 1 },
  ];

  it("lays a horizontal gauge about its midline, deep end left", () => {
    expect(horizontalPath(points, 100, 20)).toBe("M0 5 L100 0 L100 20 L0 15 Z");
  });

  it("stands a vertical gauge on its centre line, crest at the top", () => {
    expect(verticalPath(points, 100, 200)).toBe("M25 200 L0 0 L100 0 L75 200 Z");
  });
});
