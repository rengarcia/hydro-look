/**
 * What each reservoir's gauge may claim about its water, from `data/reference/reservoir_geometry.csv`
 * and the fitted curve in `forecast.json`.
 *
 * The reservoirs fall into four kinds, and the gauge says a different thing for each:
 *
 * - **A curve** — Mazar's fit, or a design curve for Amaluza, Minas San Francisco, Manduriacu and
 *   Agoyán. The gauge is drawn in the shape and its percentage is a share of water.
 * - **A pond** — Delsitanisagua and Coca Codo Sinclair's compensation reservoir hold well under a
 *   cubic hectometre, an hour or so of flow, and nothing fixes their shape. The gauge stays a
 *   straight level bar and says how small the pond is, which is the useful fact about it.
 * - **A chamber** — Sopladora has no reservoir at all, only the chamber Molino's tailrace runs
 *   through; what matters is how close the level is to the trip and the spill.
 * - **Nothing** — the gauge stays as it was.
 *
 * Where a site has both a fit and a design curve (Mazar), the fit draws the shape — it is the one
 * backtested against this repository's readings — and the design curve only bounds the absolute
 * volume, which the two disagree on by a third (`reports/Reservoir shape curves Ecuador.md`).
 */

import { areaVolumeCurve, isAreaCurve, twoPointCurve, type AreaCurve } from "./shape.ts";

export const GEOMETRY_FILE = "reservoir_geometry.csv";

export interface SiteGeometry {
  /** The curve that draws the gauge and its share; null draws it straight. */
  curve: AreaCurve | null;
  curveSource: "fit" | "design" | null;
  /** Curves whose volumes bound the absolute figure, the drawing curve first. Empty hides hm³. */
  volumeCurves: AreaCurve[];
  /** A pond too small to shape: its whole volume, hm³. */
  pondHm3: number | null;
  /** The plant's design flow, m³/s, to say the pond's volume in hours of it. */
  designFlowM3s: number | null;
  /** Below this the reservoir is being drawn down past normal operation (flushing, emptying). */
  designMinMasl: number | null;
  /** A chamber's thresholds: the plant trips below one and the chamber spills above the other. */
  tripMasl: number | null;
  spillMasl: number | null;
  /** The cited sources, for the page that explains the gauge. */
  source: string;
}

export type Geometry = Partial<Record<string, SiteGeometry>>;

function number(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The design curve a row describes, or null for a row that describes none or an impossible one. */
export function designCurve(row: Record<string, string>): AreaCurve | null {
  const riverbed = number(row["riverbed_masl"]);
  const upperMasl = number(row["upper_masl"]);
  const upperHm3 = number(row["upper_hm3"]);
  if (riverbed === null || upperMasl === null || upperHm3 === null) return null;
  if (row["kind"] === "design_two_point") {
    const lowerMasl = number(row["lower_masl"]);
    const lowerHm3 = number(row["lower_hm3"]);
    if (lowerMasl === null || lowerHm3 === null) return null;
    return twoPointCurve(riverbed, { masl: upperMasl, hm3: upperHm3 }, { masl: lowerMasl, hm3: lowerHm3 });
  }
  if (row["kind"] === "design_area_volume") {
    const km2 = number(row["upper_area_km2"]);
    return km2 === null ? null : areaVolumeCurve(riverbed, { masl: upperMasl, hm3: upperHm3, km2 });
  }
  return null;
}

/**
 * Every site's geometry: the reference rows, with `fits` — fitted curves by site — taking over
 * the drawing wherever one exists.
 */
export function geometryFrom(rows: Record<string, string>[], fits: Partial<Record<string, AreaCurve>> = {}): Geometry {
  const out: Geometry = {};
  for (const row of rows) {
    const site = row["site"];
    if (!site) continue;
    const kind = row["kind"];
    const design = designCurve(row);
    const fit = fits[site];
    const curve = fit && isAreaCurve(fit) ? fit : design;
    const shown = row["volume_shown"] === "yes";
    out[site] = {
      curve,
      curveSource: curve === null ? null : curve === design ? "design" : "fit",
      volumeCurves: shown ? [curve, design].filter((c, i, all): c is AreaCurve => c !== null && all.indexOf(c) === i) : [],
      pondHm3: kind === "pond" ? number(row["upper_hm3"]) : null,
      designFlowM3s: number(row["design_flow_m3s"]),
      designMinMasl: number(row["design_min_masl"]),
      tripMasl: kind === "chamber" ? number(row["trip_masl"]) : null,
      spillMasl: kind === "chamber" ? number(row["spill_masl"]) : null,
      source: row["source"] ?? "",
    };
  }
  for (const [site, fit] of Object.entries(fits)) {
    if (out[site] || !fit || !isAreaCurve(fit)) continue;
    out[site] = {
      curve: fit,
      curveSource: "fit",
      volumeCurves: [fit],
      pondHm3: null,
      designFlowM3s: null,
      designMinMasl: null,
      tripMasl: null,
      spillMasl: null,
      source: "",
    };
  }
  return out;
}
