/**
 * §5.1: the published runs, scored against what happened, under the version that made them.
 */

import { describe, expect, it } from "vitest";
import {
  latestRunPerOrigin,
  renderScorecardReport,
  scoreAdequacyRuns,
  scorecardBlock,
  scoreLevelForecasts,
} from "../src/lib/models/scorecard.ts";
import type { BalanceDay } from "../src/lib/features/balance.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { addDays } from "../src/lib/util/dates.ts";

const run = (id: string, origin: string, version: string, generatedAt: string, model = "M3-water-balance") => ({
  run_id: id,
  generated_at: generatedAt,
  origin_date: origin,
  site: "mazar",
  model_id: model,
  model_version: version,
});

const value = (runId: string, origin: string, h: number, p10: number, p50: number, p90: number, model = "") => ({
  run_id: runId,
  origin_date: origin,
  horizon_days: String(h),
  target_date: addDays(origin, h),
  p10: String(p10),
  p50: String(p50),
  p90: String(p90),
  model_id: model,
});

const levels: DailySeries = new Map();
for (let i = 0; i < 40; i++) levels.set(addDays("2026-09-01", i), 2130 - i * 0.1);

describe("scoreLevelForecasts", () => {
  const runs = [
    run("a1", "2026-09-01", "1", "2026-09-02T00:00:00Z"),
    run("a2", "2026-09-01", "2", "2026-09-02T01:00:00Z"),
    run("a2-rerun", "2026-09-01", "2", "2026-09-02T05:00:00Z"),
    run("b2", "2026-10-05", "2", "2026-10-06T00:00:00Z"),
  ];
  const values = [
    value("a1", "2026-09-01", 7, 2128, 2129, 2130),
    value("a2", "2026-09-01", 7, 2000, 2001, 2002),
    value("a2-rerun", "2026-09-01", 7, 2128, 2129.5, 2130, "M4-gbm-m3-residual"),
    value("a2-rerun", "2026-09-01", 14, 2120, 2125, 2126),
    value("b2", "2026-10-05", 7, 2120, 2125, 2126),
  ];
  const card = scoreLevelForecasts(runs, values, () => levels);

  it("scores each row under the version, and the row's own model, that published it", () => {
    const keys = card.groups.map((g) => `${g.modelId}|${g.modelVersion}|${g.horizonDays}`);
    expect(keys).toEqual(["M3-water-balance|1|7", "M3-water-balance|2|14", "M4-gbm-m3-residual|2|7"]);
  });

  it("scores only the last run generated for an origin and version", () => {
    expect(card.runsSuperseded).toBe(1);
    expect(card.scored.some((r) => r.runId === "a2")).toBe(false);
  });

  it("measures error, coverage and pinball against the level on the target day", () => {
    const m4 = card.groups.find((g) => g.modelId === "M4-gbm-m3-residual")!;
    const observed = levels.get("2026-09-08")!;
    expect(m4.n).toBe(1);
    expect(m4.mae).toBeCloseTo(Math.abs(observed - 2129.5), 9);
    expect(m4.coverageP10P90).toBe(1);
    const fourteen = card.groups.find((g) => g.horizonDays === 14)!;
    expect(fourteen.coverageP10P90).toBe(0);
    expect(fourteen.pinballMean).toBeGreaterThan(0);
  });

  it("counts a row whose target has not come yet as pending, not as scored", () => {
    expect(card.rowsPending).toBe(1);
    expect(card.rowsScored).toBe(3);
  });

  it("publishes an additive block with n beside every number", () => {
    const block = scorecardBlock(card, "2026-10-12T00:00:00Z") as { by_horizon: { n: number; mae: number | null }[]; recent: unknown[] };
    expect(block.by_horizon.every((g) => typeof g.n === "number")).toBe(true);
    expect(block.recent).toHaveLength(3);
  });

  it("renders a report that says so when nothing has been scored yet", () => {
    const empty = scoreLevelForecasts(runs.slice(3), values.slice(4), () => new Map());
    const text = renderScorecardReport({ generatedAt: "2026-10-12T00:00:00Z", level: empty, adequacy: empty });
    expect(text).toContain("No published row has reached its target date");
  });
});

describe("latestRunPerOrigin", () => {
  it("keeps one run per origin, version and site", () => {
    const { kept, superseded } = latestRunPerOrigin([
      run("x", "2026-09-01", "1", "2026-09-01T01:00:00Z"),
      run("y", "2026-09-01", "1", "2026-09-01T02:00:00Z"),
      run("z", "2026-09-01", "2", "2026-09-01T00:00:00Z"),
    ]);
    expect(kept.map((r) => r["run_id"]).sort()).toEqual(["y", "z"]);
    expect(superseded).toBe(1);
  });
});

describe("scoreAdequacyRuns", () => {
  const days: BalanceDay[] = Array.from({ length: 30 }, (_, i) => ({
    date: addDays("2026-09-01", i),
    loadGwh: 110,
    hydroGwh: 80,
    thermalGwh: 25,
    otherGwh: 1,
    importGwh: 4,
    exportGwh: 0,
    generationGwh: 106,
    distributionDemandGwh: 100,
  }));
  const runs = [
    { run_id: "r", generated_at: "2026-09-02T00:00:00Z", origin_date: "2026-09-01", model_id: "adequacy-v1", model_version: "2" },
  ];
  const values = [7, 14, 60].map((h) => ({
    run_id: "r",
    origin_date: "2026-09-01",
    horizon_days: String(h),
    target_date: addDays("2026-09-01", h),
    requirement_gwh_day: "28",
    requirement_p10: "25",
    requirement_p90: "31",
  }));

  it("scores the net requirement against the realised mean of load − hydro over the window", () => {
    const card = scoreAdequacyRuns(runs, values, days, []);
    expect(card.rowsScored).toBe(2);
    expect(card.rowsPending).toBe(1);
    expect(card.groups[0]!.mae).toBeCloseTo(2, 9);
    expect(card.groups[0]!.coverageP10P90).toBe(1);
  });

  it("excludes a window that ran through rationing rather than scoring the allowed load", () => {
    const card = scoreAdequacyRuns(runs, values, days, [{ start: "2026-09-05", end: "2026-09-06", kind: "rationing", hydroRelated: true }]);
    expect(card.rowsScored).toBe(0);
    expect(card.rowsExcluded).toBe(2);
  });
});
