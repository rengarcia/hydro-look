/**
 * The public data contract: what every document under `public/api/` promises a third party.
 *
 * Five scripts write those documents — `publish.ts`, `check.ts`, `forecast.ts`, `adequacy.ts`
 * and `narrative.ts` — and each one owns its own shape. What they share is stamped here, in
 * one place, so the promise cannot drift between them:
 *
 * - **`schema_version`** is the version of the *format*, not of any model. It changes only when
 *   a field is removed, renamed or retyped; adding a field does not change it. Each version has
 *   a JSON Schema under `public/api/schema/`, and `tests/publish.test.ts` validates every
 *   committed document against its schema, so a shape change is a failing test before it is a
 *   broken consumer.
 * - **`data_date`** is the one date name every document shares, and it has one meaning: the
 *   Ecuadorian calendar day the document's readings describe. In the forecast, adequacy and
 *   narrative documents it equals `origin_date`, the day the models stand on. In `latest.json`
 *   and `status.json` it is the newest day a reservoir level or a closed national balance
 *   describes. The older `as_of` — the day the job *ran*, one day later than every reading in
 *   it — stays in schema version 1 as a deprecated alias and goes in version 2.
 * - **Codes are English slugs; labels are Spanish and sit beside them.** A feed is
 *   `ords_levels`, not the sentence its log line uses; a band declaration is `report_endpoint`;
 *   a risk tier is `watch`. The site prints the `_es` label and never trims a code with a regex.
 * - **`license` and `attribution`** say what may be done with the numbers and who to credit.
 * - **`see_also`** holds absolute URLs, so a document fetched on its own still links to the rest.
 *
 * Nothing here reads a file or the clock: `withContract` is a pure function of the document it
 * is handed, and it is idempotent, so restamping a document that already carries the block is a
 * no-op rather than a second copy.
 */

export const SCHEMA_VERSION = 1;

/**
 * Where the site is served. Every absolute URL in the documents and in the page's metadata is
 * built from this, so a new domain is one environment variable at build and publish time rather
 * than a search-and-replace.
 */
export const SITE_URL = (process.env["HYDRO_LOOK_SITE_URL"]?.trim() || "https://hydro-look.vercel.app").replace(/\/+$/, "");

export const REPO_URL = "https://github.com/rengarcia/hydro-look";

export const DOCUMENTS = ["latest", "status", "forecast", "adequacy", "narrative"] as const;
export type DocumentName = (typeof DOCUMENTS)[number];

export function apiUrl(name: DocumentName): string {
  return `${SITE_URL}/api/${name}.json`;
}

export function schemaUrl(name: DocumentName): string {
  return `${SITE_URL}/api/schema/${name}.schema.json`;
}

export const LICENSE = {
  code: "MIT",
  code_url: `${REPO_URL}/blob/main/LICENSE`,
  data:
    "Copies of public data. Each upstream source keeps its own terms, listed in `attribution`; " +
    "credit them, and this project, when you republish.",
  data_es:
    "Copias de datos públicos. Cada fuente conserva sus propios términos, listados en `attribution`; " +
    "cítelas, y a este proyecto, al republicar.",
} as const;

export interface Attribution {
  id: string;
  name: string;
  provides: string;
  url: string;
  terms: string;
  terms_es: string;
}

export const ATTRIBUTION: readonly Attribution[] = [
  {
    id: "celec",
    name: "CELEC EP",
    provides: "reservoir levels, inflows, declared bands and per-plant energy",
    url: "https://www.celec.gob.ec/",
    terms: "public web services of a state company; no licence is stated",
    terms_es: "servicios web públicos de una empresa del Estado; no declaran licencia",
  },
  {
    id: "cenace",
    name: "CENACE",
    provides: "the national energy balance and live operating data",
    url: "https://www.cenace.gob.ec/",
    terms: "public web services of the system operator; no licence is stated",
    terms_es: "servicios web públicos del operador del sistema; no declaran licencia",
  },
  {
    id: "xm",
    name: "XM S.A. E.S.P.",
    provides: "Colombian storage and cross-border exchanges",
    url: "https://www.xm.com.co/",
    terms: "public data portal of the Colombian market operator",
    terms_es: "portal de datos públicos del operador del mercado colombiano",
  },
  {
    id: "open_meteo",
    name: "Open-Meteo (ERA5 and forecast models)",
    provides: "precipitation and temperature at the basin centroids",
    url: "https://open-meteo.com/",
    terms: "CC BY 4.0 (https://open-meteo.com/en/terms); the free API is for non-commercial use",
    terms_es: "CC BY 4.0 (https://open-meteo.com/en/terms); la API gratuita es para uso no comercial",
  },
  {
    id: "geoglows",
    name: "GEOGLOWS River Forecast System v2 (ECMWF, BYU; shown in Ecuador by the INAMHI–GEOGLOWS portal)",
    provides: "streamflow return periods at the rivers the dams stand on",
    url: "https://inamhi.geoglows.org/",
    terms: "CC BY-NC-SA 4.0, the licence of the return-period store: credit it, no commercial use, share derivatives alike",
    terms_es: "CC BY-NC-SA 4.0, la licencia del almacén de periodos de retorno: citarlo, sin uso comercial, compartir igual",
  },
  {
    id: "noaa",
    name: "NOAA PSL / CPC",
    provides: "the Oceanic Niño Index",
    url: "https://psl.noaa.gov/data/correlation/oni.data",
    terms: "US government work, public domain",
    terms_es: "obra del Gobierno de EE. UU., dominio público",
  },
];

