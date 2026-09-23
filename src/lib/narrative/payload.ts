/**
 * What the narrative model is allowed to know: a small, deterministic digest of numbers this
 * repository has already computed.
 *
 * Decision 8 is the whole design. The model interprets and never forecasts, so everything that
 * could be a forecast — slopes, days to a threshold, the same weeks in earlier years, the §7
 * quantiles, the adequacy tier — is computed in code and handed over, and the raw daily series
 * is not. A model given ninety thousand readings will extrapolate them, and a model given the
 * p50 at thirty days has nothing to extrapolate with. The payload is also the list of every
 * number the text may quote: `validate.ts` rejects a narrative that names a level or a date
 * that is not in here, which only works if "in here" is a closed, inspectable set.
 *
 * Where the numbers come from, and why it matters that they are reused rather than recomputed:
 *
 * - **Per-reservoir level, bands and slopes are copied from `latest.json`.** `bandsFor` and
 *   `slopeOver` already made the decisions (every declared band kept, a slope that refuses to
 *   stretch over a gap); recomputing here would be a second definition that could drift.
 * - **Mazar's quantiles, thresholds and scenario crossings are copied from `forecast.json`**,
 *   including the `unverified` status of 2115. The page shows those same numbers in the fan
 *   chart, so the text and the chart cannot disagree about what the forecast said.
 * - **The risk tier is copied from `adequacy.json`.** It is an input the model must explain,
 *   never an output it may choose; see `risk_tier` below.
 * - **Three things are computed here, because nothing upstream publishes them**: days to each
 *   floor at the current slope (a division, stated as such), the same calendar window in each
 *   earlier year (read from the resolved level series), and the 16-day precipitation forecast
 *   against its ERA5 climatology. Each is a pure function below with its own test.
 *
 * **Trimmed in version 2 (§5.6).** Version 1 spent about 5.7k of a call's 6.4k input tokens on
 * the payload, two thirds of it on the seven reservoirs the text mentions in passing if at all.
 * Mazar keeps its full block; every other reservoir keeps its level, its slopes, its inflow
 * against climatology and the nearest floor, which is everything the prompt lets the text say
 * about it. Bands, the declarations behind them and the 30-day analogue summaries of the other
 * reservoirs are gone.
 *
 * **Precipitation follows §1.1.** The outlook reads the verified Mazar centroid once its ERA5
 * climatology is adequate (`selectPrecipBasin`), the provisional point until then, and the note
 * handed to the model says which.
 *
 * The payload is hashed over its canonical JSON, and the hash plus the prompt version is what
 * makes a rerun on unchanged data free: `scripts/narrative.ts` compares both against the last
 * snapshot before it calls anything. Nothing that changes without the data changing — a
 * `generated_at`, today's date — is allowed in, or every run would look new.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../store/csv.ts";
import { addDays, daysBetween, isCalendarDate, type IsoDate } from "../util/dates.ts";
import { quantile } from "../util/stats.ts";
import { roundOrNull, roundTo } from "../util/numbers.ts";
import { availableAt, phaseOf, readOni, type OniSeries } from "../features/enso.ts";
import { MAZAR_PRECIP_BASIN, PROVISIONAL_PRECIP_BASIN, selectPrecipBasin } from "../features/weather.ts";
import { loadSeries, type DailySeries, type SeriesSet } from "../features/series.ts";
import { percentileOf, type LatestDocument, type ReservoirSnapshot } from "../publish/latest.ts";
import type { AdequacyDocument, ForecastDocument, StatusDocument } from "../site/documents.ts";

/**
 * Bumped when the payload's shape changes, which also changes every hash computed from it.
 * 2: other reservoirs trimmed to what the text may say about them; precipitation basin by §1.1.
 */
export const PAYLOAD_VERSION = 2;

/** The horizons the narrative talks about. §7 publishes 60 and 90 as well; the panel does not. */
export const NARRATIVE_HORIZONS = [7, 14, 30] as const;

/** The analogue window: how far after the same calendar day each earlier year is followed. */
export const ANALOG_DAYS = 30;

/* ------------------------------------------------------------------ shapes */

