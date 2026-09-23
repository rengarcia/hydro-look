/**
 * The learner M4 runs on, tested on problems whose answer is known before it is fitted. A
 * boosting implementation that is subtly wrong still produces numbers — usually plausible ones
 * — so each property below is one a broken learner would fail visibly.
 */

import { describe, expect, it } from "vitest";
import { binMatrix, DEFAULT_GBM, fitGbm, predictGbm, seededRandom, type GbmOptions } from "../src/lib/models/gbm.ts";

/** Box-Muller on the seeded generator, so the synthetic data is itself reproducible. */
function normal(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function options(overrides: Partial<GbmOptions> = {}): GbmOptions {
  return { ...DEFAULT_GBM, loss: { kind: "squared" }, ...overrides };
}

describe("seededRandom", () => {
  it("is a pure function of its seed and stays inside [0, 1)", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const draws = Array.from({ length: 1000 }, () => a());
    expect(draws).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...draws)).toBeLessThan(1);
    expect(seededRandom(8)()).not.toBe(seededRandom(7)());
  });
});

describe("binMatrix", () => {
  it("gives a low-cardinality feature one bin per value, and missing values bin 0", () => {
    const binned = binMatrix([[0], [1], [2], [1], [Number.NaN]], 32);
    expect([...binned.edges[0]!]).toEqual([0, 1]);
    expect([...binned.bins]).toEqual([1, 2, 3, 2, 0]);
  });

  it("never uses more bins than asked for", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => [i * 0.37]);
    const binned = binMatrix(rows, 16);
    expect(binned.edges[0]!.length).toBeLessThanOrEqual(14);
    expect(Math.max(...binned.bins)).toBeLessThanOrEqual(15);
  });

  it("refuses a bin count bytes cannot hold", () => {
    expect(() => binMatrix([[1]], 256)).toThrow(/maxBins/);
  });
});

describe("fitGbm, squared loss", () => {
  it("recovers a smooth function of two features far better than its mean", () => {
    const random = seededRandom(3);
    const make = (n: number) => {
      const x: number[][] = [];
      const y: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = random() * 6;
        const b = random() * 2;
        x.push([a, b, random()]); // the third feature is pure noise
        y.push(2 * Math.sin(a) + b * b);
      }
      return { x, y };
    };
    const train = make(2000);
    const test = make(500);
    const model = fitGbm(train.x, train.y, options({ trees: 300, learningRate: 0.1, maxDepth: 4, minLeaf: 5 }));
    const mean = train.y.reduce((s, v) => s + v, 0) / train.y.length;
    const mae = test.y.reduce((s, y, i) => s + Math.abs(y - predictGbm(model, test.x[i]!)), 0) / test.y.length;
    const baseline = test.y.reduce((s, y) => s + Math.abs(y - mean), 0) / test.y.length;
    expect(mae).toBeLessThan(0.1 * baseline);
    expect(mae).toBeLessThan(0.15);
  });

  it("finds a step exactly", () => {
    const x = Array.from({ length: 400 }, (_, i) => [i / 400]);
    const y = x.map(([v]) => (v! > 0.5 ? 1 : 0));
    const model = fitGbm(x, y, options({ trees: 200, learningRate: 0.2, subsample: 1, minLeaf: 5 }));
    expect(predictGbm(model, [0.1])).toBeCloseTo(0, 3);
    expect(predictGbm(model, [0.9])).toBeCloseTo(1, 3);
  });

  it("routes missing values the same way in training and prediction", () => {
    const x: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 400; i++) {
      const missing = i % 2 === 0;
      x.push([missing ? Number.NaN : i / 400]);
      y.push(missing ? 5 : 0);
    }
    const model = fitGbm(x, y, options({ trees: 100, learningRate: 0.3, subsample: 1, minLeaf: 5 }));
    expect(predictGbm(model, [Number.NaN])).toBeCloseTo(5, 2);
    expect(predictGbm(model, [0.3])).toBeCloseTo(0, 2);
  });
});

