/**
 * Parsers for the CELEC ORDS endpoints. Every function here is pure: raw response text in,
 * typed rows out, no network and no clock. Anything unexpected throws, because the ingest
 * contract is that a drifted response writes nothing at all.
 *
 * Endpoint shapes were recorded in Phase 0; the fixtures under tests/fixtures/celec_ords/
 * are the exact responses these parsers are tested against.
 */

import {
  DATA_DATE_OFFSET_DAYS,
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
    throw new Error(`${endpoint}: response is not JSON (${String(error)}); first 120 chars: ${body.slice(0, 120)}`, { cause: error });
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

/**
 * The largest inflow that can be a reading rather than a fault, in m3/s.
 *
 * The historian published 23,221.10 for Mazar on 2013-11-27, between neighbours of 34.31 and 0.00
 * and against a maximum of 867 in the same series and 1,933 anywhere in this repository's 21,000
 * inflow readings. A flow that size does not happen on an Ecuadorian river — it is a third of the
 * Amazon at its mouth — and the two zeros that immediately follow it read like the gauge that
 * produced it failing. Ten thousand leaves a fivefold margin above the largest reading ever seen
 * here, so the rule rejects that fault and nothing near a real flood.
 */
const INFLOW_CEILING_M3S = 10_000;

/**
 * Inflow published as a number that is not a reading: negative, zero, or in five figures.
 *
 * `q_ingresado` is water entering the reservoir, and all three of these say more about the
 * instrument than the river.
 *
 * **Negative** has no branch at all. The ORDS emits one on days before a plant's series begins:
 * Minas San Francisco's level is null on 2018-10-01 and 2018-10-10 and its inflow on those two
 * days is -4,999,995 and -3,999,996, against single digits either side and nothing else negative
 * in 14,619 inflow readings.
 *
 * **Zero** is a sentinel on one route and a real reading on the other, and the difference is
 * precision. The historian publishes decimals, and there a 0.00 is the service saying nothing:
 * the smallest non-zero reading is 84.00 m3/s for Coca Codo Sinclair — whose 1st percentile is 97
 * — 35.00 for Agoyán and 10.40 for Manduriacu, so a zero sits further below those series' own
 * floors than any real day approaches. They cluster like a fault and not like hydrology: nine
 * consecutive days in 2010-02, three in 2010-01, two immediately after the spike above, and 20 of
 * Mazar's 22 inside the first ten months of a series that begins in 2010-01.
 *
 * The 12-month reports are the opposite case, and nearly cost this rule its credibility. They
 * publish whole m3/s — the caudal cross-check found the report is exactly `round(historian)` on
 * all 4,281 shared days — so a reported 0 is `round(x)` for any x below 0.5. On 2024-11-08, at the
 * worst of the rationing drought, `repDiaHid12m` published 0 for Mazar and the historian published
 * 0.142 on the same day. That zero is the most informative reading in the series, not a missing
 * one, and dropping it would have deleted the day the Paute came closest to stopping. So the rule
 * is asked only of the route whose precision makes it meaningful.
 *
 * What is dropped is dropped with a note rather than carried into a series someone will fit a
 * model to, and every raw response stays archived, so if the meaning of one is ever established
 * it can be reprocessed.
 */
function usableInflow(
  value: number | null,
  context: { site: string; date: string; endpoint: string },
  notes: string[],
  opts: { zeroIsMissing?: boolean } = {},
): number | null {
  if (value === null) return null;
  const say = (why: string): null => {
    notes.push(`${context.endpoint} ${context.site} ${context.date}: inflow ${value} ${why}; dropped`);
    return null;
  };
  if (value < 0) return say("is negative, which q_ingresado cannot be");
  if (value === 0 && opts.zeroIsMissing)
    return say("is zero on a route that publishes decimals, so it is a missing reading rather than a stopped river");
  if (value > INFLOW_CEILING_M3S) return say(`exceeds ${INFLOW_CEILING_M3S} m3/s, which no Ecuadorian intake sees`);
  return value;
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
  const notes: string[] = [];

  for (const row of rows) {
    const date = localDateOf(requireString(row, "loctimestamp", endpoint));
    for (const [suffix, site] of Object.entries(HID12M_SUFFIX_TO_SITE)) {
      const cota = asNumber(row[`nivel${suffix}`]);
      const caudal = usableInflow(asNumber(row[`q_ingresado${suffix}`]), { site, date, endpoint }, notes);
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
  return { observations, bands, notes };
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
  const notes: string[] = [];
  for (const row of rows) {
    // The stamp is the report's date; the reading is the day before it. See
    // DATA_DATE_OFFSET_DAYS for how that was measured and why this endpoint is the odd one.
    const date = addDays(localDateOf(requireString(row, "fecha", endpoint)), DATA_DATE_OFFSET_DAYS[endpoint] ?? 0);
    const site = siteFromLabel(requireString(row, "embalse", endpoint));
    const cota = asNumber(row["nivel"]);
    // The same quantity as repDiaHid12m's q_ingresado, so the same rule applies to it.
    const caudal = usableInflow(asNumber(row["q_ingresado"]), { site, date, endpoint }, notes);
    if (cota !== null) push(observations, { date, site, variable: "cota_masl", value: cota, source: endpoint });
    if (caudal !== null) push(observations, { date, site, variable: "caudal_m3s", value: caudal, source: endpoint });
  }
  return { observations, notes };
}

/** `repDiaPotQTurb?fecha=` — power, units online and turbined flow per plant, at one instant. */
export function parseRepDiaPotQTurb(body: string): ParseResult {
  const endpoint = "ords:repDiaPotQTurb";
  const rows = itemsOf(body, endpoint);
  requireFields(rows, ["fecha", "central", "potencia", "q_turbinado", "unidlinea"], endpoint);

  const observations: Observation[] = [];
  for (const row of rows) {
    // A snapshot at the midnight in its own stamp, dated like repDiaNivQIng's, which publishes
    // Molino's turbined flow again as Sopladora's inflow. See DATA_DATE_OFFSET_DAYS.
    const date = addDays(localDateOf(requireString(row, "fecha", endpoint)), DATA_DATE_OFFSET_DAYS[endpoint] ?? 0);
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
        notes.push(
          `${endpoint}: ${site} volutilalm=${pct} is no longer band-linear (expected ${linear.toFixed(4)}); a real volume curve may have appeared`,
        );
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
  const notes: string[] = [];
  let nulls = 0;
  for (const row of rows) {
    const raw = asNumber(row["valueedit"]);
    if (raw === null) {
      nulls++;
      continue;
    }
    const stamp = requireString(row, "loctimestamp", endpoint);
    const date = opts.hourEnding ? localDateOfHourEnding(stamp) : localDateOf(stamp);
    // The historian is the same quantity by another route — the caudal-semantics cross-check
    // matched it to `repDiaHid12m` on 4,281 days — so it inherits the same rule. It is the route
    // that needs it most: the reports start in 2014-09 and the faults cluster in 2010 and 2013,
    // years only the historian reaches.
    const value = variable === "caudal_m3s" ? usableInflow(raw, { site, date, endpoint }, notes, { zeroIsMissing: true }) : raw;
    if (value === null) continue;
    push(observations, { date, site, variable, value, source: endpoint, mrid: String(mrid) });
  }
  if (nulls === rows.length && rows.length > 0) notes.push(`${endpoint} mrid=${mrid}: all ${nulls} points are null (known open issue)`);
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
    const qRow = rowsOfBlock.find((r) => typeof r["magnitud"] === "string" && r["magnitud"].startsWith("Q "));
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
