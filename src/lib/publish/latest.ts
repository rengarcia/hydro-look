/**
 * `latest.json` — the current state of the fleet, small enough to fetch from a phone.
 *
 * This is the one document the site's tiles are built from, and the only one a third party
 * needs in order to answer "how full is Mazar, and what is the country burning tonight?"
 * without cloning the repository. Everything in it is derived from the committed tables by
 * the pure functions below; nothing here touches the network, and nothing here models.
 * The forecast lives in `forecast.json` and the gates in `status.json` — this document
 * points at both rather than restating them, so there is one place for each number.
 *
 * Two decisions are worth stating because they shape every field.
 *
 * **The window is the reservoir's own history, not a fixed number of years.** A climatology
 * band computed over three years and one computed over twelve are different claims, so each
 * one carries `years` and the day count behind it. Minas San Francisco's inflow starts in
 * 2018 and Mazar's in 2010; showing them on the same axis without saying so would invite a
 * comparison the data does not support.
 *
 * **A band position is not a storage percentage.** `nivel_pct_banda` is published by the ORDS
 * as "% de volumen útil" and is exactly `(cota − min) / (max − min)` — see `registry.ts`. It is
 * recomputed here from the level and the declared band rather than copied, so the document
 * never carries a number whose definition it cannot state, and it is named `band_pct` so the
 * name itself resists the misreading.
 */

import { roundOrNull, roundTo } from "../util/numbers.ts";
import { addDays, type IsoDate } from "../util/dates.ts";
import { SITES, type SiteId } from "../registry.ts";
import { bandForDayOfYear, binByDayOfYear, sampleForDate } from "../features/climatology.ts";
import { dayOfYear } from "../util/stats.ts";
import type { DailySeries, SeriesSet } from "../features/series.ts";
import { declarationCode, tierCode, withContract, NARRATIVE_TIER_FIELD, TIER_CODES, type ContractFields } from "./contract.ts";
import {
  annualMaxima,
  gumbelReturnPeriods,
  RETURN_PERIODS,
  returnPeriodReached,
  roundTable,
  type ReturnPeriodValue,
} from "../geo/geoglows.ts";

export interface ThresholdRow {
  site: string;
  cota_min_masl: string;
  cota_max_masl: string;
  declaration: string;
  source: string;
  observed_from: string;
  observed_to: string;
}

export interface BandDeclaration {
  min_masl: number;
  max_masl: number;
  /** How CELEC declared it, as a code: `report_endpoint` or `dashboard_chart_title`. */
  declaration: string;
  /** The same, in the page's words. */
  declaration_es: string;
  source: string;
  observed_from: string;
  observed_to: string;
  /** Where the current level sits in this declaration's band, 0–100 and occasionally outside it. */
  band_pct: number | null;
  /** Metres between the current level and this declaration's floor; negative means below it. */
  metres_above_min: number | null;
}

/** A row of `data/reference/geoglows_return_periods.csv`, written by `npm run geoglows`. */
export type GeoglowsRow = Record<string, string>;

/**
 * Reservoirs whose "inflow" is not a river, so a flood return period means nothing there.
 * Sopladora's is Molino's turbine discharge — identical to six decimals on all 116 days both are
 * published — and so is capped by Molino's turbines, whatever the Paute does.
 */
export const NO_RIVER_INFLOW: Partial<Record<SiteId, string>> = {
  sopladora: "fed by Molino's tailrace: its inflow is Molino's turbined flow, not a river's",
};

/** Fewer complete years of inflow than this, and the measured return periods are not fitted. */
export const MIN_MEASURED_YEARS = 5;

/**
 * How today's inflow compares with the floods the river is known for, from two sources that are
 * kept apart because they disagree: GEOGLOWS' model, which INAMHI's portal shows, and the same
 * statistic fitted on CELEC's own record. Neither is preferred here; the page says how far apart
 * they are, and `data/reports/return-periods.md` says where each one is trustworthy.
 */
