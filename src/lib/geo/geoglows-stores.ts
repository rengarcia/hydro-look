/**
 * The GEOGLOWS v2 stores this repository reads, and how: the retrospective daily simulation (one
 * or two chunks per river) and the daily forecasts (one ensemble member of one chunk per river, by
 * range request). Shared by `scripts/geoglows.ts` and `scripts/geoglows-forecast.ts`.
 */

import type { DailySeries } from "../features/series.ts";
import type { IsoDate } from "../util/dates.ts";
import { arrayMeta, positionsOf, readChunk, readChunkRange, readConsolidated, type Consolidated, type ZarrSource } from "./zarr.ts";
import { httpZarrSource, type HttpZarrSource } from "./zarr-http.ts";

export const BUCKET = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
export const SIMULATED = `${BUCKET}/retrospective/daily.zarr`;
export const FORECASTS = "https://geoglows-v2-forecasts.s3-us-west-2.amazonaws.com";

/** A forecast store's URL: one per 00 UTC run, named `YYYYMMDD00.zarr`. */
export const forecastStore = (date: IsoDate): string => `${FORECASTS}/${date.replaceAll("-", "")}00.zarr`;

/** Dates from a `seconds since YYYY-MM-DD` time array. */
function epochOf(md: Consolidated, name: string): number {
  const unit = String((md[`${name}/.zattrs`] ?? {})["units"] ?? "");
  const epoch = /^seconds since (\d{4}-\d{2}-\d{2})(?:[ T]00:00(?::00)?)?$/.exec(unit)?.[1];
  if (!epoch) throw new Error(`zarr: ${name} is in "${unit}", not seconds since a date`);
  return Date.parse(`${epoch}T00:00:00Z`);
}

/**
 * GEOGLOWS' simulated daily mean flow at each river, 1940 → the store's last day. The store is
 * `[time, river_id]` in chunks of ~31,000 days by 50 rivers, so each river costs one or two chunks.
 */
export async function readSimulated(
  riverIds: readonly number[],
): Promise<{ series: Map<number, DailySeries>; etags: Record<string, string> }> {
  const source = httpZarrSource(SIMULATED);
  const md = await readConsolidated(source);
  const timeMeta = arrayMeta(md, "time");
  const epoch = epochOf(md, "time");
  const times: number[] = [];
  for (let c = 0; c < Math.ceil(timeMeta.shape[0]! / timeMeta.chunks[0]!); c++)
    times.push(...Array.from(await readChunk(source, "time", timeMeta, [c])));
  const dates = times.slice(0, timeMeta.shape[0]).map((t) => new Date(epoch + t * 1000).toISOString().slice(0, 10));

  const position = await positionsOf(source, "river_id", arrayMeta(md, "river_id"), riverIds);
  const q = arrayMeta(md, "Q");
  const [tChunk, rChunk] = q.chunks as [number, number];
  const series = new Map<number, DailySeries>();
  for (const id of riverIds) {
    const at = position.get(id);
    if (at === undefined) throw new Error(`zarr: river ${id} is not in daily.zarr`);
    const out: DailySeries = new Map();
    for (let tc = 0; tc < Math.ceil(q.shape[0]! / tChunk); tc++) {
      const data = await readChunk(source, "Q", q, [tc, Math.floor(at / rChunk)]);
      for (let i = 0; i < tChunk && tc * tChunk + i < dates.length; i++) {
        const v = data[i * rChunk + (at % rChunk)]!;
        if (Number.isFinite(v)) out.set(dates[tc * tChunk + i]!, v);
      }
    }
    series.set(id, out);
  }
  return { series, etags: Object.fromEntries(source.etags) };
}

/** The high-resolution member of one day's forecast at some rivers: hours from the 00 UTC origin, and values per river. */
export interface ForecastMember {
  origin: IsoDate;
  hours: number[];
  values: Map<number, Float64Array>;
}

/** Index of the high-resolution run among the forecast's 52 members: the last, hourly to ten days. */
export const HIGH_RES_MEMBER = 52;

/**
 * One member of one forecast at the given rivers. River positions are looked up in `positions`
 * and checked against the store's own index chunk by its ETag, so a store that reordered its
 * rivers is re-read rather than trusted.
 */
export async function readForecastMember(
  origin: IsoDate,
  riverIds: readonly number[],
  positions: { byId: Map<number, number>; indexEtags: Map<string, string> },
  member = HIGH_RES_MEMBER,
): Promise<{ run: ForecastMember; source: HttpZarrSource } | null> {
  const source = httpZarrSource(forecastStore(origin));
  let md: Consolidated;
  try {
    md = await readConsolidated(source);
  } catch {
    return null;
  }
  const rivid = arrayMeta(md, "rivid");
  let byId = positions.byId;
  for (const [key, etag] of positions.indexEtags) {
    await source.getRange(key, 0, 16);
    if (source.etags.get(key) !== etag) {
      byId = await positionsOf(source, "rivid", rivid, riverIds);
      break;
    }
  }
  const time = arrayMeta(md, "time");
  const epoch = epochOf(md, "time");
  const originMs = Date.parse(`${origin}T00:00:00Z`);
  const hours = Array.from(await readChunk(source, "time", time, [0])).map((t) => (epoch + t * 1000 - originMs) / 3_600_000);
  const q = arrayMeta(md, "Qout");
  const [, nt, nr] = q.chunks as [number, number, number];
  const ensembles = Array.from(await readChunk(source, "ensemble", arrayMeta(md, "ensemble"), [0]));
  const e = ensembles.indexOf(member);
  if (e < 0) throw new Error(`forecast ${origin}: no member ${member}`);
  const values = new Map<number, Float64Array>();
  const cache = new Map<number, ArrayLike<number>>();
  for (const id of riverIds) {
    const at = byId.get(id);
    if (at === undefined) throw new Error(`forecast ${origin}: river ${id} not in the store`);
    const c = Math.floor(at / nr);
    const slice = cache.get(c) ?? (await readChunkRange(source, "Qout", q, [0, 0, c], e * nt * nr, (e + 1) * nt * nr));
    cache.set(c, slice);
    values.set(
      id,
      Float64Array.from({ length: nt }, (_, i) => slice[i * nr + (at % nr)]!),
    );
  }
  return { run: { origin, hours: hours.slice(0, nt), values }, source };
}

/** River positions in a forecast store, and the ETags of the index chunks they were read from. */
export async function forecastPositions(
  origin: IsoDate,
  riverIds: readonly number[],
): Promise<{ byId: Map<number, number>; indexEtags: Map<string, string> }> {
  const source = httpZarrSource(forecastStore(origin));
  const md = await readConsolidated(source);
  const rivid = arrayMeta(md, "rivid");
  const byId = await positionsOf(source, "rivid", rivid, riverIds);
  const indexEtags = new Map<string, string>();
  for (const at of byId.values()) {
    const key = `rivid/${Math.floor(at / rivid.chunks[0]!)}`;
    indexEtags.set(key, source.etags.get(key) ?? "");
  }
  return { byId, indexEtags };
}

export type { ZarrSource };
