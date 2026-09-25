#!/usr/bin/env node
/**
 * Streamflow return periods at each dam, from the GEOGLOWS model behind INAMHI's portal.
 *
 * INAMHI's hydrological forecasts for Ecuador are published through the INAMHI–GEOGLOWS portal
 * (`inamhi.geoglows.org`), whose Hydroviewer colours each river by the return period its forecast
 * reaches. The thresholds are GEOGLOWS River Forecast System v2's, fitted on its retrospective
 * simulation and published in the public `geoglows-v2` bucket, which is what this reads — the
 * portal itself is a Tethys app with no documented API, and the development sandbox cannot open
 * it. PLAN.md Phase 7 has the plan and the decisions.
 *
 * 1. **Pour points** — the snapped dam points and catchment areas in `data/reports/catchments.json`
 *    (`npm run catchments`), so the river is chosen against a delineation this repository checked.
 * 2. **River** — GEOGLOWS' metadata and model tables (Parquet, read by range request: only the
 *    columns needed), then `matchRiver` in `src/lib/geo/geoglows.ts`.
 * 3. **Return periods** — the Zarr store `retrospective/return-periods.zarr`: the `river_id`
 *    index, then the daily-fit and hourly-fit Gumbel values and the largest simulated flow at the
 *    matched rivers (`src/lib/geo/blosc.ts` decodes the chunks).
 * 4. **The measured side** — the same Gumbel fit on the annual maxima of CELEC's daily inflow.
 * 5. **The portal** — one request to the Hydroviewer page, archived when it answers, so the next
 *    step (reading INAMHI's own values, if it publishes any that differ) starts from evidence.
 *
 * Writes `data/reference/geoglows_return_periods.csv`, `data/reports/return-periods.{md,json}` and,
 * when the portal answers, its page under `data/raw/inamhi/`.
 *
 *   npm run geoglows
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { asyncBufferFromUrl, cachedAsyncBuffer, parquetMetadataAsync, parquetRead } from "hyparquet";
import { fetch } from "undici";
import { USER_AGENT } from "../src/lib/http/client.ts";
import { bloscDecompress } from "../src/lib/geo/blosc.ts";
import {
  annualMaxima,
  gumbelReturnPeriods,
  matchRiver,
  RETURN_PERIODS,
  type AnnualMaximum,
  type PourPoint,
  type ReturnPeriodValue,
  type RiverMatch,
  type RiverSegment,
} from "../src/lib/geo/geoglows.ts";
import { loadSeries } from "../src/lib/features/series.ts";
import { toCsv } from "../src/lib/store/csv.ts";
import { roundTo } from "../src/lib/util/numbers.ts";
import { nowUtc } from "../src/lib/util/dates.ts";
import { DATA_RAW, repoPath } from "../src/lib/util/paths.ts";

const BUCKET = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
const STORE = `${BUCKET}/retrospective/return-periods.zarr`;
const METADATA_TABLE = `${BUCKET}/tables/package-metadata-table.parquet`;
const MODEL_TABLE = `${BUCKET}/tables/v2-model-table.parquet`;
const PORTAL = "https://inamhi.geoglows.org/apps/hydroviewer-ecuador/";
/** Segments further than this from every pour point are dropped while reading the tables. */
const BOX_DEG = 0.15;
/** Fewer complete years than this and the measured Gumbel is not fitted: two points make a line, not a distribution. */
export const MIN_OBSERVED_YEARS = 5;

const round = roundTo;

async function get(url: string, deadlineMs = 120_000) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(deadlineMs), headers: { "user-agent": USER_AGENT } });
      if (response.status >= 500 && attempt < 3) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function getBytes(url: string): Promise<{ bytes: Uint8Array; etag: string }> {
  const response = await get(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), etag: response.headers.get("etag") ?? "" };
}

// ---------------------------------------------------------------------------------------------
// Pour points
// ---------------------------------------------------------------------------------------------

interface Site extends PourPoint {
  site: string;
  basin: string;
  label: string;
}

