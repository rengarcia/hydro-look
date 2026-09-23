import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ENSO_MONTHLY, WEATHER_DAILY } from "../src/lib/contracts/tables.ts";
import type { FetchResult, RequestSpec } from "../src/lib/http/client.ts";
import { parseOptions } from "../src/lib/options.ts";
import { parseOni, parseWeather } from "../src/lib/parse/covariates.ts";
import { emptyBatch } from "../src/lib/sources/batch.ts";
import { Covariates, ingestCovariates, loadBasins } from "../src/lib/sources/covariates.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { fixture } from "./helpers.ts";

const archiveBody = fixture("open_meteo", "archive.json");
const oniBody = fixture("noaa", "oni_psl.txt");
const basin = loadBasins()[0]!;
const fetchedAt = "2026-09-22T17:00:00Z";
function response(body: string, timestamp = fetchedAt): FetchResult {
  return { body, fetchedAt: timestamp, key: "test", method: "GET", status: 200, url: "https://example.test", durationMs: 0, attempts: 1 };
}

describe("covariates", () => {
  it("parses the recorded weather and ONI formats without treating missing values as zero", () => {
    const history = parseWeather(archiveBody);
    expect(history).toHaveLength(31);
    expect(history[0]).toEqual({ date: "2024-01-01", precip_mm: 7.1, temp_mean_c: 12.6 });
    expect(history[24]?.precip_mm).toBe(0);
    const forecast = parseWeather(fixture("open_meteo", "forecast.json"), false);
    expect(forecast).toHaveLength(16);
    expect(forecast[0]?.temp_mean_c).toBeNull();
    const oni = parseOni(oniBody);
    expect(oni[0]).toEqual({ month: "1950-01", oni: -1.53 });
    expect(oni.at(-1)).toEqual({ month: "2026-07", oni: 1.8 });
    expect(oni.some((r) => r.oni === -99.9)).toBe(false);
    const partial = JSON.parse(archiveBody);
    partial.daily.precipitation_sum[0] = null;
    expect(parseWeather(JSON.stringify(partial))[0]?.precip_mm).toBeNull();
  });

  it("rejects changed units, timezone, dates, arrays and malformed ONI years", () => {
    expect(() => parseWeather(archiveBody.replace('"mm"', '"inch"'))).toThrow();
    expect(() => parseWeather(archiveBody.replace("America/Guayaquil", "GMT"))).toThrow();
    expect(() => parseWeather(archiveBody.replace("2024-01-02", "2024-01-01"))).toThrow(/consecutive/);
    expect(() => parseWeather(archiveBody.replace("2024-01-31", "2024-02-30"))).toThrow();
    const broken = JSON.parse(archiveBody);
    broken.daily.precipitation_sum.pop();
    expect(() => parseWeather(JSON.stringify(broken))).toThrow(/length/);
    expect(() => parseWeather(fixture("open_meteo", "forecast.json"))).toThrow(/temperature/);
    expect(() => parseOni(oniBody.replace(" 1951 ", " 1950 "))).toThrow(/malformed year/);
    expect(() => parseOni(oniBody.replace("-1.53", "NaN"))).toThrow(/invalid value/);
    expect(() => parseOni("<html>not data</html>")).toThrow(/header/);
  });

  it("archives failures and validates an entire response before adding any rows", async () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-weather-failure-"));
    const archive = new RawArchive(root);
    const batch = emptyBatch();
    const fetch = vi.fn(async () => response(archiveBody.replace('"mm"', '"inch"')));
    const source = new Covariates({ fetch }, archive);
    await source.weather(batch, basin, "era5", "2024-01-01", "2024-01-31");
    expect(batch.weather).toHaveLength(0);
    expect(batch.errors).toHaveLength(1);
    expect(archive.flush()).toHaveLength(1);
    fetch.mockResolvedValue({ ...response(oniBody), status: 503 });
    await source.oni(batch);
    expect(batch.enso).toHaveLength(0);
    expect(batch.errors.at(-1)).toMatch(/503/);
  });

  it("keeps forecast vintages and raw responses separate, with idempotent CSV writes", async () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-weather-"));
    const archive = new RawArchive(join(root, "raw"));
    const store = new CuratedStore(join(root, "curated"));
    const batch = emptyBatch();
    // The old forecast capture requested only precipitation; add a synthetic temperature
    // array to exercise the current two-variable request without altering that fixture.
    const forecast = JSON.parse(fixture("open_meteo", "forecast.json"));
    forecast.daily.temperature_2m_mean = Array(16).fill(12);
    forecast.daily_units.temperature_2m_mean = "°C";
    const fetch = vi.fn(async (_spec: RequestSpec) => response(JSON.stringify(forecast)));
    const source = new Covariates({ fetch }, archive);
    await source.weather(batch, basin, "forecast", "2026-09-21", "2026-10-06");
    fetch.mockResolvedValue(response(JSON.stringify(forecast), "2026-09-23T17:00:00Z"));
    await source.weather(batch, basin, "forecast", "2026-09-21", "2026-10-06");
    fetch.mockResolvedValue(response(archiveBody));
    await source.weather(batch, basin, "era5", "2024-01-01", "2024-01-31");
    expect(fetch.mock.calls[2]?.[0].params).toMatchObject({ models: "era5", timezone: "America/Guayaquil" });
    fetch.mockResolvedValue(response(oniBody));
    await source.oni(batch);
    expect(batch.errors).toEqual([]);
    expect(store.upsert(WEATHER_DAILY, batch.weather).added).toBe(63);
    expect(store.upsert(WEATHER_DAILY, batch.weather).unchanged).toBe(63);
    store.upsert(ENSO_MONTHLY, batch.enso);
    archive.flush();
    const saved = parseCsv(readFileSync(join(root, "curated/weather_daily/2026.csv"), "utf8"));
    expect(new Set(saved.map((r) => r["issued_at"])).size).toBe(2);
    for (const row of batch.weather) {
      const [path, key] = row.raw_ref.split("#");
      expect(archive.get(join(root, "raw", path!), key!)?.fetched_at).toBe(row.fetched_at);
    }
    const savedOni = parseCsv(readFileSync(join(root, "curated/enso_monthly/2026.csv"), "utf8"));
    expect(savedOni).toHaveLength(7);
  });

  it("resumes complete history, retries null days and honours a one-request budget", async () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-weather-resume-"));
    const store = new CuratedStore(root);
    // A complete day for every basin in the reference table, so the first run has nothing to fetch.
    const read = vi.spyOn(store, "read").mockReturnValue(loadBasins().map((b) => ({ date: "2024-01-01", basin: b.basin,
      latitude: String(b.latitude), longitude: String(b.longitude), kind: "era5", precip_mm: "0", temp_mean_c: "12" })));
    const source = new Covariates({ fetch: vi.fn() }, new RawArchive(root));
    const weather = vi.spyOn(source, "weather").mockResolvedValue();
    const oni = vi.spyOn(source, "oni").mockResolvedValue();
    const options = parseOptions(["covariates", "--from", "2024-01-01", "--to", "2024-01-01", "--max-requests", "1"]);
    await ingestCovariates(source, store, emptyBatch(), options, "2026-09-22");
    expect(weather).not.toHaveBeenCalled();
    expect(oni).toHaveBeenCalledOnce();
    read.mockReturnValue([]);
    oni.mockClear();
    const batch = emptyBatch();
    await ingestCovariates(source, store, batch, options, "2026-09-22");
    expect(weather).toHaveBeenCalledWith(batch, basin, "era5", "2024-01-01", "2024-01-01");
    expect(oni).not.toHaveBeenCalled();
    expect(batch.notes).toContainEqual(expect.stringMatching(/budget exhausted/));
    read.mockReturnValue([{ date: "2024-01-01", basin: basin.basin,
      latitude: String(basin.latitude), longitude: String(basin.longitude), kind: "era5", precip_mm: "", temp_mean_c: "12" }]);
    weather.mockClear();
    await ingestCovariates(source, store, emptyBatch(), options, "2026-09-22");
    expect(weather).toHaveBeenCalledOnce();
  });

  it("refreshes only available ERA5 dates and requests the full forecast horizon", async () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-weather-daily-"));
    const source = new Covariates({ fetch: vi.fn() }, new RawArchive(root));
    const weather = vi.spyOn(source, "weather").mockResolvedValue();
    vi.spyOn(source, "oni").mockResolvedValue();
    const store = new CuratedStore(root);
    const batch = emptyBatch();
    await ingestCovariates(source, store, batch, parseOptions(["covariates"]), "2026-09-22");
    expect(weather).toHaveBeenNthCalledWith(1, batch, basin, "forecast", "2026-09-22", "2026-10-07");
    expect(weather).toHaveBeenNthCalledWith(2, batch, basin, "era5", "2026-08-18", "2026-09-16");
    await expect(ingestCovariates(source, store, batch, parseOptions(["covariates", "--from", "2026-09-20"]), "2026-09-22"))
      .rejects.toThrow(/ERA5 range/);
  });
});
