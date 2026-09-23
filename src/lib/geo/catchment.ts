/**
 * Catchment delineation from a DEM, and the comparisons that decide whether to believe one.
 *
 * PLAN.md §2.4 left `basins.csv` waiting on a boundary set with upstream topology, and the ones
 * found so far are not it: INAMHI's `Paute_Molino` is drawn at Molino, downstream of Mazar, and a
 * Pfafstetter unit that contains a dam is a whole basin, not the part of it above the dam. A
 * catchment is a property of a pour point and a flow network, so this derives the flow network
 * itself from a public DEM and reads the catchment off it. The outside polygons become what they
 * are good for — an independent check.
 *
 * Nothing here fetches or writes; `scripts/catchments.ts` does both. Everything is a pure function
 * of a grid, so it is tested on grids small enough to reason about by hand.
 */

import type { GeoJsonGeometry } from "../probe/basins.ts";

/** A regular lon/lat raster, row-major from the north-west corner. `NaN` is no data (sea, or a missing tile). */
export interface DemGrid {
  width: number;
  height: number;
  /** Western edge of column 0 and northern edge of row 0, in degrees. */
  west: number;
  north: number;
  /** Cell size in degrees, both positive. */
  dLon: number;
  dLat: number;
  elev: Float32Array;
}

const EARTH_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

export const cellLon = (g: DemGrid, col: number): number => g.west + (col + 0.5) * g.dLon;
export const cellLat = (g: DemGrid, row: number): number => g.north - (row + 0.5) * g.dLat;

/** Exact area of one cell of row `row` on the sphere, km². */
export function cellAreaKm2(g: DemGrid, row: number): number {
  const top = g.north - row * g.dLat;
  const bottom = top - g.dLat;
  return EARTH_KM * EARTH_KM * rad(g.dLon) * Math.abs(Math.sin(rad(top)) - Math.sin(rad(bottom)));
}

const DR = [-1, -1, -1, 0, 0, 1, 1, 1];
const DC = [-1, 0, 1, -1, 1, -1, 0, 1];

/** How every cell drains: `receiver[i]` is the cell it flows into, -1 for an outlet, -2 for no data. */
export interface Routing {
  receiver: Int32Array;
  /** Cells in the order they were settled; every cell comes after its receiver. `count` of them are valid. */
  order: Int32Array;
  count: number;
}

/**
 * Drain every cell to the sea or the edge of the grid, filling depressions on the way.
 *
 * Priority-flood with a pit queue (Barnes, Lehman & Mulla 2014): cells are settled lowest first
 * from the outlets inwards, and a cell drains into whichever neighbour settled it. Because cells
 * settle in non-decreasing order of filled height, that neighbour is the lowest one, so this is D8
 * on the depression-filled surface. The pit queue settles a flat breadth-first from the point it
 * was entered, which is what makes a reservoir — which a DEM records as one flat surface — drain
 * towards its outlet rather than in an arbitrary direction.
 *
 * Outlets are the grid's border and every cell next to no data. A catchment that reaches the
 * border has been truncated by it; `catchmentStats` reports that so the caller can widen the grid.
 */
