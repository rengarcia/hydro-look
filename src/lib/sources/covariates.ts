import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ENSO_MONTHLY, WEATHER_DAILY, validateRows } from "../contracts/tables.ts";
import type { HttpClient } from "../http/client.ts";
import { parseOni, parseWeather } from "../parse/covariates.ts";
import type { RawArchive } from "../store/archive.ts";
import type { CuratedStore } from "../store/curated.ts";
import { parseCsv } from "../store/csv.ts";
import { addDays, eachDay, todayEc, yearOf } from "../util/dates.ts";
import { DATA_CURATED, DATA_REFERENCE } from "../util/paths.ts";
import type { Options } from "../options.ts";
import type { IngestBatch } from "./batch.ts";

const basinSchema = z.object({
  basin: z.string().regex(/^[a-z][a-z0-9_]*$/),
  latitude: z.string().min(1).pipe(z.coerce.number<string>().min(-90).max(90)),
  longitude: z.string().min(1).pipe(z.coerce.number<string>().min(-180).max(180)),
  coordinate_status: z.enum(["provisional", "verified"]),
  source: z.string().min(1),
  notes: z.string(),
});
type Basin = z.infer<typeof basinSchema>;

export function loadBasins(): Basin[] {
  // ponytail: one point approximates basin weather; use area-weighted grid samples if backtests require them.
  const basins = z
    .array(basinSchema)
    .min(1)
    .parse(parseCsv(readFileSync(join(DATA_REFERENCE, "basins.csv"), "utf8")));
  if (new Set(basins.map((b) => b.basin)).size !== basins.length) throw new Error("duplicate basin id");
  return basins;
}

export class Covariates {
  constructor(
    private readonly http: Pick<HttpClient, "fetch">,
    private readonly archive: RawArchive,
  ) {}

  async weather(batch: IngestBatch, basin: Basin, kind: "era5" | "forecast", from: string, to: string): Promise<void> {
    const key = `${kind}:${basin.basin}:${basin.latitude}:${basin.longitude}:${from}:${to}`;
    try {
      const result = await this.http.fetch({
        key,
        url: kind === "era5" ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast",
        params: {
          latitude: String(basin.latitude),
          longitude: String(basin.longitude),
          daily: "precipitation_sum,temperature_2m_mean",
          timezone: "America/Guayaquil",
          precipitation_unit: "mm",
          temperature_unit: "celsius",
          ...(kind === "era5" ? { models: "era5", start_date: from, end_date: to } : { forecast_days: "16" }),
        },
      });
      const rawRef = this.archive.add("open_meteo", kind, kind === "era5" ? from : null, {
        key: kind === "era5" ? key : `${key}:${result.fetchedAt}`,
        url: result.url,
        method: result.method,
        status: result.status,
        fetched_at: result.fetchedAt,
        body: result.body,
      });
      if (result.status !== 200) throw new Error(`HTTP ${result.status} (archived at ${rawRef})`);
      const rows = parseWeather(result.body);
      if (rows[0]?.date !== from || rows.at(-1)?.date !== to) throw new Error("weather: response does not cover requested dates");
      if (rows.every((r) => r.precip_mm === null && r.temp_mean_c === null)) throw new Error("weather: all values are null");
      const missing = rows.filter((r) => r.precip_mm === null || r.temp_mean_c === null).length;
      if (missing) batch.notes.push(`${key}: ${missing} days have missing weather values`);
      batch.weather.push(
        ...validateRows(
          WEATHER_DAILY,
          rows.map((row) => ({
            ...row,
            basin: basin.basin,
            latitude: basin.latitude,
            longitude: basin.longitude,
            kind,
            issued_at: kind === "forecast" ? result.fetchedAt : "",
            source: `open_meteo:${kind}`,
            fetched_at: result.fetchedAt,
            raw_ref: rawRef,
          })),
        ),
      );
    } catch (error) {
      batch.errors.push(`${key}: ${String(error)}`);
    }
  }

  async oni(batch: IngestBatch): Promise<void> {
    try {
      const result = await this.http.fetch({ key: "oni", url: "https://psl.noaa.gov/data/correlation/oni.data" });
      const rawRef = this.archive.add("noaa", "oni", null, {
        key: `oni:${result.fetchedAt}`,
        url: result.url,
        method: result.method,
        status: result.status,
        fetched_at: result.fetchedAt,
        body: result.body,
      });
      if (result.status !== 200) throw new Error(`HTTP ${result.status} (archived at ${rawRef})`);
      batch.enso.push(
        ...validateRows(
          ENSO_MONTHLY,
          parseOni(result.body).map((row) => ({
            ...row,
            source: "noaa_psl:oni",
            fetched_at: result.fetchedAt,
            raw_ref: rawRef,
          })),
        ),
      );
    } catch (error) {
      batch.errors.push(`oni: ${String(error)}`);
    }
  }
}

/** Historical runs resume by complete basin-day; daily runs refresh the recent ERA5 window. */
export async function ingestCovariates(
  source: Covariates,
  store: CuratedStore,
  batch: IngestBatch,
  options: Options,
  today = todayEc(),
): Promise<void> {
  if (options.date || (options.to && !options.from)) throw new Error("covariates: use --from and optional --to for a historical run");
  // ERA5 is published with a five-day delay; leave one more day for upstream publication.
  const available = addDays(today, -6);
  const from = z
    .string()
    .date()
    .parse(options.from ?? addDays(available, -29));
  const requestedTo = z
    .string()
    .date()
    .parse(options.to ?? available);
  const to = requestedTo > available ? available : requestedTo;
  if (from < "1940-01-01" || from > to) throw new Error(`covariates: ERA5 range must be within 1940-01-01..${available}`);
  if (requestedTo > available) batch.notes.push(`ERA5 end capped at ${available} for publication delay`);
  const basins = loadBasins();
  let remaining = options.maxRequests;
  const spend = async (work: () => Promise<void>) => {
    if (remaining <= 0) return false;
    remaining--;
    await work();
    return true;
  };
  for (const basin of basins) {
    if (basin.coordinate_status === "provisional")
      batch.notes.push(`${basin.basin}: provisional sampling point, not a verified basin centroid`);
    if (!options.from && !(await spend(() => source.weather(batch, basin, "forecast", today, addDays(today, 15))))) {
      batch.notes.push("covariates: request budget exhausted; rerun to continue");
      return;
    }
    for (let year = yearOf(from); year <= yearOf(to); year++) {
      const start = from > `${year}-01-01` ? from : `${year}-01-01`;
      const end = to < `${year}-12-31` ? to : `${year}-12-31`;
      if (options.from) {
        const complete = new Set(
          store
            .read(join(DATA_CURATED, "weather_daily", `${year}.csv`))
            .filter(
              (r) =>
                r["basin"] === basin.basin &&
                r["kind"] === "era5" &&
                Number(r["latitude"]) === basin.latitude &&
                Number(r["longitude"]) === basin.longitude &&
                Number.isFinite(Number(r["precip_mm"])) &&
                Number.isFinite(Number(r["temp_mean_c"])) &&
                r["precip_mm"] !== "" &&
                r["temp_mean_c"] !== "",
            )
            .map((r) => r["date"]),
        );
        if (eachDay(start, end).every((d) => complete.has(d))) continue;
      }
      if (!(await spend(() => source.weather(batch, basin, "era5", start, end)))) {
        batch.notes.push("covariates: request budget exhausted; rerun to continue");
        return;
      }
    }
  }
  if (!(await spend(() => source.oni(batch)))) batch.notes.push("covariates: request budget exhausted before ONI; rerun to continue");
}