export interface PayloadBand {
  floor_masl: number;
  ceiling_masl: number;
  /** Where today's level sits in this band, 0–100. The distance to the floor is in `floors`. */
  band_pct: number | null;
  metres_below_ceiling: number | null;
  /** Every source that declares this exact band, e.g. "ords:repDiaHid12m". */
  declared_by: string[];
}

export interface PayloadFloorCrossing {
  floor_masl: number;
  /** `published` for a CELEC declaration; `unverified` for this project's own 2115. */
  status: "published" | "unverified";
  metres_above: number | null;
  /**
   * Days until the level reaches the floor if the slope over the last 7 or 30 days simply
   * continued — the fastest recent pace and the steadiest one; the 14-day slope sits between
   * them and would add a number without adding a reading. Null when the level is not falling over that window. A division, not a forecast;
   * the forecast is `mazar_forecast`.
   */
  days_at_slope_7d: number | null;
  days_at_slope_30d: number | null;
}

export interface AnalogYear {
  year: number;
  level_masl: number;
  change_30d_m: number | null;
}

export interface AnalogSummary {
  /** Earlier years with a reading on this calendar day and 30 days after it. */
  years: number;
  change_30d_p10_m: number | null;
  change_30d_p50_m: number | null;
  change_30d_p90_m: number | null;
  /** Of those years, how many ended the 30 days lower than they started. */
  years_falling: number;
}

export interface PayloadReservoir {
  site: string;
  label: string;
  /** The forecast reservoir only, from here to `analog_30d`, except `floors` (nearest one for the rest). */
  basin?: string;
  level_masl: number;
  observed_on: IsoDate;
  record_from?: IsoDate;
  bands?: PayloadBand[];
  slopes_m_per_day: { d7: number | null; d14: number | null; d30: number | null };
  floors: PayloadFloorCrossing[];
  /**
   * Today's inflow against the same days of the year across the record. The p10/p90 are left
   * out: the percentile already says where today falls, and the payload has a token budget.
   */
  inflow: {
    m3s: number;
    climatology_p50_m3s?: number | null;
    percentile_today: number | null;
    climatology_years?: number | null;
  } | null;
  /** The same calendar window in earlier years, summarised. */
  analog_30d?: AnalogSummary;
  /** Year by year, for the forecast reservoir only: the one the fan chart and the text are about. */
  analog_years?: AnalogYear[];
}

export interface PayloadForecastHorizon {
  horizon_days: number;
  target_date: IsoDate;
  p10: number;
  p50: number;
  p90: number;
  /** Backtest error against assuming the level does not change; 0 is a tie, negative is losing. */
  skill_vs_persistence: number | null;
  /** Share of backtest outcomes that fell inside p10–p90, against a nominal 0.8. */
  coverage_p10_p90: number | null;
  /**
   * The model this horizon's quantiles and skill come from. The 7-day row can be M4 while the
   * rest are M3, and a text that called every row "the water balance" would misattribute it.
   */
  model_id: string;
}

export interface PayloadForecast {
  site: string;
  run_id: string;
  origin_date: IsoDate;
  model_id: string;
  level_masl: number;
  horizons: PayloadForecastHorizon[];
  scenarios: { scenario: string; analog_year: number; inflow_mean_m3s: number; minimum_level_masl: number }[];
  crossings: {
    threshold_masl: number;
    status: string;
    analogue_years: number;
    years_that_cross: number;
    p10_days: number | null;
    p50_days: number | null;
    p90_days: number | null;
    /** The named scenarios that cross within a year, and when. Absent scenarios do not cross. */
    crossing_scenarios: { scenario: string; crosses_on: IsoDate; days: number }[];
  }[];
  note: string;
}

export interface PayloadAdequacy {
  run_id: string;
  origin_date: IsoDate;
  /**
   * The tier the site shows: the worst across all published horizons. The model explains it
   * and may not substitute its own — two risk signals on one page is worse than none.
   */
  risk_tier: string;
  risk_tier_horizon_days: number;
  risk_tier_definition: string;
  tier_at_7d: string;
  hydro_anomaly: number;
  horizons: {
    horizon_days: number;
    tier: string;
    margin_pct: number;
    surplus_gwh_day: number;
    surplus_with_stressed_imports_gwh_day: number;
  }[];
  note: string;
}

