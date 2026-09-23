/**
 * CLI option parsing, kept out of the script so it can be tested directly: the workflows pass
 * these flags from GitHub inputs, where an unset input arrives as an empty string.
 */

import { parseArgs } from "node:util";
import { ENERGY_BACKFILL_ONLY_CODES, ENERGY_MODULES, type EnergyPlantCode } from "./registry.ts";
import { assertIsoDate, type IsoDate } from "./util/dates.ts";

export const BACKFILL_SOURCES = [
  "ords-levels",
  "ords-energy",
  "ords-daily",
  "ords-plant-energy",
  "ords-historian",
  "ords-basin",
  "smec",
  "all",
] as const;

export type BackfillSource = (typeof BACKFILL_SOURCES)[number];

/**
 * Three days, not one. The 12-month reports repair their own gaps, but the per-day reports
 * (`repDiaNivQIng`, `repDiaPotQTurb`, `repDiaRegAyer`, `repDiaVolAlm`) are asked one date at a
 * time, so a day missed by a failed or skipped run stayed missing until someone dispatched a
 * backfill. Re-reading the last three days covers two missed runs in a row for about twenty
 * extra requests, and an unchanged answer costs nothing downstream: the archive and the
 * tables leave identical content untouched.
 */
export const DEFAULT_DAILY_DAYS = 3;

export interface Options {
  command: string;
  dryRun: boolean;
  rateMs: number;
  maxRequests: number;
  /**
   * Wall-clock budget for the fetch phase, in minutes. A staged run only writes anything once
   * fetching ends, so a run killed by a CI job timeout loses everything it collected. Stopping
   * on our own deadline leaves time to archive, apply and push what we already have.
   */
  maxMinutes: number;
  from?: IsoDate;
  to?: IsoDate;
  date?: IsoDate;
  /** How many recent days the daily run re-reads the per-day reports for (SMEC: two more). */
  days: number;
  source: BackfillSource;
  plants: EnergyPlantCode[];
  /** Stage the run's output here instead of writing the store (see the `apply` command). */
  out?: string;
  /** Directory a staged run wrote, to be merged into the store. */
  in?: string;
  /** Markdown run summary (rows, requests, errors) written here, for `$GITHUB_STEP_SUMMARY`. */
  summary?: string;
}

/**
 * An empty or missing flag falls back to the default. This matters because a workflow that
 * forwards an unset input runs `--days ""`, and `Number("")` is 0 — which would quietly turn
 * "ingest one day" into "ingest no days" instead of failing.
 */
export function positiveNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`expected a positive number, got ${JSON.stringify(raw)}`);
  }
  return value;
}

export function parseOptions(argv: string[]): Options {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      "rate-ms": { type: "string" },
      "max-requests": { type: "string" },
      "max-minutes": { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      date: { type: "string" },
      days: { type: "string" },
      source: { type: "string" },
      plants: { type: "string" },
      out: { type: "string" },
      in: { type: "string" },
      summary: { type: "string" },
    },
  });

  const source = (values.source?.trim() || "all") as BackfillSource;
  if (!BACKFILL_SOURCES.includes(source)) {
    throw new Error(`--source must be one of ${BACKFILL_SOURCES.join(", ")}`);
  }
  const plants = (values.plants?.trim() || ENERGY_BACKFILL_ONLY_CODES.join(","))
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as EnergyPlantCode[];
  for (const plant of plants) {
    if (!Object.hasOwn(ENERGY_MODULES, plant)) throw new Error(`unknown plant code "${plant}"`);
  }

  const optionalDate = (raw: string | undefined): IsoDate | undefined => (raw && raw.trim() !== "" ? assertIsoDate(raw.trim()) : undefined);

  return {
    command: positionals[0] ?? "daily",
    dryRun: values["dry-run"] ?? false,
    rateMs: positiveNumber(values["rate-ms"], 1000),
    maxRequests: positiveNumber(values["max-requests"], Infinity),
    maxMinutes: positiveNumber(values["max-minutes"], Infinity),
    from: optionalDate(values.from),
    to: optionalDate(values.to),
    date: optionalDate(values.date),
    days: positiveNumber(values.days, DEFAULT_DAILY_DAYS),
    source,
    plants,
    out: values.out?.trim() || undefined,
    in: values.in?.trim() || undefined,
    summary: values.summary?.trim() || undefined,
  };
}
