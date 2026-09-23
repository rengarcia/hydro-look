/**
 * Spanish formatting. Decision 3: the published site is in Spanish, the code is in English.
 *
 * `es-EC` gives the thousands point and decimal comma Ecuador writes, and every call goes
 * through here so one locale decision is made once. Nulls become an em dash rather than "0" or
 * "null": a number this project does not have is not a number it knows to be zero, and the
 * distinction is the whole point of several of these fields.
 */

import { isSiteId, SITES } from "../registry.ts";
import { declarationCode, feedCode } from "../publish/contract.ts";

const LOCALE = "es-EC";

export const EM_DASH = "—";

export function num(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;
  return value.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A signed number, for a slope where the sign is the message. */
export function signed(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;
  return `${value > 0 ? "+" : ""}${num(value, digits)}`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? EM_DASH : `${num(value, digits)} %`;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** `2026-09-21` -> `21 de septiembre de 2026`. Built from the parts, never from `new Date`. */
export function longDate(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return EM_DASH;
  const [year, month, day] = iso.slice(0, 10).split("-");
  const name = MONTHS[Number(month) - 1];
  return name === undefined ? iso : `${Number(day)} de ${name} de ${year}`;
}

/** `2026-09-21` -> `21 sep`, for an axis where the year is already in the caption. */
export function shortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-");
  const name = MONTHS[Number(month) - 1];
  return name === undefined ? iso : `${Number(day)} ${name.slice(0, 3)}`;
}

/** `2026-09-21` -> `21 sep 2026`, where no caption carries the year for it. */
export function dateWithYear(iso: string): string {
  return `${shortDate(iso)} ${iso.slice(0, 4)}`;
}

/** `servicio de reportes` -> `Servicio de reportes`. */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The Spanish label for each SMEC concept, so the site never prints a column name. */
export const CONCEPT_LABELS: Record<string, string> = {
  generacion_hidraulica: "Hidroeléctrica",
  generacion_turbinas_gas: "Turbinas a gas",
  generacion_motores_bunker: "Motores de búnker",
  generacion_vapor_bunker: "Vapor de búnker",
  generacion_turbinas_diesel: "Turbinas diésel",
  generacion_otros_tipos: "Otros tipos",
  total_importacion: "Importación",
  total_exportacion: "Exportación",
  total_generacion: "Generación total",
  demanda_distribucion: "Demanda de distribución",
  total_perdidas_transporte: "Pérdidas de transporte",
};

export function conceptLabel(concept: string): string {
  return CONCEPT_LABELS[concept] ?? concept;
}

/**
 * The Spanish label of a feed in `status.json`. Since schema version 1 each feed carries its own
 * `label_es`; a document written before that is looked up by its English label instead.
 */
export function feedLabel(feed: { label_es?: string; feed?: string }): string {
  return feed.label_es ?? feedCode(feed.feed ?? "").label_es;
}

/** How a band was declared, in the page's words: the document's own label, or the code's. */
export function declarationLabel(band: { declaration: string; declaration_es?: string }): string {
  return band.declaration_es ?? declarationCode(band.declaration).label_es;
}

/** Basin ids are lowercase registry keys; every one of them is named after its river. */
const BASIN_ES: Record<string, string> = {
  paute: "Paute",
  jubones: "Jubones",
  zamora: "Zamora",
  pastaza: "Pastaza",
  guayllabamba: "Guayllabamba",
  coca: "Coca",
};

export function basinLabel(basin: string): string {
  return `cuenca del ${BASIN_ES[basin] ?? basin.charAt(0).toUpperCase() + basin.slice(1)}`;
}

/**
 * Quality findings are written in English for the log and `status.json`. The one that stays
 * open in normal operation is said in Spanish; any other is named by its check and pointed at
 * the document that carries its detail, rather than pasted into a Spanish page untranslated.
 */
function siteName(site: string): string {
  return isSiteId(site) ? SITES[site].label : site;
}

export function findingText(finding: { check: string; level: string; message: string }): string {
  const offBook = /^(\d+) percentage\(s\) sit outside 0\.\.100\b.*first: ([a-z_]+)\/\w+ (\d{4}-\d{2}-\d{2}) ([\d.]+)/.exec(finding.message);
  if (offBook) {
    const [, count, site, date, value] = offBook;
    return (
      `${count} porcentajes quedan fuera de 0–100 %: un embalse por encima de su banda declarada o una central ` +
      `por encima de su capacidad nominal, no un error (el primero: ${siteName(site!)}, ${longDate(date)}, ${num(Number(value), 1)} %)`
    );
  }
  const level = finding.level === "fail" ? "fallo" : "aviso";
  return `${level} de la comprobación «${finding.check}» (detalle en status.json)`;
}