export interface PayloadPrecipitation {
  basin: string;
  latitude: number;
  longitude: number;
  coordinate_status: string;
  issued_at: string;
  from: IsoDate;
  to: IsoDate;
  days: number;
  forecast_total_mm: number;
  climatology_years: number;
  climatology_p10_mm: number | null;
  climatology_p50_mm: number | null;
  climatology_p90_mm: number | null;
  /** Where the forecast total falls among the ERA5 totals for the same window, 0–100. */
  percentile_vs_climatology: number | null;
  note: string;
}

export interface PayloadEnso {
  month: string;
  oni: number;
  phase: "el_nino" | "neutral" | "la_nina";
  previous: { month: string; oni: number }[];
  note: string;
}

export interface NarrativePayload {
  payload_version: number;
  origin_date: IsoDate;
  reservoirs: PayloadReservoir[];
  mazar_forecast: PayloadForecast | null;
  adequacy: PayloadAdequacy | null;
  precipitation_16d: PayloadPrecipitation | null;
  enso: PayloadEnso | null;
  /** Feeds `status.json` does not call current. Empty is the normal case. */
  stale_feeds: { feed: string; latest: IsoDate | null; state: string }[];
}

/** The subset of a `weather_daily` row the precipitation outlook reads. */
export interface WeatherInput {
  date: IsoDate;
  basin: string;
  kind: string;
  precip_mm: string;
  issued_at: string;
}

export interface BasinRow {
  basin: string;
  latitude: string;
  longitude: string;
  coordinate_status: string;
}

export interface PayloadInputs {
  latest: LatestDocument;
  forecast: ForecastDocument | null;
  adequacy: AdequacyDocument | null;
  status: StatusDocument | null;
  /** The resolved observations; only `cota_masl` of the reservoirs in `latest` is read. */
  series: SeriesSet;
  weather: readonly WeatherInput[];
  basins: readonly BasinRow[];
  oni: OniSeries;
}

/* ------------------------------------------------------------ computations */

/**
 * Days until `metresAbove` is used up at `slope` m/day, or null when the level is not falling.
 *
 * Stated as a division on purpose: this is what "at the current slope" means and nothing more.
 * Reservoirs are operated, and the §7 model that knows it is `mazar_forecast`. A level already
 * at or below the floor is zero days away, not a negative number of days.
 */
export function daysAtSlope(metresAbove: number | null, slope: number | null): number | null {
  if (metresAbove === null || slope === null) return null;
  if (metresAbove <= 0) return 0;
  if (!(slope < 0)) return null;
  return Math.round(metresAbove / -slope);
}

/**
 * The same calendar day in every earlier year, followed for up to thirty days.
 *
 * Built the way `analogPaths` builds its inflow years — the date is constructed from parts and
 * checked with `isCalendarDate`, because `2021-02-29` otherwise parses as 1 March — but on the
 * level and without requiring every day in between: this describes where the level went, and a
 * missing Tuesday in the middle does not change where it ended.
 */
export function analogYears(levels: DailySeries, origin: IsoDate): AnalogYear[] {
  const monthDay = origin.slice(5);
  const originYear = Number(origin.slice(0, 4));
  const first = [...levels.keys()][0];
  if (first === undefined) return [];
  const out: AnalogYear[] = [];
  for (let year = Number(first.slice(0, 4)); year < originYear; year++) {
    const start = `${year}-${monthDay}`;
    if (!isCalendarDate(start)) continue;
    const level = levels.get(start);
    if (level === undefined) continue;
    const later = levels.get(addDays(start, ANALOG_DAYS));
    out.push({ year, level_masl: roundTo(level, 2), change_30d_m: later === undefined ? null : roundTo(later - level, 2) });
  }
  return out;
}

export function summariseAnalogs(years: readonly AnalogYear[]): AnalogSummary {
  const values = years.flatMap((y) => (y.change_30d_m === null ? [] : [y.change_30d_m]));
  return {
    years: values.length,
    change_30d_p10_m: roundOrNull(quantile(values, 0.1), 2),
    change_30d_p50_m: roundOrNull(quantile(values, 0.5), 2),
    change_30d_p90_m: roundOrNull(quantile(values, 0.9), 2),
    years_falling: values.filter((v) => v < 0).length,
  };
}

