/**
 * Table contracts. Nothing is written unless it validates: a drifted parse must leave the
 * previous data untouched rather than half-update it.
 */

import { z } from "zod";
import { SITES, VARIABLES } from "../registry.ts";
import { SMEC_CONCEPTS } from "../parse/smec.ts";
import { XM_LINKS, XM_SYSTEM_METRICS, type XmSystemMetric } from "../parse/xm.ts";

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

export const weatherRow = z
  .object({
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
  })
  .refine(
    (r) =>
      r.kind === "era5"
        ? r.issued_at === "" && r.source === "open_meteo:era5"
        : r.issued_at === r.fetched_at && r.source === "open_meteo:forecast",
    { message: "weather kind, source and collection vintage must agree" },
  );
export type WeatherRow = z.infer<typeof weatherRow>;

/**
 * GEOGLOWS v2 river forecasts at a dam's river: the daily mean of one member at one lead, per
 * 00 UTC issue. The store is a public, write-once object per issue, so provenance is its key and
 * ETag rather than an archived copy (a chunk is 15 MB; the half megabyte read from it is kept as
 * the numbers themselves). Written by `npm run geoglows:daily`; read by the inflow ensemble.
 */
export const geoglowsForecastRow = z.object({
  issued: isoDate,
  site: siteId,
  river_id: z.number().int().positive(),
  member: z.enum(["high_res"]),
  lead_days: z.number().int().min(1).max(15),
  q_m3s: z.number().finite().nonnegative(),
  store_key: z.string().min(1),
  etag: z.string(),
  fetched_at: isoTimestamp,
});
export type GeoglowsForecastRow = z.infer<typeof geoglowsForecastRow>;

export const ensoRow = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  oni: z.number().finite().min(-5).max(5),
  source: z.literal("noaa_psl:oni"),
  fetched_at: isoTimestamp,
  raw_ref: z.string().min(1),
});
export type EnsoRow = z.infer<typeof ensoRow>;

/**
 * One Ecuador circuit on one day, from XM's side of the border. Both directions sit on one row
 * because a blank hour in one direction is flow in the other (see parse/xm.ts), so the two are
 * only meaningful read together. `raw_ref` lists both archived answers the row was built from.
 */
export const xmExchangeRow = z
  .object({
    date: isoDate,
    link: z.enum(XM_LINKS),
    export_kwh: z.number().finite().nonnegative(),
    import_kwh: z.number().finite().nonnegative(),
    export_hours: z.number().int().min(0).max(24),
    import_hours: z.number().int().min(0).max(24),
    source: z.literal("xm:servapibi"),
    fetched_at: isoTimestamp,
    raw_ref: z.string().min(1),
  })
  .refine((r) => r.export_hours + r.import_hours <= 24, { message: "an hour cannot flow both ways" })
  .refine((r) => r.export_hours + r.import_hours > 0, { message: "a stored link-day has at least one published hour" });
export type XmExchangeRow = z.infer<typeof xmExchangeRow>;

/** Colombian system state, one metric per row, so each series keeps its own publication lag. */
export const xmSystemRow = z
  .object({
    date: isoDate,
    metric: z.enum(Object.keys(XM_SYSTEM_METRICS) as [XmSystemMetric, ...XmSystemMetric[]]),
    value: z.number().finite().nonnegative(),
    unit: z.enum(["fraction", "kWh", "COP/kWh"]),
    source: z.literal("xm:servapibi"),
    fetched_at: isoTimestamp,
    raw_ref: z.string().min(1),
  })
  .refine((r) => XM_SYSTEM_METRICS[r.metric].unit === r.unit, { message: "metric and unit must agree" });
export type XmSystemRow = z.infer<typeof xmSystemRow>;

/**
 * A forecast run: one origin, one target, one model, with enough of the fit recorded that the
 * run can be argued with later. The curve and the rule curve are refitted from the data every
 * time, so without these columns a forecast committed today could not be reproduced once the
 * history behind it has grown another year.
 */
