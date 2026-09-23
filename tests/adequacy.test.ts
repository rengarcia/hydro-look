/**
 * The adequacy model's decisions, checked against inputs whose answer is known.
 *
 * Like `publish.test.ts`, these assert the *decisions* the modules document rather than the
 * numbers today's tables happen to produce. Three of them are the ones that would silently
 * destroy the deficit if they regressed, and each has a test that fails loudly instead:
 *
 * - a balance day whose arithmetic is impossible must not reach the model,
 * - the demand fit must not be dragged down by a rationing episode,
 * - the hydro term must not be rescued by a rationing episode's own fall in demand.
 */

import { describe, expect, it } from "vitest";
import {
  coversDate,
  rationingEpisodes,
  readBalance,
  suppressed,
  USABLE_LOAD_RATIO,
  type BalanceCsvRow,
  type BalanceDay,
} from "../src/lib/features/balance.ts";
import {
  applyOverrides,
  buildAdequacyDocument,
  demonstratedCeilings,
  fitDemand,
  fitHydro,
  forecastAdequacy,
  importRegime,
  tierFor,
  weekdayOf,
  DEFAULT_HYDRO,
  TIGHT_GWH_DAY,
  type CeilingRow,
} from "../src/lib/models/adequacy.ts";
import { adequacySummary } from "../src/lib/publish/latest.ts";
import { addDays } from "../src/lib/util/dates.ts";

/** One balance day as the long CSV carries it: one row per concept, kWh. */
function csvDay(date: string, parts: Record<string, number>): BalanceCsvRow[] {
  return Object.entries(parts).map(([concepto, gwh]) => ({ date, concepto, dia_kwh: String(gwh * 1e6) }));
}

const WHOLE_DAY = {
  total_generacion: 100,
  total_importacion: 5,
  total_exportacion: 1,
  demanda_distribucion: 92,
  generacion_hidraulica: 70,
  generacion_turbinas_gas: 20,
  generacion_otros_tipos: 1,
};

describe("readBalance", () => {
  it("keeps a day whose load exceeds its distribution demand", () => {
    const { days, rejected } = readBalance(csvDay("2026-01-01", WHOLE_DAY));
    expect(rejected).toHaveLength(0);
    expect(days).toHaveLength(1);
    // load = generation + imports − exports, not `total_generacion` and not demand.
    expect(days[0]!.loadGwh).toBeCloseTo(104, 10);
    expect(days[0]!.thermalGwh).toBeCloseTo(20, 10);
  });

  it("rejects a page whose generation had not landed, which the 20% demand gate passes", () => {
    // 2018-01-05, to scale: 4.19 GWh of generation against 62.72 of demand. `parse/smec.ts`
    // asks demand/generation >= 0.2 and gets 14.9, so the page sails through that gate.
    const rows = csvDay("2018-01-05", {
      total_generacion: 4.19,
      total_importacion: 0,
      total_exportacion: 0,
      demanda_distribucion: 62.72,
      generacion_hidraulica: 4.06,
    });
    const { days, rejected } = readBalance(rows);
    expect(days).toHaveLength(0);
    expect(rejected[0]).toMatchObject({ date: "2018-01-05", reason: "load below distribution demand" });
  });

  it("rejects a day where one published concept contradicts the whole day", () => {
    // 2025-07-17: "otros tipos" at 153.62 GWh against a fortnight's median of 2.2.
    const rows = csvDay("2025-07-17", {
      total_generacion: 247.39,
      total_importacion: 0.159,
      total_exportacion: 0.148,
      demanda_distribucion: 86.14,
      generacion_hidraulica: 86.26,
      generacion_otros_tipos: 153.62,
    });
    const { days, rejected } = readBalance(rows);
    expect(days).toHaveLength(0);
    expect(rejected[0]!.reason).toBe("load above twice distribution demand");
  });

  it("keeps a day sitting just inside each end of the usable band", () => {
    const low = csvDay("2026-01-02", { ...WHOLE_DAY, total_generacion: 92, total_importacion: 0, total_exportacion: 0 });
    const high = csvDay("2026-01-03", { ...WHOLE_DAY, total_generacion: 183, total_importacion: 0, total_exportacion: 0 });
    const { days, rejected } = readBalance([...low, ...high]);
    expect(rejected).toHaveLength(0);
    expect(days.map((d) => d.loadGwh / d.distributionDemandGwh)).toEqual([
      USABLE_LOAD_RATIO.min,
      183 / 92,
    ]);
  });

  it("reports a day carrying too few concepts as incomplete rather than rejected", () => {
    const { days, rejected, incomplete } = readBalance(csvDay("2026-01-04", { total_generacion: 100 }));
    expect(days).toHaveLength(0);
    expect(rejected).toHaveLength(0);
    expect(incomplete).toEqual(["2026-01-04"]);
  });
});

