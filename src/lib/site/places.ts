/**
 * Where things are: the plants, the catchments above their dams, and the base layers under them,
 * read into the shapes the maps draw.
 *
 * Three committed files, all under `data/reference/`:
 *
 * - `plant_locations.csv` — a point for each plant of more than 100 MW in Sterl et al. (2026,
 *   *Nature Water* 4, 571–585, Fig. 1) and for Manduriacu, with the paper's capacity, year in
 *   service and storage class, and the source of each coordinate.
 * - `catchments.geojson` — `npm run catchments`: each dam's catchment and pour point.
 * - `basemap.geojson` — `npm run basemap`: countries, relief, rivers traced from the DEM, cities.
 *
 * The parsing is pure and takes the parsed documents, so the tests feed it small ones.
 */

import type { Box } from "./map.ts";
import { boxOf } from "./map.ts";

export const PLANT_LOCATIONS_FILE = "plant_locations.csv";
export const CATCHMENTS_FILE = "catchments.geojson";
export const BASEMAP_FILE = "basemap.geojson";

export interface PlantPlace {
  key: string;
  /** The reservoir this point belongs to on the site, when the site follows one. */
  siteId: string | null;
  name: string;
  feature: "dam" | "powerhouse";
  river: string;
  slope: "amazon" | "pacific";
  capacityMw: number | null;
  inService: number | null;
  /** Sterl et al.'s class: more or less than five days of average discharge in storage. */
  storage: ">5" | "<5" | null;
  /** The plant's numeral in the paper's Fig. 1, `i` to `x`. */
  paperLabel: string | null;
  lat: number;
  lon: number;
  source: string;
  notes: string;
}

const numberOrNull = (v: string | undefined): number | null => (v === undefined || v.trim() === "" ? null : Number(v));

export function plantPlaces(rows: readonly Record<string, string>[]): PlantPlace[] {
  return rows.map((row) => {
    const lat = numberOrNull(row["lat"]);
    const lon = numberOrNull(row["lon"]);
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon))
      throw new Error(`plant_locations.csv: ${row["key"]} has no position`);
    const feature = row["feature"];
    if (feature !== "dam" && feature !== "powerhouse") throw new Error(`plant_locations.csv: ${row["key"]} is a "${feature}"`);
    const storage = row["storage_days_class"];
    return {
      key: row["key"] ?? "",
      siteId: row["site_id"] || null,
      name: row["name"] ?? "",
      feature,
      river: row["river"] ?? "",
      slope: row["slope"] === "pacific" ? "pacific" : "amazon",
      capacityMw: numberOrNull(row["capacity_mw"]),
      inService: numberOrNull(row["in_service"]),
      storage: storage === ">5" || storage === "<5" ? storage : null,
      paperLabel: row["paper_label"] || null,
      lat,
      lon,
      source: row["location_source"] ?? "",
      notes: row["notes"] ?? "",
    };
  });
}

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates?: unknown };
}

interface FeatureCollection {
  features: Feature[];
  metadata?: Record<string, unknown>;
}

export interface Catchment {
  site: string;
  basin: string;
  areaKm2: number;
  meanElevM: number | null;
  /** INAMHI's polygon this one overlaps best, and by how much (intersection over union). */
  inamhiBest: string | null;
  inamhiIou: number | null;
  pour: { lat: number; lon: number };
  locatedFrom: string;
  geometry: { type: string; coordinates?: unknown };
  box: Box;
}

/** The catchment above each dam: the pour-point features only, one per site. */
export function catchmentsFrom(doc: FeatureCollection | null): Catchment[] {
  if (doc === null) return [];
  const out: Catchment[] = [];
  for (const f of doc.features) {
    const p = f.properties;
    if (p["pour_point"] !== true) continue;
    const box = boxOf(outer(f.geometry));
    if (box === null) continue;
    out.push({
      site: String(p["site"]),
      basin: String(p["basin"]),
      areaKm2: Number(p["area_km2"]),
      meanElevM: typeof p["mean_elev_m"] === "number" ? p["mean_elev_m"] : null,
      inamhiBest: typeof p["inamhi_best"] === "string" ? p["inamhi_best"] : null,
      inamhiIou: typeof p["inamhi_iou"] === "number" ? p["inamhi_iou"] : null,
      pour: { lat: Number(p["pour_lat"]), lon: Number(p["pour_lon"]) },
      locatedFrom: String(p["located_from"] ?? ""),
      geometry: f.geometry,
      box,
    });
  }
  return out;
}

export interface RiverLine {
  areaKm2: number;
  coordinates: number[][];
  box: Box;
}

export interface Basemap {
  countries: { code: string; name: string; geometry: Feature["geometry"]; box: Box }[];
  /** Each band is everything at or above `minM`, so the bands stack. Lowest first. */
  relief: { minM: number; geometry: Feature["geometry"] }[];
  /** Smallest first, so the big rivers are drawn on top. */
  rivers: RiverLine[];
  cities: { name: string; capital: boolean; lat: number; lon: number }[];
  window: Box | null;
}

export function basemapFrom(doc: FeatureCollection | null): Basemap | null {
  if (doc === null) return null;
  const basemap: Basemap = { countries: [], relief: [], rivers: [], cities: [], window: (doc.metadata?.["window"] as Box) ?? null };
  for (const f of doc.features) {
    const p = f.properties;
    switch (p["kind"]) {
      case "country": {
        const box = boxOf(outer(f.geometry));
        if (box) basemap.countries.push({ code: String(p["code"]), name: String(p["name"]), geometry: f.geometry, box });
        break;
      }
      case "relief":
        basemap.relief.push({ minM: Number(p["min_m"]), geometry: f.geometry });
        break;
      case "river": {
        const coordinates = f.geometry.coordinates as number[][];
        const box = boxOf(coordinates);
        if (box) basemap.rivers.push({ areaKm2: Number(p["area_km2"]), coordinates, box });
        break;
      }
      case "city": {
        const [lon, lat] = f.geometry.coordinates as [number, number];
        basemap.cities.push({ name: String(p["name"]), capital: p["capital"] === true, lat, lon });
        break;
      }
    }
  }
  basemap.relief.sort((a, b) => a.minM - b.minM);
  basemap.rivers.sort((a, b) => a.areaKm2 - b.areaKm2);
  return basemap;
}

function outer(geometry: Feature["geometry"]): number[][] {
  if (geometry.type === "Polygon") return (geometry.coordinates as number[][][])[0] ?? [];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as number[][][][]).flatMap((p) => p[0] ?? []);
  return [];
}
