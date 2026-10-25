/**
 * Binning for the site's histograms: how a reservoir's days are spread over the values a river
 * or a plant has given.
 *
 * Pure, like `scale.ts`, and for the same reason: a bin that drops its upper edge or counts a day
 * twice looks plausible on screen and is caught only by a test.
 *
 * Both quantities this is used for — inflow in m³/s and energy per day — are never negative, so
 * the first bin starts at zero rather than at the smallest reading. A day the plant stood still is
 * a real zero and belongs in the first bar, not off the left edge.
 */

import { quantile } from "../util/stats.ts";

export interface Bin {
  /** Inclusive lower edge. */
  from: number;
  /** Exclusive upper edge; the last bin is open when `open` is set. */
  to: number;
  count: number;
  /** `count` over every value binned, 0–1. */
  share: number;
}

export interface Bins {
  /** The edges, `width` apart from zero. */
  edges: number[];
  width: number;
  /**
   * True when values above the last edge were counted in the last bin. Floods are the long tail
   * of an inflow record: drawing the axis out to the largest one leaves every other day in two
   * bars at the left.
   */
  open: boolean;
}

/**
 * The step at 1/2/5 × 10^n nearest above `rough`, so the bin edges are numbers a reader can say.
 * A non-positive or non-finite step has no nice value; the caller gets 1.
 */
export function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  return (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
}

/**
 * Edges from zero to just past the `cap` quantile of `values`, in about `target` nice steps.
 *
 * The cap is a quantile rather than the maximum so one flood does not set the scale; when any
 * value lies beyond the last edge the bins say so (`open`) and the last bar counts it.
 */
export function binsFor(values: readonly number[], target = 24, cap = 0.99): Bins | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  const top = quantile(finite, cap)!;
  const max = Math.max(...finite);
  if (top <= 0) return { edges: [0, 1], width: 1, open: max > 1 };
  const width = niceStep(top / target);
  const count = Math.max(1, Math.ceil(top / width + 1e-9));
  const edges = Array.from({ length: count + 1 }, (_, i) => fix(i * width, width));
  return { edges, width, open: max >= edges.at(-1)! };
}

/**
 * Counts `values` into `bins`. A value below zero counts in the first bin and one at or above the
 * last edge in the last, so every value is counted exactly once and the shares sum to 1.
 */
export function histogram(values: readonly number[], bins: Bins): Bin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  const n = bins.edges.length - 1;
  const counts = new Array<number>(n).fill(0);
  for (const v of finite) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(v / bins.width + 1e-9)));
    counts[i]! += 1;
  }
  return counts.map((count, i) => ({
    from: bins.edges[i]!,
    to: bins.edges[i + 1]!,
    count,
    share: finite.length === 0 ? 0 : count / finite.length,
  }));
}

/** The share of `values` strictly below `value`, 0–100, or null with nothing to compare against. */
export function percentBelow(values: readonly number[], value: number): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0 || !Number.isFinite(value)) return null;
  return (finite.filter((v) => v < value).length / finite.length) * 100;
}

/** Strips the floating-point tail `i * width` leaves on an edge such as 0.30000000000000004. */
function fix(value: number, width: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(width)) + 1);
  return Number(value.toFixed(Math.min(decimals, 12)));
}