describe("rationingEpisodes", () => {
  const rows = [
    { start: "2024-09-23", end: "2024-12-20", kind: "rationing", hydro_related: "yes" },
    { start: "2024-06-19", end: "2024-06-19", kind: "blackout", hydro_related: "no" },
    { start: "2024-09-18", end: "2024-09-19", kind: "scheduled_outage", hydro_related: "no" },
    { start: "2025-01-01", end: "", kind: "restrictions_lifted", hydro_related: "yes" },
  ];

  it("keeps only hydro-related rationing, not blackouts or maintenance", () => {
    expect(rationingEpisodes(rows).map((e) => e.start)).toEqual(["2024-09-23"]);
  });

  it("covers the episode's own days and a recovery tail beyond it", () => {
    const episodes = rationingEpisodes(rows);
    expect(coversDate(episodes, "2024-10-15")).toBe(true);
    expect(coversDate(episodes, "2024-12-27")).toBe(false);
    // Load came back over about a fortnight, so the fortnight after is neither suppressed nor
    // normal and the demand fit must not be taught it was normal.
    expect(suppressed(episodes, "2024-12-27")).toBe(true);
    expect(suppressed(episodes, "2025-01-10")).toBe(false);
  });
});

describe("weekdayOf", () => {
  it("puts Sunday at 0 without going through a local Date", () => {
    expect(weekdayOf("2026-09-20")).toBe(0);
    expect(weekdayOf("2026-09-21")).toBe(1);
    expect(weekdayOf("1970-01-01")).toBe(4);
  });
});

/**
 * A synthetic fleet: load grows at a steady rate, hydro is a fixed share of it, and during the
 * episode both are cut to 70%. The real signals are all there and the arithmetic is known, so
 * an assertion can be about the answer rather than about the neighbourhood of the answer.
 */
function syntheticDays(options: { days: number; from: string; growthPerYear: number; episode?: [string, string] }): BalanceDay[] {
  const out: BalanceDay[] = [];
  for (let i = 0; i < options.days; i++) {
    const date = addDays(options.from, i);
    const inEpisode = options.episode !== undefined && date >= options.episode[0] && date <= options.episode[1];
    const base = 100 * Math.pow(1 + options.growthPerYear, i / 365);
    const load = base * (inEpisode ? 0.7 : 1);
    const hydro = load * 0.7;
    out.push({
      date,
      loadGwh: load,
      hydroGwh: hydro,
      thermalGwh: load * 0.28,
      otherGwh: load * 0.02,
      importGwh: 0,
      exportGwh: 0,
      generationGwh: load,
      distributionDemandGwh: load / 1.1,
    });
  }
  return out;
}

describe("fitDemand", () => {
  const from = "2022-01-01";
  const days = syntheticDays({ days: 1500, from, growthPerYear: 0.08, episode: ["2025-06-01", "2025-09-30"] });
  const episodes = rationingEpisodes([
    { start: "2025-06-01", end: "2025-09-30", kind: "rationing", hydro_related: "yes" },
  ]);

  it("recovers the growth rate it was given", () => {
    const fit = fitDemand(days, "2026-01-01", episodes)!;
    expect(fit).not.toBeNull();
    expect(fit.growthPctPerYear).toBeCloseTo(8, 0);
  });

  it("ignores the episode, so the level it reports is the unsuppressed one", () => {
    // An origin inside the episode: measured load is 70% of demand, and the model must say so.
    const origin = "2025-08-15";
    const fit = fitDemand(days, origin, episodes)!;
    const measured = days.find((d) => d.date === origin)!.loadGwh;
    expect(fit.predict(origin) / measured).toBeCloseTo(1 / 0.7, 1);
  });

  it("without the episode labels it would follow the suppression down", () => {
    const origin = "2025-08-15";
    const blind = fitDemand(days, origin, [])!;
    const measured = days.find((d) => d.date === origin)!.loadGwh;
    // Anchored on suppressed days, the fit lands near the rationed load rather than above it —
    // which is the failure the labels exist to prevent.
    expect(blind.predict(origin) / measured).toBeLessThan(1.1);
  });

  it("declines rather than guessing when the window holds too little", () => {
    expect(fitDemand(days.slice(0, 100), "2022-04-10", episodes)).toBeNull();
  });
});