/* --------------------------------------------------------------------------- codes */

/** The feeds `status.json` reports, keyed by the English label `check.ts` logs them under. */
export const FEEDS: Record<string, { id: string; label_es: string }> = {
  "ORDS levels and inflows (repDiaHid12m)": { id: "ords_levels", label_es: "ORDS: cotas y caudales" },
  "ORDS CELEC Sur energy (repDiaEner12m)": { id: "ords_energy", label_es: "ORDS: energía CELEC Sur" },
  "ORDS historian (pointValues)": { id: "ords_historian", label_es: "ORDS: historiador" },
  "CENACE SMEC national balance": { id: "smec_balance", label_es: "CENACE SMEC: balance nacional" },
  "CENACE Información Operativa": { id: "cenace_operativa", label_es: "CENACE: Información Operativa" },
  "Open-Meteo ERA5": { id: "era5", label_es: "Open-Meteo ERA5" },
  "NOAA ONI": { id: "oni", label_es: "NOAA ONI" },
  "XM exchanges with Colombia": { id: "xm_exchanges", label_es: "XM: intercambios con Colombia" },
  "XM Colombian storage": { id: "xm_storage", label_es: "XM: embalses de Colombia" },
  "Mazar level forecast": { id: "mazar_forecast", label_es: "Pronóstico de cota de Mazar" },
  "National adequacy": { id: "adequacy", label_es: "Suficiencia nacional" },
};

/** Feeds whose newest day is a reading of the fleet or the grid, which is what `data_date` means. */
const READING_FEEDS = new Set(["ords_levels", "ords_historian", "smec_balance"]);

/** `"ORDS levels and inflows"` -> `ords_levels_and_inflows`, for a label nobody has coded yet. */
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function feedCode(label: string): { id: string; label_es: string } {
  return FEEDS[label] ?? { id: slug(label), label_es: label };
}

/** How each band in `thresholds.csv` was declared. */
export const DECLARATIONS: Record<string, { code: string; label_es: string }> = {
  "report endpoint": { code: "report_endpoint", label_es: "servicio de reportes" },
  "dashboard chart title": { code: "dashboard_chart_title", label_es: "título del gráfico del tablero" },
};

export function declarationCode(declaration: string): { code: string; label_es: string } {
  const known = DECLARATIONS[declaration];
  if (known) return known;
  const byCode = Object.values(DECLARATIONS).find((d) => d.code === declaration);
  return byCode ?? { code: slug(declaration), label_es: declaration };
}

/**
 * The adequacy tiers. The model writes the Spanish word (`vigilancia`), which schema version 1
 * keeps in `tier`; the stable code beside it is English, and the label is what the page prints.
 */
export const TIER_CODES: Record<string, { code: string; label_es: string }> = {
  holgado: { code: "comfortable", label_es: "Holgado" },
  vigilancia: { code: "watch", label_es: "Vigilancia" },
  ajustado: { code: "tight", label_es: "Ajustado" },
  deficit: { code: "deficit", label_es: "Déficit" },
};

export function tierCode(tier: string): string {
  return TIER_CODES[tier]?.code ?? slug(tier);
}

/**
 * Which of `adequacy.json`'s two tiers the narrative is written about. The document carries the
 * tier at the first horizon (`current.tier`) and the worst across all of them
 * (`current.worst_tier`); the text is handed the worst one (`narrative/payload.ts`), and the
 * document now says so rather than leaving a reader to guess which the prose meant.
 */
export const NARRATIVE_TIER_FIELD = "worst_tier";

/* ---------------------------------------------------------------------- see_also */

/**
 * A `see_also` value made absolute: `/api/x.json` onto the site, `data/…` onto the repository.
 * Anything already absolute is left as it is.
 */