export interface ReturnPeriods {
  geoglows: {
    river_id: number;
    /**
     * What INAMHI's Hydroviewer draws for this river: a Gumbel fit on the annual maxima of
     * GEOGLOWS' daily simulation from 1980, m³/s. The thresholds `reached_years` is read against.
     */
    inamhi: ReturnPeriodValue[];
    /** The GEOGLOWS store's own fit on the daily simulation from 1940, m³/s. */
    daily: ReturnPeriodValue[];
    /** The same on hourly flow: the thresholds the Hydroviewer colours rivers by. */
    hourly: ReturnPeriodValue[];
    /** GEOGLOWS' downstream drainage area against the catchment this repository delineated, %. */
    area_diff_pct: number;
    store_revision_date: string;
    /** The longest of INAMHI's return periods today's inflow reaches; null below the 2-year flow. */
    reached_years: number | null;
    /**
     * How the model's simulated daily flow compares with CELEC's measured inflow on the days both
     * have: mean simulated ÷ mean measured, and the correlation of monthly means. Null before
     * `npm run geoglows` has compared them.
     */
    simulated_vs_measured: { days: number; ratio: number; r_monthly: number | null } | null;
  } | null;
  measured: {
    /** Complete calendar years (≥ 330 readings) whose maxima the fit is on. */
    years: number;
    first_year: number;
    last_year: number;
    values: ReturnPeriodValue[];
    reached_years: number | null;
    /** The largest daily inflow on record and its day. */
    record_m3s: number;
    record_date: IsoDate;
  } | null;
}

export interface Climatology {
  p10: number;
  p50: number;
  p90: number;
  /** Distinct calendar years contributing to the window. */
  years: number;
  /** Readings in the window, across all those years. */
  n: number;
  /** Where today's value falls in that sample, 0–100. Null when there is no current reading. */
  percentile_today: number | null;
}

export interface ReservoirSnapshot {
  site: string;
  label: string;
  basin: string;
  level: {
    masl: number;
    date: IsoDate;
    first_reading: IsoDate;
    days: number;
    /**
     * The lowest and highest level this repository has ever recorded here.
     *
     * Coca Codo Sinclair, Agoyán and Manduriacu reach us through the historian, and no source
     * declares an operating band for any of them — `thresholds.csv` has no row to offer. A
     * gauge still has to have an axis, so it falls back to this, which is a description of what
     * has been seen and not a statement about what the reservoir may do.
     */
    observed_min_masl: number;
    observed_max_masl: number;
    /** The reading of the day before `date`, when that exact day was read; never an older one. */
    previous: { masl: number; date: IsoDate } | null;
    /** `masl − previous.masl`, metres; null without a previous reading. */
    delta_1d_m: number | null;
  } | null;
  /** Every band CELEC declares for this reservoir. They disagree, so all of them are kept. */
  bands: BandDeclaration[];
  slopes_m_per_day: { d7: number | null; d14: number | null; d30: number | null };
  inflow: {
    m3s: number;
    date: IsoDate;
    first_reading: IsoDate;
    days: number;
    climatology: Climatology | null;
    previous: { m3s: number; date: IsoDate } | null;
    delta_1d_m3s: number | null;
    return_periods: ReturnPeriods;
  } | null;
}

export interface NationalSnapshot {
  date: IsoDate;
  /** Generation by type plus imports, in GWh, largest first. */
  supply_gwh: { concept: string; gwh: number; pct: number }[];
  total_generation_gwh: number | null;
  total_import_gwh: number | null;
  total_export_gwh: number | null;
  distribution_demand_gwh: number | null;
  transport_losses_gwh: number | null;
  /** Share of the day's supply that came from water, 0–100. The headline number of the page. */
  hydro_share_pct: number | null;
  /** Share that came from burning something, 0–100. */
  thermal_share_pct: number | null;
  /** Share imported from Colombia and Peru, 0–100. */
  import_share_pct: number | null;
  /** The closed day before `date`, when SMEC published it, and the change since. */
  previous: NationalPrevious | null;
  delta_1d: {
    hydro_share_pct_points: number | null;
    thermal_share_pct_points: number | null;
    import_share_pct_points: number | null;
    total_generation_gwh: number | null;
  } | null;
}

