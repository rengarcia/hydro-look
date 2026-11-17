/**
 * The backtest's own guarantees, tested directly. A scoring harness that leaks the future is
 * worse than no harness: it produces confident numbers that cannot be reproduced by anything
 * standing in the past, and nothing downstream would notice.
 */

import { describe, expect, it } from "vitest";
import {
  backtestOrigins,
  blendPredictions,
  bootstrapBlockOrigins,
  collectPredictions,
  crisisEpisodes,
  crisisLeadTime,
  DEFAULT_BACKTEST,
  MONTHLY_BACKTEST,
  monthlyOrigins,
  runBacktest,
  scoreAll,
  scorePredictions,
  truncate,
  weeklyOrigins,
  type BacktestOptions,
  type Prediction,
} from "../src/lib/models/backtest.ts";
import { persistence } from "../src/lib/models/baselines.ts";
import { addDays } from "../src/lib/util/dates.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import type { Model } from "../src/lib/models/types.ts";

function ramp(days: number, from = "2018-01-01"): DailySeries {
  const series: DailySeries = new Map();
  for (let i = 0; i < days; i++) series.set(addDays(from, i), 2130 + i * 0.01);
  return series;
}

const OPTIONS: BacktestOptions = {
  firstOrigin: "2018-01-01",
  lastOrigin: "2099-12-01",
  horizonDays: [7, 30],
  minTrainingDays: 0,
  minCalibrationOrigins: 3,
  crestM: 2153,
};

describe("truncate", () => {
  it("keeps nothing after the origin", () => {
    const series = ramp(100);
    const cut = truncate(series, "2018-01-10");
    expect([...cut.keys()].at(-1)).toBe("2018-01-10");
    expect(cut.has("2018-01-11")).toBe(false);
  });
});

describe("monthlyOrigins", () => {
  it("returns only first-of-month days the series covers, inside the closed window", () => {
    expect(monthlyOrigins(ramp(200), "2018-02-01", "2018-05-01")).toEqual(["2018-02-01", "2018-03-01", "2018-04-01", "2018-05-01"]);
  });

  it("stops where the series does, not where the window does", () => {
    expect(monthlyOrigins(ramp(45), "2018-01-01", "2099-12-01")).toEqual(["2018-01-01", "2018-02-01"]);
  });
});

describe("weeklyOrigins", () => {
  it("returns the Mondays the series covers, inside the closed window", () => {
    // 2018-01-01 was a Monday.
    expect(weeklyOrigins(ramp(30), "2018-01-01", "2018-01-22")).toEqual(["2018-01-01", "2018-01-08", "2018-01-15", "2018-01-22"]);
    expect(weeklyOrigins(ramp(30, "2018-01-03"), "2018-01-01", "2099-12-31")).toEqual([
      "2018-01-08",
      "2018-01-15",
      "2018-01-22",
      "2018-01-29",
    ]);
  });

  it("only ever grows at its end, so an earlier set is a prefix of a later one", () => {
    const short = weeklyOrigins(ramp(100), "2018-01-01", "2099-12-31");
    const long = weeklyOrigins(ramp(300), "2018-01-01", "2099-12-31");
    expect(long.slice(0, short.length)).toEqual(short);
    // Days added before the window's start, as a backfill would add them, change nothing.
    expect(weeklyOrigins(ramp(400, "2017-09-23"), "2018-01-01", "2099-12-31").slice(0, short.length)).toEqual(short);
  });

  it("skips a Monday the series has no reading for", () => {
    const gappy = ramp(30);
    gappy.delete("2018-01-08");
    expect(weeklyOrigins(gappy, "2018-01-01", "2018-01-22")).toEqual(["2018-01-01", "2018-01-15", "2018-01-22"]);
  });
});

