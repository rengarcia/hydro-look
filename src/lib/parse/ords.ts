/**
 * Parsers for the CELEC ORDS endpoints. Every function here is pure: raw response text in,
 * typed rows out, no network and no clock. Anything unexpected throws, because the ingest
 * contract is that a drifted response writes nothing at all.
 *
 * Endpoint shapes were recorded in Phase 0; the fixtures under tests/fixtures/celec_ords/
 * are the exact responses these parsers are tested against.
 */

import {
  ENER12M_SUFFIX_TO_SITE,
  HID12M_SUFFIX_TO_SITE,
  REG_AYER_COLUMN_TO_SITE,
  REG_AYER_DESCR_TO_VARIABLE,
  normalizeLabel,
  siteFromLabel,
  type SiteId,
} from "../registry.ts";
import { addDays, localDateOf, localDateOfHourEnding, type IsoDate } from "../util/dates.ts";
import { asNumber } from "../util/numbers.ts";
import type { BandReading, Observation, ParseResult } from "./types.ts";

type Json = Record<string, unknown>;

function parseJson(body: string, endpoint: string): Json {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    throw new Error(`${endpoint}: response is not JSON (${String(error)}); first 120 chars: ${body.slice(0, 120)}`);
  }
  if (payload === null || typeof payload !== "object") throw new Error(`${endpoint}: response is not an object`);
  return payload as Json;
}

/** ORDS wraps rows in `items`; `repDiaVolAlm` uses `cv_1` instead. */
function itemsOf(body: string, endpoint: string, key: "items" | "cv_1" = "items"): Json[] {
  const payload = parseJson(body, endpoint);
  const items = payload[key];
  if (!Array.isArray(items)) throw new Error(`${endpoint}: expected an array under "${key}", got ${typeof items}`);
  for (const item of items) {
    if (item === null || typeof item !== "object") throw new Error(`${endpoint}: non-object row in "${key}"`);
  }
  return items as Json[];
}

function requireString(row: Json, field: string, endpoint: string): string {
  const value = row[field];
  if (typeof value !== "string") throw new Error(`${endpoint}: row is missing the string field "${field}"`);
  return value;
}

/** Fields the endpoint must have; their absence is drift, a null value is just a gap. */
function requireFields(rows: Json[], fields: string[], endpoint: string): void {
  if (rows.length === 0) return;
  const first = rows[0]!;
  const missing = fields.filter((f) => !Object.hasOwn(first, f));
  if (missing.length > 0) {
    throw new Error(`${endpoint}: response lost the fields [${missing.join(", ")}]; present: [${Object.keys(first).join(", ")}]`);
  }
}

function push(out: Observation[], row: Omit<Observation, "mrid"> & { mrid?: string }): void {
  out.push({ mrid: "", ...row });
}

/**
 * `repDiaHid12m?fecha=` — 365 daily rows ending the day before `fecha`, carrying level,
 * inflow and the declared band for Mazar, Amaluza (columns suffixed `mol`), Minas San
 * Francisco and Delsitanisagua. One request per year covers a year of history.
 */
export function parseRepDiaHid12m(body: string): ParseResult {
  const endpoint = "ords:repDiaHid12m";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["loctimestamp", "nivelmaz", "q_ingresadomaz", "limmaz", "min_maz", "qmax_maz"], endpoint);

  const observations: Observation[] = [];
  const bands: BandReading[] = [];

  for (const row of rows) {
    const date = localDateOf(requireString(row, "loctimestamp", endpoint));
    for (const [suffix, site] of Object.entries(HID12M_SUFFIX_TO_SITE)) {
      const cota = asNumber(row[`nivel${suffix}`]);
      const caudal = asNumber(row[`q_ingresado${suffix}`]);
      if (cota !== null) push(observations, { date, site, variable: "cota_masl", value: cota, source: endpoint });
      if (caudal !== null) push(observations, { date, site, variable: "caudal_m3s", value: caudal, source: endpoint });

      const cotaMax = asNumber(row[`lim${suffix}`]);
      const cotaMin = asNumber(row[`min_${suffix}`]);
      const qmax = asNumber(row[`qmax_${suffix}`]);
      if (cotaMax !== null || cotaMin !== null || qmax !== null) {
        bands.push({ date, site, cota_min: cotaMin, cota_max: cotaMax, qmax_m3s: qmax, source: endpoint });
      }
    }
  }
  return { observations, bands };
}

