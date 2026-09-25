/**
 * Canonical ids for the sites and variables that appear in the curated tables, plus the
 * mapping from every label each upstream source uses.
 *
 * Sites are reservoirs *or* power plants, because the sources mix both: a level reading
 * belongs to a reservoir (Amaluza) while an energy reading belongs to the plant that the
 * reservoir feeds (Molino). `repDiaHid12m` names Amaluza's columns `*mol`, which is why the
 * suffix map below sends `mol` to `amaluza` for levels and `molino` for energy.
 */

export const SITES = {
  mazar: { label: "Mazar", kind: "reservoir_and_plant", basin: "paute" },
  amaluza: { label: "Amaluza", kind: "reservoir", basin: "paute", plant: "molino" },
  molino: { label: "Molino (Paute)", kind: "plant", basin: "paute" },
  sopladora: { label: "Sopladora", kind: "reservoir_and_plant", basin: "paute" },
  minas_san_francisco: { label: "Minas San Francisco", kind: "reservoir_and_plant", basin: "jubones" },
  delsitanisagua: { label: "Delsitanisagua", kind: "reservoir_and_plant", basin: "zamora" },
  alazan: { label: "Alazán", kind: "plant", basin: "paute" },
  agoyan: { label: "Agoyán", kind: "reservoir_and_plant", basin: "pastaza" },
  manduriacu: { label: "Manduriacu", kind: "reservoir_and_plant", basin: "guayllabamba" },
  coca_codo_sinclair: { label: "Coca Codo Sinclair", kind: "reservoir_and_plant", basin: "coca" },
  paute_cuenca: { label: "Cuenca del Paute", kind: "basin", basin: "paute" },
  celec_sur: { label: "CELEC Sur (Mazar+Molino+Sopladora+Minas SF)", kind: "aggregate", basin: "" },
  sni: { label: "Sistema Nacional Interconectado", kind: "aggregate", basin: "" },
} as const;

export type SiteId = keyof typeof SITES;

export function isSiteId(value: string): value is SiteId {
  return Object.hasOwn(SITES, value);
}

/**
 * Variables carry their unit in the name, so the long tables need no unit column.
 *
 * `nivel_pct_banda` is the ORDS field `volutilalm`. It is published as "% de volumen útil"
 * but is exactly (cota - volembmin) / (volembmax - volembmin), verified to ten decimals on
 * all three reservoirs it covers: a position within the declared level band, not storage.
 */
export const VARIABLES = {
  cota_masl: "Reservoir level, metres above sea level",
  caudal_m3s: "Inflow to the reservoir (q_ingresado), m3/s",
  q_turbinado_m3s: "Turbined flow, m3/s",
  produccion_mwh: "Energy produced over the local day, MWh",
  energia_plan_mwh: "Energy planned for the day, MWh",
  potencia_mw: "Instantaneous power at the report's timestamp, MW",
  unidades_linea: "Generating units online, count",
  nivel_pct_banda: "Position of the level inside the declared band, % (NOT stored volume)",
  energia_anual_acum_gwh: "Year-to-date energy, GWh",
  volumen_vertido_hm3: "Spilled volume, hm3",
  energia_vertida_gwh: "Energy equivalent of the spill, GWh",
  factor_planta_pct: "Plant factor, %",
  caudal_cuenca_m3s: "Basin mean flow, m3/s",
} as const;

export type VariableId = keyof typeof VARIABLES;

/** `repDiaHid12m` column suffix -> the site the reading belongs to (levels and inflows). */
export const HID12M_SUFFIX_TO_SITE: Record<string, SiteId> = {
  maz: "mazar",
  mol: "amaluza",
  msf: "minas_san_francisco",
  del: "delsitanisagua",
};

/** `repDiaEner12m` column suffix -> the plant whose energy it is. */
export const ENER12M_SUFFIX_TO_SITE: Record<string, SiteId> = {
  maz: "mazar",
  mol: "molino",
  sop: "sopladora",
  msf: "minas_san_francisco",
  del: "delsitanisagua",
  ala: "alazan",
};

