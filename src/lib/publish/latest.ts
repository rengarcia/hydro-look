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
  declaration: string;
  source: string;
  observed_from: string;
  observed_to: string;
  /** Where the current level sits in this declaration's band, 0–100 and occasionally outside it. */
  band_pct: number | null;
  /** Metres between the current level and this declaration's floor; negative means below it. */
  metres_above_min: number | null;
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
}

export interface LatestDocument {
  generated_at: string;
  as_of: IsoDate;
  disclaimer: string;
  reservoirs: ReservoirSnapshot[];
  national: NationalSnapshot | null;
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
    out.push({
      min_masl: min,
      max_masl: max,
      declaration: row.declaration,
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

export function reservoirSnapshot(series: SeriesSet, site: SiteId, thresholds: readonly ThresholdRow[]): ReservoirSnapshot {
  const levels = series.get(site, "cota_masl");
  const inflow = series.get(site, "caudal_m3s");
  const lastLevel = lastOf(levels);
  const lastInflow = lastOf(inflow);
  const meta = SITES[site];

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

/**
 * The most recent day SMEC has closed, as a supply mix.
 *
 * Shares are taken over generation *plus* imports rather than over generation alone, because
 * the question the tile answers is where the country's electricity came from, and an imported
 * kWh is as real as a generated one. On a day when Colombia is covering the evening peak the
 * two denominators differ by several percent, so the choice is stated here rather than left to
 * be reverse-engineered from the numbers.
 */
export function nationalSnapshot(byDay: Map<IsoDate, Map<string, number>>): NationalSnapshot | null {
  let latest: IsoDate | null = null;
  for (const date of byDay.keys()) if (latest === null || date > latest) latest = date;
  if (latest === null) return null;

  const day = byDay.get(latest)!;
  const value = (concept: string): number | null => day.get(concept) ?? null;

  const imports = value("total_importacion") ?? 0;
  const supply = (value("total_generacion") ?? 0) + imports;
  const share = (gwh: number | null): number | null =>
    gwh === null || supply <= 0 ? null : roundTo((gwh / supply) * 100, 2);

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
    date: latest,
    supply_gwh: parts,
    total_generation_gwh: roundOrNull(value("total_generacion"), 3),
    total_import_gwh: roundOrNull(value("total_importacion"), 3),
    total_export_gwh: roundOrNull(value("total_exportacion"), 3),
    distribution_demand_gwh: roundOrNull(value("demanda_distribucion"), 3),
    transport_losses_gwh: roundOrNull(value("total_perdidas_transporte"), 3),
    hydro_share_pct: share(value("generacion_hidraulica")),
    thermal_share_pct: hasThermal ? share(thermal) : null,
    import_share_pct: share(value("total_importacion")),
  };
}

export const DISCLAIMER_ES =
  "No es una fuente oficial. Cada número es una copia de lo que publicaron CELEC o CENACE, " +
  "con la respuesta que lo produjo archivada junto a él.";

export interface LatestInputs {
  series: SeriesSet;
  thresholds: readonly ThresholdRow[];
  balance: readonly BalanceRow[];
  sites: readonly SiteId[];
  generatedAt: string;
  asOf: IsoDate;
}

export function buildLatest(inputs: LatestInputs): LatestDocument {
  return {
    generated_at: inputs.generatedAt,
    as_of: inputs.asOf,
    disclaimer: DISCLAIMER_ES,
    reservoirs: inputs.sites.map((site) => reservoirSnapshot(inputs.series, site, inputs.thresholds)),
    national: nationalSnapshot(balanceByDay(inputs.balance)),
    see_also: {
      forecast: "/api/forecast.json",
      status: "/api/status.json",
    },
  };
}