/**
 * `repDiaEner12m?fecha=` — ~182 daily rows of energy per CELEC Sur plant ending the day
 * before `fecha`. `maxener*` is the dashboard's y-axis limit, not a plant limit, so it is
 * deliberately dropped.
 */
export function parseRepDiaEner12m(body: string): ParseResult {
  const endpoint = "ords:repDiaEner12m";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["loctimestamp", "enermaz", "enermol"], endpoint);

  const observations: Observation[] = [];
  for (const row of rows) {
    const date = localDateOf(requireString(row, "loctimestamp", endpoint));
    for (const [suffix, site] of Object.entries(ENER12M_SUFFIX_TO_SITE)) {
      const energy = asNumber(row[`ener${suffix}`]);
      if (energy !== null) push(observations, { date, site, variable: "produccion_mwh", value: energy, source: endpoint });
    }
  }
  return { observations };
}

/** `repDiaNivQIng?fecha=` — one day, level and inflow per reservoir, named in Spanish. */
export function parseRepDiaNivQIng(body: string): ParseResult {
  const endpoint = "ords:repDiaNivQIng";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["fecha", "embalse", "nivel", "q_ingresado"], endpoint);

  const observations: Observation[] = [];
  for (const row of rows) {
    const date = localDateOf(requireString(row, "fecha", endpoint));
    const site = siteFromLabel(requireString(row, "embalse", endpoint));
    const cota = asNumber(row["nivel"]);
    const caudal = asNumber(row["q_ingresado"]);
    if (cota !== null) push(observations, { date, site, variable: "cota_masl", value: cota, source: endpoint });
    if (caudal !== null) push(observations, { date, site, variable: "caudal_m3s", value: caudal, source: endpoint });
  }
  return { observations };
}

/** `repDiaPotQTurb?fecha=` — one day: power, units online and turbined flow per plant. */
export function parseRepDiaPotQTurb(body: string): ParseResult {
  const endpoint = "ords:repDiaPotQTurb";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["fecha", "central", "potencia", "q_turbinado", "unidlinea"], endpoint);

  const observations: Observation[] = [];
  for (const row of rows) {
    const date = localDateOf(requireString(row, "fecha", endpoint));
    const site = siteFromLabel(requireString(row, "central", endpoint));
    const power = asNumber(row["potencia"]);
    const turbined = asNumber(row["q_turbinado"]);
    const units = asNumber(row["unidlinea"]);
    if (power !== null) push(observations, { date, site, variable: "potencia_mw", value: power, source: endpoint });
    if (turbined !== null) push(observations, { date, site, variable: "q_turbinado_m3s", value: turbined, source: endpoint });
    if (units !== null) push(observations, { date, site, variable: "unidades_linea", value: units, source: endpoint });
  }
  return { observations };
}

/**
 * `repDiaEnerAyerHoy?fecha=` — yesterday's energy and today's plan per plant, plus the SNI
 * national total.
 *
 * The row's own `fecha` dates the produced energy. The planned figure is "today" relative to
 * the request, and rows have been seen carrying different `fecha` values within one response
 * (2016-06-15), so the plan is dated from the requested day instead of from the row.
 */
export function parseRepDiaEnerAyerHoy(body: string, requestedDate: IsoDate): ParseResult {
  const endpoint = "ords:repDiaEnerAyerHoy";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["fecha", "central", "enerayer", "enerplanhoy"], endpoint);

  const observations: Observation[] = [];
  const notes: string[] = [];
  const rowDates = new Set<string>();

  for (const row of rows) {
    const date = localDateOf(requireString(row, "fecha", endpoint));
    rowDates.add(date);
    const site = siteFromLabel(requireString(row, "central", endpoint));
    const produced = asNumber(row["enerayer"]);
    const planned = asNumber(row["enerplanhoy"]);
    if (produced !== null) push(observations, { date, site, variable: "produccion_mwh", value: produced, source: endpoint });
    if (planned !== null && planned !== 0) {
      push(observations, { date: requestedDate, site, variable: "energia_plan_mwh", value: planned, source: endpoint });
    }
  }
  if (rowDates.size > 1) notes.push(`${endpoint}: response mixes the dates ${[...rowDates].sort().join(", ")}`);
  return { observations, notes };
}

