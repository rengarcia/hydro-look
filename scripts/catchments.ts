#!/usr/bin/env node
/**
 * Delineate the catchment above each dam from a public DEM, and check it against INAMHI.
 *
 * PLAN.md Phase 4's last open item. `basins.csv` has held one provisional Paute point since
 * Phase 0, and §2.4 spent a day of probes looking for a boundary set with upstream topology. What
 * it found is useful but is not that: INAMHI's GeoServer serves `geonode:hidroelectricasshape`
 * ("Cuencas Hidroeléctricas"), one polygon per scheme from the ENANDES project, but its Paute
 * polygon is drawn at Molino, below Mazar, and four of the seven dams fell just outside every
 * polygon near them; the ministry's level-5 Pfafstetter units contain each dam but are whole
 * basins, not the part above the dam. So this derives the catchments itself:
 *
 * 1. **Pour points** — each scheme's dam or intake, resolved by its OSM element id through the
 *    main OSM API (Overpass timed out on half of §2.4's runs; the API reads one element and does
 *    not). A point with no confirmed element uses the Wikidata point §2.4 recorded, and says so.
 * 2. **Flow network** — Copernicus GLO-90 (3″, ~90 m), 1° tiles from the public
 *    `copernicus-dem-90m` bucket, mosaicked around the dam, depression-filled and routed by
 *    priority-flood (`src/lib/geo/catchment.ts`). If a catchment reaches the edge of the mosaic,
 *    the mosaic grows a degree on that side and the basin is routed again.
 * 3. **Catchment** — the pour point snapped onto the DEM's channel within a small radius, then
 *    every cell that drains through it: area, centroid, a point guaranteed inside, mean height.
 * 4. **Check** — every INAMHI scheme polygon rasterised onto the same grid and overlapped with
 *    each catchment both ways, so "INAMHI drew the same basin", "INAMHI drew it further
 *    downstream" and "INAMHI drew something else" read differently.
 *
 * Writes `data/reference/catchments.geojson` (outlines), `data/reports/catchments.{md,json}` and
 * the INAMHI response under `data/raw/inamhi/`. It does not touch `basins.csv`: which rows are
 * verified is decided by reading the report, and recorded in PLAN.md with the reason.
 *
 *   npm run catchments
 *   npm run catchments -- --basins paute,coca
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { fromArrayBuffer } from "geotiff";
import { USER_AGENT } from "../src/lib/http/client.ts";
import {
  accumulate,
  catchmentMask,
  catchmentStats,
  confluencesAbove,
  geometryAreaKm2,
  type Confluence,
  geometryBbox,
  outline,
  overlap,
  rasterize,
  routeFlow,
  snapToChannel,
  snapToLine,
  type CatchmentStats,
  type DemGrid,
  type Overlap,
} from "../src/lib/geo/catchment.ts";
import type { GeoJsonGeometry, LatLon } from "../src/lib/probe/basins.ts";
import { kmApart } from "../src/lib/probe/basins.ts";
import { nowUtc } from "../src/lib/util/dates.ts";
import { DATA_RAW, repoPath } from "../src/lib/util/paths.ts";

interface Candidate {
  /** What this point is: the one the catchment is defined at, or an alternative to compare it with. */
  role: "dam" | "intake lead" | "powerhouse" | "wikidata point" | "inamhi station";
  osm?: `${"node" | "way"}/${number}`;
  /** Used when there is no OSM element, or the OSM API does not answer; labelled either way. */
  recorded?: LatLon;
  /** Why this point may, or may not, be trusted as a pour point, from PLAN.md §2.4. */
  evidence: string;
  /**
   * Snap radius, km, for a point; small by default, because a wide one can jump to a bigger river
   * below a confluence. A dam mapped as a way is snapped onto its crest instead (`CREST_KM`), and
   * this is ignored.
   */
  snapKm?: number;
}

interface Basin {
  basin: string;
  site: string;
  label: string;
  /** The first candidate is the pour point; the rest are delineated for comparison. */
  candidates: Candidate[];
}

