/** Number parsing for the CENACE HTML reports and rounding for the curated tables. */

/**
 * `76,808,654.928` (SMEC) and `104 277` (Información Operativa, thin-space thousands)
 * both become plain numbers. Returns null for empty or non-numeric text.
 */
export function parseEsNumber(raw: string): number | null {
  // Thousands separators are commas (SMEC) or thin/non-breaking spaces (Informacion
  // Operativa); the decimal separator is always a point in both.
  const cleaned = raw.replace(/[\s\u00a0\u2007\u2009\u202f]/gu, "").replace(/,/g, "");
  if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * The ORDS returns values such as 73.84905660377358490566037735849056603774. Six decimals
 * is well past any instrument's precision and keeps the committed CSV diffs stable.
 */
export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** A finite number, or null for null/undefined/NaN (the ORDS uses null for "no reading"). */
export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? round6(value) : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? round6(n) : null;
  }
  return null;
}

/**
 * Rounds for publication. A forecast document is rewritten and committed every day, so a level
 * carried to sixteen digits turns every run into a diff nobody can read; and `0.01 m` is the
 * precision the levels arrive at in the first place, so the digits past it were never real.
 */
export function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/** `roundTo` that passes null through, for the many optional numbers in the forecast document. */
export function roundOrNull(value: number | null | undefined, digits: number): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : roundTo(value, digits);
}