function pourPoints(): Site[] {
  const path = repoPath("data", "reports", "catchments.json");
  const report = JSON.parse(readFileSync(path, "utf8")) as {
    results: {
      basin: string;
      site: string;
      label: string;
      candidates: { role: string; snapped?: { lat: number; lon: number }; stats?: { areaKm2: number } }[];
    }[];
  };
  // The first candidate is the pour point the catchment is defined at; the others are comparisons.
  return report.results.flatMap((r) => {
    const c = r.candidates[0];
    return c?.snapped && c.stats
      ? [{ site: r.site, basin: r.basin, label: r.label, lat: c.snapped.lat, lon: c.snapped.lon, areaKm2: c.stats.areaKm2 }]
      : [];
  });
}

// ---------------------------------------------------------------------------------------------
// GEOGLOWS tables
// ---------------------------------------------------------------------------------------------

/** Whole columns of a remote Parquet file, read by range request; nothing else is downloaded. */
async function readColumns(url: string, columns: readonly string[]): Promise<{ data: Record<string, ArrayLike<unknown>>; rows: number }> {
  const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000), headers: { "user-agent": USER_AGENT } });
  const byteLength = Number(head.headers.get("content-length"));
  if (!head.ok || !(byteLength > 0)) throw new Error(`${url}: HEAD answered ${head.status} without a length`);
  const file = cachedAsyncBuffer(
    await asyncBufferFromUrl({
      url,
      byteLength,
      requestInit: { headers: { "user-agent": USER_AGENT } },
      // undici's fetch, as everywhere else in the pipeline; its Response is the same shape as the global one.
      fetch: fetch as unknown as typeof globalThis.fetch,
    }),
  );
  const metadata = await parquetMetadataAsync(file);
  const rows = Number(metadata.num_rows);
  const data: Record<string, unknown[]> = Object.fromEntries(columns.map((c) => [c, new Array<unknown>(rows)]));
  await parquetRead({
    file,
    metadata,
    columns: [...columns],
    onChunk: ({ columnName, columnData, rowStart }) => {
      const target = data[columnName];
      if (!target) return;
      for (let i = 0; i < columnData.length; i++) target[rowStart + i] = columnData[i];
    },
  });
  return { data, rows };
}

const num = (v: unknown): number => (typeof v === "bigint" ? Number(v) : Number(v));

async function segmentsNear(sites: readonly Site[]): Promise<RiverSegment[]> {
  const near = (lat: number, lon: number) => sites.some((s) => Math.abs(s.lat - lat) <= BOX_DEG && Math.abs(s.lon - lon) <= BOX_DEG);
  const meta = await readColumns(METADATA_TABLE, ["LINKNO", "VPUCode", "lat", "lon"]);
  const points = new Map<number, { lat: number; lon: number; vpu: number }>();
  for (let i = 0; i < meta.rows; i++) {
    const lat = num(meta.data["lat"]![i]);
    const lon = num(meta.data["lon"]![i]);
    if (near(lat, lon)) points.set(num(meta.data["LINKNO"]![i]), { lat, lon, vpu: num(meta.data["VPUCode"]![i]) });
  }
  console.log(`metadata table: ${meta.rows.toLocaleString("en")} rivers, ${points.size} within ${BOX_DEG}° of a pour point`);
  const model = await readColumns(MODEL_TABLE, ["LINKNO", "DSLINKNO", "USContArea", "DSContArea", "LengthGeodesicMeters"]);
  const segments: RiverSegment[] = [];
  for (let i = 0; i < model.rows; i++) {
    const riverId = num(model.data["LINKNO"]![i]);
    const point = points.get(riverId);
    if (!point) continue;
    segments.push({
      riverId,
      downstreamId: num(model.data["DSLINKNO"]![i]),
      vpu: point.vpu,
      lat: point.lat,
      lon: point.lon,
      // TDX-Hydro areas are in m².
      upstreamKm2: num(model.data["USContArea"]![i]) / 1e6,
      downstreamKm2: num(model.data["DSContArea"]![i]) / 1e6,
      lengthKm: num(model.data["LengthGeodesicMeters"]![i]) / 1000,
    });
  }
  console.log(`model table: ${segments.length} of those carry topology and areas`);
  return segments;
}