const BASINS: Basin[] = [
  {
    basin: "paute",
    site: "mazar",
    label: "Mazar (Paute)",
    candidates: [
      {
        role: "dam",
        osm: "way/311803060",
        recorded: { lat: -2.5953091, lon: -78.6218378 },
        evidence: "OSM 'Presa Mazar', waterway=dam, wikidata=Q1751861 — the same QID as Wikidata's point, 0.04 km and 0 m from it (§2.4)",
      },
    ],
  },
  {
    basin: "paute_amaluza",
    site: "amaluza",
    label: "Amaluza (Paute, below Mazar)",
    candidates: [
      {
        role: "inamhi station",
        recorded: { lat: -2.58698, lon: -78.56553 },
        evidence:
          "INAMHI Hydropower app's station point for Amaluza (services.geoglows.org/api/hydropowers/get-station, archived under " +
          "data/raw/inamhi/hydroviewer-ecuador_2026-09-25/ by probe-basins run 36089243838). The same service's points for Mazar, " +
          "Delsitanisagua, Minas San Francisco and Coca Codo Sinclair lie 0.2, 0.06, 0.09 and 0.33 km from the OSM dams used above, " +
          "so it marks the dam; no OSM element for the Amaluza (Daniel Palacios) dam was confirmed. The catchment contains Mazar's: " +
          "Amaluza's inflow is Mazar's release plus the basin between",
      },
    ],
  },
  {
    basin: "coca",
    site: "coca_codo_sinclair",
    label: "Coca Codo Sinclair (Coca)",
    candidates: [
      {
        role: "dam",
        osm: "way/310742588",
        recorded: { lat: -0.1979037, lon: -77.6849914 },
        evidence: "OSM waterway=dam, wikidata=Q19277520, 0.11 km and 1 m from Wikidata's point (§2.4)",
      },
    ],
  },
  {
    basin: "pastaza",
    site: "agoyan",
    label: "Agoyán (Pastaza)",
    candidates: [
      {
        role: "dam",
        osm: "node/8432673468",
        recorded: { lat: -1.39852778, lon: -78.37755556 },
        evidence: "OSM element with Agoyán's QID, 0.37 km and −9 m from Wikidata's point (§2.4)",
      },
    ],
  },
  {
    basin: "guayllabamba",
    site: "manduriacu",
    label: "Manduriacu (Guayllabamba)",
    candidates: [
      {
        role: "wikidata point",
        recorded: { lat: 0.21480556, lon: -78.91233333 },
        evidence:
          "Wikidata Q65196233 only; OSM maps a plant, a dam and a reservoir under two spellings and §2.4's matcher picked different ones on different runs",
      },
    ],
  },
  {
    basin: "daule",
    site: "marcel_laniado",
    label: "Marcel Laniado (Daule)",
    candidates: [
      {
        role: "wikidata point",
        recorded: { lat: -0.927, lon: -79.75 },
        snapKm: 2,
        evidence:
          "Wikidata Q19381026, a point rounded to three decimals; no OSM dam matched (§2.4). Snapped within 2 km, because the rounding alone is up to ~0.1 km and the point may sit on the reservoir rather than the dam",
      },
    ],
  },
  {
    basin: "jubones",
    site: "minas_san_francisco",
    label: "Minas San Francisco (Jubones)",
    candidates: [
      {
        role: "dam",
        osm: "way/690695821",
        evidence:
          "the only waterway=dam on the Jubones in a 55 km box, on the river, 13.3 km from and 315 m above the powerhouse, with no name, " +
          "operator or QID (§2.4). INAMHI's Minas_San_fancisco polygon was drawn at this point: the first run's catchment here matched it " +
          "at 99% IoU (3,345 against 3,347 km²), while the powerhouse, which sits off the river at the end of the tunnel, drained 0.3 km²",
      },
    ],
  },
  {
    basin: "zamora",
    site: "delsitanisagua",
    label: "Delsitanisagua (Zamora)",
    candidates: [
      {
        role: "dam",
        osm: "way/726604479",
        evidence:
          "OSM 'Delsitanisagua hidroelectrica', waterway=dam, power=plant, operator=CELEC, across the Río Zamora 0.02 km from the " +
          "intake lead node/2489320895 and 480 m above the powerhouse, which an underground CELEC water pipeline (way/690695823) leaves; " +
          "found by probe run 35816537011",
      },
      {
        role: "powerhouse",
        osm: "way/690695824",
        recorded: { lat: -4.04588889, lon: -78.98377778 },
        evidence: "OSM 'Central Hidroeléctrica Delsitanisagua', wikidata=Q65196191, 0.1 km from Wikidata's point (§2.4)",
      },
    ],
  },
];