/** `repDiaRegAyer?fecha=` — four registry rows (year-to-date energy, spill, plant factor) as columns per plant. */
export function parseRepDiaRegAyer(body: string): ParseResult {
  const endpoint = "ords:repDiaRegAyer";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["loctimestamp", "descr", "mazar", "molino"], endpoint);

  const observations: Observation[] = [];
  for (const row of rows) {
    const date = localDateOf(requireString(row, "loctimestamp", endpoint));
    const descr = requireString(row, "descr", endpoint);
    const variable = REG_AYER_DESCR_TO_VARIABLE[normalizeLabel(descr)];
    if (!variable) throw new Error(`${endpoint}: unknown row description ${JSON.stringify(descr)}`);
    for (const [column, site] of Object.entries(REG_AYER_COLUMN_TO_SITE)) {
      const value = asNumber(row[column]);
      if (value !== null) push(observations, { date, site, variable, value, source: endpoint });
    }
  }
  return { observations };
}

/**
 * `repDiaVolAlm` (POST `{"v_loctimestamp": "<date>T05:00:00Z"}`) — level and declared band for
 * the three reservoirs with published bands.
 *
 * `volutilalm` is published as "% de volumen útil" but equals (volact - volembmin) /
 * (volembmax - volembmin) exactly, so it is stored as `nivel_pct_banda` and must never be read
 * as stored water. The parser recomputes it and notes any row where the identity fails, which
 * is the signal that a real volume curve has appeared upstream.
 */
export function parseRepDiaVolAlm(body: string, date: IsoDate): ParseResult {
  const endpoint = "ords:repDiaVolAlm";
  const rows = itemsOf(body, endpoint, "cv_1");
  requireFields(rows, ["embalse", "volact", "volembmax", "volembmin", "volutilalm"], endpoint);

  const observations: Observation[] = [];
  const bands: BandReading[] = [];
  const notes: string[] = [];

  for (const row of rows) {
    const site = siteFromLabel(requireString(row, "embalse", endpoint));
    const level = asNumber(row["volact"]);
    const max = asNumber(row["volembmax"]);
    const min = asNumber(row["volembmin"]);
    const pct = asNumber(row["volutilalm"]);

    if (level !== null) push(observations, { date, site, variable: "cota_masl", value: level, source: endpoint });
    if (pct !== null) push(observations, { date, site, variable: "nivel_pct_banda", value: pct, source: endpoint });
    if (min !== null || max !== null) {
      bands.push({ date, site, cota_min: min, cota_max: max, qmax_m3s: null, source: endpoint });
    }
    if (level !== null && min !== null && max !== null && pct !== null && max !== min) {
      const linear = ((level - min) / (max - min)) * 100;
      if (Math.abs(linear - pct) > 0.01) {
        notes.push(`${endpoint}: ${site} volutilalm=${pct} is no longer band-linear (expected ${linear.toFixed(4)}); a real volume curve may have appeared`);
      }
    }
  }
  return { observations, bands, notes };
}

/**
 * `{code}EnerDia?fecha=` — 24 hour-ending values for one plant-day. The daily total is only
 * written when all 24 hours are present, so a partially published day never lands as a dip.
 */
export function parseEnerDia(body: string, site: SiteId, code: string, date: IsoDate): ParseResult {
  const endpoint = `ords:${code}EnerDia`;
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["loctimestamp", "valueedit"], endpoint);

  let total = 0;
  let hours = 0;
  const days = new Set<string>();

  for (const row of rows) {
    const value = asNumber(row["valueedit"]);
    const day = localDateOfHourEnding(requireString(row, "loctimestamp", endpoint));
    days.add(day);
    if (value !== null) {
      total += value;
      hours++;
    }
  }

  const notes: string[] = [];
  if (days.size > 1) notes.push(`${endpoint}: response spans the days ${[...days].sort().join(", ")}`);
  if (hours < 24) {
    notes.push(`${endpoint} ${date}: only ${hours}/24 hours present, daily total not written`);
    return { observations: [], notes };
  }
  return {
    observations: [{ date, site, variable: "produccion_mwh", value: Math.round(total * 1e6) / 1e6, source: endpoint, mrid: "" }],
    notes,
  };
}

/** `csrCaudCuenAniosAvg?fechaInicio=&fechaFin=` — mean Paute basin flow per year, 2010 onwards. */
export function parseCaudCuenAniosAvg(body: string): ParseResult {
  const endpoint = "ords:csrCaudCuenAniosAvg";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["loctimestamp", "valueedit"], endpoint);

  const observations: Observation[] = [];
  for (const row of rows) {
    const value = asNumber(row["valueedit"]);
    if (value === null) continue;
    const date = localDateOf(requireString(row, "loctimestamp", endpoint));
    push(observations, { date, site: "paute_cuenca", variable: "caudal_cuenca_m3s", value, source: endpoint });
  }
  return { observations };
}