// ---------------------------------------------------------------------------------------------
// The Zarr store
// ---------------------------------------------------------------------------------------------

interface ZarrArray {
  shape: number[];
  chunks: number[];
  dtype: string;
}

interface StoreRead {
  title: string;
  revision: number | null;
  revisionDate: string;
  license: string;
  periods: number[];
  /** river_id -> variable -> values (per period, or one value for `max_simulated`). */
  values: Map<number, Record<string, number[]>>;
  etags: Record<string, string>;
}

function typed(bytes: Uint8Array, dtype: string): ArrayLike<number | bigint> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  switch (dtype) {
    case "<i4":
      return new Int32Array(buffer);
    case "<i8":
      return new BigInt64Array(buffer);
    case "<f4":
      return new Float32Array(buffer);
    case "<f8":
      return new Float64Array(buffer);
    default:
      throw new Error(`zarr: dtype ${dtype} is not handled`);
  }
}

async function readStore(riverIds: readonly number[]): Promise<StoreRead> {
  const { bytes } = await getBytes(`${STORE}/.zmetadata`);
  const consolidated = JSON.parse(new TextDecoder().decode(bytes)) as { metadata: Record<string, Record<string, unknown>> };
  const md = consolidated.metadata;
  const attrs = md[".zattrs"] ?? {};
  const array = (name: string): ZarrArray => {
    const a = md[`${name}/.zarray`];
    if (!a) throw new Error(`zarr: the store has no array ${name}`);
    if (a["order"] !== "C" || (a["filters"] ?? null) !== null)
      throw new Error(`zarr: ${name} uses an order or filters this reader does not handle`);
    return a as unknown as ZarrArray;
  };
  const etags: Record<string, string> = {};
  const chunk = async (key: string, dtype: string) => {
    const got = await getBytes(`${STORE}/${key}`);
    etags[key] = got.etag;
    return typed(bloscDecompress(got.bytes), dtype);
  };

  const periodsArray = array("return_period");
  const periods = Array.from(await chunk("return_period/0", periodsArray.dtype), (v) => Number(v));

  // The index: river ids are in the store's own order, not sorted, so every chunk is read until all are found.
  const ids = array("river_id");
  const wanted = new Set(riverIds);
  const position = new Map<number, number>();
  const idChunks = Math.ceil(ids.shape[0]! / ids.chunks[0]!);
  for (let c = 0; c < idChunks && position.size < wanted.size; c++) {
    const values = await chunk(`river_id/${c}`, ids.dtype);
    for (let i = 0; i < values.length; i++) {
      const id = Number(values[i]);
      if (wanted.has(id)) position.set(id, c * ids.chunks[0]! + i);
    }
  }
  const missing = riverIds.filter((id) => !position.has(id));
  if (missing.length > 0) throw new Error(`zarr: river ids not in the store: ${missing.join(", ")}`);

  const values = new Map<number, Record<string, number[]>>(riverIds.map((id) => [id, {}]));
  for (const name of ["gumbel_daily", "gumbel_hourly", "gumbel", "max_simulated"]) {
    const a = array(name);
    const cache = new Map<string, ArrayLike<number | bigint>>();
    for (const id of riverIds) {
      const at = position.get(id)!;
      if (a.shape.length === 2) {
        // [return_period, river_id], one chunk spanning every period.
        if (a.chunks[0] !== a.shape[0]) throw new Error(`zarr: ${name} splits return periods across chunks`);
        const key = `${name}/0.${Math.floor(at / a.chunks[1]!)}`;
        const data = cache.get(key) ?? (await chunk(key, a.dtype));
        cache.set(key, data);
        const offset = at % a.chunks[1]!;
        values.get(id)![name] = periods.map((_, p) => Number(data[p * a.chunks[1]! + offset]));
      } else {
        const key = `${name}/${Math.floor(at / a.chunks[0]!)}`;
        const data = cache.get(key) ?? (await chunk(key, a.dtype));
        cache.set(key, data);
        values.get(id)![name] = [Number(data[at % a.chunks[0]!])];
      }
    }
  }
  return {
    title: String(attrs["title"] ?? ""),
    revision: typeof attrs["revision"] === "number" ? attrs["revision"] : null,
    revisionDate: String(attrs["revision_date"] ?? ""),
    license: String(attrs["license"] ?? ""),
    periods,
    values,
    etags,
  };
}