describe("the ladder's cadence", () => {
  it("is weekly by default, monthly when not said, and keeps a year of warm-up at either spacing", () => {
    expect(DEFAULT_BACKTEST.cadence).toBe("weekly");
    expect(DEFAULT_BACKTEST.minCalibrationOrigins).toBe(52);
    expect(MONTHLY_BACKTEST.cadence).toBe("monthly");
    expect(MONTHLY_BACKTEST.minCalibrationOrigins).toBe(12);
    const levels = ramp(60);
    expect(backtestOrigins(levels, "2018-01-01", "2099-12-31")).toEqual(monthlyOrigins(levels, "2018-01-01", "2099-12-31"));
    expect(backtestOrigins(levels, "2018-01-01", "2099-12-31", "weekly")).toEqual(weeklyOrigins(levels, "2018-01-01", "2099-12-31"));
  });

  it("bootstraps in blocks of about half a year of origins", () => {
    expect(bootstrapBlockOrigins("monthly")).toBe(6);
    expect(bootstrapBlockOrigins("weekly")).toBe(26);
    expect(bootstrapBlockOrigins()).toBe(6);
  });

  it("runs the harness on Mondays when asked to", () => {
    const levels = ramp(120);
    const result = runBacktest({ levels, inflow: new Map(), production: new Map() }, [persistence], { ...OPTIONS, cadence: "weekly" });
    expect(result.origins).toEqual(weeklyOrigins(levels, "2018-01-01", "2099-12-01").filter((o) => levels.has(addDays(o, 7))));
    expect(result.origins.length).toBeGreaterThan(12);
  });
});

describe("the two passes", () => {
  const levels = ramp(400);
  const inputs = { levels, inflow: new Map(), production: new Map() };
  const drifting: Model = {
    id: "drifting",
    label: "persistence plus a metre",
    forecast: (context) => persistence.forecast(context).map((f) => ({ ...f, p50: f.p50 + 1, ensemble: [f.p50, f.p50 + 2] })),
  };

  it("score to the same result whether run together or collected apart and merged", () => {
    const together = runBacktest(inputs, [persistence, drifting], OPTIONS);
    const merged = collectPredictions(inputs, [persistence], OPTIONS);
    merged.raw.set("drifting", collectPredictions(inputs, [drifting], OPTIONS).raw.get("drifting")!);
    const apart = scorePredictions(merged, [persistence, drifting], OPTIONS);
    expect(apart.scores).toEqual(together.scores);
    expect(apart.predictions).toEqual(together.predictions);
    expect([...apart.calibration]).toEqual([...together.calibration]);
  });

  it("leave the collection unbanded, so it can be scored again with a model added", () => {
    const collected = collectPredictions(inputs, [persistence, drifting], OPTIONS);
    const first = scorePredictions(collected, [persistence, drifting], OPTIONS);
    expect(first.predictions.some((p) => p.p10 !== null)).toBe(true);
    expect([...collected.raw.values()].flat().every((p) => p.p10 === null && p.p90 === null)).toBe(true);
    expect(scorePredictions(collected, [persistence, drifting], OPTIONS).scores).toEqual(first.scores);
  });

  it("score a blend of two models from their predictions, on the origins both reached", () => {
    const collected = collectPredictions(inputs, [persistence, drifting], OPTIONS);
    const blend = blendPredictions(collected.raw.get("M0-persistence")!, collected.raw.get("drifting")!, "blend");
    expect(blend.length).toBe(collected.raw.get("drifting")!.length);
    // Half a metre above persistence everywhere: half of drifting's bias, and its own spread
    // only where both halves have one (persistence has none).
    const p = collected.raw.get("M0-persistence")![0]!;
    expect(blend[0]!.p50).toBeCloseTo(p.p50 + 0.5, 9);
    expect(blend[0]!.ensembleP10).toBeNull();
    expect(blendPredictions(collected.raw.get("drifting")!, collected.raw.get("drifting")!, "same")[0]!.ensembleP90).toBeCloseTo(
      collected.raw.get("drifting")![0]!.ensembleP90!,
      9,
    );
    expect(blendPredictions(collected.raw.get("M0-persistence")!, collected.raw.get("drifting")!, "b", 1)[0]!.p50).toBeCloseTo(
      p.p50 + 1,
      9,
    );

    collected.raw.set("blend", blend);
    const scored = scorePredictions(collected, [persistence, drifting, { id: "blend", label: "half each" }], OPTIONS);
    const bias = (id: string) => scored.scores.find((sc) => sc.modelId === id)!.horizons[0]!.biasM;
    expect(bias("blend")).toBeCloseTo((bias("M0-persistence") + bias("drifting")) / 2, 9);

    // An origin only one half reached is not in the blend.
    expect(blendPredictions(collected.raw.get("M0-persistence")!, collected.raw.get("drifting")!.slice(1), "b").length).toBe(
      blend.length - 1,
    );
  });
});