export const forecastRunRow = z.object({
  run_id: z.string().min(1),
  generated_at: isoTimestamp,
  origin_date: isoDate,
  site: siteId,
  variable: variableId,
  model_id: z.string().min(1),
  model_version: z.string().min(1),
  /** Hash of the inputs; an unchanged hash means a rerun would write the same numbers. */
  features_hash: z.string().min(1),
  origin_level_masl: z.number().finite(),
  train_days: z.number().int().nonnegative(),
  balance_days: z.number().int().nonnegative(),
  analog_years: z.number().int().nonnegative(),
  backtest_origins: z.number().int().nonnegative(),
  curve_datum_m: z.number().finite(),
  curve_area_coefficient: z.number().finite(),
  curve_area_exponent: z.number().finite(),
  curve_rmse_level_m: z.number().finite().nonnegative(),
  turbine_m3s_per_mw: z.number().finite(),
  release_stance_m3s: z.number().finite(),
  crest_masl: z.number().finite(),
});
export type ForecastRunRow = z.infer<typeof forecastRunRow>;

/**
 * One quantile triple per horizon. The ensemble bounds are kept beside the published ones
 * because they are not the same thing and the difference is worth being able to see: the
 * ensemble spans what the analogue inflow years do, the published band is that widened by the
 * model's own backtest error.
 */
export const forecastValueRow = z
  .object({
    run_id: z.string().min(1),
    origin_date: isoDate,
    horizon_days: z.number().int().positive(),
    target_date: isoDate,
    p10: z.number().finite(),
    p50: z.number().finite(),
    p90: z.number().finite(),
    ensemble_p10: nullableNumber,
    ensemble_p90: nullableNumber,
    ensemble_n: z.number().int().nonnegative(),
    /**
     * The model whose median this row publishes. Since MODEL_VERSION 2 a run can publish its
     * 7-day row from M4 and the rest from M3, so the run's `model_id` no longer names every row.
     * Optional because rows written before the column existed carry it empty, which means the
     * run's own `model_id`.
     */
    model_id: z.string().min(1).optional(),
  })
  .refine((r) => r.p10 <= r.p50 && r.p50 <= r.p90, { message: "quantiles must not cross" });
export type ForecastValueRow = z.infer<typeof forecastValueRow>;

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

export const GEOGLOWS_FORECASTS: TableSpec<GeoglowsForecastRow> = {
  name: "geoglows_forecasts",
  columns: ["issued", "site", "river_id", "member", "lead_days", "q_m3s", "store_key", "etag", "fetched_at"],
  key: ["issued", "site", "member", "lead_days"],
  partitionBy: "issued",
  schema: geoglowsForecastRow,
};

export const ENSO_MONTHLY: TableSpec<EnsoRow> = {
  name: "enso_monthly",
  columns: ["month", "oni", "source", "fetched_at", "raw_ref"],
  key: ["month", "source"],
  partitionBy: "month",
  schema: ensoRow,
};

export const XM_EXCHANGE_DAILY: TableSpec<XmExchangeRow> = {
  name: "xm_exchange_daily",
  columns: ["date", "link", "export_kwh", "import_kwh", "export_hours", "import_hours", "source", "fetched_at", "raw_ref"],
  key: ["date", "link"],
  partitionBy: "date",
  schema: xmExchangeRow,
};