describe("fitHydro", () => {
  const from = "2020-01-01";
  const days = syntheticDays({ days: 2200, from, growthPerYear: 0.08 });
  const episodes = rationingEpisodes([]);

  it("reads a normal fortnight as an anomaly of 1", () => {
    const demand = fitDemand(days, "2025-12-01", episodes)!;
    const fit = fitHydro(days, "2025-12-01", demand)!;
    expect(fit.anomaly).toBeCloseTo(1, 2);
  });

  it("carries a dry fortnight forward, and lets it decay", () => {
    const origin = "2025-12-01";
    const dry = days.map((d) =>
      d.date > addDays(origin, -14) && d.date <= origin ? { ...d, hydroGwh: d.hydroGwh * 0.6 } : d,
    );
    const demand = fitDemand(dry, origin, episodes)!;
    const fit = fitHydro(dry, origin, demand, DEFAULT_HYDRO)!;
    expect(fit.anomaly).toBeCloseTo(0.6, 1);

    const near = fit.predict(addDays(origin, 1), demand.predict(addDays(origin, 1)))!;
    const far = fit.predict(addDays(origin, 90), demand.predict(addDays(origin, 90)))!;
    const nearNormal = near / demand.predict(addDays(origin, 1));
    const farNormal = far / demand.predict(addDays(origin, 90));
    // A dry fortnight is strong evidence about tomorrow and weaker about the quarter: the
    // anomaly is half gone by the end of the longest published horizon, so the quarter-ahead
    // forecast sits meaningfully closer to climatology than the day-ahead one.
    expect(nearNormal).toBeLessThan(farNormal);
    expect((farNormal - nearNormal) / nearNormal).toBeGreaterThan(0.1);
  });

  it("is unchanged by the demand anchor, which cancels between normalisation and projection", () => {
    const origin = "2025-12-01";
    const demand = fitDemand(days, origin, episodes)!;
    const hydro = fitHydro(days, origin, demand)!;
    const shifted = { ...demand, predict: (d: string) => demand.predict(d) * 1.2 };
    const hydroShifted = fitHydro(days, origin, shifted)!;
    const target = addDays(origin, 30);
    expect(hydroShifted.predict(target, shifted.predict(target))!).toBeCloseTo(
      hydro.predict(target, demand.predict(target))!,
      6,
    );
  });
});

describe("demonstratedCeilings and applyOverrides", () => {
  const days = syntheticDays({ days: 400, from: "2025-01-01", growthPerYear: 0 });

  it("takes the largest day for capability and the median for what is not dispatchable", () => {
    const ceilings = demonstratedCeilings(days, days.at(-1)!.date);
    expect(ceilings.thermalGwhDay).toBeCloseTo(28, 6);
    expect(ceilings.otherGwhDay).toBeCloseTo(2, 6);
  });

  it("overrides only the rows the table carries, and names the rest", () => {
    const base = demonstratedCeilings(days, days.at(-1)!.date);
    const rows: CeilingRow[] = [
      { quantity: "import_stressed", gwh_day: "0.122", basis: "median 2024-10-01 → 11-10", source: "smec" },
      { quantity: "nonsense", gwh_day: "9", basis: "ignored", source: "" },
    ];
    const applied = applyOverrides(base, rows);
    expect(applied.stressedImportGwhDay).toBe(0.122);
    expect(applied.thermalGwhDay).toBe(base.thermalGwhDay);
    expect(applied.basis).toContain("import_stressed = 0.122");
    expect(applied.basis).toContain("thermal, import, other from the");
    expect(applied.basis).not.toContain("nonsense");
  });
});

describe("tierFor", () => {
  it("reads the whole distribution, not only its median", () => {
    expect(tierFor(-5, -1)).toBe("holgado");
    // A system whose p90 is short is not comfortable, whatever its median says.
    expect(tierFor(-5, 2)).toBe("vigilancia");
    expect(tierFor(1, 6)).toBe("ajustado");
    expect(tierFor(TIGHT_GWH_DAY, 20)).toBe("deficit");
  });

  it("treats an uncalibrated band as no evidence of a shortfall rather than as a safe one", () => {
    expect(tierFor(-5, null)).toBe("holgado");
    expect(tierFor(1, null)).toBe("ajustado");
  });
});

