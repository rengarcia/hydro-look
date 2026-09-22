/**
 * The M4 rows in the backtest report come from a committed snapshot, not from the run that
 * renders the report. The one thing that must never happen is a stale snapshot sitting in the
 * ladder's tables as though it had been scored on the same origins.
 */

import { describe, expect, it } from "vitest";
import type { ModelScore } from "../src/lib/models/backtest.ts";
import { DEFAULT_M4 } from "../src/lib/models/boosted.ts";
import type { M4Snapshot } from "../src/lib/models/m4-scoring.ts";
import { renderBacktestReport, type ReportInputs } from "../src/lib/models/report.ts";

function score(modelId: string, mae: number): ModelScore {
  return {
    modelId,
    label: modelId,
    horizons: [7, 90].map((horizonDays) => ({
      horizonDays,
      n: 3,
      maeM: mae,
      rmseM: mae,
      biasM: 0,
      skillVsPersistence: 1 - mae / 10,
      nBand: 3,
      pinballMeanM: mae / 3,
      coverageP10P90: 0.8,
      ensembleCoverage: null,
      meanBandWidthM: null,
    })),
  };
}

const ORIGINS = ["2018-01-01", "2018-02-01", "2018-03-01"];

function snapshot(origins: string[]): M4Snapshot {
  return {
    generatedAt: "2026-09-22T00:00:00Z",
    runtimeSeconds: 1,
    command: "npm run backtest:m4",
    origins,
    horizonDays: [7, 90],
    settings: DEFAULT_M4,
    features: { base: [], m3: [] },
    referenceId: "M3-water-balance",
    scores: [score("M0-persistence", 10), score("M3-water-balance", 7), score("M4-gbm-m3-residual", 7.5)],
    native: [],
    paired: [],
    crisis: { thresholdM: 2115, episodes: [], falseAlarms: [], originsConsidered: 3 },
    m3AnchorMaxAbsDifferenceM: 0,
  };
}

function inputs(m4: M4Snapshot | null): ReportInputs {
  return {
    generatedAt: "2026-09-22T00:00:00Z",
    site: "mazar",
    horizonDays: [7, 90],
    ladder: [score("M0-persistence", 10), score("M3-water-balance", 7)],
    shippedModelId: "M3-water-balance",
    variant: null,
    crisis: { thresholdM: 2115, thresholdSource: "test", episodes: [], falseAlarms: 0, originsConsidered: 3 },
    fit: {
      curve: {
        areaCoefficient: 1277,
        areaExponent: 1.9,
        datumM: 2060,
        turbineM3sPerMw: 0.65,
        rmseDeltaLevelM: 0.5,
        days: 100,
        fitCeilingM: 2150,
      },
      rule: { points: [{ level: 2110, releaseM3s: 10 }, { level: 2150, releaseM3s: 60 }], zeroAtM: 2060, days: 100 },
      stance: 0,
      startLevel: 2130,
    },
    crestM: 2155,
    levelRange: { first: "2014-09-20", last: "2026-09-21", days: 4385 },
    m4: m4 ? { snapshot: m4, ladderOrigins: ORIGINS } : null,
  };
}

const maeTable = (report: string) => report.split("## Mean absolute error, metres")[1]!.split("##")[0]!;

describe("the M4 section of the backtest report", () => {
  it("is absent when no snapshot has been committed", () => {
    const report = renderBacktestReport(inputs(null));
    expect(report).not.toContain("M4");
  });

  it("joins the ladder's tables when scored on exactly the ladder's origins", () => {
    const report = renderBacktestReport(inputs(snapshot(ORIGINS)));
    expect(maeTable(report)).toContain("| M4-gbm-m3-residual | 7.500 | 7.500 |");
    expect(report).toContain("## M4 — gradient-boosted quantile trees");
    expect(report).toContain("does not beat M3-water-balance at any horizon");
  });

  it("stays out of the ladder's tables, and says it is stale, when the origins differ", () => {
    const report = renderBacktestReport(inputs(snapshot(ORIGINS.slice(0, 2))));
    expect(maeTable(report)).not.toContain("M4-gbm");
    expect(report).toContain("was scored on 2 origins");
    expect(report).toContain("the ladder above now has 3");
  });

  it("states plainly which horizon publishes M4, or why this run fell back to M3", () => {
    const published = renderBacktestReport({
      ...inputs(snapshot(ORIGINS)),
      published: { published: true, modelId: "M4-gbm-m3-residual", horizonDays: 7, reason: null },
    });
    expect(published).toContain("**7 days publishes M4-gbm-m3-residual; every other horizon publishes M3-water-balance.**");

    const fellBack = renderBacktestReport({
      ...inputs(snapshot(ORIGINS.slice(0, 2))),
      published: { published: false, modelId: "M4-gbm-m3-residual", horizonDays: 7, reason: "the snapshot is stale." },
    });
    expect(fellBack).toContain("**7 days would publish M4-gbm-m3-residual, but this run falls back to M3-water-balance:** the snapshot is stale.");
    expect(fellBack).not.toContain("7 days publishes M4");
  });
});