export function routeFlow(g: DemGrid): Routing {
  const { width: w, height: h, elev } = g;
  const n = w * h;
  const receiver = new Int32Array(n).fill(-2);
  const order = new Int32Array(n);
  const filled = new Float32Array(elev);
  const heap = new MinHeap(n);
  const pit = new Int32Array(n);
  let pitHead = 0;
  let pitTail = 0;
  let count = 0;

  const isData = (i: number) => !Number.isNaN(elev[i]!);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (!isData(i)) continue;
      let outlet = r === 0 || c === 0 || r === h - 1 || c === w - 1;
      for (let k = 0; k < 8 && !outlet; k++) {
        if (!isData((r + DR[k]!) * w + c + DC[k]!)) outlet = true;
      }
      if (outlet) {
        receiver[i] = -1;
        heap.push(i, filled[i]!);
      }
    }
  }

  while (pitHead < pitTail || heap.size > 0) {
    const i = pitHead < pitTail ? pit[pitHead++]! : heap.pop();
    order[count++] = i;
    const r = Math.floor(i / w);
    const c = i - r * w;
    const z = filled[i]!;
    for (let k = 0; k < 8; k++) {
      const rr = r + DR[k]!;
      const cc = c + DC[k]!;
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc;
      if (receiver[j] !== -2 || !isData(j)) continue;
      receiver[j] = i;
      if (filled[j]! <= z) {
        filled[j] = z;
        pit[pitTail++] = j;
      } else {
        heap.push(j, filled[j]!);
      }
    }
  }

  // The flood's own choice is the lowest neighbour by height, which on a slope is biased to the
  // diagonals: a diagonal neighbour is further away, so it is lower even when it is not steeper.
  // On a valley side that sends water down the valley at 45° instead of across it, and a pour
  // point then misses the wedge of hillside just above it. So every cell with a strictly lower
  // neighbour on the filled surface is re-pointed at its steepest one, by drop over distance.
  // That neighbour settled earlier (settling is in non-decreasing filled height), so the order
  // stays valid. Flats keep the flood's breadth-first direction, which is what drains them.
  const kmPerDeg = (Math.PI * EARTH_KM) / 180;
  const dy = g.dLat * kmPerDeg;
  for (let r = 0; r < h; r++) {
    const dx = g.dLon * kmPerDeg * Math.cos(rad(cellLat(g, r)));
    const dist = DR.map((drr, k) => Math.hypot(drr * dy, DC[k]! * dx));
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (receiver[i]! < 0) continue;
      const z = filled[i]!;
      let best = -1;
      let bestSlope = 0;
      for (let k = 0; k < 8; k++) {
        const rr = r + DR[k]!;
        const cc = c + DC[k]!;
        if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
        const j = rr * w + cc;
        if (receiver[j] === -2) continue;
        const slope = (z - filled[j]!) / dist[k]!;
        if (slope > bestSlope) {
          bestSlope = slope;
          best = j;
        }
      }
      if (best >= 0) receiver[i] = best;
    }
  }
  return { receiver, order, count };
}

/** Upstream area of every cell including itself, km². */
export function accumulate(g: DemGrid, routing: Routing): Float64Array {
  const acc = new Float64Array(g.width * g.height);
  for (let k = routing.count - 1; k >= 0; k--) {
    const i = routing.order[k]!;
    acc[i]! += cellAreaKm2(g, Math.floor(i / g.width));
    const r = routing.receiver[i]!;
    if (r >= 0) acc[r]! += acc[i]!;
  }
  return acc;
}

export interface Snapped {
  index: number;
  lat: number;
  lon: number;
  /** How far the pour point moved to reach the channel, km. */
  movedKm: number;
  accKm2: number;
}

/**
 * The cell with the largest upstream area within `radiusKm` of a point.
 *
 * A mapped dam sits on the river to within its crest's width, but the DEM's channel is one cell
 * wide and need not pass through the cell the coordinate falls in. Snapping to the largest
 * accumulation nearby puts the pour point on the channel. The radius is the whole risk: too wide
 * and it jumps to a bigger river below a confluence, so the caller keeps it small and the result
 * reports how far it moved.
 */
