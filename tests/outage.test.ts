/**
 * §8a gap 5: the Coca Codo Sinclair outage scenario — the share it is read from, and the deficit
 * and tier it implies — on inputs whose answer is known.
 */

import { describe, expect, it } from "vitest";
import { forecastAdequacy, tierFor, type Ceilings } from "../src/lib/models/adequacy.ts";
import { outageBlock, outageScenario, OUTAGE_MIN_DAYS, plantEnergy, plantShare } from "../src/lib/models/outage.ts";
import type { BalanceDay } from "../src/lib/features/balance.ts";
import { addDays } from "../src/lib/util/dates.ts";

function days(n: number, from = "2019-01-01"): BalanceDay[] {
  return Array.from({ length: n }, (_, i) => {
    const load = 80 * Math.pow(1.05, i / 365) * (1 + 0.03 * Math.sin((i / 7) * 2 * Math.PI));
    const hydro = load * (0.7 + 0.08 * Math.sin((i / 365) * 2 * Math.PI));
    return {
      date: addDays(from, i),
      loadGwh: load,
      hydroGwh: hydro,
      thermalGwh: 20,
      otherGwh: 1,
      importGwh: 5,
      exportGwh: 0,
      generationGwh: load - 5,
      distributionDemandGwh: load / 1.1,
    };
  });
}

const ceilings: Ceilings = { thermalGwhDay: 25, importGwhDay: 10, stressedImportGwhDay: 0.1, otherGwhDay: 1, basis: "test" };

describe("plantEnergy", () => {
  it("reads the site's produccion_mwh in GWh and ignores everything else", () => {
    const series = plantEnergy([
      { date: "2026-09-20", site: "coca_codo_sinclair", variable: "produccion_mwh", value: "25086.453" },
      { date: "2026-09-20", site: "coca_codo_sinclair", variable: "caudal_m3s", value: "220" },
      { date: "2026-09-20", site: "agoyan", variable: "produccion_mwh", value: "2961" },
      { date: "2026-09-21", site: "coca_codo_sinclair", variable: "produccion_mwh", value: "" },
    ]);
    expect([...series.keys()]).toEqual(["2026-09-20"]);
    expect(series.get("2026-09-20")).toBeCloseTo(25.086453, 9);
  });
});

describe("plantShare", () => {
  const history = days(60);
  const origin = history.at(-1)!.date;

  it("is the plant's energy over national hydro on the matched days of the window", () => {
    const plant = new Map(history.map((d) => [d.date, d.hydroGwh * 0.45]));
    const share = plantShare(history, plant, origin)!;
    expect(share.share).toBeCloseTo(0.45, 10);
    expect(share.days).toBe(28);
    expect(share.to).toBe(origin);
    expect(share.from).toBe(addDays(origin, -27));
  });

  it("refuses a share read from too few days", () => {
    const recent = history.slice(-(OUTAGE_MIN_DAYS - 1));
    const plant = new Map(recent.map((d) => [d.date, 10]));
    expect(plantShare(history, plant, origin)).toBeNull();
  });
});

describe("outageScenario", () => {
  const history = days(2400);
  const origin = history.at(-1)!.date;
  const forecast = forecastAdequacy({ days: history, episodes: [], ceilings, origin })!;
  const share = { site: "coca_codo_sinclair", share: 0.4, plantGwhDay: 25, days: 28, from: addDays(origin, -27), to: origin };
  const scenario = outageScenario(forecast, share);

  it("adds the lost hydro to the central deficit at every horizon and re-reads the tier", () => {
    expect(scenario.horizons.map((h) => h.horizonDays)).toEqual(forecast.horizons.map((h) => h.horizonDays));
    for (const [i, h] of scenario.horizons.entries()) {
      const central = forecast.horizons[i]!;
      expect(h.lostGwhDay).toBeCloseTo(central.hydroGwhDay * 0.4, 10);
      expect(h.hydroGwhDay).toBeCloseTo(central.hydroGwhDay * 0.6, 10);
      expect(h.deficitGwhDay).toBeCloseTo(central.deficitGwhDay + h.lostGwhDay, 10);
      expect(h.tier).toBe(tierFor(h.deficitGwhDay, h.deficitP90, forecast.rules.tightGwhDay));
    }
  });

  it("publishes the scenario, or says why it is absent", () => {
    const block = outageBlock(scenario);
    expect(block["available"]).toBe(true);
    expect(block["share_of_hydro"]).toBe(0.4);
    expect((block["horizons"] as unknown[]).length).toBe(forecast.horizons.length);
    const absent = outageBlock(null, "no data");
    expect(absent).toMatchObject({ available: false, reason: "no data", site: "coca_codo_sinclair" });
    expect(absent["horizons"]).toBeUndefined();
  });
});