export interface NationalPrevious {
  date: IsoDate;
  total_generation_gwh: number | null;
  total_import_gwh: number | null;
  hydro_share_pct: number | null;
  thermal_share_pct: number | null;
  import_share_pct: number | null;
}

/**
 * The adequacy headline, copied from `adequacy.json` rather than recomputed.
 *
 * Copied, because two documents computing the same tier from the same tables would eventually
 * disagree — after a model change, or a half-finished run — and a site showing two risk signals
 * at once is worse than one showing none. `adequacy.json` owns the number; this carries it and
 * says where it came from.
 */
export interface AdequacySummary {
  origin_date: IsoDate;
  /** Tier at the shortest published horizon: the model's Spanish word, kept for schema version 1. */
  tier: string;
  /** The same tier as a stable English code: `comfortable`, `watch`, `tight` or `deficit`. */
  tier_code: string;
  tier_label_es: string;
  /** The worst tier across all horizons, and where it falls. */
  worst_tier: string;
  worst_tier_code: string;
  worst_tier_label_es: string;
  worst_tier_horizon_days: number;
  /** Which of the two tiers the daily narrative is written about: always `worst_tier`. */
  narrative_tier_field: string;
  /** GWh/day, censored at zero: a surplus is not a negative deficit. */
  worst_deficit_gwh_day: number;
  run_id: string;
}

export interface LatestDocument extends ContractFields {
  generated_at: string;
  /** The newest day a reservoir level or a closed national balance describes. */
  data_date: IsoDate | null;
  /** Deprecated: the day the job ran, a day after every reading in the document. */
  as_of: IsoDate;
  disclaimer: string;
  reservoirs: ReservoirSnapshot[];
  national: NationalSnapshot | null;
  adequacy: AdequacySummary | null;
  see_also: Record<string, string>;
}

/**
 * The same definition of a slope the forecast document publishes: the straight mean over the
 * trailing window, not a regression. A missing endpoint returns null rather than reaching for
 * the nearest day it can find — a 7-day slope measured over 9 days is not a 7-day slope.
 */
export function slopeOver(levels: DailySeries, origin: IsoDate, days: number): number | null {
  const now = levels.get(origin);
  const then = levels.get(addDays(origin, -days));
  return now === undefined || then === undefined ? null : (now - then) / days;
}

/**
 * The share of `sample` at or below `value`, as a percentage.
 *
 * Ties count as "at or below", so a day sitting exactly on the historical median reads 50-ish
 * rather than 0. An empty sample has no percentile.
 */
export function percentileOf(sample: readonly number[], value: number): number | null {
  if (sample.length === 0) return null;
  let atOrBelow = 0;
  for (const item of sample) if (item <= value) atOrBelow++;
  return (atOrBelow / sample.length) * 100;
}

/**
 * The band for the day `date` falls on, with today's reading placed inside it.
 *
 * The pooling itself lives in `features/climatology.ts` so that this tile and the ribbon the
 * site draws behind a year of readings are the same computation; see that module for why the
 * window is circular and why the current year is in it.
 */
export function climatologyFor(series: DailySeries, date: IsoDate, today: number | null): Climatology | null {
  const band = bandForDayOfYear(binByDayOfYear(series), dayOfYear(date));
  if (band === null) return null;
  return {
    p10: roundTo(band.p10, 2),
    p50: roundTo(band.p50, 2),
    p90: roundTo(band.p90, 2),
    years: band.years,
    n: band.n,
    percentile_today: today === null ? null : roundOrNull(percentileOf(sampleForDate(series, date), today), 1),
  };
}

const tableFrom = (row: GeoglowsRow, suffix: string): ReturnPeriodValue[] =>
  RETURN_PERIODS.map((years) => ({ years, m3s: Number(row[`q${years}${suffix}_m3s`]) }));