export function snapToChannel(g: DemGrid, acc: Float64Array, lat: number, lon: number, radiusKm: number): Snapped | null {
  const kmPerLat = (Math.PI * EARTH_KM) / 180;
  const kmPerLon = kmPerLat * Math.cos(rad(lat));
  const dRow = Math.ceil(radiusKm / kmPerLat / g.dLat);
  const dCol = Math.ceil(radiusKm / kmPerLon / g.dLon);
  const row0 = Math.floor((g.north - lat) / g.dLat);
  const col0 = Math.floor((lon - g.west) / g.dLon);
  let best: Snapped | null = null;
  for (let r = Math.max(0, row0 - dRow); r <= Math.min(g.height - 1, row0 + dRow); r++) {
    for (let c = Math.max(0, col0 - dCol); c <= Math.min(g.width - 1, col0 + dCol); c++) {
      const i = r * g.width + c;
      const km = Math.hypot((cellLat(g, r) - lat) * kmPerLat, (cellLon(g, c) - lon) * kmPerLon);
      if (km > radiusKm || !(acc[i]! > 0)) continue;
      if (!best || acc[i]! > best.accKm2) best = { index: i, lat: cellLat(g, r), lon: cellLon(g, c), movedKm: km, accKm2: acc[i]! };
    }
  }
  return best;
}

/**
 * The cell with the largest upstream area within `toleranceKm` of a line — a dam's crest.
 *
 * Better than a radius wherever the dam is mapped as a way: the river crosses the crest, so the
 * channel cell under it is the pour point, and nothing downstream of the dam is ever a candidate.
 * A radius cannot promise that. Mazar is the case that showed it: a 0.5 km radius around the
 * crest's centre reached below the dam, past a north-bank tributary, and added 385 km² that
 * INAMHI's polygon, drawn at the dam, does not have.
 */
export function snapToLine(g: DemGrid, acc: Float64Array, line: readonly { lat: number; lon: number }[], toleranceKm: number): Snapped | null {
  if (line.length === 0) return null;
  const kmPerLat = (Math.PI * EARTH_KM) / 180;
  const midLat = line.reduce((s, p) => s + p.lat, 0) / line.length;
  const kmPerLon = kmPerLat * Math.cos(rad(midLat));
  const padLat = toleranceKm / kmPerLat;
  const padLon = toleranceKm / kmPerLon;
  const r0 = Math.max(0, Math.floor((g.north - Math.max(...line.map((p) => p.lat)) - padLat) / g.dLat));
  const r1 = Math.min(g.height - 1, Math.floor((g.north - Math.min(...line.map((p) => p.lat)) + padLat) / g.dLat));
  const c0 = Math.max(0, Math.floor((Math.min(...line.map((p) => p.lon)) - padLon - g.west) / g.dLon));
  const c1 = Math.min(g.width - 1, Math.floor((Math.max(...line.map((p) => p.lon)) + padLon - g.west) / g.dLon));
  const centre = { lat: midLat, lon: line.reduce((s, p) => s + p.lon, 0) / line.length };
  let best: Snapped | null = null;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * g.width + c;
      if (!(acc[i]! > 0) || (best && acc[i]! <= best.accKm2)) continue;
      const p = { lat: cellLat(g, r), lon: cellLon(g, c) };
      if (kmToPolyline(p, line, kmPerLat, kmPerLon) > toleranceKm) continue;
      best = { index: i, lat: p.lat, lon: p.lon, movedKm: Math.hypot((p.lat - centre.lat) * kmPerLat, (p.lon - centre.lon) * kmPerLon), accKm2: acc[i]! };
    }
  }
  return best;
}