/**
 * Bands with identical floor and ceiling folded into one, keeping every declaration that
 * states it. Mazar's 2100–2153 is published by two report endpoints; sending it twice would
 * spend tokens to say the same thing and invite the model to count it as two pieces of
 * evidence. Order follows `bandsFor`, best-evidenced first.
 */
export function foldBands(reservoir: ReservoirSnapshot): PayloadBand[] {
  const level = reservoir.level?.masl ?? null;
  const out = new Map<string, PayloadBand>();
  for (const band of reservoir.bands) {
    const key = `${band.min_masl}|${band.max_masl}`;
    const label = band.source;
    const existing = out.get(key);
    if (existing) {
      if (!existing.declared_by.includes(label)) existing.declared_by.push(label);
      continue;
    }
    out.set(key, {
      floor_masl: band.min_masl,
      ceiling_masl: band.max_masl,
      band_pct: band.band_pct,
      metres_below_ceiling: level === null ? null : roundTo(band.max_masl - level, 2),
      declared_by: [label],
    });
  }
  return [...out.values()];
}

/**
 * Every distinct floor for a reservoir with the days to it at each slope. For the forecast
 * reservoir the forecast's own thresholds are added, which is how 2115 arrives — with its
 * `unverified` status, because no upstream source publishes it.
 */
export function floorsFor(
  reservoir: ReservoirSnapshot,
  extra: readonly { level_masl: number; status: string }[] = [],
): PayloadFloorCrossing[] {
  const level = reservoir.level?.masl ?? null;
  const floors = new Map<number, "published" | "unverified">();
  for (const band of reservoir.bands) floors.set(band.min_masl, "published");
  for (const threshold of extra) {
    if (!floors.has(threshold.level_masl)) floors.set(threshold.level_masl, threshold.status === "unverified" ? "unverified" : "published");
  }
  const slopes = reservoir.slopes_m_per_day;
  return [...floors]
    .sort(([a], [b]) => b - a)
    .map(([floor, status]) => {
      const above = level === null ? null : roundTo(level - floor, 2);
      return {
        floor_masl: floor,
        status,
        metres_above: above,
        days_at_slope_7d: daysAtSlope(above, slopes.d7),
        days_at_slope_30d: daysAtSlope(above, slopes.d30),
      };
    });
}

/**
 * The newest precipitation forecast for a basin, totalled, against the ERA5 totals for the
 * same calendar window in every complete earlier year.
 *
 * The window is taken from the forecast vintage itself — whichever days that collection
 * covers — and mapped onto each earlier year by its first day, so a window crossing New Year
 * stays contiguous. A year missing any day is dropped, for the same reason `analogPaths` drops
 * one: a total over fifteen days compared against totals over sixteen is not a comparison.
 *
 * Two different models are being compared, a forecast and a reanalysis, at a single grid
 * point that is not a basin average. The note carried with the result says both.
 */