describe("fitGbm, pinball loss", () => {
  // Heteroscedastic: the spread grows with x, so a band that ignored x would be wrong at both
  // ends while still covering 80% overall. Coverage is checked in each half separately.
  const random = seededRandom(11);
  const make = (n: number) => {
    const x: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = random() * 4;
      x.push([v]);
      y.push(3 * v + (0.2 + v) * normal(random));
    }
    return { x, y };
  };
  const train = make(4000);
  const test = make(4000);
  const fit = (alpha: number) =>
    fitGbm(train.x, train.y, options({ loss: { kind: "quantile", alpha }, trees: 250, learningRate: 0.1, minLeaf: 30 }));
  const q10 = fit(0.1);
  const q50 = fit(0.5);
  const q90 = fit(0.9);

  it("puts about the stated share of held-out outcomes below each quantile", () => {
    const below = (model: ReturnType<typeof fit>) => test.y.filter((y, i) => y < predictGbm(model, test.x[i]!)).length / test.y.length;
    expect(below(q10)).toBeGreaterThan(0.07);
    expect(below(q10)).toBeLessThan(0.13);
    expect(below(q50)).toBeGreaterThan(0.46);
    expect(below(q50)).toBeLessThan(0.54);
    expect(below(q90)).toBeGreaterThan(0.87);
    expect(below(q90)).toBeLessThan(0.93);
  });

  it("covers about 80% inside p10-p90 in the narrow half and the wide half alike", () => {
    for (const [lo, hi] of [
      [0, 2],
      [2, 4],
    ] as const) {
      const idx = test.x
        .map((row, i) => [row[0]!, i] as const)
        .filter(([v]) => v >= lo && v < hi)
        .map(([, i]) => i);
      const inside = idx.filter((i) => {
        const y = test.y[i]!;
        return y >= predictGbm(q10, test.x[i]!) && y <= predictGbm(q90, test.x[i]!);
      }).length;
      expect(inside / idx.length).toBeGreaterThan(0.74);
      expect(inside / idx.length).toBeLessThan(0.86);
    }
    // And the band is actually wider where the noise is.
    const width = (v: number) => predictGbm(q90, [v]) - predictGbm(q10, [v]);
    expect(width(3.5)).toBeGreaterThan(2.5 * width(0.5));
  });
});

describe("determinism", () => {
  const random = seededRandom(5);
  const x = Array.from({ length: 600 }, () => [random(), random(), random()]);
  const y = x.map(([a, b, c]) => a! * 3 - b! + c! * c! + 0.1 * normal(random));
  const probe = [
    [0.2, 0.4, 0.6],
    [0.9, 0.1, 0.3],
  ];

  it("produces the same model bit for bit from the same seed", () => {
    const settings = options({ loss: { kind: "quantile", alpha: 0.9 }, subsample: 0.6, featureFraction: 0.67, seed: 42 });
    const a = fitGbm(x, y, settings);
    const b = fitGbm(x, y, settings);
    expect(probe.map((row) => predictGbm(a, row))).toEqual(probe.map((row) => predictGbm(b, row)));
    expect(a.trees.map((t) => [...t.threshold])).toEqual(b.trees.map((t) => [...t.threshold]));
  });

  it("changes with the seed when there is randomness to seed", () => {
    const a = fitGbm(x, y, options({ subsample: 0.6, seed: 1 }));
    const b = fitGbm(x, y, options({ subsample: 0.6, seed: 2 }));
    expect(predictGbm(a, probe[0]!)).not.toBe(predictGbm(b, probe[0]!));
  });

  it("refuses a row of the wrong width rather than reading undefined as a value", () => {
    const model = fitGbm(x, y, options({ trees: 5 }));
    expect(() => predictGbm(model, [0.1, 0.2])).toThrow(/features/);
  });
});