const INAMHI_WFS =
  "https://geoservicios.inamhi.gob.ec/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature" +
  "&typeName=geonode:hidroelectricasshape&outputFormat=application/json&srsName=EPSG:4326";

const DEM_BUCKET = "https://copernicus-dem-90m.s3.amazonaws.com";
/** No catchment here is wider than this many degrees; a mosaic that would need more is a routing error, not a basin. */
const MAX_SPAN_DEG = 5;
const OUTLINE_TOLERANCE_DEG = 0.002;
/** How far from a dam's crest line a channel cell may be and still be the pour point: about one and a half cells. */
const CREST_KM = 0.15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

async function get(url: string, deadlineMs = 120_000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(deadlineMs), headers: { "user-agent": USER_AGENT } });
}

// ---------------------------------------------------------------------------------------------
// Pour points
// ---------------------------------------------------------------------------------------------

interface Resolved extends LatLon {
  source: string;
  /** A way's nodes in order — a dam's crest, which the pour point is snapped onto. Absent for a node. */
  line?: LatLon[];
}

/** An OSM element's position: a node's own, or the mean of a way's nodes. */
async function resolveOsm(ref: string): Promise<Resolved | { error: string }> {
  const [type, id] = ref.split("/") as ["node" | "way", string];
  const url = `https://api.openstreetmap.org/api/0.6/${type}/${id}${type === "way" ? "/full" : ""}.json`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await get(url, 30_000);
      if (response.status === 410) return { error: `${ref} is deleted in OSM (410)` };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as {
        elements: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[];
      };
      const nodes = json.elements.filter((e) => e.type === "node" && e.lat !== undefined && e.lon !== undefined);
      if (nodes.length === 0) return { error: `${ref}: no nodes in the answer` };
      const element = json.elements.find((e) => `${e.type}/${e.id}` === ref);
      const tags = element?.tags ?? {};
      const name = tags["name"] ? ` "${tags["name"]}"` : "";
      const lat = nodes.reduce((s, n) => s + n.lat!, 0) / nodes.length;
      const lon = nodes.reduce((s, n) => s + n.lon!, 0) / nodes.length;
      const byId = new Map(nodes.map((n) => [n.id, { lat: n.lat!, lon: n.lon! }]));
      const line = type === "way" ? (element?.nodes ?? []).flatMap((id) => byId.get(id) ?? []) : undefined;
      return {
        lat: round(lat, 7),
        lon: round(lon, 7),
        ...(line && line.length >= 2 ? { line } : {}),
        source: `OSM ${ref}${name} (${nodes.length} node${nodes.length === 1 ? "" : "s"}), api.openstreetmap.org ${nowUtc()}`,
      };
    } catch (error) {
      if (attempt === 3) return { error: `${ref}: ${String(error)}` };
      await sleep(2000 * attempt);
    }
  }
  return { error: `${ref}: unreachable` };
}

async function resolveCandidate(c: Candidate): Promise<(Resolved & { note: string }) | null> {
  if (c.osm) {
    const r = await resolveOsm(c.osm);
    await sleep(1000);
    if ("lat" in r) {
      const drift = c.recorded ? ` — ${kmApart(r, c.recorded)} km from the recorded point` : "";
      return { ...r, note: `resolved from OSM${drift}` };
    }
    if (c.recorded)
      return { ...c.recorded, source: "point recorded in PLAN.md §2.4", note: `OSM did not answer (${r.error}); recorded point used` };
    return null;
  }
  return c.recorded ? { ...c.recorded, source: "point recorded in PLAN.md §2.4", note: "no OSM element to resolve" } : null;
}

// ---------------------------------------------------------------------------------------------
// DEM mosaic
// ---------------------------------------------------------------------------------------------

interface Tile {
  name: string;
  /** null when the bucket has no tile there (open sea). */
  data: Float32Array | null;
  width: number;
  height: number;
  west: number;
  north: number;
  dLon: number;
  dLat: number;
  etag: string;
}

const tiles = new Map<string, Tile>();

