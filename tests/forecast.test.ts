/**
 * What the published document has to guarantee, whatever the data does: quantiles that do not
 * cross, rows that satisfy their contracts, and provenance carried through to the reader.
 */

import { describe, expect, it } from "vitest";
import { buildForecast, MODEL_VERSION, type ThresholdRef } from "../src/lib/models/forecast.ts";
import { buildSeries } from "../src/lib/features/series.ts";
import { volumeAt, levelAt, type Hypsometry } from "../src/lib/features/hydrology.ts";
import { FORECAST_RUNS, FORECAST_VALUES, validateRows } from "../src/lib/contracts/tables.ts";
import type { Calibration } from "../src/lib/models/backtest.ts";
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

function build(cal: Calibration) {
  return buildForecast({
    series: buildSeries(observationRows()),
    site: "mazar",
    variable: "cota_masl",
    horizonDays: HORIZONS,
    thresholds: THRESHOLDS,
    calibration: cal,
    scores: [],
    modelId: "M3-water-balance",
    modelLabel: "Water balance",
    backtestOrigins: 90,
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
