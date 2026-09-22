/**
 * The arithmetic the M4 decision rests on. Each of these is small, and each is one a report
 * could get quietly wrong: a crossing read off the wrong horizon, an interval that is not
 * reproducible, a "win" declared on MAE while the band went bad.
 */

import { describe, expect, it } from "vitest";
import type { ModelScore, Prediction } from "../src/lib/models/backtest.ts";
import { DEFAULT_M4 } from "../src/lib/models/boosted.ts";
import {
  gridCrossings,
  m4Decisions,
  nativeBandScores,
  pairedAgainst,
  pairedBlockBootstrap,
  type M4Snapshot,
} from "../src/lib/models/m4-scoring.ts";
import { addDays } from "../src/lib/util/dates.ts";

function prediction(modelId: string, origin: string, horizonDays: number, p50: number, actual: number, extra: Partial<Prediction> = {}): Prediction {
  return {
    modelId,
    origin,
    horizonDays,
    targetDate: addDays(origin, horizonDays),
    actual,
    p50,
    ensembleP10: null,
    ensembleP90: null,
    p10: null,
    p90: null,
    ...extra,
  };
}

describe("gridCrossings", () => {
  it("puts the crossing at the first horizon whose quantile reaches the threshold", () => {
    const predictions = [
      prediction("M4", "2024-09-01", 7, 2130, 0),
      prediction("M4", "2024-09-01", 30, 2114, 0),
      prediction("M4", "2024-09-01", 14, 2120, 0),
      prediction("M4", "2024-09-01", 60, 2100, 0),
      prediction("M4", "2024-10-01", 7, 2125, 0),
      prediction("other", "2024-10-01", 7, 2000, 0),
    ];
    expect(gridCrossings(predictions, "M4", 2115, (p) => p.p50)).toEqual([
      { origin: "2024-09-01", predictedCrossing: "2024-10-01" },
      { origin: "2024-10-01", predictedCrossing: null },
    ]);
  });

  it("treats a missing quantile as no call rather than as a crossing", () => {
    const predictions = [prediction("M4", "2024-09-01", 7, 2100, 0)];
    expect(gridCrossings(predictions, "M4", 2115, (p) => p.ensembleP10)[0]!.predictedCrossing).toBeNull();
  });
});

describe("pairedBlockBootstrap", () => {
  it("is reproducible from its seed and brackets the mean", () => {
    const diffs = Array.from({ length: 60 }, (_, i) => Math.sin(i) - 0.2);
    const a = pairedBlockBootstrap(diffs, 6, 500, 3)!;
    expect(pairedBlockBootstrap(diffs, 6, 500, 3)).toEqual(a);
    expect(a.low).toBeLessThan(a.mean);
    expect(a.high).toBeGreaterThan(a.mean);
  });

  it("collapses to the mean when every difference is the same", () => {
    const a = pairedBlockBootstrap(Array(20).fill(-0.5), 6, 200, 1)!;
    expect(a.low).toBeCloseTo(-0.5, 12);
    expect(a.high).toBeCloseTo(-0.5, 12);
  });

  it("has nothing to say about no data", () => {
    expect(pairedBlockBootstrap([], 6, 100, 1)).toBeNull();
  });
});

describe("pairedAgainst and nativeBandScores", () => {
  const origins = Array.from({ length: 24 }, (_, i) => addDays("2020-01-01", i * 30));
  const predictions = origins.flatMap((origin, i) => [
    prediction("M3", origin, 30, 2130, 2131 + (i % 3)),
    prediction("M4", origin, 30, 2131, 2131 + (i % 3), { ensembleP10: 2130.5, ensembleP90: 2132.5, p10: 2129, p90: 2133 }),
  ]);

  it("measures the paired MAE difference with the sign that means 'closer'", () => {
    const [cell] = pairedAgainst(predictions, "M4", "M3", [30]);
    // M3 misses by 1, 2, 3 in turn; M4 by 0, 1, 2: one metre closer every time.
    expect(cell!.maeDifferenceM).toBeCloseTo(-1, 12);
    expect(cell!.winShare).toBe(1);
    expect(cell!.high90).toBeLessThan(0);
  });

  it("scores the model's own band only where the harness had a calibrated one", () => {
    const withWarmup = predictions.map((p, i) => (i < 4 ? { ...p, p10: null, p90: null } : p));
    const [cell] = nativeBandScores(withWarmup, "M4", [30]);
    expect(cell!.n).toBe(22);
    // Origins 2..23 remain; actuals cycle 2131, 2132, 2133 against a 2130.5-2132.5 band, and
    // the eight origins with i % 3 = 2 land outside it.
    expect(cell!.coverage).toBeCloseTo(14 / 22, 12);
  });
});

describe("m4Decisions", () => {
  const score = (modelId: string, mae: number, coverage: number): ModelScore => ({
    modelId,
    label: modelId,
    horizons: [
      {
        horizonDays: 30,
        n: 100,
        maeM: mae,
        rmseM: mae,
        biasM: 0,
        skillVsPersistence: null,
        nBand: 90,
        pinballMeanM: null,
        coverageP10P90: coverage,
        ensembleCoverage: null,
        meanBandWidthM: null,
      },
    ],
  });
  const snapshot = (m4: ModelScore): M4Snapshot => ({
    generatedAt: "",
    runtimeSeconds: 0,
    command: "",
    origins: [],
    horizonDays: [30],
    settings: DEFAULT_M4,
    features: { base: [], m3: [] },
    referenceId: "M3-water-balance",
    scores: [score("M3-water-balance", 5, 0.75), m4],
    native: [],
    paired: [],
    crisis: { thresholdM: 2115, episodes: [], falseAlarms: [], originsConsidered: 0 },
    m3AnchorMaxAbsDifferenceM: 0,
  });

  it("counts a win only when the MAE is lower and the band is no further from 80%", () => {
    expect(m4Decisions(snapshot(score("M4-a", 4.5, 0.82)))[0]!.wins).toBe(true);
    expect(m4Decisions(snapshot(score("M4-a", 4.5, 0.62)))[0]!.wins).toBe(false);
    expect(m4Decisions(snapshot(score("M4-a", 5.5, 0.8)))[0]!.wins).toBe(false);
  });

  it("does not judge the reference against itself", () => {
    expect(m4Decisions(snapshot(score("M4-a", 4, 0.8))).map((d) => d.modelId)).toEqual(["M4-a"]);
  });
});