describe("look-ahead", () => {
  it("hands a model nothing past the origin it is standing on", () => {
    const seen: string[] = [];
    const spy: Model = {
      id: "M0-persistence",
      label: "spy",
      forecast(context) {
        const last = [...context.levels.keys()].at(-1)!;
        seen.push(last);
        expect(last <= context.origin).toBe(true);
        return context.horizonDays.map((horizonDays) => ({
          horizonDays,
          targetDate: addDays(context.origin, horizonDays),
          p50: context.levels.get(context.origin)!,
          ensemble: [],
        }));
      },
    };
    const levels = ramp(400);
    runBacktest({ levels, inflow: new Map(), production: new Map() }, [spy], OPTIONS);
    expect(seen.length).toBeGreaterThan(5);
  });

  it("calibrates a band only from origins strictly earlier than the one it is applied to", () => {
    const levels = ramp(500);
    const result = runBacktest({ levels, inflow: new Map(), production: new Map() }, [persistence], OPTIONS);
    const byOrigin = result.predictions.filter((p) => p.horizonDays === 7).sort((a, b) => (a.origin < b.origin ? -1 : 1));

    // The warm-up carries no band at all rather than borrowing one from the future.
    expect(byOrigin.slice(0, OPTIONS.minCalibrationOrigins).every((p) => p.p10 === null)).toBe(true);
    expect(byOrigin[OPTIONS.minCalibrationOrigins]!.p10).not.toBeNull();

    // On a steady ramp persistence always under-forecasts, so the calibrated band sits above
    // the point forecast — which also shows the residuals reached it in the right direction.
    const banded = byOrigin.find((p) => p.p90 !== null)!;
    expect(banded.p90!).toBeGreaterThan(banded.p50);
  });

  it("scores every model on the origins they all reached", () => {
    const shy: Model = {
      id: "shy",
      label: "declines the later origins",
      forecast(context) {
        if (context.origin > "2018-06-01") return [];
        return context.horizonDays.map((horizonDays) => ({
          horizonDays,
          targetDate: addDays(context.origin, horizonDays),
          p50: 2130,
          ensemble: [],
        }));
      },
    };
    const levels = ramp(500);
    const result = runBacktest({ levels, inflow: new Map(), production: new Map() }, [persistence, shy], OPTIONS);
    const counts = new Set(result.scores.map((s) => s.horizons.find((h) => h.horizonDays === 7)?.n));
    expect(counts.size).toBe(1);
    expect([...counts][0]).toBeLessThanOrEqual(6);
  });
});

