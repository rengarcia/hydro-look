/**
 * The geometry behind the site's charts: scales, ticks and SVG path strings.
 *
 * The site renders every chart as inline SVG on the server and no chart depends on a script, so
 * these run once at build time and their output is what a reader receives. That is the reason
 * they live here rather than inside the components: a path string is arithmetic, arithmetic can
 * be wrong in ways that look plausible on screen, and a unit test catches an off-by-one in a
 * stack that a glance at a rendered chart will not.
 *
 * Everything is pure and takes its domain explicitly. Nothing here reads data, picks a colour,
 * or decides what a chart means.
 */

/** Maps a value in `[domainMin, domainMax]` onto `[rangeMin, rangeMax]`. */
export interface Scale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
}

/**
 * A linear scale. A zero-width domain maps everything to the middle of the range rather than
 * dividing by zero — which is the case of a reservoir that has not moved all week, and a chart
 * that renders it as a flat line through the centre is telling the truth about it.
 */
export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const scale = ((value: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0))) as Scale;
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/**
 * Tick values at 1/2/5 × 10^n covering `[min, max]`, aiming for about `count` of them.
 *
 * Axis labels are read as round numbers or not read at all, so the step is snapped to the
 * familiar three rather than to `span / count`. The result is inclusive of any nice value
 * inside the domain and never extends past it: a gridline outside the plotted range would
 * invite the reader to extend the axis in their head.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 1) return [];
  if (min === max) return [min];
  const [lo, hi] = min < max ? [min, max] : [max, min];
  const rough = (hi - lo) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  // The smallest nice value at or above the rough step. Reaching for the next one up instead
  // halves the tick count: over a 50 m domain asking for five ticks, a rough step of exactly 10
  // would be promoted to 20 and the axis would come back with two labels.
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

  const out: number[] = [];
  // Start at the first nice value at or above `lo`, then walk. Accumulating `first + i * step`
  // rather than `value += step` keeps floating-point drift from turning 0.30000000000000004
  // into an axis label.
  const first = Math.ceil(lo / step) * step;
  for (let i = 0; first + i * step <= hi + step * 1e-9; i++) out.push(round(first + i * step, step));
  return out;
}

/** Rounds to the decimals the step itself carries, so 0.1 steps do not print 16 digits. */
function round(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(Math.min(decimals, 12)));
}

export interface Point {
  x: number;
  y: number;
}

/** `M x y L x y …` through the points, in order. Fewer than two points draw nothing. */
export function linePath(points: readonly Point[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)} ${fmt(p.y)}`).join(" ");
}

/**
 * A closed band between an upper and a lower edge, for a climatology band or a forecast fan.
 *
 * The lower edge is walked backwards so the path closes without a diagonal across the figure.
 * The two edges must share their x values in order; they are not resampled here, because a
 * silent resample is how a band ends up describing days it was never computed for.
 */
export function bandPath(upper: readonly Point[], lower: readonly Point[]): string {
  if (upper.length < 2 || lower.length !== upper.length) return "";
  const forward = upper.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)} ${fmt(p.y)}`).join(" ");
  const back = [...lower]
    .reverse()
    .map((p) => `L${fmt(p.x)} ${fmt(p.y)}`)
    .join(" ");
  return `${forward} ${back} Z`;
}

/** Two decimals is a tenth of a pixel at these sizes, and keeps the committed HTML readable. */
function fmt(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "0";
}

export interface StackBand {
  key: string;
  /** `[y0, y1]` per input row, cumulative from zero upward. */
  extents: [number, number][];
}

/**
 * Cumulative bands for a stacked area, in the order `keys` is given.
 *
 * The order is fixed by the caller and never by the day's values: a stack that reorders itself
 * when the mix changes repaints every series and destroys the one thing a stacked area is for,
 * which is following a band across time. A missing or negative value contributes zero rather
 * than dropping the row, so every band stays the same length as every other and the shared
 * x positions in `bandPath` remain true.
 */
export function stack(rows: readonly Record<string, number | null | undefined>[], keys: readonly string[]): StackBand[] {
  const bands: StackBand[] = keys.map((key) => ({ key, extents: [] }));
  for (const row of rows) {
    let cursor = 0;
    for (const band of bands) {
      const raw = row[band.key];
      const value = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
      band.extents.push([cursor, cursor + value]);
      cursor += value;
    }
  }
  return bands;
}

/** The largest top edge across every band — the y domain a stacked chart needs. */
export function stackMax(bands: readonly StackBand[]): number {
  let max = 0;
  for (const band of bands) for (const [, top] of band.extents) if (top > max) max = top;
  return max;
}