function kmToPolyline(p: { lat: number; lon: number }, line: readonly { lat: number; lon: number }[], kmPerLat: number, kmPerLon: number): number {
  const xy = (q: { lat: number; lon: number }) => ({ x: (q.lon - p.lon) * kmPerLon, y: (q.lat - p.lat) * kmPerLat });
  if (line.length === 1) {
    const a = xy(line[0]!);
    return Math.hypot(a.x, a.y);
  }
  let best = Infinity;
  for (let k = 1; k < line.length; k++) {
    const a = xy(line[k - 1]!);
    const b = xy(line[k]!);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

export interface Confluence {
  /** Distance up the main channel from the pour point, km. */
  kmUpstream: number;
  lat: number;
  lon: number;
  /** Upstream area of the side branch that joins here, km². */
  sideKm2: number;
  /** Upstream area of the main channel just above the junction, km². */
  mainKm2: number;
}

/**
 * Walk up the main channel from a pour point — always into the upstream neighbour with the
 * largest area — and list every branch of at least `minKm2` that joins it within `maxKm`.
 *
 * This is how a disagreement about a catchment near a dam is settled from the data rather than
 * argued: if a tributary the size of the difference joins a few hundred metres above the pour
 * point, the two delineations differ on which side of the dam that junction is, and the distance
 * says how far the DEM is from agreeing with the other.
 */
export function confluencesAbove(g: DemGrid, routing: Routing, acc: Float64Array, pour: number, maxKm: number, minKm2: number): Confluence[] {
  const { width: w, height: h } = g;
  const kmPerDeg = (Math.PI * EARTH_KM) / 180;
  const out: Confluence[] = [];
  let at = pour;
  let km = 0;
  while (km <= maxKm) {
    const r = Math.floor(at / w);
    const c = at - r * w;
    const children: number[] = [];
    for (let k = 0; k < 8; k++) {
      const rr = r + DR[k]!;
      const cc = c + DC[k]!;
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc;
      if (routing.receiver[j] === at) children.push(j);
    }
    if (children.length === 0) break;
    children.sort((a, b) => acc[b]! - acc[a]!);
    const main = children[0]!;
    for (const side of children.slice(1)) {
      if (acc[side]! >= minKm2) out.push({ kmUpstream: Math.round(km * 1000) / 1000, lat: cellLat(g, r), lon: cellLon(g, c), sideKm2: acc[side]!, mainKm2: acc[main]! });
    }
    const mr = Math.floor(main / w);
    const mc = main - mr * w;
    km += Math.hypot((mr - r) * g.dLat * kmPerDeg, (mc - c) * g.dLon * kmPerDeg * Math.cos(rad(cellLat(g, r))));
    at = main;
  }
  return out;
}

/** Every cell that drains through `pour`, as a 0/1 mask. */
export function catchmentMask(g: DemGrid, routing: Routing, pour: number): Uint8Array {
  const mask = new Uint8Array(g.width * g.height);
  mask[pour] = 1;
  for (let k = 0; k < routing.count; k++) {
    const i = routing.order[k]!;
    const r = routing.receiver[i]!;
    if (r >= 0 && mask[r]) mask[i] = 1;
  }
  return mask;
}

export interface CatchmentStats {
  areaKm2: number;
  cells: number;
  /** Area-weighted mean position. It can fall outside a crescent-shaped catchment. */
  centroid: { lat: number; lon: number };
  /** The centroid if it is inside, otherwise the catchment cell nearest to it: a point that is always in the catchment. */
  representative: { lat: number; lon: number; isCentroid: boolean };
  bbox: { south: number; west: number; north: number; east: number };
  /**
   * Which grid borders the catchment reaches. Border cells are outlets, so a catchment the grid cut
   * off stops one cell short of the border; reaching that row or column is the signal to widen.
   */
  touches: { north: boolean; south: boolean; west: boolean; east: boolean };
  /** Mean elevation of the catchment, m, from the unfilled DEM. */
  meanElevM: number;
}

export function catchmentStats(g: DemGrid, mask: Uint8Array): CatchmentStats {
  const { width: w, height: h } = g;
  let area = 0;
  let cells = 0;
  let sumLat = 0;
  let sumLon = 0;
  let sumElev = 0;
  let rMin = Infinity;
  let rMax = -Infinity;
  let cMin = Infinity;
  let cMax = -Infinity;
  for (let r = 0; r < h; r++) {
    const a = cellAreaKm2(g, r);
    for (let c = 0; c < w; c++) {
      if (!mask[r * w + c]) continue;
      cells++;
      area += a;
      sumLat += a * cellLat(g, r);
      sumLon += a * cellLon(g, c);
      sumElev += a * g.elev[r * w + c]!;
      if (r < rMin) rMin = r;
      if (r > rMax) rMax = r;
      if (c < cMin) cMin = c;
      if (c > cMax) cMax = c;
    }
  }
  if (cells === 0) throw new Error("empty catchment");
  const centroid = { lat: sumLat / area, lon: sumLon / area };
  const cr = Math.floor((g.north - centroid.lat) / g.dLat);
  const cc = Math.floor((centroid.lon - g.west) / g.dLon);
  let representative = { ...centroid, isCentroid: true };
  if (!mask[cr * w + cc]) {
    let bestD = Infinity;
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (!mask[r * w + c]) continue;
        const d = (r - cr) ** 2 + (c - cc) ** 2;
        if (d < bestD) {
          bestD = d;
          representative = { lat: cellLat(g, r), lon: cellLon(g, c), isCentroid: false };
        }
      }
    }
  }
  return {
    areaKm2: area,
    cells,
    centroid,
    representative,
    bbox: { north: g.north - rMin * g.dLat, south: g.north - (rMax + 1) * g.dLat, west: g.west + cMin * g.dLon, east: g.west + (cMax + 1) * g.dLon },
    touches: { north: rMin <= 1, south: rMax >= h - 2, west: cMin <= 1, east: cMax >= w - 2 },
    meanElevM: sumElev / area,
  };
}