const tileName = (south: number, west: number): string =>
  `Copernicus_DSM_COG_30_${south < 0 ? "S" : "N"}${String(Math.abs(south)).padStart(2, "0")}_00_${west < 0 ? "W" : "E"}${String(Math.abs(west)).padStart(3, "0")}_00_DEM`;

/** The 1° tile whose south-west corner is (south, west), read whole. Cached for the run. */
async function loadTile(south: number, west: number): Promise<Tile> {
  const name = tileName(south, west);
  const cached = tiles.get(name);
  if (cached) return cached;
  const url = `${DEM_BUCKET}/${name}/${name}.tif`;
  let tile: Tile | null = null;
  for (let attempt = 1; attempt <= 3 && !tile; attempt++) {
    try {
      const response = await get(url);
      if (response.status === 404 || response.status === 403) {
        // The bucket answers 403 as well as 404 for a key that does not exist; both mean no land tile here.
        tile = { name, data: null, width: 0, height: 0, west, north: south + 1, dLon: 0, dLat: 0, etag: `absent (${response.status})` };
        break;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const tiff = await fromArrayBuffer(buffer);
      const image = await tiff.getImage();
      const [originLon, originLat] = image.getOrigin() as [number, number];
      const [resLon, resLat] = image.getResolution() as [number, number];
      const raster = (await image.readRasters({ interleave: true })) as unknown as ArrayLike<number>;
      const width = image.getWidth();
      const height = image.getHeight();
      const nodata = image.getGDALNoData();
      const data = new Float32Array(width * height);
      for (let i = 0; i < data.length; i++) {
        const v = Number(raster[i]);
        data[i] = v === nodata || v < -1000 || !Number.isFinite(v) ? NaN : v;
      }
      if (Math.abs(originLon - west) > 0.01 || Math.abs(originLat - (south + 1)) > 0.01) {
        throw new Error(`tile ${name} is georeferenced at ${originLon}, ${originLat}, not at its name's corner ${west}, ${south + 1}`);
      }
      tile = {
        name,
        data,
        width,
        height,
        west: originLon,
        north: originLat,
        dLon: Math.abs(resLon),
        dLat: Math.abs(resLat),
        etag: response.headers.get("etag") ?? "",
      };
    } catch (error) {
      if (attempt === 3) throw new Error(`DEM tile ${name}: ${String(error)}`, { cause: error });
      await sleep(3000 * attempt);
    }
  }
  tiles.set(name, tile!);
  return tile!;
}

interface Window {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The DEM over a window of whole degrees, as one grid at the tiles' own resolution. */
async function mosaic(win: Window): Promise<{ grid: DemGrid; tiles: string[]; noDataShare: number }> {
  const used: Tile[] = [];
  for (let s = win.south; s < win.north; s++) for (let w = win.west; w < win.east; w++) used.push(await loadTile(s, w));
  const land = used.filter((t) => t.data);
  if (land.length === 0) throw new Error("no DEM tile over this window");
  const dLon = land[0]!.dLon;
  const dLat = land[0]!.dLat;
  if (land.some((t) => Math.abs(t.dLon - dLon) > 1e-12 || Math.abs(t.dLat - dLat) > 1e-12))
    throw new Error("tiles of different resolution in one window");
  const width = Math.round((win.east - win.west) / dLon);
  const height = Math.round((win.north - win.south) / dLat);
  const elev = new Float32Array(width * height).fill(NaN);
  for (const t of land) {
    const col0 = Math.round((t.west - win.west) / dLon);
    const row0 = Math.round((win.north - t.north) / dLat);
    for (let r = 0; r < t.height; r++) {
      const rr = row0 + r;
      if (rr < 0 || rr >= height) continue;
      const c0 = Math.max(0, -col0);
      const c1 = Math.min(t.width, width - col0);
      if (c1 > c0) elev.set(t.data!.subarray(r * t.width + c0, r * t.width + c1), rr * width + col0 + c0);
    }
  }
  let missing = 0;
  for (let i = 0; i < elev.length; i++) if (Number.isNaN(elev[i]!)) missing++;
  return {
    grid: { width, height, west: win.west, north: win.north, dLon, dLat, elev },
    tiles: used.map((t) => `${t.name} ${t.etag}`),
    noDataShare: missing / elev.length,
  };
}

// ---------------------------------------------------------------------------------------------
// INAMHI
// ---------------------------------------------------------------------------------------------

interface InamhiPolygon {
  id: string;
  layer: string;
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry;
  areaKm2: number;
  bbox: Window;
}

async function fetchInamhi(): Promise<{ polygons: InamhiPolygon[]; note: string; raw: string | null }> {
  try {
    const response = await get(INAMHI_WFS, 180_000);
    const body = await response.text();
    if (!response.ok) return { polygons: [], note: `HTTP ${response.status}: ${body.slice(0, 160)}`, raw: null };
    const json = JSON.parse(body) as {
      features?: { id?: string; properties?: Record<string, unknown>; geometry?: GeoJsonGeometry | null }[];
    };
    const polygons = (json.features ?? []).flatMap((f, k): InamhiPolygon[] => {
      const bbox = geometryBbox(f.geometry);
      if (!f.geometry || !bbox) return [];
      const layer = String(f.properties?.["layer"] ?? f.properties?.["nombre_5"] ?? f.id ?? `feature ${k}`);
      return [
        { id: String(f.id ?? k), layer, properties: f.properties ?? {}, geometry: f.geometry, areaKm2: geometryAreaKm2(f.geometry), bbox },
      ];
    });
    return { polygons, note: `${polygons.length} polygons, ${body.length.toLocaleString("en-US")} bytes`, raw: body };
  } catch (error) {
    return { polygons: [], note: String(error), raw: null };
  }
}

// ---------------------------------------------------------------------------------------------
// Delineation
// ---------------------------------------------------------------------------------------------

interface CandidateResult {
  role: Candidate["role"];
  evidence: string;
  point: (Resolved & { note: string }) | null;
  snapped: { lat: number; lon: number; movedKm: number; accKm2: number; by: string } | null;
  stats: CatchmentStats | null;
  /** Branches of at least 2% of the catchment joining the main channel within 3 km above the pour point. */
  confluences: Confluence[];
  inamhi: (Overlap & { layer: string; id: string })[];
  outline: GeoJsonGeometry | null;
  error: string;
}

interface BasinResult {
  basin: string;
  site: string;
  label: string;
  window: Window;
  grids: number;
  tiles: string[];
  noDataShare: number;
  seconds: number;
  candidates: CandidateResult[];
  error: string;
}

const intersects = (a: Window, b: Window) => a.west < b.east && b.west < a.east && a.south < b.north && b.south < a.north;
const within = (inner: Window, outer: Window) =>
  inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;

async function delineate(basin: Basin, inamhi: InamhiPolygon[]): Promise<BasinResult> {
  const t0 = Date.now();
  const points = await Promise.all(basin.candidates.map(resolveCandidate));
  const located = points.filter((p): p is NonNullable<typeof p> => p !== null);
  const result: BasinResult = {
    basin: basin.basin,
    site: basin.site,
    label: basin.label,
    window: { south: 0, west: 0, north: 0, east: 0 },
    grids: 0,
    tiles: [],
    noDataShare: 0,
    seconds: 0,
    candidates: [],
    error: "",
  };
  if (located.length === 0) {
    result.error = "no candidate point could be located";
    return result;
  }
  const win: Window = {
    south: Math.floor(Math.min(...located.map((p) => p.lat)) - 0.5),
    north: Math.ceil(Math.max(...located.map((p) => p.lat)) + 0.5),
    west: Math.floor(Math.min(...located.map((p) => p.lon)) - 0.5),
    east: Math.ceil(Math.max(...located.map((p) => p.lon)) + 0.5),
  };

  for (;;) {
    result.grids++;
    const { grid, tiles: used, noDataShare } = await mosaic(win);
    const routing = routeFlow(grid);
    const acc = accumulate(grid, routing);
    const candidates: CandidateResult[] = [];
    const grow = { north: false, south: false, west: false, east: false };
    for (const [k, c] of basin.candidates.entries()) {
      const point = points[k] ?? null;
      const out: CandidateResult = {
        role: c.role,
        evidence: c.evidence,
        point,
        snapped: null,
        stats: null,
        confluences: [],
        inamhi: [],
        outline: null,
        error: "",
      };
      candidates.push(out);
      if (!point) {
        out.error = "not located";
        continue;
      }
      const onCrest = c.role !== "powerhouse" && point.line;
      const snapped = onCrest
        ? snapToLine(grid, acc, point.line!, CREST_KM)
        : snapToChannel(grid, acc, point.lat, point.lon, c.snapKm ?? 0.5);
      if (!snapped) {
        out.error = onCrest ? "no channel under the crest" : "no channel within the snap radius";
        continue;
      }
      out.snapped = {
        lat: round(snapped.lat, 6),
        lon: round(snapped.lon, 6),
        movedKm: round(snapped.movedKm, 3),
        accKm2: round(snapped.accKm2, 1),
        by: onCrest ? `crest, ${CREST_KM} km` : `radius, ${c.snapKm ?? 0.5} km`,
      };
      const mask = catchmentMask(grid, routing, snapped.index);
      out.stats = catchmentStats(grid, mask);
      for (const side of ["north", "south", "west", "east"] as const) if (out.stats.touches[side]) grow[side] = true;
      if (Object.values(out.stats.touches).some(Boolean)) continue; // cut off: widen before measuring anything else
      out.outline = outline(grid, mask, OUTLINE_TOLERANCE_DEG);
      out.confluences = confluencesAbove(grid, routing, acc, snapped.index, 3, 0.02 * out.stats.areaKm2).map((k) => ({
        ...k,
        lat: round(k.lat, 5),
        lon: round(k.lon, 5),
        sideKm2: round(k.sideKm2, 1),
        mainKm2: round(k.mainKm2, 1),
      }));
      for (const p of inamhi) {
        if (!intersects(p.bbox, out.stats.bbox)) continue;
        if (!within(p.bbox, win)) {
          out.inamhi.push({
            layer: p.layer,
            id: p.id,
            aKm2: out.stats.areaKm2,
            bKm2: p.areaKm2,
            bothKm2: NaN,
            iou: NaN,
            aInB: NaN,
            bInA: NaN,
          });
          continue;
        }
        const o = overlap(grid, mask, rasterize(grid, p.geometry));
        if (o.bothKm2 > 0) out.inamhi.push({ layer: p.layer, id: p.id, ...o });
      }
      out.inamhi.sort((a, b) => (Number.isNaN(b.iou) ? -1 : b.iou) - (Number.isNaN(a.iou) ? -1 : a.iou));
    }
    result.window = { ...win };
    result.tiles = used;
    result.noDataShare = noDataShare;
    result.candidates = candidates;
    const needs = Object.entries(grow)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (needs.length === 0) break;
    if (grow.north) win.north++;
    if (grow.south) win.south--;
    if (grow.west) win.west--;
    if (grow.east) win.east++;
    if (win.north - win.south > MAX_SPAN_DEG || win.east - win.west > MAX_SPAN_DEG) {
      result.error = `the catchment still reached the ${needs.join(", ")} edge at ${MAX_SPAN_DEG}° — a routing error, or a snap onto the wrong river`;
      break;
    }
    console.log(`${basin.basin}: catchment reaches the ${needs.join(", ")} edge; widening to ${JSON.stringify(win)}`);
  }
  result.seconds = Math.round((Date.now() - t0) / 1000);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const f1 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "—");
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—");
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function report(startedAt: string, inamhiNote: string, inamhi: InamhiPolygon[], results: BasinResult[]): string {
  const lines = [
    "# Catchments above the fleet's dams",
    "",
    `Generated by \`npm run catchments\` (\`scripts/catchments.ts\`), started ${startedAt}, finished ${nowUtc()}.`,
    "DEM: Copernicus GLO-90 (3″), public bucket `copernicus-dem-90m`; routing: priority-flood D8 on the",
    "depression-filled surface; pour point snapped to the largest upstream area within the stated radius.",
    `Outlines are simplified to ${OUTLINE_TOLERANCE_DEG}° (~${Math.round(OUTLINE_TOLERANCE_DEG * 111_000)} m); areas and centroids are from the full-resolution mask.`,
    "",
    "## Pour points and catchments",
    "",
    "| basin | point | located from | snapped, moved | area km² | centroid | point inside | mean m | INAMHI best match | IoU | ours in INAMHI | INAMHI in ours |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    for (const c of r.candidates) {
      const best = c.inamhi[0];
      lines.push(
        `| ${r.basin} | ${c.role} | ${c.point ? `${c.point.lat}, ${c.point.lon} — ${cell(c.point.source)}; ${cell(c.point.note)}` : "—"} | ` +
          `${c.snapped ? `${c.snapped.lat}, ${c.snapped.lon}; ${c.snapped.movedKm} km (${c.snapped.by})` : cell(c.error) || "—"} | ${c.stats ? f1(c.stats.areaKm2) : "—"} | ` +
          `${c.stats ? `${round(c.stats.centroid.lat, 4)}, ${round(c.stats.centroid.lon, 4)}` : "—"} | ` +
          `${c.stats ? `${round(c.stats.representative.lat, 4)}, ${round(c.stats.representative.lon, 4)}${c.stats.representative.isCentroid ? " (centroid)" : " (nearest cell)"}` : "—"} | ` +
          `${c.stats ? Math.round(c.stats.meanElevM) : "—"} | ${best ? cell(best.layer) : "none overlaps"} | ${best ? pct(best.iou) : "—"} | ${best ? pct(best.aInB) : "—"} | ${best ? pct(best.bInA) : "—"} |`,
      );
    }
  }
  lines.push(
    "",
    "How to read the last three columns. **IoU** near 100% means INAMHI and this delineation drew the same basin.",
    "**Ours in INAMHI** near 100% with **INAMHI in ours** well below it means INAMHI's polygon contains this",
    "catchment and more — it was drawn further downstream, as `Paute_Molino` is for Mazar. The reverse means",
    "INAMHI drew a smaller basin, upstream of this pour point.",
    "",
    "## Every INAMHI polygon each catchment touches",
    "",
    "| basin | point | INAMHI layer | INAMHI km² | shared km² | IoU | ours in INAMHI | INAMHI in ours |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const r of results) {
    for (const c of r.candidates) {
      for (const o of c.inamhi) {
        lines.push(
          `| ${r.basin} | ${c.role} | ${cell(o.layer)} | ${f1(o.bKm2)} | ${Number.isNaN(o.bothKm2) ? "outside the mosaic" : f1(o.bothKm2)} | ${pct(o.iou)} | ${pct(o.aInB)} | ${pct(o.bInA)} |`,
        );
      }
    }
  }
  lines.push(
    "",
    "## Confluences just above each pour point",
    "",
    "Every branch of at least 2% of the catchment that joins the main channel within 3 km upstream of the pour point.",
    "A disagreement with INAMHI the size of one of these branches is a disagreement about which side of the dam that",
    "junction lies on, and its distance is how far apart the two pour points are.",
    "",
    "| basin | point | km upstream | at | branch km² | main channel km² |",
    "|---|---|---|---|---|---|",
    ...results.flatMap((r) =>
      r.candidates.flatMap((c) =>
        c.confluences.length
          ? c.confluences.map(
              (k) => `| ${r.basin} | ${c.role} | ${k.kmUpstream} | ${k.lat}, ${k.lon} | ${f1(k.sideKm2)} | ${f1(k.mainKm2)} |`,
            )
          : [`| ${r.basin} | ${c.role} | — | none within 3 km | — | — |`],
      ),
    ),
    "",
    "## Evidence for each pour point",
    "",
    ...results.flatMap((r) => r.candidates.map((c) => `- **${r.basin} / ${c.role}**: ${c.evidence}.`)),
    "",
    "## INAMHI `geonode:hidroelectricasshape`",
    "",
    `Asked of ${INAMHI_WFS.split("?")[0]} (WFS 1.0.0 GetFeature, EPSG:4326): ${inamhiNote}. The raw answer is archived under \`data/raw/inamhi/\`.`,
    "",
    "| id | layer | km² (sphere) | west | south | east | north | attributes |",
    "|---|---|---|---|---|---|---|---|",
    ...inamhi.map(
      (p) =>
        `| ${p.id} | ${cell(p.layer)} | ${f1(p.areaKm2)} | ${round(p.bbox.west, 3)} | ${round(p.bbox.south, 3)} | ${round(p.bbox.east, 3)} | ${round(p.bbox.north, 3)} | ` +
        `${cell(
          Object.entries(p.properties)
            .filter(([k]) => k !== "path")
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(", ")
            .slice(0, 160),
        )} |`,
    ),
    "",
    "## Runs",
    "",
    "| basin | window (S, W, N, E) | routings | no-data share | seconds | tiles | error |",
    "|---|---|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.basin} | ${r.window.south}, ${r.window.west}, ${r.window.north}, ${r.window.east} | ${r.grids} | ${pct(r.noDataShare)} | ${r.seconds} | ` +
        `${cell(r.tiles.map((t) => t.replace("Copernicus_DSM_COG_30_", "").replace("_00_DEM", "")).join("; "))} | ${cell(r.error) || "—"} |`,
    ),
    "",
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  const startedAt = nowUtc();
  const only = process.argv.indexOf("--basins");
  const chosen = only >= 0 ? new Set((process.argv[only + 1] ?? "").split(",").filter(Boolean)) : null;
  const basins = BASINS.filter((b) => !chosen || chosen.has(b.basin));
  if (chosen && basins.length !== chosen.size)
    throw new Error(`unknown basin in --basins; known: ${BASINS.map((b) => b.basin).join(", ")}`);

  const inamhi = await fetchInamhi();
  console.log(`INAMHI hidroelectricasshape: ${inamhi.note}`);
  if (inamhi.raw) {
    const path = join(DATA_RAW, "inamhi", `hidroelectricasshape_${startedAt.slice(0, 10)}.geojson.gz`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, gzipSync(inamhi.raw));
  }

  const results: BasinResult[] = [];
  for (const basin of basins) {
    console.log(`${basin.basin}: delineating`);
    try {
      results.push(await delineate(basin, inamhi.polygons));
    } catch (error) {
      results.push({
        basin: basin.basin,
        site: basin.site,
        label: basin.label,
        window: { south: 0, west: 0, north: 0, east: 0 },
        grids: 0,
        tiles: [],
        noDataShare: 0,
        seconds: 0,
        candidates: [],
        error: String(error),
      });
    }
    const last = results.at(-1)!;
    console.log(
      `${basin.basin}: ${last.error || last.candidates.map((c) => `${c.role} ${c.stats ? `${f1(c.stats.areaKm2)} km²` : c.error}`).join("; ")}`,
    );
  }

  const features = results.flatMap((r) =>
    r.candidates.flatMap((c, k) =>
      c.outline && c.stats && c.snapped
        ? [
            {
              type: "Feature",
              properties: {
                basin: r.basin,
                site: r.site,
                role: c.role,
                pour_point: k === 0,
                pour_lat: c.snapped.lat,
                pour_lon: c.snapped.lon,
                located_from: c.point?.source ?? "",
                area_km2: round(c.stats.areaKm2, 1),
                centroid_lat: round(c.stats.centroid.lat, 5),
                centroid_lon: round(c.stats.centroid.lon, 5),
                inside_lat: round(c.stats.representative.lat, 5),
                inside_lon: round(c.stats.representative.lon, 5),
                mean_elev_m: Math.round(c.stats.meanElevM),
                inamhi_best: c.inamhi[0]?.layer ?? null,
                inamhi_iou: c.inamhi[0] && Number.isFinite(c.inamhi[0].iou) ? round(c.inamhi[0].iou, 3) : null,
                dem: "Copernicus GLO-90",
                generated_at: startedAt,
              },
              geometry: c.outline,
            },
          ]
        : [],
    ),
  );
  writeFileSync(repoPath("data", "reference", "catchments.geojson"), `${JSON.stringify({ type: "FeatureCollection", features })}\n`);
  mkdirSync(repoPath("data", "reports"), { recursive: true });
  const md = report(startedAt, inamhi.note, inamhi.polygons, results);
  writeFileSync(repoPath("data", "reports", "catchments.md"), `${md}\n`);
  writeFileSync(
    repoPath("data", "reports", "catchments.json"),
    `${JSON.stringify({ startedAt, finishedAt: nowUtc(), inamhi: inamhi.note, results: results.map((r) => ({ ...r, candidates: r.candidates.map(({ outline: _o, ...c }) => c) })) }, null, 1)}\n`,
  );
  console.log(md);
  if (results.some((r) => r.error || r.candidates.some((c) => c.error))) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
