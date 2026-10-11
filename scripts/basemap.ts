#!/usr/bin/env node
/**
 * Build the base layers the site's maps are drawn on: `data/reference/basemap.geojson`.
 *
 * The fleet map on the home page follows Sterl et al. (2026, *Nature Water* 4, 571–585, Fig. 1):
 * mainland Ecuador, the Andes as bands of height, the rivers the plants stand on, and every plant
 * of more than 100 MW. Each reservoir page zooms the same layers to its own catchment. Three
 * public sources, all fetched here and nowhere at build time:
 *
 * - **Countries and cities** — Natural Earth 1:10m (public domain), from its GitHub release, cut
 *   to the window. Galápagos is left out, as in the paper.
 * - **Relief** — Copernicus GLO-90, the DEM `npm run catchments` delineates on, read at the COG's
 *   first overview (6″, ~180 m) rather than its full resolution: the maps draw at a few hundred
 *   metres a pixel, and one overview of the whole country is a fraction of one full tile.
 * - **Rivers** — traced from that same surface by the same priority-flood routing as the
 *   catchments (`src/lib/geo/basemap.ts`), so a river meets its catchment's outlet at the dam.
 *   Rivers draining at least `NATIONAL_KM2` are kept everywhere in Ecuador; inside each
 *   catchment's map window, down to `DETAIL_KM2`. They are unnamed: the map names the river each
 *   plant stands on from `plant_locations.csv`, and nothing else.
 *
 *   npm run basemap
 */

import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fromUrl } from "geotiff";
import { accumulate, rasterize, routeFlow, simplifyRing, outline, type DemGrid } from "../src/lib/geo/catchment.ts";
import { channelLines, clipRing, downsample, dropSmallRings, polygonsOf, roundLine, type Box } from "../src/lib/geo/basemap.ts";
import type { GeoJsonGeometry } from "../src/lib/probe/basins.ts";
import { nowUtc } from "../src/lib/util/dates.ts";
import { repoPath } from "../src/lib/util/paths.ts";
import { USER_AGENT } from "../src/lib/http/client.ts";

const NATURAL_EARTH = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const DEM_BUCKET = "https://copernicus-dem-90m.s3.amazonaws.com";
/** Overview 1 of each 1° COG: 600 × 600 cells, 6″. */
const DEM_LEVEL = 1;

/** Mainland Ecuador with a margin: what the fleet map frames. */
const WINDOW: Box = { west: -81.15, south: -5.1, east: -75.15, north: 1.55 };
/** Countries are cut a little wider than the window, so the cut is never on screen. */
const COUNTRY_BOX: Box = { west: WINDOW.west - 0.6, south: WINDOW.south - 0.6, east: WINDOW.east + 0.6, north: WINDOW.north + 0.6 };
const COUNTRIES = ["ECU", "COL", "PER"] as const;
const CITIES = ["Quito", "Guayaquil", "Cuenca"];

const NATIONAL_KM2 = 1500;
const DETAIL_KM2 = 60;
const RIVER_TOLERANCE_DEG = 0.002;
/** Relief is outlined on 3 × 3 blocks of the overview, ~540 m. */
const RELIEF_BLOCK = 3;
const RELIEF_TOLERANCE_DEG = 0.005;
const RELIEF_MIN_KM2 = 15;
const RELIEF_BANDS_M = [1000, 2000, 3000, 4000];
const COUNTRY_TOLERANCE_DEG = 0.004;

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000), headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

interface NeFeature {
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry & { coordinates: unknown };
}

// ---------------------------------------------------------------------------------------------
// DEM
// ---------------------------------------------------------------------------------------------

const tileName = (south: number, west: number): string =>
  `Copernicus_DSM_COG_30_${south < 0 ? "S" : "N"}${String(Math.abs(south)).padStart(2, "0")}_00_${west < 0 ? "W" : "E"}${String(Math.abs(west)).padStart(3, "0")}_00_DEM`;

interface Tile {
  south: number;
  west: number;
  size: number;
  data: Float32Array | null;
}