// ---------------------------------------------------------------------------------------------
// Polygons: rasterising someone else's, outlining ours
// ---------------------------------------------------------------------------------------------

type Position = readonly number[];
type Ring = readonly Position[];

/** Every ring of a Polygon, MultiPolygon or collection of them; anything else contributes none. */
export function ringsOf(geometry: GeoJsonGeometry | null | undefined): Ring[] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates as Ring[];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as Ring[][]).flat();
  if (geometry.type === "GeometryCollection") return (geometry.geometries ?? []).flatMap(ringsOf);
  return [];
}

/**
 * Rasterise a polygon onto the grid by cell centre, even-odd across all rings (so holes are holes).
 *
 * Scanline rather than a point-in-polygon test per cell: a basin outline has thousands of
 * vertices and the grid millions of cells, and one pass of edge crossings per row is the
 * difference between seconds and hours.
 */
export function rasterize(g: DemGrid, geometry: GeoJsonGeometry | null | undefined): Uint8Array {
  const mask = new Uint8Array(g.width * g.height);
  const edges: [number, number, number, number][] = [];
  for (const ring of ringsOf(geometry)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j]!;
      const b = ring[i]!;
      if (a[1] !== b[1]) edges.push([a[0]!, a[1]!, b[0]!, b[1]!]);
    }
  }
  const xs: number[] = [];
  for (let r = 0; r < g.height; r++) {
    const y = cellLat(g, r);
    xs.length = 0;
    for (const [x1, y1, x2, y2] of edges) {
      if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k]! - g.west) / g.dLon - 0.5));
      const c1 = Math.min(g.width - 1, Math.floor((xs[k + 1]! - g.west) / g.dLon - 0.5));
      for (let c = c0; c <= c1; c++) mask[r * g.width + c] = 1;
    }
  }
  return mask;
}

export interface Overlap {
  aKm2: number;
  bKm2: number;
  bothKm2: number;
  /** Intersection over union. */
  iou: number;
  /** Share of A that lies inside B, and of B inside A. */
  aInB: number;
  bInA: number;
}

export function overlap(g: DemGrid, a: Uint8Array, b: Uint8Array): Overlap {
  let aKm2 = 0;
  let bKm2 = 0;
  let bothKm2 = 0;
  for (let r = 0; r < g.height; r++) {
    const area = cellAreaKm2(g, r);
    for (let c = 0; c < g.width; c++) {
      const i = r * g.width + c;
      if (a[i]) aKm2 += area;
      if (b[i]) bKm2 += area;
      if (a[i] && b[i]) bothKm2 += area;
    }
  }
  const union = aKm2 + bKm2 - bothKm2;
  return { aKm2, bKm2, bothKm2, iou: union > 0 ? bothKm2 / union : 0, aInB: aKm2 > 0 ? bothKm2 / aKm2 : 0, bInA: bKm2 > 0 ? bothKm2 / bKm2 : 0 };
}

