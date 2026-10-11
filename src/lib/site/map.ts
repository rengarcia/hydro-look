/**
 * The arithmetic of the site's maps: which box to draw, how to put a longitude on the page, and
 * how a GeoJSON geometry becomes an SVG path.
 *
 * The maps are inline SVG like every other chart here, drawn at build time and needing no
 * script. Ecuador straddles the equator, so the projection is the plain equirectangular one with
 * longitude scaled by the cosine of the box's middle latitude: at 5° from the equator the
 * distortion is under 0.4%, less than a stroke's width on any of these maps.
 */

export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Projection {
  box: Box;
  width: number;
  height: number;
  x: (lon: number) => number;
  y: (lat: number) => number;
  /** Pixels per kilometre, for a scale bar. */
  pxPerKm: number;
}

const KM_PER_DEG = 111.195;

/** The box drawn `width` pixels wide, with the height its shape asks for. */
export function project(box: Box, width: number): Projection {
  const k = Math.cos((((box.north + box.south) / 2) * Math.PI) / 180);
  const sx = width / ((box.east - box.west) * k);
  const height = Math.round((box.north - box.south) * sx);
  return {
    box,
    width,
    height,
    x: (lon) => (lon - box.west) * k * sx,
    y: (lat) => (box.north - lat) * sx,
    pxPerKm: sx / KM_PER_DEG,
  };
}

/**
 * The smallest box around `box`, padded by `pad` of its larger side, whose shape is `aspect`
 * (width over height, in projected units). A catchment that is long and thin still gets a map
 * the page can lay out.
 */
export function fitBox(box: Box, aspect: number, pad = 0.1): Box {
  const k = Math.cos((((box.north + box.south) / 2) * Math.PI) / 180);
  let w = (box.east - box.west) * k;
  let h = box.north - box.south;
  const margin = Math.max(w, h) * pad;
  w += 2 * margin;
  h += 2 * margin;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (box.east + box.west) / 2;
  const cy = (box.north + box.south) / 2;
  return { west: cx - w / k / 2, east: cx + w / k / 2, south: cy - h / 2, north: cy + h / 2 };
}

type Position = readonly number[];

/** The box around a set of positions; null for none. */
export function boxOf(points: Iterable<Position>): Box | null {
  let box: Box | null = null;
  for (const p of points) {
    const [lon, lat] = [p[0]!, p[1]!];
    if (box === null) box = { west: lon, east: lon, south: lat, north: lat };
    else {
      box.west = Math.min(box.west, lon);
      box.east = Math.max(box.east, lon);
      box.south = Math.min(box.south, lat);
      box.north = Math.max(box.north, lat);
    }
  }
  return box;
}

export const overlaps = (a: Box, b: Box): boolean => a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;

export const contains = (box: Box, lon: number, lat: number): boolean =>
  lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north;

/** A tenth of a pixel, written short: `0.5` as `.5`, `-0.5` as `-.5`, `3.0` as `3`. */
const short = (v: number): string => {
  const t = String(Math.round(v * 10) / 10);
  return t.startsWith("0.") ? t.slice(1) : t.startsWith("-0.") ? `-${t.slice(2)}` : t;
};

/**
 * An SVG path through positions; `closed` adds `Z`.
 *
 * Points are rounded to a tenth of a pixel and written relative to the one before (`l`), the
 * deltas taken between rounded points so nothing drifts. A point less than `minPx` from the last
 * one written is skipped — the national map's relief carries vertices a fifth of a pixel apart —
 * but the last point of a line is always kept, so rivers still meet.
 */
export function linePath(points: readonly Position[], p: Projection, closed = false, minPx = 0): string {
  let out = "";
  let lx = 0;
  let ly = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const q = points[i]!;
    const x = Math.round(p.x(q[0]!) * 10) / 10;
    const y = Math.round(p.y(q[1]!) * 10) / 10;
    if (out === "") {
      out = `M${short(x)},${short(y)}`;
    } else {
      const dx = x - lx;
      const dy = y - ly;
      if (dx === 0 && dy === 0) continue;
      if (i < n - 1 && Math.hypot(dx, dy) < minPx) continue;
      out += `l${short(dx)}${dy < 0 ? "" : ","}${short(dy)}`;
    }
    lx = x;
    ly = y;
  }
  return out === "" ? "" : closed ? `${out}Z` : out;
}

/**
 * The rings of a Polygon or MultiPolygon as one path, for `fill-rule="evenodd"` so holes stay holes.
 * A polygon wholly outside the projection's box is left out, and so is a ring smaller than `minPx`.
 */
export function polygonPath(geometry: { type: string; coordinates?: unknown }, p: Projection, minPx = 0): string {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : geometry.type === "MultiPolygon"
        ? (geometry.coordinates as Position[][][])
        : [];
  let out = "";
  for (const polygon of polygons) {
    const box = boxOf(polygon[0] ?? []);
    if (box === null || !overlaps(box, p.box)) continue;
    for (const ring of polygon) {
      const rb = boxOf(ring);
      if (rb === null || Math.max(p.x(rb.east) - p.x(rb.west), p.y(rb.south) - p.y(rb.north)) < minPx) continue;
      out += linePath(ring, p, true, minPx);
    }
  }
  return out;
}

/** Every position of a Polygon or MultiPolygon's outer rings. */
export function outerPositions(geometry: { type: string; coordinates?: unknown }): Position[] {
  if (geometry.type === "Polygon") return (geometry.coordinates as Position[][])[0] ?? [];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as Position[][][]).flatMap((poly) => poly[0] ?? []);
  return [];
}

/**
 * A plant's marker radius in pixels: area proportional to capacity, so Coca Codo Sinclair's
 * 1,500 MW reads as nine times Mazar's 170, not three.
 */
export function markerRadius(capacityMw: number | null, scale: number, floor = 3): number {
  if (capacityMw === null || !(capacityMw > 0)) return floor;
  return Math.max(floor, Math.sqrt(capacityMw) * scale);
}

/** A river's stroke width from its upstream area: the log keeps the Pastaza from drowning the Paute. */
export function riverWidth(areaKm2: number, minKm2: number, base: number, perDecade: number): number {
  return base + Math.max(0, Math.log10(areaKm2 / minKm2)) * perDecade;
}

/** A round scale-bar length, in km, no longer than `maxPx` on this projection. */
export function scaleBarKm(p: Projection, maxPx: number): number {
  const limit = maxPx / p.pxPerKm;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  return steps.filter((s) => s <= limit).at(-1) ?? 1;
}

/** `2,59° S · 78,62° O`, the way a Spanish-language map writes a position. */
export function latLonEs(lat: number, lon: number, digits = 3): string {
  const f = (v: number) => Math.abs(v).toFixed(digits).replace(".", ",");
  return `${f(lat)}° ${lat < 0 ? "S" : "N"} · ${f(lon)}° ${lon < 0 ? "O" : "E"}`;
}
