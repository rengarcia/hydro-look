/**
 * What the published document has to guarantee, whatever the data does: quantiles that do not
 * cross, rows that satisfy their contracts, and provenance carried through to the reader.
 */

import { describe, expect, it } from "vitest";
import { buildForecast, MODEL_VERSION, type HorizonSwitch, type ThresholdRef } from "../src/lib/models/forecast.ts";
import { m4HorizonSwitch, type M4Evidence } from "../src/lib/models/m4-live.ts";
import { buildSeries } from "../src/lib/features/series.ts";
import { volumeAt, levelAt, type Hypsometry } from "../src/lib/features/hydrology.ts";
import { FORECAST_RUNS, FORECAST_VALUES, validateRows } from "../src/lib/contracts/tables.ts";
import type { Calibration, ModelScore } from "../src/lib/models/backtest.ts";
import { addDays } from "../src/lib/util/dates.ts";

const TRUTH: Hypsometry = {
  areaCoefficient: 1277,
  areaExponent: 1.9,
  datumM: 2060,
  turbineM3sPerMw: 0.65,
  rmseDeltaLevelM: 0,
  days: 0,
  fitCeilingM: 2150,
};

const HORIZONS = [7, 30] as const;

const THRESHOLDS: ThresholdRef[] = [
  {
    name: "critical (plan)",
    levelMasl: 2115,
    source: "PLAN.md section 7",
    status: "unverified",
    note: "No upstream source publishes this level.",
  },
  {
    name: "declared minimum (report endpoint)",
    levelMasl: 2100,
    source: "ords:repDiaHid12m",
    status: "published",
    note: "Observed 2014-09-20 onward.",
  },
];

/** Twelve years of a reservoir that obeys the balance, written as curated observation rows. */
function observationRows(years = 12): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  let level = 2130;
  for (let i = 0; i < years * 365; i++) {
    const date = addDays("2014-01-01", i);
    const inflowM3s = 60 + 55 * Math.sin((i / 365) * 2 * Math.PI) + 12 * Math.sin(i / 3.3);
    const powerMw = Math.min(170, Math.max(0, 95 + 6 * (level - 2128) + 18 * Math.sin(i / 11)));
    for (const [variable, value] of [
      ["cota_masl", level],
      ["caudal_m3s", inflowM3s],
      ["produccion_mwh", powerMw * 24],
    ] as const) {
      rows.push({
        date,
        site: "mazar",
        variable,
        value: String(value),
        source: "ords:repDiaHid12m",
        mrid: "",
        fetched_at: "2026-09-22T00:00:00Z",
        raw_ref: "synthetic",
      });
    }
    level = levelAt(TRUTH, volumeAt(TRUTH, level) + 86_400 * (inflowM3s - TRUTH.turbineM3sPerMw * powerMw));
  }
  return rows;
}

function calibration(q10: number, q50: number, q90: number): Calibration {
  const perHorizon = new Map(HORIZONS.map((h) => [h, { q10, q50, q90, n: 40 }]));
  return new Map([["M3-water-balance", perHorizon]]);
}

function build(cal: Calibration, horizonSwitch?: HorizonSwitch, scores: ModelScore[] = []) {
  return buildForecast({
    series: buildSeries(observationRows()),
    site: "mazar",
    variable: "cota_masl",
    horizonDays: HORIZONS,
    thresholds: THRESHOLDS,
    calibration: cal,
    scores,
    modelId: "M3-water-balance",
    modelLabel: "Water balance",
    backtestOrigins: 90,
    horizonSwitch,
  });
}