export function precipitationOutlook(
  weather: readonly WeatherInput[],
  basin: string,
  basinRow: BasinRow | undefined,
): PayloadPrecipitation | null {
  let vintage = "";
  for (const row of weather) {
    if (row.basin === basin && row.kind === "forecast" && row.issued_at > vintage) vintage = row.issued_at;
  }
  if (!vintage) return null;

  const forecast = weather
    .filter((r) => r.basin === basin && r.kind === "forecast" && r.issued_at === vintage && r.precip_mm !== "")
    .map((r) => ({ date: r.date, mm: Number(r.precip_mm) }))
    .filter((r) => Number.isFinite(r.mm))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (forecast.length === 0) return null;
  const from = forecast[0]!.date;
  const to = forecast.at(-1)!.date;
  const days = forecast.length;
  // A vintage with a hole in it is not compared at all: its total would be over fewer days than
  // the climatology it is set against, and the percentile would read drier than the forecast.
  if (daysBetween(from, to) + 1 !== days) return null;
  const total = forecast.reduce((sum, r) => sum + r.mm, 0);

  const era5 = new Map<IsoDate, number>();
  for (const row of weather) {
    if (row.basin !== basin || row.kind !== "era5" || row.precip_mm === "") continue;
    const mm = Number(row.precip_mm);
    if (Number.isFinite(mm)) era5.set(row.date, mm);
  }

  const totals: number[] = [];
  let firstYear = Infinity;
  for (const date of era5.keys()) firstYear = Math.min(firstYear, Number(date.slice(0, 4)));
  const vintageYear = Number(from.slice(0, 4));
  for (let year = firstYear; Number.isFinite(year) && year < vintageYear; year++) {
    const start = `${year}-${from.slice(5)}`;
    if (!isCalendarDate(start)) continue;
    let sum = 0;
    let complete = true;
    for (let offset = 0; offset < days; offset++) {
      const mm = era5.get(addDays(start, offset));
      if (mm === undefined) {
        complete = false;
        break;
      }
      sum += mm;
    }
    if (complete) totals.push(sum);
  }

  return {
    basin,
    latitude: Number(basinRow?.latitude ?? NaN),
    longitude: Number(basinRow?.longitude ?? NaN),
    coordinate_status: basinRow?.coordinate_status || "unknown",
    issued_at: vintage,
    from,
    to,
    days,
    forecast_total_mm: roundTo(total, 1),
    climatology_years: totals.length,
    climatology_p10_mm: roundOrNull(quantile(totals, 0.1), 1),
    climatology_p50_mm: roundOrNull(quantile(totals, 0.5), 1),
    climatology_p90_mm: roundOrNull(quantile(totals, 0.9), 1),
    percentile_vs_climatology: roundOrNull(percentileOf(totals, total), 0),
    note:
      basinRow?.coordinate_status === "verified"
        ? "Un solo punto, el centroide verificado de la cuenca, no un promedio de la cuenca; pronóstico Open-Meteo frente a climatología ERA5."
        : "Un solo punto provisional, no un promedio de la cuenca; pronóstico Open-Meteo frente a climatología ERA5.",
  };
}

/** The newest ONI a reader could have on the origin date, and the two before it. */
export function ensoAt(oni: OniSeries, origin: IsoDate): PayloadEnso | null {
  const now = availableAt(oni, origin);
  if (now === null) return null;
  const earlier = [...oni.entries()]
    .filter(([month]) => month < now.month)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 2)
    .map(([month, value]) => ({ month, oni: value }));
  return {
    month: now.month,
    oni: now.oni,
    phase: phaseOf(now.oni),
    previous: earlier,
    note: "Fase por el umbral de NOAA sobre el último ONI publicado, que siempre tiene unos dos meses de retraso.",
  };
}

function forecastBlock(forecast: ForecastDocument): PayloadForecast {
  const horizons = forecast.forecast
    .filter((h) => (NARRATIVE_HORIZONS as readonly number[]).includes(h.horizon_days))
    .map((h) => {
      const score = forecast.backtest.horizons.find((b) => b.horizon_days === h.horizon_days);
      return {
        horizon_days: h.horizon_days,
        target_date: h.target_date,
        p10: h.p10,
        p50: h.p50,
        p90: h.p90,
        skill_vs_persistence: score ? roundTo(score.skill_vs_persistence, 3) : null,
        coverage_p10_p90: score ? roundTo(score.coverage_p10_p90, 2) : null,
        // Documents written before the per-horizon switch name one model for every row.
        model_id: h.model ?? forecast.model.id,
      };
    });

  // The three named scenarios are the same inflow years for every threshold; only where each
  // crosses differs. Stated once, then referenced, rather than repeated per threshold.
  const firstThreshold = forecast.days_to_threshold.thresholds[0];
  const scenarios = (firstThreshold?.scenarios ?? []).map((s) => ({
    scenario: s.scenario,
    analog_year: s.analogYear,
    inflow_mean_m3s: s.inflowMeanM3s,
    minimum_level_masl: s.minimumLevelMasl,
  }));

  return {
    site: forecast.site,
    run_id: forecast.run_id,
    origin_date: forecast.origin_date,
    model_id: forecast.model.id,
    level_masl: forecast.current.level_masl,
    horizons,
    scenarios,
    crossings: forecast.days_to_threshold.thresholds.map((t) => ({
      threshold_masl: t.level_masl,
      status: t.status,
      analogue_years: t.across_all_analogue_years.analogue_years,
      years_that_cross: t.across_all_analogue_years.years_that_cross,
      p10_days: t.across_all_analogue_years.p10_days,
      p50_days: t.across_all_analogue_years.p50_days,
      p90_days: t.across_all_analogue_years.p90_days,
      crossing_scenarios: t.scenarios.flatMap((s) =>
        s.crossesOn === null || s.days === null ? [] : [{ scenario: s.scenario, crosses_on: s.crossesOn, days: s.days }],
      ),
    })),
    note: "Pronóstico estadístico (§7) con años análogos de caudal. 2115 es un marcador propio del proyecto, no de CELEC.",
  };
}

