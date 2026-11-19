/**
 * A provisional national balance for the days SMEC has not served, built from CENACE's
 * Información Operativa page.
 *
 * SMEC (`ResultadoInforme1.do`) is the national balance of record: metered, by technology, with
 * distribution demand and transmission losses. From 2026-11-06 it answered every date — old days
 * that it had served the week before included — with a JBoss 500 ("Cannot find bean informeBean
 * in any scope"), and the adequacy model, which stands on the newest usable balance day, froze
 * on 2026-11-04. Información Operativa is read on every ingest run anyway, and its "INFORMACIÓN
 * OPERATIVA DIARIA" block is a closed day of the same kind: total, hydro, thermal,
 * non-conventional, imports and exports, in MWh.
 *
 * It is not the same measurement, and this module does not pretend it is.
 *
 * - **Preliminary SCADA, not metering.** On the 37 days both sources served (2026-09-19 →
 *   2026-11-04) the page ran low on hydro (median ratio 0.932, p10–p90 0.900–0.955) and high on
 *   thermal (1.064, 0.988–1.111), and 3% low on the total. The bias is steady enough to correct,
 *   so each component is scaled by the median SMEC/Operativa ratio over the most recent days the
 *   two share. The factors are recomputed on every read from the committed tables, so they move
 *   as SMEC comes back and the overlap grows.
 * - **No distribution demand, no losses.** The adequacy model sizes supply against
 *   `total_generacion + imports − exports` and does not read `demanda_distribucion` (see
 *   `balance.ts`), but `readBalance` uses demand to tell a whole day from a page caught
 *   mid-render. A provisional day therefore carries an *estimated* demand — its load divided by
 *   the median SMEC load/demand ratio over the same overlap — which passes that gate by
 *   construction and must never be shown as a measurement (`latest.ts` nulls it).
 * - **One day per snapshot, two to four days late.** The page shows a single closed day and only
 *   the latest one; a day no run saw is a day this module cannot rebuild.
 *
 * Every provisional row carries `source = PROVISIONAL_BALANCE_SOURCE` and its thermal total under
 * a concept of its own, `generacion_termica`, because the page does not split thermal by
 * technology. SMEC's rows win: a date with a usable SMEC day is never replaced, so the day SMEC
 * answers again its rows supersede these without anything being deleted — provisional rows are
 * computed on read and never written to `national_balance_daily`.
 */

import { PROVISIONAL_BALANCE_SOURCE, PROVISIONAL_THERMAL_CONCEPT, readBalance, type BalanceCsvRow, type BalanceDay } from "./balance.ts";
import type { IsoDate } from "../util/dates.ts";

export { PROVISIONAL_BALANCE_SOURCE, PROVISIONAL_THERMAL_CONCEPT };

/** A row of `operativa_snapshots`, as read from the CSV. */
export interface OperativaCsvRow {
  fetched_at: string;
  block: string;
  period_date: string;
  metric: string;
  value: string;
  unit: string;
  source?: string;
}

/** One closed day as the Información Operativa page reported it, in GWh. */
export interface OperativaDay {
  date: IsoDate;
  fetchedAt: string;
  source: string;
  totalGwh: number;
  hydroGwh: number;
  thermalGwh: number;
  otherGwh: number;
  importGwh: number;
  exportGwh: number;
}

const DAILY_METRICS = {
  produccion_total: "totalGwh",
  hidraulica: "hydroGwh",
  termica: "thermalGwh",
  renovable_no_convencional: "otherGwh",
  importacion: "importGwh",
  exportacion: "exportGwh",
} as const;

/**
 * Every closed day the page has reported, oldest first. A day reported by several snapshots
 * takes the newest one: the page republishes a day unchanged, and when CENACE revises the
 * preliminary figures the later reading is the better one. A snapshot missing any of the six
 * metrics is not a day.
 */