describe("forecastAdequacy", () => {
  const days = syntheticDays({ days: 2200, from: "2020-01-01", growthPerYear: 0.08 });
  const ceilings = {
    thermalGwhDay: 30,
    importGwhDay: 10,
    stressedImportGwhDay: 0.1,
    otherGwhDay: 2,
    basis: "test",
  };

  it("computes the identity it documents", () => {
    const out = forecastAdequacy({ days, episodes: [], ceilings, origin: "2025-12-01" })!;
    expect(out).not.toBeNull();
    for (const horizon of out.horizons) {
      expect(horizon.requirementGwhDay).toBeCloseTo(horizon.demandGwhDay - horizon.hydroGwhDay, 9);
      expect(horizon.deficitGwhDay).toBeCloseTo(
        horizon.requirementGwhDay - (ceilings.thermalGwhDay + ceilings.otherGwhDay + out.imports.centralGwhDay),
        9,
      );
      // The stressed case differs from the central one by exactly the import assumption.
      expect(horizon.stressedDeficitGwhDay - horizon.deficitGwhDay).toBeCloseTo(
        out.imports.centralGwhDay - ceilings.stressedImportGwhDay,
        9,
      );
    }
  });

  it("leaves the band absent until residuals have calibrated it", () => {
    const out = forecastAdequacy({ days, episodes: [], ceilings, origin: "2025-12-01" })!;
    expect(out.horizons.every((h) => h.requirementP10 === null && h.deficitP90 === null)).toBe(true);
  });

  it("never lets a calibrated band cross its own centre", () => {
    // Residuals that all fall on one side would, uncorrected, put p10 above p50.
    const calibration = new Map([[7, { q10: 4, q50: 5, q90: 6, n: 30 }]]);
    const out = forecastAdequacy({ days, episodes: [], ceilings, origin: "2025-12-01", horizonDays: [7], calibration })!;
    const horizon = out.horizons[0]!;
    expect(horizon.requirementP10!).toBeLessThanOrEqual(horizon.requirementGwhDay);
    expect(horizon.requirementP90!).toBeGreaterThanOrEqual(horizon.requirementGwhDay);
  });

  it("gives the hydro term a band of its own that contains its centre (§7 target 4)", () => {
    const hydroCalibration = new Map([[7, { q10: -9, q50: -8, q90: -7, n: 30 }]]);
    const out = forecastAdequacy({
      days,
      episodes: [],
      ceilings,
      origin: "2025-12-01",
      horizonDays: [7],
      hydroCalibration,
    })!;
    const horizon = out.horizons[0]!;
    expect(horizon.hydroP10!).toBeCloseTo(horizon.hydroGwhDay - 9, 9);
    expect(horizon.hydroP90!).toBe(horizon.hydroGwhDay);
    // One band never borrows the other's calibration.
    expect(horizon.requirementP10).toBeNull();
  });

  it("declines rather than guessing when there is too little history", () => {
    expect(
      forecastAdequacy({ days: days.slice(0, 30), episodes: [], ceilings, origin: "2020-01-30" }),
    ).toBeNull();
  });
});