describe("buildForecast", () => {
  it("produces a quantile triple per horizon that satisfies the table contract", () => {
    const out = build(calibration(-6, -0.4, 4))!;
    expect(out.valueRows).toHaveLength(HORIZONS.length);
    expect(() => validateRows(FORECAST_VALUES, out.valueRows)).not.toThrow();
    expect(() => validateRows(FORECAST_RUNS, [out.runRow])).not.toThrow();
    for (const row of out.valueRows) {
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p50).toBeLessThanOrEqual(row.p90);
    }
  });

  it("keeps the band around the median even when every past residual fell one side", () => {
    // A model that has only ever forecast too low would otherwise put its p10 above its p50 and
    // the contract would refuse the row.
    const out = build(calibration(3, 5, 9))!;
    expect(() => validateRows(FORECAST_VALUES, out.valueRows)).not.toThrow();
    for (const row of out.valueRows) {
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p90).toBeGreaterThan(row.p50);
    }
  });

  it("falls back to the ensemble's own spread when a horizon has no calibration yet", () => {
    const out = build(new Map())!;
    for (const row of out.valueRows) {
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p50).toBeLessThanOrEqual(row.p90);
      expect(row.ensemble_n).toBeGreaterThan(0);
    }
  });

  it("ties every row to one run, and the run to the data it was built from", () => {
    const out = build(calibration(-6, 0, 4))!;
    expect(out.valueRows.every((row) => row.run_id === out.runRow.run_id)).toBe(true);
    expect(out.runRow.model_version).toBe(MODEL_VERSION);
    expect(out.runRow.origin_date).toBe(out.origin);
    expect(out.runRow.features_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(out.runRow.backtest_origins).toBe(90);
  });

  it("gives the same run id for the same inputs, so a rerun is a no-op", () => {
    expect(build(calibration(-6, 0, 4))!.runRow.run_id).toBe(build(calibration(-1, 0, 1))!.runRow.run_id);
  });

  it("carries each threshold's provenance, so an unverified level cannot be read as declared", () => {
    const document = build(calibration(-6, 0, 4))!.document as {
      thresholds: { level_masl: number; status: string; source: string }[];
    };
    const critical = document.thresholds.find((t) => t.level_masl === 2115)!;
    expect(critical.status).toBe("unverified");
    expect(critical.source).toBe("PLAN.md section 7");
    expect(document.thresholds.find((t) => t.level_masl === 2100)!.status).toBe("published");
  });

  it("says it is not an official source", () => {
    const document = build(calibration(-6, 0, 4))!.document as { disclaimer: string };
    expect(document.disclaimer).toMatch(/No es una fuente oficial/);
  });

  it("reports days-to-threshold under three named scenarios and across the whole ensemble", () => {
    const document = build(calibration(-6, 0, 4))!.document as {
      days_to_threshold: {
        thresholds: {
          level_masl: number;
          scenarios: { scenario: string; analogYear: number }[];
          across_all_analogue_years: { analogue_years: number; years_that_cross: number } | null;
        }[];
      };
    };
    const entry = document.days_to_threshold.thresholds[0]!;
    expect(entry.scenarios.map((s) => s.scenario)).toEqual(["dry", "median", "wet"]);
    // Each scenario names the real year it came from, which is the point of an analogue method.
    expect(entry.scenarios.every((s) => s.analogYear >= 2014)).toBe(true);
    expect(entry.across_all_analogue_years!.years_that_cross).toBeLessThanOrEqual(
      entry.across_all_analogue_years!.analogue_years,
    );
  });

  it("publishes the fitted reservoir so the forecast can be argued with", () => {
    const document = build(calibration(-6, 0, 4))!.document as {
      reservoir: { release_rule_m3s: unknown[]; area_elevation: { exponent: number } };
    };
    expect(document.reservoir.release_rule_m3s.length).toBeGreaterThan(1);
    expect(document.reservoir.area_elevation.exponent).toBeGreaterThan(0);
  });

  it("declines rather than guessing when there is no level history", () => {
    const empty = buildForecast({
      series: buildSeries([]),
      site: "mazar",
      variable: "cota_masl",
      horizonDays: HORIZONS,
      thresholds: THRESHOLDS,
      calibration: new Map(),
      scores: [],
      modelId: "M3-water-balance",
      modelLabel: "Water balance",
      backtestOrigins: 0,
    });
    expect(empty).toBeNull();
  });
});