/** ORDS per-plant energy modules: `{code}EnerDia` lives in module `sardom{code}`. */
export const ENERGY_MODULES = {
  maz: { module: "sardommaz", site: "mazar" },
  mol: { module: "sardommol", site: "molino" },
  sop: { module: "sardomsop", site: "sopladora" },
  msf: { module: "sardommsf", site: "minas_san_francisco" },
  ago: { module: "sardomago", site: "agoyan" },
  man: { module: "sardomman", site: "manduriacu" },
  ccs: { module: "sardomccs", site: "coca_codo_sinclair" },
} as const satisfies Record<string, { module: string; site: SiteId }>;

export type EnergyPlantCode = keyof typeof ENERGY_MODULES;

/**
 * Plants whose daily energy is only available through `{code}EnerDia`: the other four are
 * covered by `repDiaEner12m`, 182 days per request, so backfilling them hour by hour would
 * be thousands of needless requests.
 */
export const ENERGY_BACKFILL_ONLY_CODES: EnergyPlantCode[] = ["ago", "man", "ccs"];

/**
 * The historian series behind the dashboard charts, from `data/reference/mrids.csv`.
 *
 * These mrids are the only route to levels and inflows for Coca Codo Sinclair, Agoyán and
 * Manduriacu; `repDiaHid12m` covers every other reservoir. Mazar is carried as a **control**:
 * its level and inflow are already published by the report endpoints, so a run can tell
 * "the historian is answering null right now" from "this plant has no data that far back".
 * Without that distinction a run made inside the blank window of §2.1 would record a false
 * "no data" for exactly the three plants we have no second source for.
 *
 * A control earns its place twice over, and the order below says which job comes first. The
 * first one is the run's **gate**: one request, on a closed month, and a blank answer ends the
 * run. The rest are walked like targets, because the same property that makes a control usable
 * as a gate — the reports publish it too — is what makes its history the only way to settle
 * what a series *means*. Mazar's inflow mrid is here for that second job: the report endpoints
 * publish Mazar's inflow as `q_ingresado` and its turbined flow through `repDiaPotQTurb`, and
 * only a run of days against both says which one `mridCaud` is. The three plants with no
 * second source inherit the answer, since their mrids are declared the same way in the same
 * dashboard component.
 */
export interface HistorianSeries {
  site: SiteId;
  variable: "cota_masl" | "caudal_m3s";
  mrid: number;
  /** Values also published by `repDiaHid12m`, so an answer can be checked rather than counted. */
  control?: boolean;
}

export const HISTORIAN_SERIES: readonly HistorianSeries[] = [
  // The gate first: level, the one series proven identical to the reports day for day.
  { site: "mazar", variable: "cota_masl", mrid: 30031, control: true },
  { site: "mazar", variable: "caudal_m3s", mrid: 30538, control: true },
  { site: "coca_codo_sinclair", variable: "cota_masl", mrid: 100540 },
  { site: "coca_codo_sinclair", variable: "caudal_m3s", mrid: 100037 },
  { site: "agoyan", variable: "cota_masl", mrid: 140031 },
  { site: "agoyan", variable: "caudal_m3s", mrid: 140537 },
  { site: "manduriacu", variable: "cota_masl", mrid: 110031 },
  { site: "manduriacu", variable: "caudal_m3s", mrid: 110537 },
];

export const HISTORIAN_CONTROLS = HISTORIAN_SERIES.filter((s) => s.control);
export const HISTORIAN_TARGETS = HISTORIAN_SERIES.filter((s) => !s.control);

/** Strip accents and case so upstream labels match regardless of how they are written. */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Labels as the ORDS reports spell them (`embalse`, `central`, `descr` columns). */
const LABEL_TO_SITE: Record<string, SiteId> = {
  mazar: "mazar",
  amaluza: "amaluza",
  molino: "molino",
  paute: "molino",
  sopladora: "sopladora",
  "cmr intr sopladora": "sopladora",
  "camara intermedia sopladora": "sopladora",
  minas: "minas_san_francisco",
  "minas san francisco": "minas_san_francisco",
  delsitanisagua: "delsitanisagua",
  alazan: "alazan",
  agoyan: "agoyan",
  manduriacu: "manduriacu",
  "coca codo sinclair": "coca_codo_sinclair",
  sni: "sni",
};

