/**
 * The provisional balance's decisions: SMEC always wins, a filled day is never half one source
 * and half the other, the correction is the median SMEC/Operativa ratio, and too little overlap
 * means no provisional days at all.
 */

import { describe, expect, it } from "vitest";
import { PROVISIONAL_BALANCE_SOURCE, readBalance, type BalanceCsvRow } from "../src/lib/features/balance.ts";
import {
  CALIBRATION_MIN_OVERLAP,
  calibrate,
  operativaDays,
  withProvisionalBalance,
  type OperativaCsvRow,
} from "../src/lib/features/provisional-balance.ts";
import { addDays } from "../src/lib/util/dates.ts";
import { nationalSnapshot, balanceByDay } from "../src/lib/publish/latest.ts";

/** A whole SMEC day, in GWh. */
function smecDay(date: string, hydro: number, thermal: number, other = 0.5, imports = 0, exports = 0): BalanceCsvRow[] {
  const generation = hydro + thermal + other;
  const concepts: Record<string, number> = {
    generacion_hidraulica: hydro,
    generacion_motores_bunker: thermal,
    generacion_otros_tipos: other,
    total_generacion: generation,
    total_importacion: imports,
    total_exportacion: exports,
    demanda_distribucion: (generation + imports - exports) / 1.08,
    total_perdidas_transporte: 3,
  };
  return Object.entries(concepts).map(([concepto, gwh]) => ({
    date,
    concepto,
    dia_kwh: String(gwh * 1e6),
    source: "smec:ResultadoInforme1",
  }));
}

/** One "diaria" snapshot of Información Operativa, in GWh. */
function operativaDay(
  date: string,
  fetchedAt: string,
  hydro: number,
  thermal: number,
  other = 0.5,
  imports = 0,
  exports = 0,
): OperativaCsvRow[] {
  const metrics: Record<string, number> = {
    produccion_total: hydro + thermal + other,
    hidraulica: hydro,
    termica: thermal,
    renovable_no_convencional: other,
    importacion: imports,
    exportacion: exports,
  };
  return Object.entries(metrics).map(([metric, gwh]) => ({
    fetched_at: fetchedAt,
    block: "diaria",
    period_date: date,
    metric,
    value: String(gwh * 1000),
    unit: "MWh",
    source: "cenace:InformacionOperativa",
  }));
}

/** `n` days both sources served, with Operativa 10% low on hydro and 5% high on thermal. */
function overlap(n: number, start = "2026-09-01") {
  const smec: BalanceCsvRow[] = [];
  const operativa: OperativaCsvRow[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(start, i);
    smec.push(...smecDay(date, 80, 20));
    operativa.push(...operativaDay(date, `${addDays(date, 2)}T12:00:00Z`, 72, 21));
  }
  return { smec, operativa };
}

describe("operativaDays", () => {
  it("keeps the newest snapshot of a day and drops one missing a metric", () => {
    const rows = [
      ...operativaDay("2026-11-03", "2026-11-05T07:00:00Z", 60, 20),
      ...operativaDay("2026-11-03", "2026-11-06T07:00:00Z", 67, 23),
      ...operativaDay("2026-11-04", "2026-11-06T09:00:00Z", 69, 28).filter((r) => r.metric !== "termica"),
    ];
    const days = operativaDays(rows);
    expect(days.map((d) => d.date)).toEqual(["2026-11-03"]);
    expect(days[0]!.hydroGwh).toBeCloseTo(67);
  });
});

describe("calibrate", () => {
  it("is the median SMEC/Operativa ratio per component", () => {
    const { smec, operativa } = overlap(CALIBRATION_MIN_OVERLAP);
    const c = calibrate(readBalance(smec).days, operativaDays(operativa))!;
    expect(c.hydro).toBeCloseTo(80 / 72);
    expect(c.thermal).toBeCloseTo(20 / 21);
    expect(c.loadToDemand).toBeCloseTo(1.08);
    expect(c.overlapDays).toBe(CALIBRATION_MIN_OVERLAP);
  });

  it("refuses to correct on too few shared days", () => {
    const { smec, operativa } = overlap(CALIBRATION_MIN_OVERLAP - 1);
    expect(calibrate(readBalance(smec).days, operativaDays(operativa))).toBeNull();
  });
});

describe("withProvisionalBalance", () => {
  const { smec, operativa } = overlap(20);
  const late = "2026-09-25";
  const withLate = [...operativa, ...operativaDay(late, "2026-09-27T12:00:00Z", 72, 21)];

  it("fills a day SMEC did not serve, corrected and flagged, and leaves SMEC's days alone", () => {
    const merged = withProvisionalBalance(smec, withLate);
    expect(merged.provisionalDates).toEqual([late]);
    const days = readBalance(merged.rows).days;
    expect(days.filter((d) => d.provisional).map((d) => d.date)).toEqual([late]);
    const filled = days.find((d) => d.date === late)!;
    expect(filled.hydroGwh).toBeCloseTo(80);
    expect(filled.thermalGwh).toBeCloseTo(20);
    expect(days.filter((d) => !d.provisional)).toHaveLength(20);
  });

  it("lets SMEC supersede the provisional day the moment it serves it", () => {
    const merged = withProvisionalBalance([...smec, ...smecDay(late, 81, 19)], withLate);
    expect(merged.provisionalDates).toEqual([]);
    expect(merged.rows.some((r) => (r as { source?: string }).source === PROVISIONAL_BALANCE_SOURCE)).toBe(false);
  });

  it("replaces a SMEC day it cannot use whole, never mixing the two on one date", () => {
    // SMEC served the date mid-render: generation without demand.
    const partial = smecDay(late, 4, 1).filter((r) => r.concepto !== "demanda_distribucion");
    const merged = withProvisionalBalance([...smec, ...partial], withLate);
    expect(merged.provisionalDates).toEqual([late]);
    const sources = new Set(merged.rows.filter((r) => r.date === late).map((r) => (r as { source?: string }).source));
    expect([...sources]).toEqual([PROVISIONAL_BALANCE_SOURCE]);
  });

  it("publishes a provisional day without the demand it only estimated", () => {
    const merged = withProvisionalBalance(smec, withLate);
    const rows = merged.rows as BalanceCsvRow[];
    const provisional = new Set(rows.filter((r) => r.source === PROVISIONAL_BALANCE_SOURCE).map((r) => r.date));
    const snapshot = nationalSnapshot(balanceByDay(rows), provisional)!;
    expect(snapshot.date).toBe(late);
    expect(snapshot.provisional).toBe(true);
    expect(snapshot.distribution_demand_gwh).toBeNull();
    expect(snapshot.thermal_share_pct).toBeGreaterThan(0);
  });
});
