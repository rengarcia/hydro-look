/**
 * Spanish formatting. Decision 3: the published site is in Spanish, the code is in English.
 *
 * `es-EC` gives the thousands point and decimal comma Ecuador writes, and every call goes
 * through here so one locale decision is made once. Nulls become an em dash rather than "0" or
 * "null": a number this project does not have is not a number it knows to be zero, and the
 * distinction is the whole point of several of these fields.
 */

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

/** The Spanish label for each feed in `status.json`, which names its endpoints in English. */
export function feedLabel(feed: string): string {
  return feed
    .replace("ORDS levels and inflows", "ORDS: cotas y caudales")
    .replace("ORDS CELEC Sur energy", "ORDS: energía CELEC Sur")
    .replace("ORDS historian", "ORDS: historiador")
    .replace("CENACE SMEC national balance", "CENACE SMEC: balance nacional")
    .replace("CENACE Información Operativa", "CENACE: Información Operativa")
    .replace("Open-Meteo ERA5", "Open-Meteo ERA5")
    .replace("NOAA ONI", "NOAA ONI")
    .replace("Mazar level forecast", "Pronóstico de cota de Mazar")
    .replace("National adequacy", "Suficiencia nacional");
}
