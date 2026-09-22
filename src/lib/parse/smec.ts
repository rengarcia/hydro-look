/**
 * CENACE SMEC daily energy balance: `ResultadoInforme1.do?fecha=YYYY/MM/DD`.
 *
 * This is the project's primary national source because it reports the *closed* day in
 * absolute kWh and is date-parameterised all the way back to at least 2016-05-01.
 *
 * The report's shape moves with the era: 2016 has "Generación Motores Diesel" and "Turbinas a
 * Nafta" and no Perú interconnection rows, later years drop the first two and add the second.
 * The parser is therefore label-driven — every row label must be known, but no row is required
 * except the core set that makes a report meaningful.
 */

import * as cheerio from "cheerio";
import { assertIsoDate, type IsoDate } from "../util/dates.ts";
import { normalizeLabel } from "../registry.ts";
import { parseEsNumber } from "../util/numbers.ts";

export const SMEC_CONCEPTS = {
  "generacion hidraulica": "generacion_hidraulica",
  "generacion vapor bunker": "generacion_vapor_bunker",
  "generacion turbinas a gas": "generacion_turbinas_gas",
  "generacion turbinas a diesel": "generacion_turbinas_diesel",
  "generacion motores bunker": "generacion_motores_bunker",
  "generacion motores diesel": "generacion_motores_diesel",
  "generacion turbinas a nafta": "generacion_turbinas_nafta",
  "generacion de otros tipos": "generacion_otros_tipos",
  "total generacion": "total_generacion",
  "importacion de colombia": "importacion_colombia",
  "importacion de peru": "importacion_peru",
  "total importacion": "total_importacion",
  "exportacion a colombia": "exportacion_colombia",
  "exportacion a peru": "exportacion_peru",
  "total exportacion": "total_exportacion",
  "demanda distribucion": "demanda_distribucion",
  "total perdidas transporte": "total_perdidas_transporte",
} as const;

export type SmecConcept = (typeof SMEC_CONCEPTS)[keyof typeof SMEC_CONCEPTS];

/** A report without these is a stub, not a balance: CENACE publishes the running day that way. */
const REQUIRED_CONCEPTS: SmecConcept[] = ["generacion_hidraulica", "total_generacion", "demanda_distribucion"];

export interface SmecRow {
  date: IsoDate;
  concepto: SmecConcept;
  dia_kwh: number | null;
  pct_dia: number | null;
  mes_kwh: number | null;
  pct_mes: number | null;
  anio_kwh: number | null;
  pct_anio: number | null;
  ultimos365_kwh: number | null;
}

export interface SmecReport {
  date: IsoDate;
  tipo_dia: string;
  tipo_dia_anio_anterior: string;
  rows: SmecRow[];
  /** False for the running day, which CENACE publishes with the section headings and no data. */
  complete: boolean;
  notes: string[];
}

type ColumnKey = keyof Omit<SmecRow, "date" | "concepto">;

const HEADER_PATTERNS: [RegExp, ColumnKey][] = [
  [/en el dia.*kwh/, "dia_kwh"],
  [/incremento\s*dia/, "pct_dia"],
  [/en el mes.*kwh/, "mes_kwh"],
  [/incremento\s*mes/, "pct_mes"],
  [/en el ano.*kwh/, "anio_kwh"],
  [/incremento\s*ano/, "pct_anio"],
  [/ultimos 365/, "ultimos365_kwh"],
];

function columnKey(header: string): ColumnKey | null {
  const normalized = normalizeLabel(header);
  for (const [pattern, key] of HEADER_PATTERNS) if (pattern.test(normalized)) return key;
  return null;
}

/** `parse` never throws on an unexpected *date*; it throws on an unexpected *structure*. */
export function parseSmecInforme1(html: string, requestedDate: IsoDate): SmecReport {
  const $ = cheerio.load(html);
  const text = $.root().text().replace(/\s+/g, " ");

  const dateMatch = /Fecha:\s*(\d{4})\/(\d{2})\/(\d{2})/.exec(text);
  if (!dateMatch) throw new Error(`smec: no "Fecha:" in the response for ${requestedDate}`);
  const date = assertIsoDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);

  const notes: string[] = [];
  if (date !== requestedDate) notes.push(`smec: asked for ${requestedDate}, report says ${date}`);

  const tipoMatch = /Tipo D[ií]a:\s*(.+?)\s+Tipo D[ií]a A[ñn]o Anterior:\s*([^ ]+)/.exec(text);
  const tipo_dia = tipoMatch?.[1]?.trim() ?? "";
  const tipo_dia_anio_anterior = tipoMatch?.[2]?.trim() ?? "";

  let columns: ColumnKey[] | null = null;
  const rows: SmecRow[] = [];
  const seen = new Set<SmecConcept>();

  $("tr").each((_, tr) => {
    // Direct children only: SMEC nests the report table inside layout tables, so `find`
    // would hand the outer row the entire document as one cell.
    if ($(tr).find("table").length > 0) return;
    const cells = $(tr)
      .children("td, th")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 2) return;

    const label = cells[0] ?? "";
    // The header row is the one whose first cell is "Tipo Generación".
    if (normalizeLabel(label) === "tipo generacion") {
      const keys = cells.slice(1).map(columnKey);
      const unknown = cells.slice(1).filter((_c, i) => keys[i] === null);
      if (unknown.length > 0) throw new Error(`smec: unrecognised column headers [${unknown.join(" | ")}]`);
      columns = keys as ColumnKey[];
      return;
    }

    const concepto = SMEC_CONCEPTS[normalizeLabel(label) as keyof typeof SMEC_CONCEPTS];
    if (!concepto) {
      // Section headings ("Balance Generación") are single-cell rows and carry no numbers.
      const hasNumbers = cells.slice(1).some((c) => parseEsNumber(c) !== null);
      if (hasNumbers && label !== "") throw new Error(`smec: unknown row label ${JSON.stringify(label)}`);
      return;
    }
    if (!columns) throw new Error("smec: data row appeared before the header row");

    const row: SmecRow = {
      date,
      concepto,
      dia_kwh: null,
      pct_dia: null,
      mes_kwh: null,
      pct_mes: null,
      anio_kwh: null,
      pct_anio: null,
      ultimos365_kwh: null,
    };
    (columns as ColumnKey[]).forEach((key, index) => {
      row[key] = parseEsNumber(cells[index + 1] ?? "");
    });
    rows.push(row);
    seen.add(concepto);
  });

  const missing = REQUIRED_CONCEPTS.filter((c) => !seen.has(c));
  const totalGeneration = rows.find((r) => r.concepto === "total_generacion")?.dia_kwh ?? 0;
  const complete = missing.length === 0 && totalGeneration > 0;
  if (!complete) {
    notes.push(
      `smec ${date}: report is incomplete (${missing.length > 0 ? `missing ${missing.join(", ")}` : "total generación is 0"}); CENACE publishes the running day this way until D+1`,
    );
  }
  return { date, tipo_dia, tipo_dia_anio_anterior, rows, complete, notes };
}