describe("importRegime", () => {
  const ceilings = { thermalGwhDay: 30, importGwhDay: 10, stressedImportGwhDay: 0.1, otherGwhDay: 2, basis: "test" };
  const fortnight = (importGwh: number, thermalGwh: number, count = 14) =>
    syntheticDays({ days: count, from: "2026-09-08", growthPerYear: 0 }).map((d) => ({ ...d, importGwh, thermalGwh }));

  it("cuts the central case to what is arriving when imports stop while thermal works hard", () => {
    const regime = importRegime(fortnight(0.14, 25), "2026-09-21", ceilings);
    expect(regime.state).toBe("cutoff");
    expect(regime.centralGwhDay).toBeCloseTo(0.14, 9);
  });

  it("reads low imports with idle thermal as imports not wanted, not imports unavailable", () => {
    const regime = importRegime(fortnight(0.14, 12), "2026-09-21", ceilings);
    expect(regime.state).toBe("normal");
    expect(regime.centralGwhDay).toBe(10);
  });

  it("keeps the ceiling while imports flow, and when too few days are usable to judge", () => {
    expect(importRegime(fortnight(8, 25), "2026-09-21", ceilings).state).toBe("normal");
    const sparse = importRegime(fortnight(0.1, 25, 5), "2026-09-12", ceilings);
    expect(sparse.state).toBe("normal");
    expect(sparse.trailingGwhDay).toBeNull();
  });

  it("feeds the central supply of every horizon, and can be switched off for comparison", () => {
    const days = syntheticDays({ days: 2200, from: "2020-01-01", growthPerYear: 0.08 }).map((d) =>
      d.date > "2025-11-15" ? { ...d, importGwh: 0.1, thermalGwh: 28 } : d,
    );
    const on = forecastAdequacy({ days, episodes: [], ceilings, origin: "2025-12-01", horizonDays: [7] })!;
    const off = forecastAdequacy({
      days, episodes: [], ceilings, origin: "2025-12-01", horizonDays: [7], ignoreImportRegime: true,
    })!;
    expect(on.imports.state).toBe("cutoff");
    expect(on.horizons[0]!.deficitGwhDay - off.horizons[0]!.deficitGwhDay).toBeCloseTo(10 - 0.1, 6);
    expect(on.horizons[0]!.stressedDeficitGwhDay).toBeCloseTo(off.horizons[0]!.stressedDeficitGwhDay, 9);
  });
});

describe("buildAdequacyDocument", () => {
  const days = syntheticDays({ days: 2200, from: "2020-01-01", growthPerYear: 0.08 });
  const ceilings = {
    thermalGwhDay: 30,
    importGwhDay: 10,
    stressedImportGwhDay: 0.1,
    otherGwhDay: 2,
    basis: "test",
  };
  const backtest = { origins: [], scores: [], calibration: new Map(), hydroCalibration: new Map() };
  const crisis = { episodes: [], calls: [] };

  function documentWith(basis: string) {
    const forecast = forecastAdequacy({ days, episodes: [], ceilings: { ...ceilings, basis }, origin: "2025-12-01" })!;
    return buildAdequacyDocument({
      forecast,
      backtest,
      crisis,
      usableDays: days.length,
      rejectedDays: 0,
      generatedAt: "2026-01-01T00:00:00Z",
    });
  }

  it("gives the same run id when only the prose explaining the ceilings changed", () => {
    // An unchanged hash has to mean a rerun would write the same numbers. Folding the basis
    // sentence into it gave a reworded comment a new run id and a second row for the same day.
    expect(documentWith("test").run_id).toBe(documentWith("reworded, same four numbers").run_id);
  });

  it("gives a different run id when a ceiling moves", () => {
    const moved = forecastAdequacy({
      days,
      episodes: [],
      ceilings: { ...ceilings, thermalGwhDay: 31 },
      origin: "2025-12-01",
    })!;
    const other = buildAdequacyDocument({
      forecast: moved,
      backtest,
      crisis,
      usableDays: days.length,
      rejectedDays: 0,
      generatedAt: "2026-01-01T00:00:00Z",
    });
    expect(other.run_id).not.toBe(documentWith("test").run_id);
  });

  it("censors the headline deficit at zero: a surplus is not a negative deficit", () => {
    const document = documentWith("test");
    expect((document.current as { worst_deficit_gwh_day: number }).worst_deficit_gwh_day).toBeGreaterThanOrEqual(0);
  });
});

describe("adequacySummary", () => {
  const document = {
    run_id: "2026-09-20-adequacy-1-abcd1234",
    origin_date: "2026-09-20",
    current: { tier: "holgado", worst_tier: "vigilancia", worst_tier_horizon_days: 60, worst_deficit_gwh_day: 0 },
  };

  it("copies the tier rather than recomputing it", () => {
    expect(adequacySummary(document)).toMatchObject({
      origin_date: "2026-09-20",
      tier: "holgado",
      worst_tier: "vigilancia",
      worst_tier_horizon_days: 60,
      worst_deficit_gwh_day: 0,
      run_id: "2026-09-20-adequacy-1-abcd1234",
    });
  });

  it("returns null for anything it cannot fully read, so the tile is absent rather than wrong", () => {
    expect(adequacySummary(null)).toBeNull();
    expect(adequacySummary({})).toBeNull();
    expect(adequacySummary({ current: {} })).toBeNull();
    expect(adequacySummary({ ...document, current: { ...document.current, worst_tier_horizon_days: "60" } })).toBeNull();
  });
});