// ---------------------------------------------------------------------------------------------
// The portal
// ---------------------------------------------------------------------------------------------

interface PortalProbe {
  url: string;
  status: string;
  archived: string | null;
  /** Paths and URLs in the page that mention return periods or an API, for the next step. */
  endpoints: string[];
}

async function probePortal(): Promise<PortalProbe> {
  try {
    const response = await fetch(PORTAL, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": USER_AGENT } });
    const text = await response.text();
    if (!response.ok) return { url: PORTAL, status: `HTTP ${response.status}`, archived: null, endpoints: [] };
    const date = nowUtc().slice(0, 10);
    const archived = `inamhi/hydroviewer-ecuador_${date}.html.gz`;
    mkdirSync(`${DATA_RAW}/inamhi`, { recursive: true });
    writeFileSync(`${DATA_RAW}/${archived}`, gzipSync(text));
    const endpoints = [
      ...new Set(
        [...text.matchAll(/["'`]((?:https?:\/\/[^"'`\s]+|\/[^"'`\s]*))["'`]/g)]
          .map((m) => m[1]!)
          .filter((u) => /return|retorno|periods|api|rest|geoserver|forecast/i.test(u)),
      ),
    ].sort();
    return { url: PORTAL, status: `HTTP ${response.status}, ${text.length.toLocaleString("en")} characters`, archived, endpoints };
  } catch (error) {
    return { url: PORTAL, status: `no answer: ${String(error)}`, archived: null, endpoints: [] };
  }
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

interface SiteResult {
  site: Site;
  match: RiverMatch;
  geoglows: { daily: ReturnPeriodValue[]; hourly: ReturnPeriodValue[]; maxSimulated: number } | null;
  observed: { maxima: AnnualMaximum[]; fit: ReturnPeriodValue[] | null } | null;
}

const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v), 1)}%`;

function report(startedAt: string, store: StoreRead, portal: PortalProbe, results: SiteResult[], rule: string): string {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);
  push(
    "# Streamflow return periods at the fleet's dams",
    "",
    `Generated by \`npm run geoglows\` (\`scripts/geoglows.ts\`), started ${startedAt}, finished ${nowUtc()}.`,
    `Store: \`${STORE.replace(BUCKET, "s3://geoglows-v2")}\` — "${store.title}", revision ${store.revision ?? "?"} of ${store.revisionDate}, licence ${store.license}.`,
    "Return periods are GEOGLOWS' Gumbel (type I) fits by the method of moments on the annual maxima of its retrospective",
    "simulation (1940 →). `gumbel_daily` is fitted on daily means, which is what CELEC's inflow is, so it is the column",
    "compared below; `gumbel` (identical to `gumbel_hourly`) is the one the Hydroviewer colours rivers by.",
    "",
    "## Which GEOGLOWS river is each dam's",
    "",
    `Rule: ${rule}. The catchment is the one \`npm run catchments\` delineated on Copernicus GLO-90 (\`data/reports/catchments.md\`);`,
    "GEOGLOWS' areas are TDX-Hydro's, so the area column is two independent delineations agreeing or not.",
    "",
    "| site | catchment km² | river_id | VPU | point to pour point, km | upstream km² | downstream km² | area vs catchment | runner-up |",
    "|---|---|---|---|---|---|---|---|---|",
  );
  for (const r of results) {
    const c = r.match.chosen;
    const next = r.match.candidates.find((x) => x !== c);
    push(
      `| ${r.site.site} | ${fmt(r.site.areaKm2, 1)} | ${c ? c.segment.riverId : "no match"} | ${c?.segment.vpu ?? "—"} | ${fmt(c?.distanceKm, 2)} | ` +
        `${fmt(c?.segment.upstreamKm2, 1)} | ${fmt(c?.segment.downstreamKm2, 1)} | ${c ? signedPct(c.areaDiffPct) : "—"} | ` +
        `${next ? `${next.segment.riverId} (${signedPct(next.areaDiffPct)}, ${fmt(next.distanceKm, 2)} km)` : "—"} |`,
    );
  }
  push(
    "",
    "## GEOGLOWS against the measured record",
    "",
    "Daily-fit return-period flows, m³/s. **Measured** is the same method-of-moments Gumbel on the annual maxima of CELEC's",
    `daily inflow, over calendar years with at least 330 readings; it needs ${MIN_OBSERVED_YEARS} such years.`,
    "",
    `| site | source | ${store.periods.map((p) => `${p} y`).join(" | ")} | years |`,
    `|---|---|${store.periods.map(() => "---").join("|")}|---|`,
  );
  for (const r of results) {
    if (r.geoglows) push(`| ${r.site.site} | GEOGLOWS daily | ${r.geoglows.daily.map((v) => fmt(v.m3s)).join(" | ")} | 1940 → |`);
    if (r.geoglows)
      push(`| ${r.site.site} | GEOGLOWS hourly (Hydroviewer) | ${r.geoglows.hourly.map((v) => fmt(v.m3s)).join(" | ")} | 1940 → |`);
    const fit = r.observed?.fit;
    push(
      `| ${r.site.site} | measured (CELEC) | ${fit ? fit.map((v) => fmt(v.m3s)).join(" | ") : store.periods.map(() => "—").join(" | ")} | ${r.observed?.maxima.length ?? 0} |`,
    );
    if (r.geoglows && fit) {
      push(`| ${r.site.site} | GEOGLOWS ÷ measured | ${r.geoglows.daily.map((v, i) => `${fmt(v.m3s / fit[i]!.m3s, 2)}×`).join(" | ")} | |`);
    }
  }
  push("", "## Annual maxima of the measured daily inflow", "", "| site | year: m³/s (date) |", "|---|---|");
  for (const r of results) {
    push(
      `| ${r.site.site} | ${(r.observed?.maxima ?? []).map((m) => `${m.year}: ${fmt(m.m3s)} (${m.date.slice(5)})`).join("; ") || "—"} |`,
    );
  }
  push(
    "",
    "## INAMHI's portal",
    "",
    `\`${portal.url}\`: ${portal.status}.${portal.archived ? ` Archived as \`data/raw/${portal.archived}\`.` : ""}`,
    portal.endpoints.length > 0
      ? `Paths in the page that mention return periods or an API: ${portal.endpoints.map((e) => `\`${e}\``).join(", ")}.`
      : "No endpoint was read from it on this run.",
    "",
    "## Store chunks read",
    "",
    ...Object.entries(store.etags).map(([k, e]) => `- \`${k}\` ${e}`),
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAt = nowUtc();
  const sites = pourPoints();
  if (sites.length === 0) throw new Error("no pour points in data/reports/catchments.json: run npm run catchments first");
  console.log(`${sites.length} pour points: ${sites.map((s) => s.site).join(", ")}`);

  const portal = probePortal();
  const segments = await segmentsNear(sites);
  const matches = sites.map((site) => ({ site, match: matchRiver(site, segments) }));
  for (const { site, match } of matches) {
    const c = match.chosen;
    console.log(
      `${site.site.padEnd(20)} ${c ? `river ${c.segment.riverId}, ${c.segment.downstreamKm2.toFixed(0)} km² vs ${site.areaKm2.toFixed(0)} (${c.areaDiffPct}%), ${c.distanceKm} km` : "no river within the rule"}`,
    );
  }
  const riverIds = matches.flatMap((m) => (m.match.chosen ? [m.match.chosen.segment.riverId] : []));
  const store = await readStore(riverIds);
  if (store.periods.join() !== RETURN_PERIODS.join()) {
    throw new Error(`the store's return periods changed: ${store.periods.join(", ")} (this code expects ${RETURN_PERIODS.join(", ")})`);
  }

  const series = loadSeries();
  const results: SiteResult[] = matches.map(({ site, match }) => {
    const v = match.chosen ? store.values.get(match.chosen.segment.riverId)! : null;
    const table = (xs: number[] | undefined) => store.periods.map((years, i) => ({ years, m3s: round(xs?.[i] ?? NaN, 1) }));
    const inflow = series.get(site.site, "caudal_m3s");
    const maxima = inflow.size > 0 ? annualMaxima(inflow) : [];
    return {
      site,
      match,
      geoglows: v
        ? { daily: table(v["gumbel_daily"]), hourly: table(v["gumbel_hourly"]), maxSimulated: round(v["max_simulated"]![0]!, 1) }
        : null,
      observed:
        inflow.size > 0
          ? {
              maxima: maxima.map((m) => ({ ...m, m3s: round(m.m3s, 2) })),
              fit:
                maxima.length >= MIN_OBSERVED_YEARS
                  ? gumbelReturnPeriods(maxima.map((m) => m.m3s)).map((r) => ({ ...r, m3s: round(r.m3s, 1) }))
                  : null,
            }
          : null,
    };
  });

  const hourlyIsDefault = [...store.values.values()].every((v) => v["gumbel"]!.every((x, i) => x === v["gumbel_hourly"]![i]));
  if (!hourlyIsDefault)
    console.warn("warning: the store's `gumbel` no longer equals `gumbel_hourly`; the report's wording assumes it does");

  const retrievedOn = startedAt.slice(0, 10);
  const columns = [
    "site",
    "basin",
    "river_id",
    "vpu",
    "downstream_river_id",
    "river_lat",
    "river_lon",
    "distance_km",
    "catchment_km2",
    "upstream_km2",
    "downstream_km2",
    "area_diff_pct",
    ...RETURN_PERIODS.map((p) => `q${p}_m3s`),
    ...RETURN_PERIODS.map((p) => `q${p}_hourly_m3s`),
    "max_simulated_m3s",
    "store_revision",
    "store_revision_date",
    "license",
    "retrieved_on",
  ];
  const rows = results.flatMap((r) => {
    const c = r.match.chosen;
    if (!c || !r.geoglows) return [];
    return [
      {
        site: r.site.site,
        basin: r.site.basin,
        river_id: c.segment.riverId,
        vpu: c.segment.vpu,
        downstream_river_id: c.segment.downstreamId,
        river_lat: round(c.segment.lat, 5),
        river_lon: round(c.segment.lon, 5),
        distance_km: c.distanceKm,
        catchment_km2: round(r.site.areaKm2, 1),
        upstream_km2: round(c.segment.upstreamKm2, 1),
        downstream_km2: round(c.segment.downstreamKm2, 1),
        area_diff_pct: c.areaDiffPct,
        ...Object.fromEntries(r.geoglows.daily.map((v) => [`q${v.years}_m3s`, v.m3s])),
        ...Object.fromEntries(r.geoglows.hourly.map((v) => [`q${v.years}_hourly_m3s`, v.m3s])),
        max_simulated_m3s: r.geoglows.maxSimulated,
        store_revision: store.revision ?? "",
        store_revision_date: store.revisionDate,
        license: store.license,
        retrieved_on: retrievedOn,
      },
    ];
  });
  writeFileSync(repoPath("data", "reference", "geoglows_return_periods.csv"), toCsv(columns, rows));

  const probe = await portal;
  const rule = matches[0]?.match.rule ?? "";
  mkdirSync(repoPath("data", "reports"), { recursive: true });
  writeFileSync(repoPath("data", "reports", "return-periods.md"), `${report(startedAt, store, probe, results, rule)}\n`);
  writeFileSync(
    repoPath("data", "reports", "return-periods.json"),
    `${JSON.stringify(
      {
        startedAt,
        finishedAt: nowUtc(),
        store: {
          url: STORE,
          title: store.title,
          revision: store.revision,
          revisionDate: store.revisionDate,
          license: store.license,
          etags: store.etags,
        },
        portal: probe,
        rule,
        results: results.map((r) => ({
          site: r.site,
          chosen: r.match.chosen,
          candidates: r.match.candidates,
          geoglows: r.geoglows,
          observed: r.observed,
        })),
      },
      null,
      1,
    )}\n`,
  );
  console.log(`wrote data/reference/geoglows_return_periods.csv (${rows.length} rivers) and data/reports/return-periods.{md,json}`);
  console.log(`portal: ${probe.status}`);
}

await main();