/** Area of a GeoJSON polygon geometry on the sphere, km², holes subtracted. */
export function geometryAreaKm2(geometry: GeoJsonGeometry | null | undefined): number {
  if (!geometry) return 0;
  const polygons: Ring[][] =
    geometry.type === "Polygon" ? [geometry.coordinates as Ring[]] : geometry.type === "MultiPolygon" ? (geometry.coordinates as Ring[][]) : [];
  let total = 0;
  for (const rings of polygons) {
    rings.forEach((ring, k) => {
      const a = Math.abs(ringAreaKm2(ring));
      total += k === 0 ? a : -a;
    });
  }
  if (geometry.type === "GeometryCollection") for (const g of geometry.geometries ?? []) total += geometryAreaKm2(g);
  return total;
}

/** Signed spherical area of a lon/lat ring, km², positive counter-clockwise (Chamberlain & Duquette 2007). */
export function ringAreaKm2(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    sum += rad(q[0]! - p[0]!) * (2 + Math.sin(rad(p[1]!)) + Math.sin(rad(q[1]!)));
  }
  return (-sum * EARTH_KM * EARTH_KM) / 2;
}

/** Bounding box of a geometry's rings, or null if it has none. */
export function geometryBbox(geometry: GeoJsonGeometry | null | undefined): { south: number; west: number; north: number; east: number } | null {
  const rings = ringsOf(geometry);
  if (rings.length === 0) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p[0]! < west) west = p[0]!;
      if (p[0]! > east) east = p[0]!;
      if (p[1]! < south) south = p[1]!;
      if (p[1]! > north) north = p[1]!;
    }
  }
  return { south, west, north, east };
}

/**
 * The outline of a mask as a GeoJSON Polygon or MultiPolygon, along cell edges, simplified.
 *
 * Each cell edge with the catchment on one side and not the other is a boundary edge, oriented so
 * the catchment is on its right in row/column space (which is on its left, counter-clockwise, once
 * rows run north); chaining edges head to tail closes the rings. Where two cells touch only at a
 * corner the chain turns right, which keeps a pinch point from joining two rings into a figure
 * of eight. Rings are then simplified by Douglas–Peucker to `toleranceDeg`.
 */
export function outline(g: DemGrid, mask: Uint8Array, toleranceDeg: number): GeoJsonGeometry {
  const { width: w, height: h } = g;
  const W = w + 1;
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < h && c < w && mask[r * w + c] === 1;
  // Vertices are cell corners (row, col) on a (h+1) × (w+1) lattice; an edge is stored by its start vertex.
  const next = new Map<number, number[]>();
  const add = (r0: number, c0: number, r1: number, c1: number) => {
    const key = r0 * W + c0;
    const list = next.get(key);
    if (list) list.push(r1 * W + c1);
    else next.set(key, [r1 * W + c1]);
  };
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!inside(r, c)) continue;
      if (!inside(r - 1, c)) add(r, c + 1, r, c); // north edge, westwards
      if (!inside(r, c - 1)) add(r, c, r + 1, c); // west edge, southwards
      if (!inside(r + 1, c)) add(r + 1, c, r + 1, c + 1); // south edge, eastwards
      if (!inside(r, c + 1)) add(r + 1, c + 1, r, c + 1); // east edge, northwards
    }
  }
  const rings: number[][][] = [];
  for (const [start] of next) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const ring: number[] = [start];
      let prev = start;
      let cur = takeEdge(next, start, -1, W);
      while (cur !== start) {
        ring.push(cur);
        const nxt = takeEdge(next, cur, prev, W);
        prev = cur;
        cur = nxt;
      }
      ring.push(start);
      const coords = ring.map((v) => {
        const r = Math.floor(v / W);
        const c = v - r * W;
        return [round6(g.west + c * g.dLon), round6(g.north - r * g.dLat)];
      });
      rings.push(simplifyRing(coords, toleranceDeg));
    }
  }
  const outers = rings.filter((r) => ringAreaKm2(r) > 0).sort((a, b) => ringAreaKm2(b) - ringAreaKm2(a));
  const holes = rings.filter((r) => ringAreaKm2(r) < 0);
  const polygons = outers.map((o) => [o] as number[][][]);
  for (const hole of holes) {
    const target = polygons.find((p) => geometryContainsPoint(p[0]!, hole[0]!)) ?? polygons[0];
    target?.push(hole);
  }
  return polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Take the outgoing edge from `at`; at a pinch (two choices) prefer the right turn relative to the incoming edge. */
