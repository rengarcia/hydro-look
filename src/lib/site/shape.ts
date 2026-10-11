/**
 * The shape of a reservoir, for drawing a gauge whose painted area is the water it holds.
 *
 * A straight gauge filled to today's level measures metres, not water, and for a reservoir in a
 * valley the two are far apart: Mazar's lake is about five times wider at its crest than at its
 * floor, so the bottom half of the band holds well under half of the band's water. If the gauge
 * is drawn as wide at each level as the lake's surface is at that level, the area of the water
 * drawn is `∫ A(h) dh` — the stored volume — and the eye reads the right quantity without a
 * caption.
 *
 * The width comes from an area-elevation curve, and only one exists: Mazar's, fitted by
 * `features/hydrology.ts` from this repository's own readings and published in `forecast.json`
 * as `reservoir.area_elevation`. The same fit was tried on the other seven and does not close —
 * level errors of 4–5 m on bands 14–33 m tall, and 82 hm³ for Coca Codo Sinclair's 0.8 hm³
 * compensation pond — so they get no curve and stay straight. Inventing a valley shape for them
 * would be drawing a claim no data supports. Every function here is pure; the components only
 * place what these return.
 */

/** `A(level) = coefficient * (level - datum_m)^exponent`, in m². The form `forecast.json` publishes. */
export interface AreaCurve {
  coefficient: number;
  exponent: number;
  datum_m: number;
}

/** One point of a gauge outline: `t` 0–1 along the axis from its minimum, `w` the width relative to the axis maximum. */
export interface OutlinePoint {
  t: number;
  w: number;
}

/** Below this, a width is drawn at this; a sliver thinner than a pixel reads as a gap. */
const MIN_WIDTH = 0.02;

export function isAreaCurve(value: unknown): value is AreaCurve {
  if (value === null || typeof value !== "object") return false;
  const { coefficient, exponent, datum_m } = value as Record<string, unknown>;
  return (
    typeof coefficient === "number" &&
    coefficient > 0 &&
    typeof exponent === "number" &&
    Number.isFinite(exponent) &&
    exponent > -1 &&
    typeof datum_m === "number" &&
    Number.isFinite(datum_m)
  );
}

export function areaM2(curve: AreaCurve, level: number): number {
  return curve.coefficient * Math.pow(Math.max(level - curve.datum_m, 0), curve.exponent);
}

/** Volume below `level` down to the curve's datum, m³. Only differences between two levels mean anything. */
export function volumeM3(curve: AreaCurve, level: number): number {
  const power = curve.exponent + 1;
  return (curve.coefficient * Math.pow(Math.max(level - curve.datum_m, 0), power)) / power;
}

/** Water held between `floor` and `level`, hm³; negative below the floor. */
export function storedHm3(curve: AreaCurve, floor: number, level: number): number {
  return (volumeM3(curve, level) - volumeM3(curve, floor)) / 1e6;
}

/**
 * Where `level` sits in the band's *water*, 0–100: the volume above the floor as a share of the
 * volume between floor and crest. Not clamped, like `band_pct`, so a spilling reservoir reads
 * above 100 and one below its floor reads below 0. Null for a band with no height.
 */
export function volumeShare(curve: AreaCurve, floor: number, crest: number, level: number): number | null {
  const full = volumeM3(curve, crest) - volumeM3(curve, floor);
  if (!(full > 0)) return null;
  return ((volumeM3(curve, level) - volumeM3(curve, floor)) / full) * 100;
}

/**
 * The gauge's outline from `min` to `upTo` (default `max`), sampled at `steps` intervals over the
 * whole axis plus the exact end point, so a fill stops at the level and not at the nearest sample.
 * Widths are relative to the surface at `max`, so the widest point of the gauge is 1.
 */
export function outline(curve: AreaCurve, min: number, max: number, upTo: number = max, steps = 40): OutlinePoint[] {
  const span = max - min;
  const top = areaM2(curve, max);
  if (!(span > 0) || !(top > 0)) return [];
  const end = Math.min(Math.max(upTo, min), max);
  const width = (level: number) => Math.max(areaM2(curve, level) / top, MIN_WIDTH);
  const points: OutlinePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const level = min + (span * i) / steps;
    if (level >= end) break;
    points.push({ t: i / steps, w: width(level) });
  }
  points.push({ t: (end - min) / span, w: width(end) });
  return points;
}

/** The width of the outline at `t`, by linear interpolation; for ruling a line exactly across the shape. */
export function widthAt(points: readonly OutlinePoint[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0]!.t) return points[0]!.w;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (t <= b.t) return b.t === a.t ? b.w : a.w + ((b.w - a.w) * (t - a.t)) / (b.t - a.t);
  }
  return points.at(-1)!.w;
}

const r = (v: number) => Math.round(v * 100) / 100;

/**
 * A horizontal gauge: the axis runs left to right over `length`, and the outline is symmetric
 * about the bar's midline, `thickness` tall at its widest. Returns an SVG path, closed.
 */
export function horizontalPath(points: readonly OutlinePoint[], length: number, thickness: number): string {
  if (points.length === 0) return "";
  const mid = thickness / 2;
  const top = points.map((p) => `${r(p.t * length)} ${r(mid - (p.w * thickness) / 2)}`);
  const bottom = [...points].reverse().map((p) => `${r(p.t * length)} ${r(mid + (p.w * thickness) / 2)}`);
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
}

/**
 * A vertical gauge: the axis runs bottom to top over `height`, and the outline is symmetric
 * about the column's centre line, `width` wide at its widest — a valley seen end on.
 */
export function verticalPath(points: readonly OutlinePoint[], width: number, height: number): string {
  if (points.length === 0) return "";
  const mid = width / 2;
  const left = points.map((p) => `${r(mid - (p.w * width) / 2)} ${r(height - p.t * height)}`);
  const right = [...points].reverse().map((p) => `${r(mid + (p.w * width) / 2)} ${r(height - p.t * height)}`);
  return `M${left.join(" L")} L${right.join(" L")} Z`;
}
