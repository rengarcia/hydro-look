/** Small statistics the models share. Kept here so each one is defined and tested once. */

/** Linear-interpolated quantile of an unsorted sample. Empty input has no quantile. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const position = Math.min(Math.max(q, 0), 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

export function median(values: readonly number[]): number | null {
  return quantile(values, 0.5);
}

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Pinball (quantile) loss: the scoring rule for a single quantile forecast. Under-forecasting
 * the p90 is cheap and over-forecasting it is dear, which is what makes it the right metric for
 * a band rather than a point.
 */
export function pinballLoss(actual: number, forecast: number, q: number): number {
  const error = actual - forecast;
  return error >= 0 ? q * error : (q - 1) * error;
}

/** Day of year, 1..365, with 29 February folded onto 28 February so every year has one shape. */
export function dayOfYear(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const start = Date.UTC(year, 0, 1);
  const raw = Math.round((Date.UTC(year, month - 1, day) - start) / 86_400_000) + 1;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap && raw > 59 ? raw - 1 : Math.min(raw, 365);
}

/** Circular distance between two days of the year, so 1 January is one day from 31 December. */
export function dayOfYearDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 365 - raw);
}