export function absolute(link: string): string {
  if (/^https?:\/\//.test(link)) return link;
  if (link.startsWith("/")) return `${SITE_URL}${link}`;
  return `${REPO_URL}/blob/main/${link.replace(/^\.\//, "")}`;
}

export function seeAlso(self: DocumentName, existing: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, link] of Object.entries(existing)) out[key] = absolute(link);
  for (const name of DOCUMENTS) if (name !== self && !(name in out)) out[name] = apiUrl(name);
  out["schema"] = schemaUrl(self);
  out["documentation"] = `${SITE_URL}/datos/`;
  return out;
}

/* ---------------------------------------------------------------------- stamping */

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** The newest reading day across the feeds that describe the fleet or the grid. */
function statusDataDate(feeds: unknown): string | null {
  if (!Array.isArray(feeds)) return null;
  let newest: string | null = null;
  for (const feed of feeds) {
    if (!isObject(feed) || !READING_FEEDS.has(String(feed["id"]))) continue;
    const latest = stringOr(feed["latest"], null);
    if (latest !== null && (newest === null || latest > newest)) newest = latest;
  }
  return newest;
}

function withTierCodes(block: Json): Json {
  const out: Json = { ...block };
  for (const key of ["tier", "worst_tier"]) {
    const value = block[key];
    if (typeof value === "string") {
      out[`${key}_code`] = tierCode(value);
      out[`${key}_label_es`] = TIER_CODES[value]?.label_es ?? value;
    }
  }
  return out;
}

/** The per-document additions: codes beside the Spanish words, and which tier the text uses. */
function specifics(name: DocumentName, document: Json): Json {
  switch (name) {
    case "status": {
      const feeds = Array.isArray(document["feeds"])
        ? (document["feeds"] as unknown[]).map((feed) => {
            if (!isObject(feed)) return feed;
            const code = feedCode(String(feed["feed"] ?? feed["id"] ?? ""));
            return { id: code.id, label_es: code.label_es, ...feed };
          })
        : document["feeds"];
      return { feeds };
    }
    case "adequacy": {
      const out: Json = {};
      if (isObject(document["current"])) {
        out["current"] = { ...withTierCodes(document["current"]), narrative_tier_field: NARRATIVE_TIER_FIELD };
      }
      if (Array.isArray(document["horizons"])) {
        out["horizons"] = (document["horizons"] as unknown[]).map((h) => (isObject(h) ? withTierCodes(h) : h));
      }
      if (isObject(document["tiers"])) {
        out["tiers"] = { ...document["tiers"], codes: TIER_CODES };
      }
      return out;
    }
    case "narrative": {
      const tier = document["risk_tier"];
      return {
        risk_tier_code: typeof tier === "string" ? tierCode(tier) : null,
        risk_tier_source: `adequacy.current.${NARRATIVE_TIER_FIELD}`,
      };
    }
    default:
      return {};
  }
}

/** Old fields kept for one schema version, with what replaces them. */
const DEPRECATED: Partial<Record<DocumentName, Record<string, string>>> = {
  latest: { as_of: "data_date; as_of is the day the job ran, not the day the readings describe. Removed in schema_version 2." },
  status: {
    as_of: "data_date; as_of is the day the check ran. Removed in schema_version 2.",
    "feeds[].feed": "feeds[].id for the code and feeds[].label_es for the label. Removed in schema_version 2.",
  },
};

export interface ContractFields {
  schema_version: number;
  data_date: string | null;
  license: typeof LICENSE;
  attribution: readonly Attribution[];
  see_also: Record<string, string>;
}

/**
 * A document with the contract stamped on it. `schema_version` goes first so a consumer reading
 * the head of the file sees it; the provenance goes last, after the numbers.
 */
export function withContract<T extends object>(name: DocumentName, document: T): T & ContractFields {
  const doc = document as unknown as Json;
  const body: Json = { ...doc, ...specifics(name, doc) };
  // Stamped fields are rebuilt, never carried over, so stamping twice gives the same document.
  for (const key of ["schema_version", "generated_at", "data_date", "deprecated", "license", "attribution", "see_also"]) {
    delete body[key];
  }
  const dataDate =
    stringOr(doc["data_date"], null) ?? stringOr(doc["origin_date"], null) ?? (name === "status" ? statusDataDate(body["feeds"]) : null);
  const existing = doc["see_also"];
  return {
    schema_version: SCHEMA_VERSION,
    ...(doc["generated_at"] !== undefined ? { generated_at: doc["generated_at"] } : {}),
    data_date: dataDate,
    ...body,
    ...(DEPRECATED[name] ? { deprecated: DEPRECATED[name] } : {}),
    license: LICENSE,
    attribution: ATTRIBUTION,
    see_also: seeAlso(name, isObject(existing) ? (existing as Record<string, string>) : {}),
  } as unknown as T & ContractFields;
}

/** The file body a script writes: the stamped document, pretty-printed, with a final newline. */
export function publicJson(name: DocumentName, document: object): string {
  return `${JSON.stringify(withContract(name, document), null, 2)}\n`;
}
