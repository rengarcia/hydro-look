/**
 * §5.8: the hours `{code}EnerDia` returns, curated instead of summed away.
 *
 * `parseEnerDia` totals the 24 hour-ending values of a plant-day into `produccion_mwh` and the
 * hours themselves stay only in the raw archive. This reads them back out into `energy_hourly`
 * rows. It is written against an abstract reader — "every raw record archived for this
 * endpoint" — rather than against a file layout, because the archive is moving from gzip bundles
 * to uncompressed NDJSON per source-endpoint-day (ENHANCEMENTS §2.1), and a backfill that knew the
 * layout would have to be rewritten with it.
 *
 * A record is what the archive stores per request: its key (`mazEnerDia:2026-09-20`), status,
 * fetch time and body. Only 200s with a body are read. Where the same plant-hour was fetched
 * more than once, the latest fetch wins, which is the curated tables' rule too.
 */

import { ENERGY_MODULES, type EnergyPlantCode } from "../registry.ts";
import type { EnergyHourlyRow } from "../contracts/tables.ts";
import { localDateOfHourEnding, localHourEnding } from "../util/dates.ts";

export interface RawRecord {
  key: string;
  status: number;
  fetched_at: string;
  body: string;
  /** How the archive names this record, carried into `raw_ref`. */
  ref: string;
}

/** Every archived record for one endpoint, in any order. The layout behind it is the archive's business. */
export type RawReader = (endpoint: string) => Iterable<RawRecord>;

/** The hours of one `{code}EnerDia` body. Hours published as null are absent, never zero. */
export function parseEnerDiaHours(body: string, code: EnergyPlantCode, record: Pick<RawRecord, "fetched_at" | "ref">): EnergyHourlyRow[] {
  const parsed = JSON.parse(body) as { items?: { loctimestamp?: unknown; valueedit?: unknown }[] };
  if (!Array.isArray(parsed.items)) throw new Error(`ords:${code}EnerDia: no items array`);
  const out: EnergyHourlyRow[] = [];
  for (const item of parsed.items) {
    if (typeof item.loctimestamp !== "string") throw new Error(`ords:${code}EnerDia: an item without loctimestamp`);
    if (item.valueedit === null || item.valueedit === undefined) continue;
    const value = Number(item.valueedit);
    if (!Number.isFinite(value) || value < 0) continue;
    out.push({
      date: localDateOfHourEnding(item.loctimestamp),
      hour_ending: localHourEnding(item.loctimestamp),
      site: ENERGY_MODULES[code].site,
      energy_mwh: Math.round(value * 1e6) / 1e6,
      source: `ords:${code}EnerDia`,
      fetched_at: record.fetched_at,
      raw_ref: record.ref,
    });
  }
  return out;
}

/** Every plant-hour the archive holds, latest fetch per plant-hour, in date, site and hour order. */
export function energyHourlyFromRaw(
  read: RawReader,
  codes: readonly EnergyPlantCode[] = Object.keys(ENERGY_MODULES) as EnergyPlantCode[],
): EnergyHourlyRow[] {
  const best = new Map<string, EnergyHourlyRow>();
  for (const code of codes) {
    for (const record of read(`${code}EnerDia`)) {
      if (record.status !== 200 || !record.body) continue;
      for (const row of parseEnerDiaHours(record.body, code, record)) {
        const key = `${row.date}|${row.site}|${row.hour_ending}`;
        const current = best.get(key);
        if (!current || row.fetched_at > current.fetched_at) best.set(key, row);
      }
    }
  }
  return [...best.values()].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.site.localeCompare(b.site) || a.hour_ending - b.hour_ending,
  );
}