export function returnPeriodsFor(inflow: DailySeries, today: number, row: GeoglowsRow | undefined): ReturnPeriods {
  const inamhi = row ? tableFrom(row, "_inamhi") : null;
  const daily = row ? tableFrom(row, "") : null;
  const hourly = row ? tableFrom(row, "_hourly") : null;
  const finite = (t: ReturnPeriodValue[] | null): t is ReturnPeriodValue[] => t !== null && t.every((v) => Number.isFinite(v.m3s));
  const simDays = Number(row?.["sim_days"]);
  const geoglows =
    row && finite(inamhi) && finite(daily) && finite(hourly)
      ? {
          river_id: Number(row["river_id"]),
          inamhi,
          daily,
          hourly,
          area_diff_pct: Number(row["area_diff_pct"]),
          store_revision_date: row["store_revision_date"] ?? "",
          reached_years: returnPeriodReached(today, inamhi),
          simulated_vs_measured:
            simDays > 0
              ? {
                  days: simDays,
                  ratio: Number(row["sim_ratio"]),
                  r_monthly: row["sim_r_monthly"] ? Number(row["sim_r_monthly"]) : null,
                }
              : null,
        }
      : null;
  const maxima = annualMaxima(inflow);
  let record: { m3s: number; date: IsoDate } | null = null;
  for (const [date, m3s] of inflow) if (record === null || m3s > record.m3s) record = { m3s, date };
  const values = maxima.length >= MIN_MEASURED_YEARS ? roundTable(gumbelReturnPeriods(maxima.map((m) => m.m3s))) : null;
  return {
    geoglows,
    measured:
      values && record
        ? {
            years: maxima.length,
            first_year: maxima[0]!.year,
            last_year: maxima.at(-1)!.year,
            values,
            reached_years: returnPeriodReached(today, values),
            record_m3s: roundTo(record.m3s, 2),
            record_date: record.date,
          }
        : null,
  };
}

/**
 * Every band declared for a site, best-evidenced first.
 *
 * All of them are kept because they disagree and nothing in the data settles which is right:
 * Mazar's floor is 2098 by the dashboard's chart title and 2100 by both report endpoints.
 * Picking one here would hide the disagreement behind a tidy gauge; carrying both makes the
 * site draw two floors, which is the truth.
 *
 * The order is by how long the declaration was observed, longest first, and that is a claim
 * about evidence rather than about correctness. A chart title is a string in a JavaScript
 * bundle, read once, so it spans a single day; `repDiaHid12m` restated its band on every one of
 * 4,384 days from 2014-09-20. Neither is thereby right — CELEC publishes both — but the first
 * is the band the fleet was actually reported against, which is the one a gauge should default
 * to drawing. Ties break on the floor so the order is stable across runs.
 */
export function bandsFor(rows: readonly ThresholdRow[], site: string, level: number | null): BandDeclaration[] {
  const out: BandDeclaration[] = [];
  for (const row of rows) {
    if (row.site !== site) continue;
    const min = Number(row.cota_min_masl);
    const max = Number(row.cota_max_masl);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) continue;
    const declared = declarationCode(row.declaration);
    out.push({
      min_masl: min,
      max_masl: max,
      declaration: declared.code,
      declaration_es: declared.label_es,
      source: row.source,
      observed_from: row.observed_from,
      observed_to: row.observed_to,
      band_pct: level === null ? null : roundTo(((level - min) / (max - min)) * 100, 2),
      metres_above_min: level === null ? null : roundTo(level - min, 2),
    });
  }
  return out.sort((a, b) => spanDays(b) - spanDays(a) || a.min_masl - b.min_masl);
}

