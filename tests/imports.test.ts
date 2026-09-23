/**
 * §5.5: the import sensitivity published beside the central case, the export-availability
 * model's arithmetic, the band's adaptive stretch and the ONI covariate — each on inputs whose
 * answer is known.
 */

import { describe, expect, it } from "vitest";
import {
  backtestAdequacy,
  createAdequacyCache,
  DEFAULT_ADEQUACY_BACKTEST,
  DEFAULT_BAND,
  forecastAdequacy,
  POOLED_BAND,
  referenceAdequacyRules,
  type Ceilings,
} from "../src/lib/models/adequacy.ts";
import { fitLinear, importSensitivity, sensitivityBlock } from "../src/lib/models/imports.ts";
import { oniHydroExperiment } from "../src/lib/models/adequacy-experiments.ts";
import type { BalanceDay } from "../src/lib/features/balance.ts";
import { addDays } from "../src/lib/util/dates.ts";

/** Balance days with a noisy, drifting hydro share, so a pooled band under-covers. */
function days(n: number, from = "2016-01-01", importGwh = 5): BalanceDay[] {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, (_, i) => {
    const load = 80 * Math.pow(1.05, i / 365) * (1 + 0.03 * Math.sin((i / 7) * 2 * Math.PI));
    const drift = 1 + (i / n) * 0.6;
    const hydro = load * (0.7 + 0.08 * Math.sin((i / 365) * 2 * Math.PI) + drift * 0.06 * (random() - 0.5));
    return {
      date: addDays(from, i),
      loadGwh: load,
      hydroGwh: hydro,
      thermalGwh: 20,
      otherGwh: 1,
      importGwh: importGwh,
      exportGwh: 0,
      generationGwh: load - importGwh,
      distributionDemandGwh: load / 1.1,
    };
  });
}

const ceilings: Ceilings = { thermalGwhDay: 25, importGwhDay: 10, stressedImportGwhDay: 0.1, otherGwhDay: 1, basis: "test" };

describe("importSensitivity", () => {
  const history = days(2400, "2019-01-01", 0.2);
  const forecast = forecastAdequacy({ days: history, episodes: [], ceilings, origin: history.at(-1)!.date })!;
  const cases = importSensitivity(forecast);

  it("states the deficit under each assumption, from the same requirement", () => {
    expect(cases.map((c) => c.case)).toEqual(["demonstrated", "stressed", "current_regime"]);
    const [demonstrated, stressed] = cases;
    for (let i = 0; i < forecast.horizons.length; i++) {
      expect(stressed!.horizons[i]!.deficitGwhDay - demonstrated!.horizons[i]!.deficitGwhDay).toBeCloseTo(10 - 0.1, 9);
    }
  });

  it("reads the current regime from what arrived, whether or not the rule calls it a cutoff", () => {
    expect(cases[2]!.importGwhDay).toBeCloseTo(0.2, 9);
  });

  it("names the case the central deficit uses", () => {
    const block = sensitivityBlock(forecast, cases) as { central_case: string; cases: { case: string }[] };
    expect(block.central_case).toBe(forecast.imports.state === "cutoff" ? "current_regime" : "demonstrated");
    expect(block.cases).toHaveLength(3);
  });

  it("uses the tier cut from the rules file", () => {
    expect(forecast.rules.tightGwhDay).toBe(referenceAdequacyRules().tightGwhDay);
  });
});

describe("fitLinear", () => {
  it("recovers a known linear relation", () => {
    const rows = Array.from({ length: 300 }, (_, i) => [Math.sin(i), Math.cos(i * 0.7), i / 300]);
    const targets = rows.map(([a, b, c]) => 2 + 3 * a! - 1.5 * b! + 4 * c!);
    const predict = fitLinear(rows, targets, 1e-6)!;
    expect(predict([0.5, -0.2, 0.4])).toBeCloseTo(2 + 1.5 + 0.3 + 1.6, 3);
  });

  it("declines a degenerate fit rather than returning nonsense", () => {
    expect(fitLinear([], [], 1)).toBeNull();
  });
});

describe("the adaptive band stretch", () => {
  const history = days(3300);
  const options = { ...DEFAULT_ADEQUACY_BACKTEST, horizonDays: [7, 30], cache: createAdequacyCache() };

  it("covers nearer the nominal than the pooled band when the errors grow over time", () => {
    const pooled = backtestAdequacy(history, [], ceilings, { ...options, band: POOLED_BAND });
    const adaptive = backtestAdequacy(history, [], ceilings, { ...options, band: DEFAULT_BAND });
    const cov = (b: typeof pooled) => b.scores.find((s) => s.component === "requirement")!.horizons.map((h) => h.coverageP10P90!);
    const [p, a] = [cov(pooled), cov(adaptive)];
    for (let i = 0; i < p.length; i++) expect(Math.abs(a[i]! - 0.8)).toBeLessThanOrEqual(Math.abs(p[i]! - 0.8) + 1e-9);
    // Medians are untouched: only the band moved.
    expect(adaptive.scores.map((s) => s.horizons.map((h) => h.maeGwhDay))).toEqual(pooled.scores.map((s) => s.horizons.map((h) => h.maeGwhDay)));
    expect([...adaptive.calibration.values()].every((c) => (c.stretch ?? 1) >= 1)).toBe(true);
  }, 60_000);
});

describe("oniHydroExperiment", () => {
  it("fits the correction on earlier origins only, and helps when the error follows ONI", () => {
    const oni = new Map<string, number>();
    for (let y = 2014; y <= 2026; y++) for (let m = 1; m <= 12; m++) oni.set(`${y}-${String(m).padStart(2, "0")}`, Math.sin(y * 3 + m / 2));
    const points = Array.from({ length: 60 }, (_, i) => {
      const origin = addDays("2018-01-01", i * 30);
      const month = addDays(origin, -62).slice(0, 7);
      return { origin, horizonDays: 7, error: -2 * (oni.get(month) ?? 0), baselineError: 0, inBand: null };
    });
    const [result] = oniHydroExperiment(points, oni, [7]);
    expect(result!.n).toBeGreaterThan(30);
    expect(result!.maeWith).toBeLessThan(result!.maeWithout);
  });
});
