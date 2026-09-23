/**
 * CENACE Información Operativa (`www.cenace.gob.ec/info-operativa/InformacionOperativa.htm`).
 *
 * Secondary source, used to cross-check SMEC and to show a live tile. Two cautions, both
 * established in Phase 0:
 *
 * - the "PRODUCCIÓN EN TIEMPO REAL" block is a running cumulative total for the current day
 *   (84 GWh at 18:59 on a day that closed near 105 GWh), so only the "INFORMACIÓN OPERATIVA
 *   DIARIA" block is a closed day;
 * - the page's Plotly pies mix units between tabs and are never parsed here. Only the visible
 *   key/value text is read, and the annual block is in GWh while the others are in MWh.
 *
 * The page itself says: "Datos preliminares del SCADA, sujetos a revisión y validación."
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { assertIsoDate, type IsoDate } from "../util/dates.ts";
import { normalizeLabel } from "../registry.ts";
import { parseEsNumber } from "../util/numbers.ts";

export type OperativaBlock = "tiempo_real" | "diaria" | "mensual" | "anual" | "demanda" | "demanda_empresas";

export interface OperativaMetric {
  block: OperativaBlock;
  /** The period as the page labels it, kept verbatim for traceability. */
  period_label: string;
  /** Resolved calendar day when the block describes one; null for month/year blocks. */
  period_date: IsoDate | null;
  metric: string;
  value: number;
  unit: "MWh" | "GWh" | "MW";
}

export interface OperativaSnapshot {
  metrics: OperativaMetric[];
  peak_month_label: string | null;
  peak_historic_label: string | null;
  disclaimer: string | null;
  notes: string[];
}

const MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

const PRODUCTION_METRICS: Record<string, string> = {
  "produccion total": "produccion_total",
  exportacion: "exportacion",
  importacion: "importacion",
  hidraulica: "hidraulica",
  termica: "termica",
  "r no convencional": "renovable_no_convencional",
};

const DEMAND_METRICS: Record<string, string> = {
  "demanda total": "demanda_total",
  anterior: "demanda_anterior",
  "demanda cnel": "demanda_cnel",
  "empresas electricas": "demanda_empresas_electricas",
};

/** `Lunes, 21 de septiembre de 2026` -> `2026-09-21`. Returns null for month/year labels. */
export function spanishDayToIso(label: string): IsoDate | null {
  const match = /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i.exec(label.normalize("NFC"));
  if (!match) return null;
  const month = MONTHS[normalizeLabel(match[2]!)];
  if (!month) return null;
  return assertIsoDate(`${match[3]}-${month}-${match[1]!.padStart(2, "0")}`);
}

/** Text nodes in document order; the page puts every label and every number in its own node. */
function textLines(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const lines: string[] = [];
  const walk = (node: AnyNode): void => {
    // domhandler types `type` as an ElementType enum whose Text member is the string "text".
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (node.type === "text") {
      const text = node.data.replace(/\s+/g, " ").trim();
      if (text) lines.push(text);
      return;
    }
    if ("children" in node) for (const child of node.children) walk(child);
  };
  for (const node of $.root().children().toArray()) walk(node);
  return lines;
}

interface Section {
  block: OperativaBlock;
  start: number;
}

/**
 * Section headings also appear as navigation links at the top of the page, so a heading only
 * opens a section when a date label and a "PRODUCCIÓN ENERGÉTICA"/"DEMANDA" heading follow it.
 */
function findSections(lines: string[]): Section[] {
  const markers: [RegExp, OperativaBlock][] = [
    [/^produccion en tiempo real$/, "tiempo_real"],
    [/^demandas empresas electricas de distribucion$/, "demanda"],
    [/^informacion operativa diaria$/, "diaria"],
    [/^informacion operativa mensual$/, "mensual"],
    [/^informacion operativa anual$/, "anual"],
  ];
  const sections: Section[] = [];
  lines.forEach((line, index) => {
    const normalized = normalizeLabel(line);
    for (const [pattern, block] of markers) {
      if (!pattern.test(normalized)) continue;
      const lookahead = lines.slice(index + 1, index + 5).map(normalizeLabel);
      if (!lookahead.some((l) => l.startsWith("produccion energetica") || l.startsWith("demanda"))) continue;
      sections.push({ block, start: index });
    }
  });
  return sections;
}

export function parseInformacionOperativa(html: string): OperativaSnapshot {
  const lines = textLines(html);
  const sections = findSections(lines);
  const notes: string[] = [];
  if (sections.length === 0) throw new Error("operativa: no recognisable sections; the page layout changed");

  const metrics: OperativaMetric[] = [];

  sections.forEach((section, i) => {
    const end = sections[i + 1]?.start ?? lines.length;
    const body = lines.slice(section.start + 1, end);
    const periodLabel = body.find((l) => /\d{4}/.test(l) && !/^\d+$/.test(l)) ?? "";
    const periodDate = spanishDayToIso(periodLabel);

    // "PRODUCCIÓN ENERGÉTICA (MWh)" / "(GWh)" fixes the unit for the whole block.
    const unitLine = body.find((l) => /produccion energetica/.test(normalizeLabel(l)));
    const energyUnit: "MWh" | "GWh" = unitLine && /gwh/i.test(unitLine) ? "GWh" : "MWh";

    for (let j = 0; j < body.length - 1; j++) {
      const label = normalizeLabel(body[j]!);
      const next = body[j + 1]!;

      const production = PRODUCTION_METRICS[label];
      if (production && section.block !== "demanda") {
        const value = parseEsNumber(next);
        if (value !== null) {
          metrics.push({ block: section.block, period_label: periodLabel, period_date: periodDate, metric: production, value, unit: energyUnit });
          j++;
        }
        continue;
      }

      if (section.block === "demanda") {
        const demand = DEMAND_METRICS[label];
        if (demand) {
          const value = parseEsNumber(next);
          if (value !== null) {
            metrics.push({ block: "demanda", period_label: periodLabel, period_date: periodDate, metric: demand, value, unit: "MW" });
            j++;
          }
          continue;
        }
        // The per-utility list puts name and value in one node: "EMELNORTE 138 MW".
        const utility = /^(.+?)\s+([\d\s\u00a0\u2009\u202f]+)\s*MW$/i.exec(body[j]!.trim());
        if (utility) {
          const value = parseEsNumber(utility[2]!);
          if (value !== null) {
            metrics.push({
              block: "demanda_empresas",
              period_label: periodLabel,
              period_date: periodDate,
              metric: normalizeLabel(utility[1]!).replace(/ /g, "_"),
              value,
              unit: "MW",
            });
          }
        }
      }
    }
  });

  const joined = lines.join("\n");
  const peakMonth = /Demanda m[áa]xima mensual:\s*(.+)/.exec(joined)?.[1]?.trim() ?? null;
  const peakHistoric = /Demanda m[áa]xima hist[óo]rica:\s*(.+)/.exec(joined)?.[1]?.trim() ?? null;
  const disclaimer = lines.find((l) => /Datos preliminares del SCADA/i.test(l)) ?? null;

  if (!metrics.some((m) => m.block === "diaria")) {
    notes.push("operativa: no closed-day block found; only the running total was published");
  }
  return { metrics, peak_month_label: peakMonth, peak_historic_label: peakHistoric, disclaimer, notes };
}
