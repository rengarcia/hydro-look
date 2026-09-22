/**
 * Table contracts. Nothing is written unless it validates: a drifted parse must leave the
 * previous data untouched rather than half-update it.
 */

import { z } from "zod";
import { SITES, VARIABLES } from "../registry.ts";
import { SMEC_CONCEPTS } from "../parse/smec.ts";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const isoTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "expected an ISO UTC timestamp");
const siteId = z.enum(Object.keys(SITES) as [string, ...string[]]);
const variableId = z.enum(Object.keys(VARIABLES) as [string, ...string[]]);
const concepto = z.enum(Object.values(SMEC_CONCEPTS) as [string, ...string[]]);
const nullableNumber = z.number().finite().nullable();

export const observationRow = z.object({
  date: isoDate,
  site: siteId,
  variable: variableId,
  value: z.number().finite(),
  source: z.string().min(1),
  mrid: z.string(),
  fetched_at: isoTimestamp,
  raw_ref: z.string(),
});
export type ObservationRow = z.infer<typeof observationRow>;

export const nationalBalanceRow = z.object({
  date: isoDate,
  concepto,
  dia_kwh: nullableNumber,
  pct_dia: nullableNumber,
  mes_kwh: nullableNumber,
  pct_mes: nullableNumber,
  anio_kwh: nullableNumber,
  pct_anio: nullableNumber,
  ultimos365_kwh: nullableNumber,
  tipo_dia: z.string(),
  tipo_dia_anio_anterior: z.string(),
  source: z.string().min(1),
  fetched_at: isoTimestamp,
  raw_ref: z.string(),
});
export type NationalBalanceRow = z.infer<typeof nationalBalanceRow>;

export const operativaRow = z.object({
  fetched_at: isoTimestamp,
  block: z.enum(["tiempo_real", "diaria", "mensual", "anual", "demanda", "demanda_empresas"]),
  period_label: z.string(),
  period_date: z.union([isoDate, z.literal("")]),
  metric: z.string().min(1),
  value: z.number().finite(),
  unit: z.enum(["MWh", "GWh", "MW"]),
  source: z.string().min(1),
  raw_ref: z.string(),
});
export type OperativaRow = z.infer<typeof operativaRow>;

export const operatingBandRow = z.object({
  site: siteId,
  cota_min: nullableNumber,
  cota_max: nullableNumber,
  qmax_m3s: nullableNumber,
  source: z.string().min(1),
  first_date: isoDate,
  last_date: isoDate,
});
export type OperatingBandRow = z.infer<typeof operatingBandRow>;

export const weatherRow = z.object({
  date: z.string().date(),
  basin: z.string().regex(/^[a-z][a-z0-9_]*$/),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  kind: z.enum(["era5", "forecast"]),
  precip_mm: z.number().finite().nonnegative().nullable(),
  temp_mean_c: z.number().finite().min(-90).max(60).nullable(),
  // Collection vintage, not the upstream model's initialization time. Empty for ERA5.
  issued_at: z.union([isoTimestamp, z.literal("")]),
  source: z.enum(["open_meteo:era5", "open_meteo:forecast"]),
  fetched_at: isoTimestamp,
  raw_ref: z.string().min(1),
}).refine((r) => r.kind === "era5"
  ? r.issued_at === "" && r.source === "open_meteo:era5"
  : r.issued_at === r.fetched_at && r.source === "open_meteo:forecast",
{ message: "weather kind, source and collection vintage must agree" });
export type WeatherRow = z.infer<typeof weatherRow>;

export const ensoRow = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  oni: z.number().finite().min(-5).max(5),
  source: z.literal("noaa_psl:oni"),
  fetched_at: isoTimestamp,
  raw_ref: z.string().min(1),
});
export type EnsoRow = z.infer<typeof ensoRow>;

export interface TableSpec<T> {
  name: string;
  columns: readonly (keyof T & string)[];
  /** Columns whose combination identifies a row; a re-ingest replaces the row with the same key. */
  key: readonly (keyof T & string)[];
  /** Column the year partition is taken from; undefined keeps the table in one file. */
  partitionBy?: keyof T & string;
  schema: z.ZodType<T>;
}

export const OBSERVATIONS_DAILY: TableSpec<ObservationRow> = {
  name: "observations_daily",
  columns: ["date", "site", "variable", "value", "source", "mrid", "fetched_at", "raw_ref"],
  key: ["date", "site", "variable", "source", "mrid"],
  partitionBy: "date",
  schema: observationRow,
};

export const NATIONAL_BALANCE_DAILY: TableSpec<NationalBalanceRow> = {
  name: "national_balance_daily",
  columns: [
    "date",
    "concepto",
    "dia_kwh",
    "pct_dia",
    "mes_kwh",
    "pct_mes",
    "anio_kwh",
    "pct_anio",
    "ultimos365_kwh",
    "tipo_dia",
    "tipo_dia_anio_anterior",
    "source",
    "fetched_at",
    "raw_ref",
  ],
  key: ["date", "concepto"],
  partitionBy: "date",
  schema: nationalBalanceRow,
};

export const OPERATIVA_SNAPSHOTS: TableSpec<OperativaRow> = {
  name: "operativa_snapshots",
  columns: ["fetched_at", "block", "period_label", "period_date", "metric", "value", "unit", "source", "raw_ref"],
  key: ["fetched_at", "block", "metric"],
  partitionBy: "fetched_at",
  schema: operativaRow,
};

export const OPERATING_BANDS: TableSpec<OperatingBandRow> = {
  name: "operating_bands",
  columns: ["site", "cota_min", "cota_max", "qmax_m3s", "source", "first_date", "last_date"],
  key: ["site", "source", "cota_min", "cota_max", "qmax_m3s"],
  schema: operatingBandRow,
};

export const WEATHER_DAILY: TableSpec<WeatherRow> = {
  name: "weather_daily",
  columns: ["date", "basin", "latitude", "longitude", "kind", "precip_mm", "temp_mean_c", "issued_at", "source", "fetched_at", "raw_ref"],
  key: ["date", "basin", "latitude", "longitude", "kind", "issued_at"],
  partitionBy: "date",
  schema: weatherRow,
};

export const ENSO_MONTHLY: TableSpec<EnsoRow> = {
  name: "enso_monthly",
  columns: ["month", "oni", "source", "fetched_at", "raw_ref"],
  key: ["month", "source"],
  partitionBy: "month",
  schema: ensoRow,
};

/** Validates every row, reporting all failures at once rather than only the first. */
export function validateRows<T>(spec: TableSpec<T>, rows: unknown[]): T[] {
  const problems: string[] = [];
  const valid: T[] = [];
  rows.forEach((row, index) => {
    const result = spec.schema.safeParse(row);
    if (result.success) valid.push(result.data);
    else problems.push(`  row ${index}: ${result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  });
  if (problems.length > 0) {
    throw new Error(`${spec.name}: ${problems.length}/${rows.length} rows failed the contract\n${problems.slice(0, 10).join("\n")}`);
  }
  return valid;
}