function adequacyBlock(adequacy: AdequacyDocument): PayloadAdequacy {
  const worst = adequacy.current.worst_tier;
  return {
    run_id: adequacy.run_id,
    origin_date: adequacy.origin_date,
    risk_tier: worst,
    risk_tier_horizon_days: adequacy.current.worst_tier_horizon_days,
    risk_tier_definition: adequacy.tiers?.definition[worst] ?? "",
    tier_at_7d: adequacy.current.tier,
    hydro_anomaly: adequacy.data.hydro_anomaly,
    horizons: adequacy.horizons
      // The week, the month, and wherever the worst tier falls: the three the text can explain.
      .filter((h) => h.horizon_days === 7 || h.horizon_days === 30 || h.horizon_days === adequacy.current.worst_tier_horizon_days)
      .map((h) => ({
        horizon_days: h.horizon_days,
        tier: h.tier,
        margin_pct: h.margin_pct,
        // Published as a deficit; turned into a surplus here so a positive number reads as
        // "enough", which is how the site's table prints it too.
        surplus_gwh_day: roundTo(-h.deficit_gwh_day, 3),
        surplus_with_stressed_imports_gwh_day: roundTo(-h.stressed_deficit_gwh_day, 3),
      })),
    note: "Nivel calculado por el modelo de suficiencia (§7). hydro_anomaly: hidroeléctrica de 14 días / su climatología.",
  };
}

function reservoirBlock(reservoir: ReservoirSnapshot, inputs: PayloadInputs, forecastSite: string | null): PayloadReservoir | null {
  const level = reservoir.level;
  if (level === null) return null;
  const isForecastSite = reservoir.site === forecastSite;
  const inflow = reservoir.inflow;
  if (!isForecastSite) {
    // Everything the prompt lets the text say about a reservoir it does not forecast.
    const nearest = floorsFor(reservoir)[0];
    return {
      site: reservoir.site,
      label: reservoir.label,
      level_masl: level.masl,
      observed_on: level.date,
      slopes_m_per_day: reservoir.slopes_m_per_day,
      floors: nearest ? [nearest] : [],
      inflow: inflow && { m3s: inflow.m3s, percentile_today: inflow.climatology?.percentile_today ?? null },
    };
  }
  const years = analogYears(inputs.series.get(reservoir.site, "cota_masl"), level.date);
  const out: PayloadReservoir = {
    site: reservoir.site,
    label: reservoir.label,
    basin: reservoir.basin,
    level_masl: level.masl,
    observed_on: level.date,
    record_from: level.first_reading,
    bands: foldBands(reservoir),
    slopes_m_per_day: reservoir.slopes_m_per_day,
    floors: floorsFor(reservoir, isForecastSite ? (inputs.forecast?.thresholds ?? []) : []),
    inflow: inflow && {
      m3s: inflow.m3s,
      climatology_p50_m3s: inflow.climatology?.p50 ?? null,
      percentile_today: inflow.climatology?.percentile_today ?? null,
      climatology_years: inflow.climatology?.years ?? null,
    },
    analog_30d: summariseAnalogs(years),
  };
  out.analog_years = years;
  return out;
}

/* ------------------------------------------------------------------ builder */

