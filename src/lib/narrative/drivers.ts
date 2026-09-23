/**
 * Structured drivers (§5.6): each driver names the factor it is about, the one payload number it
 * rests on, and which side of that number's natural reference the number sits — so a driver is
 * checked by code, not only by the number-and-date scan the prose gets.
 *
 * Three checks, each one a way a fluent driver can be wrong while every figure in it is real:
 *
 * - **The reference resolves.** `payload_ref` is a path into the payload the text was given —
 *   `adequacy.horizons[2].surplus_gwh_day` — and it must land on a number. A driver that cites
 *   a field that does not exist is citing nothing.
 * - **The factor matches the block.** A driver filed under `enso` that points into `adequacy`
 *   is about something other than what it says it is about.
 * - **The direction matches the sign.** For the numbers whose reference is fixed — zero for a
 *   slope, a change, a surplus, a deficit or a skill; fifty for a percentile; one for the hydro
 *   anomaly; zero for ONI — `up` must be above it and `down` below. `steady` is accepted without
 *   a check: there is no tolerance that would make "steady" true or false by arithmetic.
 *
 * What it does not check: that the sentence says what the reference is. The text is still
 * scanned for invented figures by `validate.ts`, and the page renders the numbers beside it.
 */

import type { NarrativePayload } from "./payload.ts";

export const DRIVER_FACTORS = [
  "mazar_level",
  "mazar_forecast",
  "inflow",
  "adequacy",
  "imports",
  "precipitation",
  "enso",
  "stale_data",
  "other_reservoirs",
] as const;
export type DriverFactor = (typeof DRIVER_FACTORS)[number];

export const DRIVER_DIRECTIONS = ["up", "down", "steady"] as const;
export type DriverDirection = (typeof DRIVER_DIRECTIONS)[number];

export interface StructuredDriver {
  text: string;
  factor: DriverFactor;
  direction: DriverDirection;
  payload_ref: string;
}

/** The payload blocks each factor may point into. */
const FACTOR_ROOTS: Record<DriverFactor, readonly string[]> = {
  mazar_level: ["reservoirs"],
  mazar_forecast: ["mazar_forecast"],
  inflow: ["reservoirs"],
  adequacy: ["adequacy"],
  imports: ["adequacy"],
  precipitation: ["precipitation_16d"],
  enso: ["enso"],
  stale_data: ["stale_feeds"],
  other_reservoirs: ["reservoirs"],
};

/** `a.b[2].c` → `["a", "b", 2, "c"]`, or null for anything that is not such a path. */
export function parseRef(ref: string): (string | number)[] | null {
  const trimmed = ref.trim().replace(/^payload\./, "");
  if (!/^[a-z_][a-z0-9_]*(?:\[\d+\]|\.[a-z_][a-z0-9_]*)*$/i.test(trimmed)) return null;
  const out: (string | number)[] = [];
  for (const match of trimmed.matchAll(/([a-z_][a-z0-9_]*)|\[(\d+)\]/gi)) {
    out.push(match[2] !== undefined ? Number(match[2]) : match[1]!);
  }
  return out;
}

export function resolveRef(payload: NarrativePayload, ref: string): unknown {
  const path = parseRef(ref);
  if (path === null) return undefined;
  let here: unknown = payload;
  for (const step of path) {
    if (here === null || typeof here !== "object") return undefined;
    here = typeof step === "number" ? (Array.isArray(here) ? here[step] : undefined) : (here as Record<string, unknown>)[step];
  }
  return here;
}

/** The natural reference of a number, by its key, or null when it has none this check knows. */
export function referenceFor(ref: string): number | null {
  const path = parseRef(ref);
  const key = String(path?.at(-1) ?? "");
  if (path?.[0] === "enso" && key === "oni") return 0;
  if (key === "hydro_anomaly") return 1;
  if (/percentile/.test(key)) return 50;
  if (/slope|change|surplus|deficit|skill|^d(7|14|30)$/.test(key)) return 0;
  return null;
}

/** Every problem with one driver; empty means it checks out. */
export function checkDriver(driver: StructuredDriver, payload: NarrativePayload): string[] {
  const problems: string[] = [];
  const path = parseRef(driver.payload_ref);
  if (path === null) return [`payload_ref "${driver.payload_ref}" is not a path`];
  const value = resolveRef(payload, driver.payload_ref);
  if (typeof value !== "number") problems.push(`payload_ref "${driver.payload_ref}" does not resolve to a number in the payload`);
  const roots = FACTOR_ROOTS[driver.factor];
  if (!roots.includes(String(path[0]))) problems.push(`factor "${driver.factor}" does not match payload_ref "${driver.payload_ref}"`);
  // Mazar's own factors must point at Mazar, and the other reservoirs' factor at another one.
  if (path[0] === "reservoirs" && typeof path[1] === "number") {
    const site = payload.reservoirs[path[1]]?.site;
    if (driver.factor === "mazar_level" && site !== "mazar") problems.push(`factor "mazar_level" points at ${site ?? "no reservoir"}`);
    if (driver.factor === "other_reservoirs" && site === "mazar") problems.push('factor "other_reservoirs" points at Mazar');
  }
  const reference = referenceFor(driver.payload_ref);
  if (typeof value === "number" && reference !== null && driver.direction !== "steady") {
    const above = value > reference;
    const below = value < reference;
    if ((driver.direction === "up" && !above) || (driver.direction === "down" && !below)) {
      problems.push(`direction "${driver.direction}" contradicts ${driver.payload_ref} = ${value} against ${reference}`);
    }
  }
  return problems;
}