function takeEdge(next: Map<number, number[]>, at: number, from: number, W: number): number {
  const list = next.get(at)!;
  if (list.length === 1 || from < 0) return list.shift()!;
  const ar = Math.floor(at / W);
  const ac = at - ar * W;
  const fr = Math.floor(from / W);
  const fc = from - fr * W;
  const inR = ar - fr;
  const inC = ac - fc;
  let bestK = 0;
  let bestScore = -Infinity;
  list.forEach((v, k) => {
    const vr = Math.floor(v / W);
    const vc = v - vr * W;
    const outR = vr - ar;
    const outC = vc - ac;
    // In (row, col) space with rows running south, a right turn has a positive cross product.
    const score = inR * outC - inC * outR;
    if (score > bestScore) {
      bestScore = score;
      bestK = k;
    }
  });
  return list.splice(bestK, 1)[0]!;
}

function geometryContainsPoint(ring: readonly number[][], p: readonly number[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > p[1]! !== yj > p[1]! && p[0]! < ((xj - xi) * (p[1]! - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Douglas–Peucker on a closed ring, keeping it closed and never below four points. */
export function simplifyRing(ring: number[][], tolerance: number): number[][] {
  if (ring.length <= 4) return ring;
  const open = ring.slice(0, -1);
  // Split at the vertex farthest from the first, so the two halves are well-conditioned lines.
  let far = 0;
  let farD = -1;
  for (let i = 1; i < open.length; i++) {
    const d = (open[i]![0]! - open[0]![0]!) ** 2 + (open[i]![1]! - open[0]![1]!) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = simplifyLine(open.slice(0, far + 1), tolerance);
  const b = simplifyLine([...open.slice(far), open[0]!], tolerance);
  const out = [...a.slice(0, -1), ...b];
  return out.length >= 4 ? out : ring;
}

function simplifyLine(line: number[][], tolerance: number): number[][] {
  if (line.length <= 2) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let idx = -1;
    let maxD = tolerance;
    for (let i = s + 1; i < e; i++) {
      const d = pointSegment(line[i]!, line[s]!, line[e]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

function pointSegment(p: number[], a: number[], b: number[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / len2));
  return Math.hypot(p[0]! - a[0]! - t * dx, p[1]! - a[1]! - t * dy);
}

// ---------------------------------------------------------------------------------------------

/** A binary min-heap of cell indices keyed by height, in typed arrays: the grids here run to tens of millions of cells. */
class MinHeap {
  private readonly keys: Float32Array;
  private readonly vals: Int32Array;
  size = 0;
  constructor(capacity: number) {
    this.keys = new Float32Array(capacity);
    this.vals = new Int32Array(capacity);
  }
  push(v: number, k: number): void {
    let i = this.size++;
    const { keys, vals } = this;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= k) break;
      keys[i] = keys[p]!;
      vals[i] = vals[p]!;
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }
  pop(): number {
    const { keys, vals } = this;
    const top = vals[0]!;
    const n = --this.size;
    const k = keys[n]!;
    const v = vals[n]!;
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && keys[child + 1]! < keys[child]!) child++;
      if (keys[child]! >= k) break;
      keys[i] = keys[child]!;
      vals[i] = vals[child]!;
      i = child;
    }
    keys[i] = k;
    vals[i] = v;
    return top;
  }
}