export function buildPayload(inputs: PayloadInputs): NarrativePayload {
  const forecastSite = inputs.forecast?.site ?? null;
  const reservoirs = inputs.latest.reservoirs
    .map((r) => reservoirBlock(r, inputs, forecastSite))
    .filter((r): r is PayloadReservoir => r !== null);

  // The origin is the day the statistical forecast stands on when there is one, so the text's
  // "today" and the fan chart's are the same day; otherwise the newest level reading.
  const origin =
    inputs.forecast?.origin_date ??
    reservoirs.map((r) => r.observed_on).sort().at(-1) ??
    inputs.latest.as_of;

  // §1.1: the verified Mazar centroid once its ERA5 climatology is adequate, else the provisional point.
  const era5 = new Map<string, Map<IsoDate, number>>();
  for (const row of inputs.weather) {
    if (row.kind !== "era5" || row.precip_mm === "") continue;
    const mm = Number(row.precip_mm);
    if (!Number.isFinite(mm)) continue;
    (era5.get(row.basin) ?? era5.set(row.basin, new Map()).get(row.basin)!).set(row.date, mm);
  }
  const precipBasin = selectPrecipBasin(era5, MAZAR_PRECIP_BASIN, PROVISIONAL_PRECIP_BASIN).basin;
  const basinRow = inputs.basins.find((b) => b.basin === precipBasin);

  return {
    payload_version: PAYLOAD_VERSION,
    origin_date: origin,
    reservoirs,
    mazar_forecast: inputs.forecast ? forecastBlock(inputs.forecast) : null,
    adequacy: inputs.adequacy ? adequacyBlock(inputs.adequacy) : null,
    precipitation_16d: precipitationOutlook(inputs.weather, precipBasin, basinRow),
    enso: ensoAt(inputs.oni, origin),
    stale_feeds: (inputs.status?.feeds ?? [])
      .filter((f) => f.state !== "current")
      .map((f) => ({ feed: f.feed, latest: f.latest, state: f.state })),
  };
}

/* ------------------------------------------------------------------- hashing */

/**
 * JSON with object keys sorted at every depth, so the same payload always serialises to the
 * same bytes whatever order the code happened to build it in. Arrays keep their order: the
 * order of reservoirs or horizons is part of what the payload says.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) sorted[key] = (item as Record<string, unknown>)[key];
    return sorted;
  });
}

/** Full sha256, hex. The snapshot table stores all 64 characters; the run id uses eight. */
export function payloadHash(payload: NarrativePayload): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

/**
 * A rough token count, for the dry-run log and nothing else: about four characters a token for
 * JSON that is mostly numbers and short keys. The gateway's own count is what the snapshot
 * records.
 */
export function estimateTokens(payload: NarrativePayload): number {
  return Math.ceil(canonicalJson(payload).length / 4);
}

/* ----------------------------------------------------------------- reading */

function readTableDir(directory: string): Record<string, string>[] {
  if (!existsSync(directory)) return [];
  const rows: Record<string, string>[] = [];
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    rows.push(...parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  return rows;
}

export function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

/** `weather_daily` under a curated root, as the narrow rows the outlook reads. */
export function readWeather(curatedRoot: string): WeatherInput[] {
  return readTableDir(join(curatedRoot, "weather_daily")).map((r) => ({
    date: r["date"] ?? "",
    basin: r["basin"] ?? "",
    kind: r["kind"] ?? "",
    precip_mm: r["precip_mm"] ?? "",
    issued_at: r["issued_at"] ?? "",
  }));
}

export function readBasins(path: string): BasinRow[] {
  return existsSync(path) ? (parseCsv(readFileSync(path, "utf8")) as unknown as BasinRow[]) : [];
}

/**
 * Everything `buildPayload` reads, from disk. The roots are parameters so the fixture test and
 * the CLI go through the same function: the test points it at a known day under
 * `tests/fixtures/narrative/`, the CLI at the repository. Returns null without `latest.json`,
 * because a narrative with no reservoirs in it has nothing to be about.
 */
export function loadPayloadInputs(roots: { curated: string; api: string; basins: string }): PayloadInputs | null {
  const latest = readJson<LatestDocument>(join(roots.api, "latest.json"));
  if (latest === null) return null;
  return {
    latest,
    forecast: readJson<ForecastDocument>(join(roots.api, "forecast.json")),
    adequacy: readJson<AdequacyDocument>(join(roots.api, "adequacy.json")),
    status: readJson<StatusDocument>(join(roots.api, "status.json")),
    series: loadSeries(roots.curated),
    weather: readWeather(roots.curated),
    basins: readBasins(roots.basins),
    oni: readOni(roots.curated),
  };
}
