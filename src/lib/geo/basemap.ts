/**
 * The geometry under the site's maps: rivers traced from the DEM, relief bands, and country
 * outlines cut to a window.
 *
 * `scripts/basemap.ts` fetches and writes; everything here is a pure function of a grid or a
 * ring, so it is tested on shapes small enough to check by hand. The rivers come from the same
 * flow routing as the catchments (`catchment.ts`), which is the point of tracing them rather than
 * borrowing a river layer: a river drawn on a map here meets its catchment's outlet at the dam,
 * because both were read off one surface.
 */

import { cellLat, cellLon, ringAreaKm2, simplifyLine, type DemGrid, type Routing } from "./catchment.ts";

export interface RiverLine {
  /** Upstream area at the line's downstream end, km² — what the map scales the stroke by. */
  areaKm2: number;
  /** [lon, lat] pairs from upstream to downstream. */
  coordinates: number[][];
}

/**
 * Every channel as a set of lines that break at confluences.
 *
 * `keep` marks the channel cells (typically `acc ≥ threshold` inside a region). A line starts at a
 * channel cell no other channel cell drains into (a source) or at one two or more do (a junction),
 * and runs downstream until the next junction, which it ends on so the two lines meet, or until
 * the channel leaves `keep` or the grid. The order of `routing.order` puts receivers first, so it
 * is read backwards to count donors before any line is traced.
 */
export function channelLines(g: DemGrid, routing: Routing, acc: Float64Array, keep: Uint8Array, toleranceDeg: number): RiverLine[] {
  const n = g.width * g.height;
  const donors = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    const r = routing.receiver[i]!;
    if (r >= 0 && keep[r] && donors[r]! < 255) donors[r]!++;
  }
  const lines: RiverLine[] = [];
  const point = (i: number) => {
    const row = Math.floor(i / g.width);
    return [cellLon(g, i - row * g.width), cellLat(g, row)];
  };
  for (let start = 0; start < n; start++) {
    if (!keep[start] || donors[start] === 1) continue;
    const coords = [point(start)];
    let area = acc[start]!;
    let cur = start;
    for (;;) {
      const next = routing.receiver[cur]!;
      if (next < 0 || !keep[next]) break;
      coords.push(point(next));
      area = acc[next]!;
      if (donors[next]! >= 2) break;
      cur = next;
    }
    if (coords.length < 2) continue;
    lines.push({ areaKm2: area, coordinates: simplifyLine(coords, toleranceDeg) });
  }
  return lines;
}

/**
 * A grid averaged over `factor × factor` blocks, ignoring no-data cells; a block with none is no data.
 * Relief bands drawn on the full grid would carry every gully as a vertex.
 */
export function downsample(g: DemGrid, factor: number): DemGrid {
  if (!Number.isInteger(factor) || factor < 1) throw new Error(`factor must be a positive integer, got ${factor}`);
  const width = Math.floor(g.width / factor);
  const height = Math.floor(g.height / factor);
  const elev = new Float32Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      let sum = 0;
      let count = 0;
      for (let dr = 0; dr < factor; dr++) {
        for (let dc = 0; dc < factor; dc++) {
          const v = g.elev[(r * factor + dr) * g.width + c * factor + dc]!;
          if (Number.isFinite(v)) {
            sum += v;
            count++;
          }
        }
      }
      elev[r * width + c] = count > 0 ? sum / count : Number.NaN;
    }
  }
  return { width, height, west: g.west, north: g.north, dLon: g.dLon * factor, dLat: g.dLat * factor, elev };
}

export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * A closed ring cut to a box (Sutherland–Hodgman), still closed; null when nothing is left.
 *
 * A country that runs off the window keeps a straight edge along the window's side, which is
 * outside what the map draws, so the cut never shows.
 */
export function clipRing(ring: readonly (readonly number[])[], box: Box): number[][] | null {
  type P = [number, number];
  let pts: P[] = ring.slice(0, -1).map((p) => [p[0]!, p[1]!]);
  const edges: { inside: (p: P) => boolean; cross: (a: P, b: P) => P }[] = [
    { inside: (p) => p[0] >= box.west, cross: (a, b) => atX(a, b, box.west) },
    { inside: (p) => p[0] <= box.east, cross: (a, b) => atX(a, b, box.east) },
    { inside: (p) => p[1] >= box.south, cross: (a, b) => atY(a, b, box.south) },
    { inside: (p) => p[1] <= box.north, cross: (a, b) => atY(a, b, box.north) },
  ];
  for (const edge of edges) {
    if (pts.length === 0) break;
    const out: P[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i]!;
      const prev = pts[(i + pts.length - 1) % pts.length]!;
      const curIn = edge.inside(cur);
      const prevIn = edge.inside(prev);
      if (curIn) {
        if (!prevIn) out.push(edge.cross(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(edge.cross(prev, cur));
      }
    }
    pts = out;
  }
  if (pts.length < 3) return null;
  return [...pts, pts[0]!];
}

function atX(a: [number, number], b: [number, number], x: number): [number, number] {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
}

function atY(a: [number, number], b: [number, number], y: number): [number, number] {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), y];
}

/** The polygons of a Polygon or MultiPolygon geometry's coordinates. */
export function polygonsOf(geometry: { type: string; coordinates?: unknown }): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as number[][][][];
  return [];
}

/**
 * Polygons without the islands and holes smaller than `minKm2`: at the scale of a national map a
 * 5 km² patch above 4,000 m is a speck that costs as many vertices as a mountain range.
 */
export function dropSmallRings(polygons: number[][][][], minKm2: number): number[][][][] {
  return polygons
    .filter((p) => p[0] !== undefined && Math.abs(ringAreaKm2(p[0])) >= minKm2)
    .map((p) => [p[0]!, ...p.slice(1).filter((hole) => Math.abs(ringAreaKm2(hole)) >= minKm2)]);
}

/** Coordinates rounded to `digits` decimals, with consecutive duplicates the rounding creates removed. */
export function roundLine(coords: readonly (readonly number[])[], digits: number): number[][] {
  const f = 10 ** digits;
  const out: number[][] = [];
  for (const p of coords) {
    const q = [Math.round(p[0]! * f) / f, Math.round(p[1]! * f) / f];
    const last = out.at(-1);
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}
