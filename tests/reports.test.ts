/**
 * The two Markdown reports no other test renders (ENHANCEMENTS §6.2): built from synthetic
 * inputs, they must carry every section their script promises, and no `NaN` or `undefined`.
 */

import { describe, expect, it } from "vitest";
import type { BalanceDay } from "../src/lib/features/balance.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { backtestAdequacy, crisisCheck, DEFAULT_ADEQUACY_BACKTEST, forecastAdequacy } from "../src/lib/models/adequacy.ts";
import { renderAdequacyReport } from "../src/lib/models/adequacy-report.ts";
import { importSensitivity } from "../src/lib/models/imports.ts";
import { backtestInflow } from "../src/lib/models/inflow.ts";
import { renderInflowReport } from "../src/lib/models/inflow-report.ts";
import { addDays } from "../src/lib/util/dates.ts";

function assertClean(text: string): void {
  expect(text).not.toMatch(/\bNaN\b|\bundefined\b|\[object Object\]/);
}

describe("renderAdequacyReport", () => {
  const days: BalanceDay[] = [];
  for (let i = 0; i < 2600; i++) {
    const load = 100 * Math.pow(1.05, i / 365) * (1 + 0.05 * Math.sin(i / 20));
    days.push({
      date: addDays("2018-01-01", i),
      loadGwh: load,
      hydroGwh: load * 0.7,
      thermalGwh: load * 0.27,
      otherGwh: load * 0.02,
      importGwh: load * 0.01,
      exportGwh: 0,
      generationGwh: load * 0.99,
      distributionDemandGwh: load / 1.1,
    });
  }
  const ceilings = { thermalGwhDay: 40, importGwhDay: 10, stressedImportGwhDay: 0.1, otherGwhDay: 3, basis: "test" };
  const origin = days.at(-1)!.date;
  const options = { ...DEFAULT_ADEQUACY_BACKTEST, firstOrigin: "2022-01-01", horizonDays: [7, 30] };
  const backtest = backtestAdequacy(days, [], ceilings, options);
  const forecast = forecastAdequacy({ days, episodes: [], ceilings, origin, horizonDays: [7, 30] })!;
  const report = renderAdequacyReport({
    generatedAt: "2026-09-23T00:00:00Z",
    forecast,
    backtest,
    crisis: crisisCheck(days, [], ceilings, backtest, options),
    ceilings,
    usableDays: days.length,
    rejected: [],
    range: { first: days[0]!.date, last: origin },
    sensitivity: importSensitivity(forecast),
    experiments: [{ heading: "An experiment", body: ["It lost."] }],
  });

  it("renders the forecast, the backtest, the sensitivity and the experiments", () => {
    expect(forecast).not.toBeNull();
    expect(report).toMatch(/^# /);
    expect(report).toContain("| 7 d |");
    expect(report).toContain("| 30 d |");
    expect(report).toMatch(/current_regime|régimen|regime/i);
    expect(report).toContain("An experiment");
    assertClean(report);
  });
});

describe("renderInflowReport", () => {
  const inflow: DailySeries = new Map();
  for (let i = 0; i < 9 * 365; i++) {
    const wetness = 1 + 0.4 * Math.sin(Math.floor(i / 365) * 1.7);
    inflow.set(addDays("2012-01-01", i), wetness * (100 + 60 * Math.sin((i / 365) * 2 * Math.PI)));
  }
  const report = renderInflowReport({
    generatedAt: "2026-09-23T00:00:00Z",
    backtests: [backtestInflow("amaluza", inflow)],
    precip: [{ site: "amaluza", basin: "paute_amaluza", used: false, reason: "paute_amaluza: no ERA5 rows" }],
  });

  it("renders each plant's rungs and why rain was or was not used", () => {
    expect(report).toMatch(/^# Inflow forecasts/);
    expect(report).toContain("amaluza");
    expect(report).toContain("paute_amaluza: no ERA5 rows");
    expect(report).toMatch(/persistence/);
    assertClean(report);
  });
});
