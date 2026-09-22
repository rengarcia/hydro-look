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