describe("scoring", () => {
  const prediction = (over: Partial<Prediction>): Prediction => ({
    modelId: "M0-persistence",
    origin: "2020-01-01",
    horizonDays: 7,
    targetDate: "2020-01-08",
    actual: 100,
    p50: 100,
    ensembleP10: null,
    ensembleP90: null,
    p10: null,
    p90: null,
    ...over,
  });

  it("reports skill against persistence, and zero for persistence itself", () => {
    const other: Model = { id: "other", label: "other", forecast: () => [] };
    const scores = scoreAll(
      [prediction({ actual: 110, p50: 100 }), prediction({ modelId: "other", actual: 110, p50: 105 })],
      [persistence, other],
      [7],
    );
    expect(scores[0]!.horizons[0]!.skillVsPersistence).toBe(0);
    expect(scores[1]!.horizons[0]!.skillVsPersistence).toBeCloseTo(0.5, 6);
    expect(scores[1]!.horizons[0]!.maeM).toBeCloseTo(5, 6);
  });

  it("measures coverage on the band, not on the ensemble", () => {
    const scores = scoreAll(
      [
        prediction({ actual: 100, p10: 95, p90: 105, ensembleP10: 99, ensembleP90: 101 }),
        prediction({ origin: "2020-02-01", actual: 108, p10: 95, p90: 105, ensembleP10: 99, ensembleP90: 101 }),
      ],
      [persistence],
      [7],
    );
    expect(scores[0]!.horizons[0]!.coverageP10P90).toBeCloseTo(0.5, 6);
    expect(scores[0]!.horizons[0]!.ensembleCoverage).toBeCloseTo(0.5, 6);
    expect(scores[0]!.horizons[0]!.nBand).toBe(2);
  });

  it("signs the bias so that a model forecasting too low reads positive", () => {
    const scores = scoreAll([prediction({ actual: 110, p50: 100 })], [persistence], [7]);
    expect(scores[0]!.horizons[0]!.biasM).toBeCloseTo(10, 6);
  });
});

describe("crisis episodes", () => {
  const levels: DailySeries = new Map();
  for (let i = 0; i < 400; i++) {
    const date = addDays("2024-01-01", i);
    // Two separate spells below 2115, months apart.
    const low = (i >= 100 && i < 110) || (i >= 280 && i < 300);
    levels.set(date, low ? 2110 : 2140);
  }

  it("separates spells that are months apart and merges days that are not", () => {
    const episodes = crisisEpisodes(levels, 2115);
    expect(episodes.map((e) => e.crossedOn)).toEqual([addDays("2024-01-01", 100), addDays("2024-01-01", 280)]);
  });

  it("requires a sustained call, not one origin that is later contradicted", () => {
    const episode = { crossedOn: "2024-06-01", thresholdM: 2115 };
    const flicker = crisisLeadTime(episode, [
      { origin: "2024-01-01", predictedCrossing: "2024-05-01" },
      { origin: "2024-02-01", predictedCrossing: null },
      { origin: "2024-03-01", predictedCrossing: "2024-05-20" },
      { origin: "2024-04-01", predictedCrossing: "2024-05-25" },
      { origin: "2024-05-01", predictedCrossing: "2024-05-30" },
    ]);
    // January said yes, but February said no, so the sustained call starts in March.
    expect(flicker.calledFrom).toBe("2024-03-01");
    expect(flicker.leadTimeDays).toBe(92);
  });

  it("never counts an origin after the crossing", () => {
    const episode = { crossedOn: "2024-06-01", thresholdM: 2115 };
    const call = crisisLeadTime(episode, [{ origin: "2024-07-01", predictedCrossing: "2024-06-01" }]);
    expect(call.calledFrom).toBeNull();
    expect(call.leadTimeDays).toBeNull();
  });

  it("allows a week of grace, so a call that is a day late still counts", () => {
    const episode = { crossedOn: "2024-06-01", thresholdM: 2115 };
    expect(crisisLeadTime(episode, [{ origin: "2024-05-25", predictedCrossing: "2024-06-02" }]).leadTimeDays).toBe(7);
    // ...but a crossing predicted for next season is not a warning about this one.
    expect(crisisLeadTime(episode, [{ origin: "2024-05-25", predictedCrossing: "2024-08-01" }]).calledFrom).toBeNull();
  });

  it("reports no call at all when nothing predicted the crossing", () => {
    const episode = { crossedOn: "2024-06-01", thresholdM: 2115 };
    const call = crisisLeadTime(episode, [
      { origin: "2024-04-01", predictedCrossing: null },
      { origin: "2024-05-01", predictedCrossing: null },
    ]);
    expect(call.calledFrom).toBeNull();
  });
});