export const XM_SYSTEM_DAILY: TableSpec<XmSystemRow> = {
  name: "xm_system_daily",
  columns: ["date", "metric", "value", "unit", "source", "fetched_at", "raw_ref"],
  key: ["date", "metric"],
  partitionBy: "date",
  schema: xmSystemRow,
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

export const FORECAST_RUNS: TableSpec<ForecastRunRow> = {
  name: "forecast_runs",
  columns: [
    "run_id",
    "generated_at",
    "origin_date",
    "site",
    "variable",
    "model_id",
    "model_version",
    "features_hash",
    "origin_level_masl",
    "train_days",
    "balance_days",
    "analog_years",
    "backtest_origins",
    "curve_datum_m",
    "curve_area_coefficient",
    "curve_area_exponent",
    "curve_rmse_level_m",
    "turbine_m3s_per_mw",
    "release_stance_m3s",
    "crest_masl",
  ],
  key: ["run_id"],
  partitionBy: "origin_date",
  schema: forecastRunRow,
};

export const FORECAST_VALUES: TableSpec<ForecastValueRow> = {
  name: "forecast_values",
  // `model_id` is last so every earlier header is a prefix of this one.
  columns: [
    "run_id",
    "origin_date",
    "horizon_days",
    "target_date",
    "p10",
    "p50",
    "p90",
    "ensemble_p10",
    "ensemble_p90",
    "ensemble_n",
    "model_id",
  ],
  key: ["run_id", "horizon_days"],
  partitionBy: "origin_date",
  schema: forecastValueRow,
};

/**
 * One adequacy run. The ceilings are columns rather than a reference to the assumptions file
 * because the file is editable: a run committed today has to say which numbers it was standing
 * on, or a later edit would silently rewrite the past.
 */
export const adequacyRunRow = z.object({
  run_id: z.string().min(1),
  generated_at: isoTimestamp,
  origin_date: isoDate,
  model_id: z.string().min(1),
  model_version: z.string().min(1),
  features_hash: z.string().min(1),
  usable_days: z.number().int().nonnegative(),
  rejected_days: z.number().int().nonnegative(),
  demand_fit_days: z.number().int().nonnegative(),
  demand_growth_pct_per_year: z.number().finite(),
  hydro_fit_days: z.number().int().nonnegative(),
  hydro_anomaly: z.number().finite().positive(),
  thermal_gwh_day: z.number().finite().nonnegative(),
  import_gwh_day: z.number().finite().nonnegative(),
  stressed_import_gwh_day: z.number().finite().nonnegative(),
  other_gwh_day: z.number().finite().nonnegative(),
  backtest_origins: z.number().int().nonnegative(),
});
export type AdequacyRunRow = z.infer<typeof adequacyRunRow>;

export const adequacyValueRow = z
  .object({
    run_id: z.string().min(1),
    origin_date: isoDate,
    horizon_days: z.number().int().positive(),
    target_date: isoDate,
    demand_gwh_day: z.number().finite().positive(),
    hydro_gwh_day: z.number().finite(),
    requirement_gwh_day: z.number().finite(),
    requirement_p10: nullableNumber,
    requirement_p90: nullableNumber,
    deficit_gwh_day: z.number().finite(),
    deficit_p10: nullableNumber,
    deficit_p90: nullableNumber,
    stressed_deficit_gwh_day: z.number().finite(),
    margin_pct: z.number().finite(),
    tier: z.enum(["holgado", "vigilancia", "ajustado", "deficit"]),
  })
  .refine((r) => r.requirement_p10 === null || r.requirement_p90 === null || r.requirement_p10 <= r.requirement_p90, {
    message: "requirement quantiles must not cross",
  });
export type AdequacyValueRow = z.infer<typeof adequacyValueRow>;

export const ADEQUACY_RUNS: TableSpec<AdequacyRunRow> = {
  name: "adequacy_runs",
  columns: [
    "run_id",
    "generated_at",
    "origin_date",
    "model_id",
    "model_version",
    "features_hash",
    "usable_days",
    "rejected_days",
    "demand_fit_days",
    "demand_growth_pct_per_year",
    "hydro_fit_days",
    "hydro_anomaly",
    "thermal_gwh_day",
    "import_gwh_day",
    "stressed_import_gwh_day",
    "other_gwh_day",
    "backtest_origins",
  ],
  key: ["run_id"],
  partitionBy: "origin_date",
  schema: adequacyRunRow,
};

export const ADEQUACY_VALUES: TableSpec<AdequacyValueRow> = {
  name: "adequacy_values",
  columns: [
    "run_id",
    "origin_date",
    "horizon_days",
    "target_date",
    "demand_gwh_day",
    "hydro_gwh_day",
    "requirement_gwh_day",
    "requirement_p10",
    "requirement_p90",
    "deficit_gwh_day",
    "deficit_p10",
    "deficit_p90",
    "stressed_deficit_gwh_day",
    "margin_pct",
    "tier",
  ],
  key: ["run_id", "horizon_days"],
  partitionBy: "origin_date",
  schema: adequacyValueRow,
};

/**
 * One attempt at the AI narrative (Phase 6b), whatever became of it.
 *
 * A row is written for every attempt that reached the gateway or was refused by it — `ok`,
 * `rejected`, `skipped`, `failed` — and not for a rerun the payload hash made a no-op, nor for a
 * run without a key. That makes the table the spend log decision 8 asks for (monthly gateway
 * spend is the sum of `cost_usd` by month) and the audit trail for the validator: a rejected
 * row keeps the text and, in `reason`, the figures it invented.
 *
 * `risk_tier` is copied from the payload, which copied it from `adequacy.json`; it is here so
 * the row says which tier the text was asked to explain, not because the model chose it.
 * `drivers_json` is a JSON array in one cell because a CSV has no lists, and the text columns
 * are quoted by `toCsv` like any other cell containing a comma.
 */
export const narrativeSnapshotRow = z
  .object({
    run_id: z.string().min(1),
    generated_at: isoTimestamp,
    origin_date: isoDate,
    status: z.enum(["ok", "skipped", "rejected", "failed"]),
    model_id: z.string().min(1),
    prompt_version: z.string().min(1),
    payload_hash: z.string().regex(/^[0-9a-f]{64}$/, "expected a sha256 hex digest"),
    forecast_run_id: z.string(),
    adequacy_run_id: z.string(),
    risk_tier: z.union([z.enum(["holgado", "vigilancia", "ajustado", "deficit"]), z.literal("")]),
    confidence: z.union([z.enum(["low", "medium", "high"]), z.literal("")]),
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
    cost_usd: z.number().finite().nonnegative().nullable(),
    outlook_es: z.string(),
    drivers_json: z.string(),
    reason: z.string(),
  })
  .refine((r) => r.status !== "ok" || (r.outlook_es !== "" && r.confidence !== ""), {
    message: "an ok snapshot must carry its text and confidence",
  });
export type NarrativeSnapshotRow = z.infer<typeof narrativeSnapshotRow>;

export const NARRATIVE_SNAPSHOTS: TableSpec<NarrativeSnapshotRow> = {
  name: "narrative_snapshots",
  columns: [
    "run_id",
    "generated_at",
    "origin_date",
    "status",
    "model_id",
    "prompt_version",
    "payload_hash",
    "forecast_run_id",
    "adequacy_run_id",
    "risk_tier",
    "confidence",
    "input_tokens",
    "output_tokens",
    "cost_usd",
    "outlook_es",
    "drivers_json",
    "reason",
  ],
  key: ["run_id"],
  partitionBy: "generated_at",
  schema: narrativeSnapshotRow,
};

/**
 * One plant-hour of energy (§5.8), from the 24 hour-ending values `{code}EnerDia` returns per
 * plant-day — the values `parseEnerDia` sums into `produccion_mwh`, archived raw and never
 * curated until now. `date` and `hour_ending` are Ecuadorian local time, hour 24 being the hour
 * that ends at local midnight and so belongs to the day it ends. A peak-hour view of adequacy (MW
 * rather than GWh/day) needs this; nothing reads it yet, so no generated table is committed:
 * `energyHourlyFromRaw` backfills it from the raw archive when someone asks the peak question.
 */
export const energyHourlyRow = z.object({
  date: isoDate,
  hour_ending: z.number().int().min(1).max(24),
  site: siteId,
  energy_mwh: z.number().finite().nonnegative(),
  source: z.string().min(1),
  fetched_at: isoTimestamp,
  raw_ref: z.string(),
});
export type EnergyHourlyRow = z.infer<typeof energyHourlyRow>;

export const ENERGY_HOURLY: TableSpec<EnergyHourlyRow> = {
  name: "energy_hourly",
  columns: ["date", "hour_ending", "site", "energy_mwh", "source", "fetched_at", "raw_ref"],
  key: ["date", "hour_ending", "site", "source"],
  partitionBy: "date",
  schema: energyHourlyRow,
};