/** Days a declaration was observed over, inclusive. Unparseable dates count as a single day. */
function spanDays(band: BandDeclaration): number {
  const from = Date.parse(`${band.observed_from}T00:00:00Z`);
  const to = Date.parse(`${band.observed_to}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, (to - from) / 86_400_000 + 1) : 1;
}

function lastOf(series: DailySeries): { date: IsoDate; value: number } | null {
  let date: IsoDate | null = null;
  for (const key of series.keys()) date = key;
  return date === null ? null : { date, value: series.get(date)! };
}

/** The reading of the calendar day before `date`, or null when that day was not read. */
export function previousOf(series: DailySeries, date: IsoDate): { date: IsoDate; value: number } | null {
  const day = addDays(date, -1);
  const value = series.get(day);
  return value === undefined ? null : { date: day, value };
}

function firstOf(series: DailySeries): IsoDate | null {
  for (const key of series.keys()) return key;
  return null;
}

/**
 * `[min, max]` over a series, by iteration rather than `Math.min(...values)`: these series grow
 * by a row a day and spreading one into an argument list is a stack overflow with a date on it.
 */
function rangeOf(series: DailySeries): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of series.values()) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

export function reservoirSnapshot(
  series: SeriesSet,
  site: SiteId,
  thresholds: readonly ThresholdRow[],
  geoglows: readonly GeoglowsRow[] = [],
): ReservoirSnapshot {
  const levels = series.get(site, "cota_masl");
  const inflow = series.get(site, "caudal_m3s");
  const lastLevel = lastOf(levels);
  const lastInflow = lastOf(inflow);
  const meta = SITES[site];
  const levelBefore = lastLevel && previousOf(levels, lastLevel.date);
  const inflowBefore = lastInflow && previousOf(inflow, lastInflow.date);

  return {
    site,
    label: meta.label,
    basin: meta.basin,
    level: lastLevel && {
      masl: roundTo(lastLevel.value, 2),
      date: lastLevel.date,
      first_reading: firstOf(levels)!,
      days: levels.size,
      observed_min_masl: roundTo(rangeOf(levels)[0], 2),
      observed_max_masl: roundTo(rangeOf(levels)[1], 2),
      previous: levelBefore && { masl: roundTo(levelBefore.value, 2), date: levelBefore.date },
      delta_1d_m: levelBefore ? roundTo(lastLevel.value - levelBefore.value, 2) : null,
    },
    bands: bandsFor(thresholds, site, lastLevel?.value ?? null),
    slopes_m_per_day: lastLevel
      ? {
          d7: roundOrNull(slopeOver(levels, lastLevel.date, 7), 4),
          d14: roundOrNull(slopeOver(levels, lastLevel.date, 14), 4),
          d30: roundOrNull(slopeOver(levels, lastLevel.date, 30), 4),
        }
      : { d7: null, d14: null, d30: null },
    inflow: lastInflow && {
      m3s: roundTo(lastInflow.value, 2),
      date: lastInflow.date,
      first_reading: firstOf(inflow)!,
      days: inflow.size,
      climatology: climatologyFor(inflow, lastInflow.date, lastInflow.value),
      previous: inflowBefore && { m3s: roundTo(inflowBefore.value, 2), date: inflowBefore.date },
      delta_1d_m3s: inflowBefore ? roundTo(lastInflow.value - inflowBefore.value, 2) : null,
      return_periods: NO_RIVER_INFLOW[site]
        ? { geoglows: null, measured: null }
        : returnPeriodsFor(
            inflow,
            lastInflow.value,
            geoglows.find((r) => r["site"] === site),
          ),
    },
  };
}

/** SMEC's generation concepts, in the order the site stacks them: water first, then fuel. */
export const GENERATION_CONCEPTS = [
  "generacion_hidraulica",
  "generacion_turbinas_gas",
  "generacion_motores_bunker",
  "generacion_vapor_bunker",
  "generacion_turbinas_diesel",
  "generacion_otros_tipos",
] as const;

const THERMAL_CONCEPTS = new Set<string>([
  "generacion_turbinas_gas",
  "generacion_motores_bunker",
  "generacion_vapor_bunker",
  "generacion_turbinas_diesel",
]);

export interface BalanceRow {
  date: string;
  concepto: string;
  dia_kwh: string;
}

/** `date -> concept -> GWh`, from the long national table. */
export function balanceByDay(rows: readonly BalanceRow[]): Map<IsoDate, Map<string, number>> {
  const out = new Map<IsoDate, Map<string, number>>();
  for (const row of rows) {
    const kwh = Number(row.dia_kwh);
    if (!row.date || !row.concepto || !Number.isFinite(kwh)) continue;
    const day = out.get(row.date) ?? out.set(row.date, new Map()).get(row.date)!;
    day.set(row.concepto, kwh / 1e6);
  }
  return out;
}

/** The most recent day SMEC has closed, as a supply mix, with the day before it beside it. */
export function nationalSnapshot(byDay: Map<IsoDate, Map<string, number>>): NationalSnapshot | null {
  let latest: IsoDate | null = null;
  for (const date of byDay.keys()) if (latest === null || date > latest) latest = date;
  if (latest === null) return null;

  const today = dayOf(byDay.get(latest)!);
  // Only the calendar day before counts as "yesterday": after a gap in SMEC's record, the
  // previous closed day could be a week back, and a delta across a week is not "since yesterday".
  const before = byDay.get(addDays(latest, -1));
  const yesterday = before ? dayOf(before) : null;
  const diff = (a: number | null, b: number | null | undefined, places: number): number | null =>
    a === null || b === null || b === undefined ? null : roundTo(a - b, places);

  return {
    date: latest,
    supply_gwh: today.parts,
    total_generation_gwh: today.totalGeneration,
    total_import_gwh: today.totalImport,
    total_export_gwh: today.totalExport,
    distribution_demand_gwh: today.demand,
    transport_losses_gwh: today.losses,
    hydro_share_pct: today.hydro,
    thermal_share_pct: today.thermal,
    import_share_pct: today.imports,
    previous: yesterday && {
      date: addDays(latest, -1),
      total_generation_gwh: yesterday.totalGeneration,
      total_import_gwh: yesterday.totalImport,
      hydro_share_pct: yesterday.hydro,
      thermal_share_pct: yesterday.thermal,
      import_share_pct: yesterday.imports,
    },
    delta_1d: yesterday && {
      hydro_share_pct_points: diff(today.hydro, yesterday.hydro, 2),
      thermal_share_pct_points: diff(today.thermal, yesterday.thermal, 2),
      import_share_pct_points: diff(today.imports, yesterday.imports, 2),
      total_generation_gwh: diff(today.totalGeneration, yesterday.totalGeneration, 3),
    },
  };
}

/**
 * One closed day as shares and totals.
 *
 * Shares are taken over generation *plus* imports rather than over generation alone, because
 * the question the tile answers is where the country's electricity came from, and an imported
 * kWh is as real as a generated one. On a day when Colombia is covering the evening peak the
 * two denominators differ by several percent, so the choice is stated here rather than left to
 * be reverse-engineered from the numbers.
 */
function dayOf(day: Map<string, number>) {
  const value = (concept: string): number | null => day.get(concept) ?? null;

  const imports = value("total_importacion") ?? 0;
  const supply = (value("total_generacion") ?? 0) + imports;
  const share = (gwh: number | null): number | null => (gwh === null || supply <= 0 ? null : roundTo((gwh / supply) * 100, 2));

  const parts: { concept: string; gwh: number; pct: number }[] = [];
  for (const concept of [...GENERATION_CONCEPTS, "total_importacion"]) {
    const gwh = value(concept);
    if (gwh === null) continue;
    parts.push({ concept, gwh: roundTo(gwh, 3), pct: share(gwh) ?? 0 });
  }
  parts.sort((a, b) => b.gwh - a.gwh);

  let thermal = 0;
  let hasThermal = false;
  for (const concept of THERMAL_CONCEPTS) {
    const gwh = value(concept);
    if (gwh === null) continue;
    thermal += gwh;
    hasThermal = true;
  }

  return {
    parts,
    totalGeneration: roundOrNull(value("total_generacion"), 3),
    totalImport: roundOrNull(value("total_importacion"), 3),
    totalExport: roundOrNull(value("total_exportacion"), 3),
    demand: roundOrNull(value("demanda_distribucion"), 3),
    losses: roundOrNull(value("total_perdidas_transporte"), 3),
    hydro: share(value("generacion_hidraulica")),
    thermal: hasThermal ? share(thermal) : null,
    imports: share(value("total_importacion")),
  };
}

export const DISCLAIMER_ES =
  "No es una fuente oficial. Cada número es una copia de lo que publicaron CELEC o CENACE, " +
  "con la respuesta que lo produjo archivada junto a él.";

/**
 * The adequacy document as it arrives from disk. Only the fields this summary needs are named,
 * and every one of them is checked rather than trusted: a half-written `adequacy.json` should
 * leave the tile absent, which the site already knows how to render, not put a `undefined` tier
 * on the page.
 */
export function adequacySummary(document: unknown): AdequacySummary | null {
  if (typeof document !== "object" || document === null) return null;
  const doc = document as Record<string, unknown>;
  const current = doc["current"];
  if (typeof current !== "object" || current === null) return null;
  const now = current as Record<string, unknown>;
  const tier = now["tier"];
  const worst = now["worst_tier"];
  const horizon = now["worst_tier_horizon_days"];
  const deficit = now["worst_deficit_gwh_day"];
  if (typeof tier !== "string" || typeof worst !== "string") return null;
  if (typeof horizon !== "number" || typeof deficit !== "number") return null;
  return {
    origin_date: typeof doc["origin_date"] === "string" ? doc["origin_date"] : "",
    tier,
    tier_code: tierCode(tier),
    tier_label_es: TIER_CODES[tier]?.label_es ?? tier,
    worst_tier: worst,
    worst_tier_code: tierCode(worst),
    worst_tier_label_es: TIER_CODES[worst]?.label_es ?? worst,
    worst_tier_horizon_days: horizon,
    narrative_tier_field: NARRATIVE_TIER_FIELD,
    worst_deficit_gwh_day: roundTo(deficit, 3),
    run_id: typeof doc["run_id"] === "string" ? doc["run_id"] : "",
  };
}

export interface LatestInputs {
  series: SeriesSet;
  thresholds: readonly ThresholdRow[];
  /** `data/reference/geoglows_return_periods.csv`; absent or empty leaves every `geoglows` null. */
  geoglows?: readonly GeoglowsRow[];
  balance: readonly BalanceRow[];
  sites: readonly SiteId[];
  generatedAt: string;
  asOf: IsoDate;
  /** Parsed `public/api/adequacy.json`, or null before it has ever been generated. */
  adequacy?: unknown;
}

/**
 * The day the document's readings describe: the newest reservoir level or closed balance day.
 * Each reading still carries its own date — SMEC closes a day later than the ORDS reports — and
 * this is the newest of them, which is what "data as of" means to someone reading the page.
 */
export function dataDateOf(reservoirs: readonly ReservoirSnapshot[], national: NationalSnapshot | null): IsoDate | null {
  let newest: IsoDate | null = national?.date ?? null;
  for (const reservoir of reservoirs) {
    const date = reservoir.level?.date;
    if (date && (newest === null || date > newest)) newest = date;
  }
  return newest;
}

export function buildLatest(inputs: LatestInputs): LatestDocument {
  const reservoirs = inputs.sites.map((site) => reservoirSnapshot(inputs.series, site, inputs.thresholds, inputs.geoglows));
  const national = nationalSnapshot(balanceByDay(inputs.balance));
  return withContract("latest", {
    generated_at: inputs.generatedAt,
    data_date: dataDateOf(reservoirs, national),
    as_of: inputs.asOf,
    disclaimer: DISCLAIMER_ES,
    reservoirs,
    national,
    adequacy: adequacySummary(inputs.adequacy),
    see_also: {
      forecast: "/api/forecast.json",
      status: "/api/status.json",
      adequacy: "/api/adequacy.json",
      narrative: "/api/narrative.json",
    },
  });
}