describe("the seven-day switch in the published forecast", () => {
  const EVIDENCE: M4Evidence = {
    snapshotGeneratedAt: "2026-09-22T00:00:00Z",
    snapshotCommand: "npm run backtest:m4",
    origins: 105,
    referenceId: "M3-water-balance",
    n: 105,
    maeM: 2.034,
    referenceMaeM: 2.292,
    skillVsPersistence: 0.112,
    coverageP10P90: 0.763,
    referenceCoverageP10P90: 0.742,
    ownCoverageP10P90: 0.619,
    paired: { maeDifferenceM: -0.26, low90: -0.45, high90: -0.07, winShare: 0.62 },
    calibration: { q10: -2.9, q50: -0.1, q90: 2.3, n: 105 },
  };
  const M3_SCORES: ModelScore[] = [
    {
      modelId: "M3-water-balance",
      label: "Water balance",
      horizons: HORIZONS.map((horizonDays) => ({
        horizonDays,
        n: 105,
        maeM: horizonDays === 7 ? 2.292 : 5.85,
        rmseM: 3,
        biasM: 0,
        skillVsPersistence: horizonDays === 7 ? -0.001 : 0.001,
        nBand: 93,
        pinballMeanM: 1,
        coverageP10P90: horizonDays === 7 ? 0.742 : 0.804,
        ensembleCoverage: 0.6,
        meanBandWidthM: 5,
      })),
    },
  ];
  type Entry = { horizon_days: number; p10: number; p50: number; p90: number; model: string; band_source: string } & Record<string, unknown>;
  type Doc = {
    forecast: Entry[];
    backtest: { horizons: { horizon_days: number; model: string; mae_m: number; skill_vs_persistence: number }[] };
    horizon_switch: Record<string, unknown> | null;
    model: { id: string; horizon_models: { horizon_days: number; model_id: string }[] };
  };

  function switched(p50: number, evidence: M4Evidence = EVIDENCE) {
    const live = { horizonDays: 7, p50, ownP10: p50 - 1, ownP90: p50 + 1, anchorP50: p50 + 0.5 };
    return build(calibration(-6, -0.4, 4), m4HorizonSwitch(evidence, live, null, "M3-water-balance"), M3_SCORES)!;
  }

  it("publishes M4 at seven days and M3 everywhere else, and says so on every row", () => {
    const plain = build(calibration(-6, -0.4, 4), undefined, M3_SCORES)!;
    const m3At7 = plain.valueRows.find((r) => r.horizon_days === 7)!;
    const out = switched(m3At7.p50 - 1.234);
    const doc = out.document as Doc;

    const seven = doc.forecast.find((h) => h.horizon_days === 7)!;
    expect(seven.model).toBe("M4-gbm-m3-residual");
    expect(seven.p50).toBeCloseTo(m3At7.p50 - 1.234, 2);
    expect(seven.band_source).toContain("M4-gbm-m3-residual out-of-sample residuals");
    expect(seven["backtest_skill"]).toMatchObject({ mae_m: 2.034, reference_model: "M3-water-balance", reference_mae_m: 2.292 });
    // What M3 would have published is kept beside it, so the size of the switch is visible.
    expect(seven["would_have_published"]).toMatchObject({ model: "M3-water-balance", p10: m3At7.p10, p50: m3At7.p50, p90: m3At7.p90 });

    const thirty = doc.forecast.find((h) => h.horizon_days === 30)!;
    const plainThirty = (plain.document as Doc).forecast.find((h) => h.horizon_days === 30)!;
    expect(thirty.model).toBe("M3-water-balance");
    expect([thirty.p10, thirty.p50, thirty.p90]).toEqual([plainThirty.p10, plainThirty.p50, plainThirty.p90]);
    expect(thirty["would_have_published"]).toBeUndefined();

    // The skill beside each row is the skill of the model that produced it.
    const skill7 = doc.backtest.horizons.find((h) => h.horizon_days === 7)!;
    expect(skill7).toMatchObject({ model: "M4-gbm-m3-residual", mae_m: 2.034, skill_vs_persistence: 0.112 });
    expect(doc.backtest.horizons.find((h) => h.horizon_days === 30)!.model).toBe("M3-water-balance");

    expect(doc.model.id).toBe("M3-water-balance");
    expect(doc.model.horizon_models).toEqual([
      { horizon_days: 7, model_id: "M4-gbm-m3-residual" },
      { horizon_days: 30, model_id: "M3-water-balance" },
    ]);
    expect(doc.horizon_switch).toMatchObject({ status: "published", published_model: "M4-gbm-m3-residual" });
  });

  it("writes rows that satisfy the contracts, each carrying its model", () => {
    const out = switched(2128.5);
    expect(() => validateRows(FORECAST_VALUES, out.valueRows)).not.toThrow();
    expect(() => validateRows(FORECAST_RUNS, [out.runRow])).not.toThrow();
    expect(out.valueRows.find((r) => r.horizon_days === 7)!.model_id).toBe("M4-gbm-m3-residual");
    expect(out.valueRows.find((r) => r.horizon_days === 30)!.model_id).toBe("M3-water-balance");
    expect(out.runRow.model_id).toBe("M3-water-balance");
  });

  it("keeps the published band around the published median", () => {
    for (const q of [
      { q10: -2.9, q50: 0, q90: 2.3 },
      { q10: 0.4, q50: 1, q90: 3 },
      { q10: -3, q50: -1, q90: -0.2 },
    ]) {
      const out = switched(2128.5, { ...EVIDENCE, calibration: { ...q, n: 105 } });
      const row = out.valueRows.find((r) => r.horizon_days === 7)!;
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p50).toBeLessThanOrEqual(row.p90);
    }
  });

  it("publishes M3 at every horizon when the switch falls back, and records why", () => {
    const plain = build(calibration(-6, -0.4, 4), undefined, M3_SCORES)!;
    const out = build(
      calibration(-6, -0.4, 4),
      m4HorizonSwitch(null, null, "the M4 snapshot was scored on 105 origins; the ladder now has 106", "M3-water-balance"),
      M3_SCORES,
    )!;
    const doc = out.document as Doc;
    expect(doc.forecast.every((h) => h.model === "M3-water-balance")).toBe(true);
    expect(out.valueRows.every((r) => r.model_id === "M3-water-balance")).toBe(true);
    expect(out.valueRows.map((r) => [r.p10, r.p50, r.p90])).toEqual(plain.valueRows.map((r) => [r.p10, r.p50, r.p90]));
    expect(doc.horizon_switch).toMatchObject({ status: "fallback", published_model: "M3-water-balance" });
    expect(String(doc.horizon_switch!["reason"])).toContain("the ladder now has 106");
  });

  it("is a different run from the same data forecast without the switch", () => {
    const plain = build(calibration(-6, -0.4, 4), undefined, M3_SCORES)!;
    expect(switched(2128.5).runRow.run_id).not.toBe(plain.runRow.run_id);
  });
});
