/**
 * INAMHI's Hydropower app (`inamhi.geoglows.org/apps/hydropower`), read through the API it calls
 * (`services.geoglows.org/api/hydropowers/…`). Found by walking the app's bundles
 * (`data/reports/return-periods.md`); the host answers runners but not the development sandbox.
 *
 * For each of eight plants the app serves a 15-day forecast — GEOGLOWS' ensemble and its
 * high-resolution member, corrected to the plant's measured inflow — as a CSV
 * (`get-forecast-csv?hydropower=…&date=YYYY-MM-DD`), the same forecast drawn as a Plotly figure
 * pinned to the last observation (`get-forecast-plot`, five days), and the plant's daily inflow
 * history (`get-observed-data-plot`, whose one trace is labelled "Historical Simulation" but tracks
 * CELEC's measured inflow). Past dates are served back to 2025 at least, which is what makes a
 * backtest possible. These are the pure parsers.
 */

import type { IsoDate } from "../util/dates.ts";

/** INAMHI's plant names, as the app lists them, and this repository's site for each where it has one. */
export const INAMHI_PLANTS: Record<string, string | null> = {
  Agoyán: "agoyan",
  Amaluza: "amaluza",
  "Coca Codo Sinclair": "coca_codo_sinclair",
  "Daule Peripa": null,
  Delsitanisagua: "delsitanisagua",
  Mazar: "mazar",
  "Minas San Francisco": "minas_san_francisco",
  Pisayambo: null,
};

export const HYDROPOWER_API = "https://services.geoglows.org/api/hydropowers";

export const forecastCsvUrl = (plant: string, date: IsoDate) =>
  `${HYDROPOWER_API}/get-forecast-csv?hydropower=${encodeURIComponent(plant)}&date=${date}`;
export const forecastPlotUrl = (plant: string, date: IsoDate) =>
  `${HYDROPOWER_API}/get-forecast-plot?hydropower=${encodeURIComponent(plant)}&width=1000&height=600&date=${date}`;
export const observedPlotUrl = (plant: string) =>
  `${HYDROPOWER_API}/get-observed-data-plot?hydropower=${encodeURIComponent(plant)}&width=1000&height=600`;

/** A series at hours from the forecast's origin (00 UTC of its date). */
export interface Timed {
  hours: number[];
  values: number[];
}

const hoursFrom = (origin: IsoDate, stamp: string): number =>
  (Date.parse(`${stamp.slice(0, 10)}T${stamp.slice(11, 19) || "00:00:00"}Z`) - Date.parse(`${origin}T00:00:00Z`)) / 3_600_000;

/**
 * `datetime,flow_max,flow_75,flow_avg,flow_25,flow_min,high_res`, hourly rows with the ensemble
 * columns filled every third hour. Each column becomes its own series of the rows that fill it.
 */
export function parseForecastCsv(text: string, origin: IsoDate): Record<string, Timed> {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()?.split(",") ?? [];
  if (header[0] !== "datetime" || !header.includes("flow_avg")) throw new Error(`inamhi: not a forecast CSV (header ${header.join(",")})`);
  const out: Record<string, Timed> = Object.fromEntries(header.slice(1).map((h) => [h, { hours: [], values: [] }]));
  for (const line of lines) {
    const cells = line.split(",");
    const h = hoursFrom(origin, cells[0]!);
    header.slice(1).forEach((name, i) => {
      const raw = cells[i + 1];
      if (raw === undefined || raw === "") return;
      const v = Number(raw);
      if (!Number.isFinite(v)) return;
      out[name]!.hours.push(h);
      out[name]!.values.push(v);
    });
  }
  return out;
}

interface PlotlyTrace {
  name?: string;
  x?: string[];
  y?: (number | null)[];
}

/** A Plotly figure's traces by name. The app's JSON carries bare `NaN`, which JSON does not allow. */
export function parsePlotTraces(text: string, key: string): Map<string, { x: string[]; y: (number | null)[] }> {
  const doc = JSON.parse(text.replace(/\bNaN\b/g, "null")) as Record<string, { data?: PlotlyTrace[] }>;
  const figure = doc[key];
  if (!figure?.data) throw new Error(`inamhi: no figure "${key}" in the answer`);
  const out = new Map<string, { x: string[]; y: (number | null)[] }>();
  for (const t of figure.data)
    if (t.name && t.x && t.y) out.set(t.name.replace(/<br>/g, " ").replace(/\s+/g, " ").trim(), { x: t.x, y: t.y });
  return out;
}

/** The forecast plot's central line, as hours from the origin. */
export function plotMean(text: string, origin: IsoDate): Timed | null {
  const trace = parsePlotTraces(text, "fp").get("Pronóstico Media");
  if (!trace) return null;
  const hours: number[] = [];
  const values: number[] = [];
  trace.x.forEach((x, i) => {
    const v = trace.y[i];
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    hours.push(hoursFrom(origin, x.replace("T", " ")));
    values.push(v);
  });
  return { hours, values };
}

/** The observed-data plot's one trace, as a daily series. */
export function observedDaily(text: string): Map<IsoDate, number> {
  const traces = [...parsePlotTraces(text, "hs").values()];
  const out = new Map<IsoDate, number>();
  const t = traces[0];
  if (!t) return out;
  t.x.forEach((x, i) => {
    const v = t.y[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) out.set(x.slice(0, 10), v);
  });
  return out;
}