async function loadTile(south: number, west: number): Promise<Tile> {
  const name = tileName(south, west);
  const url = `${DEM_BUCKET}/${name}/${name}.tif`;
  const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(60_000) });
  // The bucket answers 403 as well as 404 for a key that does not exist: open sea.
  if (head.status === 403 || head.status === 404) return { south, west, size: 0, data: null };
  if (!head.ok) throw new Error(`${name}: HTTP ${head.status}`);
  for (let attempt = 1; ; attempt++) {
    try {
      const tiff = await fromUrl(url);
      const image = await tiff.getImage(DEM_LEVEL);
      const size = image.getWidth();
      if (image.getHeight() !== size) throw new Error(`${name} overview ${DEM_LEVEL} is ${size} × ${image.getHeight()}, not square`);
      const raster = (await image.readRasters({ interleave: true })) as unknown as ArrayLike<number>;
      const data = new Float32Array(size * size);
      for (let i = 0; i < data.length; i++) {
        const v = Number(raster[i]);
        data[i] = v < -1000 || !Number.isFinite(v) ? Number.NaN : v;
      }
      return { south, west, size, data };
    } catch (error) {
      if (attempt === 3) throw new Error(`${name}: ${String(error)}`, { cause: error });
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

async function mosaic(box: Box): Promise<{ grid: DemGrid; tiles: number }> {
  const south0 = Math.floor(box.south);
  const north0 = Math.ceil(box.north);
  const west0 = Math.floor(box.west);
  const east0 = Math.ceil(box.east);
  const jobs: Promise<Tile>[] = [];
  for (let s = south0; s < north0; s++) for (let w = west0; w < east0; w++) jobs.push(loadTile(s, w));
  const tiles: Tile[] = [];
  // Eight at a time: the bucket is fast, the proxy in front of it less so.
  for (let i = 0; i < jobs.length; i += 8) tiles.push(...(await Promise.all(jobs.slice(i, i + 8))));
  const size = tiles.find((t) => t.data)?.size;
  if (!size) throw new Error("no DEM tile in the window");
  const d = 1 / size;
  const west = west0 + Math.round((box.west - west0) / d) * d;
  const north = north0 - Math.round((north0 - box.north) / d) * d;
  const width = Math.round((box.east - west) / d);
  const height = Math.round((north - box.south) / d);
  const elev = new Float32Array(width * height).fill(Number.NaN);
  for (const t of tiles) {
    if (!t.data) continue;
    if (t.size !== size) throw new Error(`tile at ${t.south}, ${t.west} is ${t.size} cells a side, not ${size}`);
    for (let r = 0; r < size; r++) {
      const row = Math.round((north - (t.south + 1)) / d) + r;
      if (row < 0 || row >= height) continue;
      for (let c = 0; c < size; c++) {
        const col = Math.round((t.west - west) / d) + c;
        if (col < 0 || col >= width) continue;
        elev[row * width + col] = t.data[r * size + c]!;
      }
    }
  }
  return { grid: { width, height, west, north, dLon: d, dLat: d, elev }, tiles: tiles.filter((t) => t.data).length };
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

interface CatchmentFeature {
  properties: { site: string; role: string };
  geometry: GeoJsonGeometry;
}

/** Each catchment's box, padded the way the reservoir page frames it, as the window rivers are kept in in detail. */
function detailBoxes(): Box[] {
  const fc = JSON.parse(readFileSync(repoPath("data", "reference", "catchments.geojson"), "utf8")) as { features: CatchmentFeature[] };
  return fc.features.map((f) => {
    const pts = polygonsOf(f.geometry as { type: string; coordinates?: unknown }).flatMap((p) => p[0] ?? []);
    const lons = pts.map((p) => p[0]!);
    const lats = pts.map((p) => p[1]!);
    const pad = 0.15 * Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats)) + 0.05;
    return { west: Math.min(...lons) - pad, east: Math.max(...lons) + pad, south: Math.min(...lats) - pad, north: Math.max(...lats) + pad };
  });
}

async function main(): Promise<void> {
  const started = nowUtc();
  console.log("Natural Earth …");
  const countries = await getJson<{ features: NeFeature[] }>(`${NATURAL_EARTH}/ne_10m_admin_0_countries.geojson`);
  const places = await getJson<{ features: NeFeature[] }>(`${NATURAL_EARTH}/ne_10m_populated_places_simple.geojson`);

  const byCode = new Map(countries.features.map((f) => [String(f.properties["ADM0_A3"]), f]));
  const mainland = (f: NeFeature) => polygonsOf(f.geometry).filter((p) => p[0] !== undefined && Math.max(...p[0].map((q) => q[0]!)) > -85);
  const ecuador: GeoJsonGeometry = { type: "MultiPolygon", coordinates: mainland(byCode.get("ECU")!) };
  const land: GeoJsonGeometry = {
    type: "GeometryCollection",
    geometries: COUNTRIES.map((code) => ({ type: "MultiPolygon", coordinates: mainland(byCode.get(code)!) })),
  };

  console.log("DEM …");
  const { grid, tiles } = await mosaic(WINDOW);
  console.log(`  ${tiles} tiles, ${grid.width} × ${grid.height} cells`);
  const onLand = rasterize(grid, land);
  for (let i = 0; i < onLand.length; i++) if (!onLand[i]) grid.elev[i] = Number.NaN;
  const inEcuador = rasterize(grid, ecuador);

  console.log("Routing …");
  const routing = routeFlow(grid);
  const acc = accumulate(grid, routing);
  const boxes = detailBoxes();
  const keep = new Uint8Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row++) {
    const lat = grid.north - (row + 0.5) * grid.dLat;
    for (let col = 0; col < grid.width; col++) {
      const i = row * grid.width + col;
      if (!inEcuador[i] || acc[i]! < DETAIL_KM2) continue;
      if (acc[i]! >= NATIONAL_KM2) {
        keep[i] = 1;
        continue;
      }
      const lon = grid.west + (col + 0.5) * grid.dLon;
      if (boxes.some((b) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north)) keep[i] = 1;
    }
  }
  const rivers = channelLines(grid, routing, acc, keep, RIVER_TOLERANCE_DEG);
  console.log(`  ${rivers.length} river lines`);

  console.log("Relief …");
  const coarse = downsample(grid, RELIEF_BLOCK);
  const coarseEcuador = rasterize(coarse, ecuador);
  const relief = RELIEF_BANDS_M.map((m) => {
    const mask = new Uint8Array(coarse.width * coarse.height);
    for (let i = 0; i < mask.length; i++) mask[i] = coarseEcuador[i] && coarse.elev[i]! >= m ? 1 : 0;
    const polygons = dropSmallRings(polygonsOf(outline(coarse, mask, RELIEF_TOLERANCE_DEG)), RELIEF_MIN_KM2);
    return { m, polygons };
  });

  const features: object[] = [];
  for (const code of COUNTRIES) {
    const polygons = mainland(byCode.get(code)!)
      .map((p) =>
        p.map((ring) => clipRing(simplifyRing(ring, COUNTRY_TOLERANCE_DEG), COUNTRY_BOX)).filter((r): r is number[][] => r !== null),
      )
      .filter((p) => p.length > 0)
      .map((p) => p.map((r) => roundLine(r, 4)));
    features.push({
      type: "Feature",
      properties: { kind: "country", code, name: String(byCode.get(code)!.properties["NAME_ES"]) },
      geometry: { type: "MultiPolygon", coordinates: polygons },
    });
  }
  for (const { m, polygons } of relief) {
    features.push({
      type: "Feature",
      properties: { kind: "relief", min_m: m },
      geometry: { type: "MultiPolygon", coordinates: polygons.map((p) => p.map((r) => roundLine(r, 4))) },
    });
  }
  for (const river of rivers.sort((a, b) => a.areaKm2 - b.areaKm2)) {
    const coordinates = roundLine(river.coordinates, 4);
    if (coordinates.length < 2) continue;
    features.push({
      type: "Feature",
      properties: { kind: "river", area_km2: Math.round(river.areaKm2) },
      geometry: { type: "LineString", coordinates },
    });
  }
  for (const name of CITIES) {
    const place = places.features.find((f) => f.properties["name"] === name && f.properties["adm0_a3"] === "ECU");
    if (!place) throw new Error(`Natural Earth has no ${name}`);
    const [lon, lat] = place.geometry.coordinates as [number, number];
    features.push({
      type: "Feature",
      properties: { kind: "city", name, capital: place.properties["adm0cap"] === 1 },
      geometry: { type: "Point", coordinates: [round(lon, 4), round(lat, 4)] },
    });
  }

  const document = {
    type: "FeatureCollection",
    metadata: {
      generated_at: nowUtc(),
      started_at: started,
      window: WINDOW,
      sources: {
        countries: `${NATURAL_EARTH}/ne_10m_admin_0_countries.geojson (public domain)`,
        cities: `${NATURAL_EARTH}/ne_10m_populated_places_simple.geojson (public domain)`,
        dem: `${DEM_BUCKET} Copernicus GLO-90, COG overview ${DEM_LEVEL} (${round(grid.dLon * 3600, 1)}″), ${tiles} tiles. © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA`,
      },
      rivers: `traced by priority-flood routing on the DEM; at least ${NATIONAL_KM2} km² upstream anywhere in mainland Ecuador, at least ${DETAIL_KM2} km² inside each catchment's map window; simplified to ${RIVER_TOLERANCE_DEG}°`,
      relief: `mainland Ecuador at or above ${RELIEF_BANDS_M.join(", ")} m, on ${RELIEF_BLOCK} × ${RELIEF_BLOCK} blocks of the overview, simplified to ${RELIEF_TOLERANCE_DEG}°, patches under ${RELIEF_MIN_KM2} km² dropped`,
    },
    features,
  };
  const path = repoPath("data", "reference", "basemap.geojson");
  writeFileSync(path, `${JSON.stringify(document)}\n`);
  console.log(`wrote ${path}: ${features.length} features, ${(JSON.stringify(document).length / 1024).toFixed(0)} kB`);
}

await main();