/** Throws on an unknown label: a renamed plant is schema drift and must not be guessed. */
export function siteFromLabel(label: string): SiteId {
  const site = LABEL_TO_SITE[normalizeLabel(label)];
  if (!site) throw new Error(`unknown site label from upstream: ${JSON.stringify(label)}`);
  return site;
}

/**
 * Endpoints whose rows describe a different day from the one they are stamped with.
 *
 * `repDiaNivQIng?fecha=D` answers with `"fecha":"D T05:00:00Z"` — local midnight of D, the date
 * asked for — and values that belong to **D−1**. It is not a rounding difference or a partial
 * day: the numbers are `repDiaHid12m`'s previous-day numbers exactly, to every decimal the
 * report publishes. Measured on 113 consecutive days of 2026 for level and inflow at Mazar,
 * Amaluza and Minas San Francisco (level 113/113 identical at D−1 against 0/113 at D), and on
 * the Phase 0 fixtures for 2016-06-15, 2019-06-15, 2022-01-15, 2024-10-15 and 2026-09-20, so it
 * is a decade-long property of the endpoint rather than something recent.
 *
 * Which side is wrong is not a judgement call either. `repDiaHid12m`'s dating is confirmed
 * twice over: against jordanvt18's independent scrape of the historian on 1,668 days, and
 * against our own historian walk on 4,281. Two routes with explicit local-midnight timestamps
 * agree; `repDiaNivQIng` is the one out of step, so its rows are stored under the day they
 * describe and the raw response keeps its own `fecha` in the archive.
 *
 * `repDiaPotQTurb` has the same habit, and it is tied to this one number for number. Molino's
 * tailrace feeds Sopladora's intake chamber directly, and the two reports publish that one
 * flow twice: asked for the same `fecha`, `repDiaNivQIng`'s Sopladora `q_ingresado` is
 * `repDiaPotQTurb`'s Molino `q_turbinado` to every published decimal, on all 116 archived
 * requests (2026-06-01 → 2026-09-24) and on every Phase 0 fixture (2016 to 2026). One
 * reading from one instant cannot belong to two different days, so once `repDiaNivQIng` was
 * shifted, leaving this one alone stored the same number under D−1 for Sopladora and D for
 * Molino. The plants' own generation agrees independently. Against `repDiaEner12m` (energy
 * on day D + lag), turbined flow stored as published correlates at lag −1 / 0 / +1 with
 * Molino 0.826 / 0.635 / 0.270, Sopladora 0.777 / 0.625 / 0.288 and Mazar 0.588 / 0.458 / 0.137.
 * Minas San Francisco, at 0.726 / 0.760 / 0.389, does not separate the days; that is expected,
 * not a counterexample. The report is not a daily figure at all: `potencia` × 24 misses daily
 * energy by ~1,000 MWh, and against `{code}EnerDia`'s hours (2026-09-20 → 23) it sits between
 * the last hour of D−1 and the first hour of D. Molino 778.7 MW against 779.2 and 635.0,
 * Sopladora 448.9 against 451.2 and 368.3. So it is a snapshot taken at the midnight in its
 * own stamp. A snapshot at midnight describes a day only as much as that day's generation
 * holds steady up to midnight. That is why every r stays near 0.8 rather than 1, and it
 * explains Minas San Francisco: with the smallest reservoir, its output swings from hour to
 * hour, so its midnight value is no closer to one side of the boundary than the other.
 *
 * The family does not share the habit, which is why this is a list and not a rule:
 * `repDiaVolAlm` (level, 112/112 at offset 0) and `repDiaEnerAyerHoy` (energy against
 * `repDiaEner12m`, 112/112) are dated correctly despite the "Ayer" in that one's name, and so
 * is `repDiaRegAyer`. Its `Factor de Planta (%)` is `repDiaEner12m`'s energy for the stamped
 * day over a fixed capacity (Mazar 170.00, Minas San Francisco 270.00, Sopladora 486.90,
 * Molino 1096.78 MW) to within 0.1% on 458 of 458 plant-days at offset 0, against 1–3 per
 * plant at ±1. Its year-to-date energy is published in whole GWh, too coarse to date anything.
 *
 * Changing an entry here changes how new rows are dated, not the rows already stored:
 * `scripts/redate.ts` rebuilds a source's stored rows from the raw archive.
 */