/**
 * `pointValues` / `pointValuesMesH24` — the historian series behind the dashboard charts.
 * Every Phase 0 run got the timestamp skeleton with `valueedit: null`, so a fully null
 * response is a normal outcome here and is reported rather than thrown.
 */
export function parsePointValues(
  body: string,
  site: SiteId,
  variable: "cota_masl" | "caudal_m3s" | "unidades_linea",
  mrid: number,
  opts: { hourEnding?: boolean } = {},
): ParseResult {
  const endpoint = "ords:pointValues";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["loctimestamp", "valueedit"], endpoint);

  const observations: Observation[] = [];
  let nulls = 0;
  for (const row of rows) {
    const value = asNumber(row["valueedit"]);
    if (value === null) {
      nulls++;
      continue;
    }
    const stamp = requireString(row, "loctimestamp", endpoint);
    const date = opts.hourEnding ? localDateOfHourEnding(stamp) : localDateOf(stamp);
    push(observations, { date, site, variable, value, source: endpoint, mrid: String(mrid) });
  }
  const notes = nulls === rows.length && rows.length > 0 ? [`${endpoint} mrid=${mrid}: all ${nulls} points are null (known open issue)`] : [];
  return { observations, notes };
}

/** `csrEstUnidades` — unit status right now; a snapshot, not a series. */
export interface UnitStatus {
  site: SiteId;
  unit: string;
  status: string;
}

export function parseEstUnidades(body: string): UnitStatus[] {
  const endpoint = "ords:csrEstUnidades";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["central", "unidad", "valor"], endpoint);
  return rows.map((row) => ({
    site: siteFromLabel(requireString(row, "central", endpoint)),
    unit: requireString(row, "unidad", endpoint),
    status: requireString(row, "valor", endpoint),
  }));
}

/**
 * `csrProdLineaLast2h` — the live tile: for each site a block of four magnitudes (daily
 * energy, level, inflow, total energy), then the Paute basin flow. The block's `Q <site>`
 * row is what names the site, since the rows themselves carry only ids.
 */
export interface LiveReading {
  site: SiteId;
  magnitude: string;
  value: number;
  units: string;
  timestamp: string;
  hour: number;
}

export function parseProdLineaLast2h(body: string): LiveReading[] {
  const endpoint = "ords:csrProdLineaLast2h";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["id", "hora", "loctimestamp", "valueedit", "magnitud", "units"], endpoint);

  const blocks = new Map<string, Json[]>();
  for (const row of rows) {
    const id = asNumber(row["id"]);
    const hour = asNumber(row["hora"]);
    if (id === null || hour === null) throw new Error(`${endpoint}: row without id/hora`);
    const block = `${hour}:${Math.floor((id - 1) / 4)}`;
    (blocks.get(block) ?? blocks.set(block, []).get(block)!).push(row);
  }

  const out: LiveReading[] = [];
  for (const rowsOfBlock of blocks.values()) {
    const qRow = rowsOfBlock.find((r) => typeof r["magnitud"] === "string" && (r["magnitud"] as string).startsWith("Q "));
    if (!qRow) continue; // a block with no flow row names no site; the dashboard shows nothing for it either
    const site = siteFromQLabel(requireString(qRow, "magnitud", endpoint));
    for (const row of rowsOfBlock) {
      const value = asNumber(row["valueedit"]);
      if (value === null) continue;
      out.push({
        site,
        magnitude: requireString(row, "magnitud", endpoint),
        value,
        units: requireString(row, "units", endpoint),
        timestamp: requireString(row, "loctimestamp", endpoint),
        hour: asNumber(row["hora"])!,
      });
    }
  }
  return out;
}

/** `Q M.S.Francisco`, `Q cuenca Paute`, ... -> site id. */
function siteFromQLabel(label: string): SiteId {
  const name = normalizeLabel(label.replace(/^Q\s*/i, ""));
  const special: Record<string, SiteId> = {
    "m s francisco": "minas_san_francisco",
    "cuenca paute": "paute_cuenca",
  };
  return special[name] ?? siteFromLabel(name);
}

/** The day a `repDia*` "yesterday" report describes, given the `fecha` it was asked for. */
export function previousDay(date: IsoDate): IsoDate {
  return addDays(date, -1);
}