export function operativaDays(rows: readonly OperativaCsvRow[]): OperativaDay[] {
  const snapshots = new Map<string, { date: IsoDate; fetchedAt: string; source: string; values: Map<string, number> }>();
  for (const row of rows) {
    if (row.block !== "diaria" || !row.period_date || row.unit !== "MWh") continue;
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    const key = `${row.fetched_at}\u0000${row.period_date}`;
    const snapshot =
      snapshots.get(key) ??
      snapshots.set(key, { date: row.period_date, fetchedAt: row.fetched_at, source: row.source ?? "", values: new Map() }).get(key)!;
    snapshot.values.set(row.metric, value / 1000);
  }

  const newest = new Map<IsoDate, OperativaDay>();
  for (const snapshot of snapshots.values()) {
    if (!Object.keys(DAILY_METRICS).every((metric) => snapshot.values.has(metric))) continue;
    const day = { date: snapshot.date, fetchedAt: snapshot.fetchedAt, source: snapshot.source } as OperativaDay;
    for (const [metric, field] of Object.entries(DAILY_METRICS)) day[field] = snapshot.values.get(metric)!;
    const held = newest.get(day.date);
    if (held === undefined || day.fetchedAt > held.fetchedAt) newest.set(day.date, day);
  }
  return [...newest.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** SMEC ÷ Operativa, per component, over the most recent days both served. */
export interface BalanceCalibration {
  hydro: number;
  thermal: number;
  other: number;
  /** SMEC's own load ÷ distribution demand over the same days, for the estimated demand. */
  loadToDemand: number;
  overlapDays: number;
  first: IsoDate | null;
  last: IsoDate | null;
}

export const CALIBRATION_WINDOW_DAYS = 60;
/** Fewer shared days than this and the bias is not known well enough to correct: no provisional days. */
export const CALIBRATION_MIN_OVERLAP = 14;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The per-component correction, or null when the two sources share too few days. Ratios are
 * medians of daily ratios, so a single mis-rendered day on either side moves nothing; a
 * component too small on a day to divide by (under 0.05 GWh) is left out of that day's ratio.
 */
export function calibrate(
  smec: readonly BalanceDay[],
  operativa: readonly OperativaDay[],
  windowDays = CALIBRATION_WINDOW_DAYS,
): BalanceCalibration | null {
  const byDate = new Map(operativa.map((d) => [d.date, d]));
  const shared = smec.filter((d) => !d.provisional && byDate.has(d.date)).slice(-windowDays);
  if (shared.length < CALIBRATION_MIN_OVERLAP) return null;

  const ratios = (pick: (s: BalanceDay, o: OperativaDay) => [number, number]): number => {
    const out: number[] = [];
    for (const s of shared) {
      const [num, den] = pick(s, byDate.get(s.date)!);
      if (den > 0.05 && num > 0.05) out.push(num / den);
    }
    return out.length > 0 ? median(out) : 1;
  };

  return {
    hydro: ratios((s, o) => [s.hydroGwh, o.hydroGwh]),
    thermal: ratios((s, o) => [s.thermalGwh, o.thermalGwh]),
    other: ratios((s, o) => [s.otherGwh, o.otherGwh]),
    loadToDemand: median(shared.map((s) => s.loadGwh / s.distributionDemandGwh)),
    overlapDays: shared.length,
    first: shared[0]!.date,
    last: shared.at(-1)!.date,
  };
}

/** The SMEC-shaped rows for one provisional day, in kWh like the table they stand in for. */
export function provisionalRowsFor(day: OperativaDay, calibration: BalanceCalibration): (BalanceCsvRow & { source: string })[] {
  const hydro = day.hydroGwh * calibration.hydro;
  const thermal = day.thermalGwh * calibration.thermal;
  const other = day.otherGwh * calibration.other;
  const generation = hydro + thermal + other;
  const load = generation + day.importGwh - day.exportGwh;
  const concepts: [string, number][] = [
    ["generacion_hidraulica", hydro],
    [PROVISIONAL_THERMAL_CONCEPT, thermal],
    ["generacion_otros_tipos", other],
    ["total_generacion", generation],
    ["total_importacion", day.importGwh],
    ["total_exportacion", day.exportGwh],
    ["demanda_distribucion", load / calibration.loadToDemand],
  ];
  return concepts.map(([concepto, gwh]) => ({
    date: day.date,
    concepto,
    dia_kwh: String(Math.round(gwh * 1e9) / 1e3),
    source: PROVISIONAL_BALANCE_SOURCE,
  }));
}

export interface MergedBalance<Row> {
  /** SMEC's rows, with every date SMEC could not support replaced by a provisional day. */
  rows: (Row | (BalanceCsvRow & { source: string }))[];
  /** The dates filled from Información Operativa, oldest first. */
  provisionalDates: IsoDate[];
  /**
   * The filled dates newer than SMEC's newest usable day: the ones standing in for SMEC at its
   * front edge, rather than holes SMEC left behind it and never went back to. This is what
   * freshness reads. After the 2026-11-06 outage SMEC came back on 2026-11-11 without re-serving
   * 2026-11-05 → 10, and those old fills kept "the provisional feed" aging until it failed every
   * daily apply, although SMEC itself was current and nothing was standing in for it.
   */
  coveringDates: IsoDate[];
  calibration: BalanceCalibration | null;
}

/**
 * SMEC's table with its holes filled. A date is filled when Información Operativa reported it
 * and SMEC has no usable day for it — missing, incomplete, or rejected by `readBalance` — and the
 * SMEC rows for a filled date are dropped, so a day is never half one source and half the other.
 */
export function withProvisionalBalance<Row extends BalanceCsvRow>(
  smecRows: readonly Row[],
  operativaRows: readonly OperativaCsvRow[],
): MergedBalance<Row> {
  const smec = readBalance(smecRows);
  const operativa = operativaDays(operativaRows);
  const calibration = calibrate(smec.days, operativa);
  if (calibration === null) return { rows: [...smecRows], provisionalDates: [], coveringDates: [], calibration };

  const usable = new Set(smec.days.map((d) => d.date));
  const fill = operativa.filter((d) => !usable.has(d.date));
  const filled = new Set(fill.map((d) => d.date));
  const smecLatest = smec.days.at(-1)?.date ?? null;
  const provisionalDates = fill.map((d) => d.date);
  return {
    rows: [...smecRows.filter((row) => !filled.has(row.date)), ...fill.flatMap((d) => provisionalRowsFor(d, calibration))],
    provisionalDates,
    coveringDates: provisionalDates.filter((date) => smecLatest === null || date > smecLatest),
    calibration,
  };
}