export const DATA_DATE_OFFSET_DAYS: Record<string, number> = {
  "ords:repDiaNivQIng": -1,
  "ords:repDiaPotQTurb": -1,
};

/** `repDiaRegAyer` reports four plants as columns rather than rows. */
export const REG_AYER_COLUMN_TO_SITE: Record<string, SiteId> = {
  minas: "minas_san_francisco",
  mazar: "mazar",
  molino: "molino",
  sopladora: "sopladora",
};

/** `repDiaRegAyer` row descriptions -> variable. */
export const REG_AYER_DESCR_TO_VARIABLE: Record<string, VariableId> = {
  "energia anual acum gwh": "energia_anual_acum_gwh",
  "volumen vertido hm3": "volumen_vertido_hm3",
  "energia equi vertida gwh": "energia_vertida_gwh",
  "factor de planta": "factor_planta_pct",
};

/**
 * The fewest rows a 200 from each endpoint may parse to before it counts as a failure.
 *
 * A report that answers 200 with an empty `items` array looks exactly like a quiet day to the
 * parser, and was accepted silently: the feed then stalls for three days until freshness trips.
 * These floors turn that into an error on the run that saw it. They are deliberately low — one
 * row, where any row at all proves the endpoint is answering — because the point is to catch
 * "nothing", not to second-guess how many plants a report lists.
 *
 * `settleDays` is how long after the day asked about an empty answer stops being normal. The
 * per-day reports answer nothing for a day that has not been published yet (`repDiaVolAlm` for
 * the running day was empty on every run of 2026-09-22), so they are held to their floor only
 * for days at least two days old — which the daily run's three-day window always includes, and
 * which every one of them had answered for by the next morning in the committed record. `since`
 * is the first day a windowed report has anything to say, so a backfill that asks before it is
 * not an error either.
 *
 * Endpoints with no entry have no floor. The historian (`pointValuesMesH24`) answers null for
 * whole months as a known property of the endpoint (see sources/historian.ts), and a quiet month
 * there is information rather than failure. `{code}EnerDia` is never silent to begin with: its
 * parser writes a day only once all 24 hours are in and notes every day it leaves out, and
 * before a plant's commissioning (Agoyán's hours begin 2017-01-01) an empty day is the truth.
 */
export interface RowFloor {
  rows: number;
  settleDays: number;
  since?: string;
}

export const MIN_ROWS: Record<string, RowFloor> = {
  repDiaHid12m: { rows: 1, settleDays: 0, since: "2014-09-21" },
  repDiaEner12m: { rows: 1, settleDays: 0, since: "2016-05-01" },
  repDiaNivQIng: { rows: 1, settleDays: 2 },
  repDiaPotQTurb: { rows: 1, settleDays: 2 },
  repDiaEnerAyerHoy: { rows: 1, settleDays: 2 },
  repDiaRegAyer: { rows: 1, settleDays: 2 },
  repDiaVolAlm: { rows: 1, settleDays: 2 },
  csrCaudCuenAniosAvg: { rows: 1, settleDays: 0 },
  InformacionOperativa: { rows: 1, settleDays: 0 },
};

/** The floor that applies to one answer, or null when an empty one is acceptable. */
export function rowFloor(endpoint: string, dataDate: string | null, today: string): RowFloor | null {
  const floor = MIN_ROWS[endpoint];
  if (!floor) return null;
  if (dataDate !== null) {
    if (floor.since && dataDate < floor.since) return null;
    const settled = new Date(Date.parse(`${today}T00:00:00Z`) - floor.settleDays * 86_400_000).toISOString().slice(0, 10);
    if (floor.settleDays > 0 && dataDate > settled) return null;
  }
  return floor;
}
