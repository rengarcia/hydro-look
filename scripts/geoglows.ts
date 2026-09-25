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
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { asyncBufferFromUrl, cachedAsyncBuffer, parquetMetadataAsync, parquetRead } from "hyparquet";
import { fetch } from "undici";
import { USER_AGENT } from "../src/lib/http/client.ts";
import { arrayMeta, positionsOf, readChunk, readConsolidated } from "../src/lib/geo/zarr.ts";
import { httpZarrSource } from "../src/lib/geo/zarr-http.ts";
import { readSimulated, SIMULATED } from "../src/lib/geo/geoglows-stores.ts";
import {
  annualMaxima,
  compareFlows,
  FLOW_PERCENTILES,
  gumbelReturnPeriods,
  INAMHI_FIRST_YEAR,
  inamhiReturnPeriods,
  portalReturnPeriods,
  roundTable,
  type FlowAgreement,
  matchRiver,
  RETURN_PERIODS,
  type AnnualMaximum,
  type PourPoint,
  type ReturnPeriodValue,
  type RiverMatch,
  type RiverSegment,
} from "../src/lib/geo/geoglows.ts";
import { loadSeries } from "../src/lib/features/series.ts";
import { parsePlotTraces } from "../src/lib/parse/inamhi-hydropower.ts";
import { baseOf, bundleRefs, endpointsIn, isHtml, keywordHits, resolveRef, type EndpointHit } from "../src/lib/probe/portal.ts";
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

async function readStore(riverIds: readonly number[]): Promise<StoreRead> {
  const source = httpZarrSource(STORE);
  const md = await readConsolidated(source);
  const attrs = md[".zattrs"] ?? {};
  const periodsMeta = arrayMeta(md, "return_period");
  const periods = Array.from(await readChunk(source, "return_period", periodsMeta, [0]));

  // The index: river ids are in the store's own order, not sorted, so chunks are read until all are found.
  const position = await positionsOf(source, "river_id", arrayMeta(md, "river_id"), riverIds);
  const missing = riverIds.filter((id) => !position.has(id));
  if (missing.length > 0) throw new Error(`zarr: river ids not in the store: ${missing.join(", ")}`);

  const values = new Map<number, Record<string, number[]>>(riverIds.map((id) => [id, {}]));
  for (const name of ["gumbel_daily", "gumbel_hourly", "gumbel", "max_simulated"]) {
    const a = arrayMeta(md, name);
    const cache = new Map<string, ArrayLike<number>>();
    for (const id of riverIds) {
      const at = position.get(id)!;
      const riverChunk = a.chunks.at(-1)!;
      const index = a.shape.length === 2 ? [0, Math.floor(at / riverChunk)] : [Math.floor(at / riverChunk)];
      // [return_period, river_id] in one chunk spanning every period, or [river_id].
      if (a.shape.length === 2 && a.chunks[0] !== a.shape[0]) throw new Error(`zarr: ${name} splits return periods across chunks`);
      const key = index.join(".");
      const data = cache.get(key) ?? (await readChunk(source, name, a, index));
      cache.set(key, data);
      const offset = at % riverChunk;
      values.get(id)![name] = a.shape.length === 2 ? periods.map((_, p) => data[p * riverChunk + offset]!) : [data[offset]!];
    }
  }
  return {
    title: String(attrs["title"] ?? ""),
    revision: typeof attrs["revision"] === "number" ? attrs["revision"] : null,
    revisionDate: String(attrs["revision_date"] ?? ""),
    license: String(attrs["license"] ?? ""),
    periods,
    values,
    etags: Object.fromEntries(source.etags),
  };
}

// ---------------------------------------------------------------------------------------------
// The portal
// ---------------------------------------------------------------------------------------------

interface PortalFile {
  url: string;
  status: string;
  bytes: number;
}

interface PortalTry {
  url: string;
  status: string;
  contentType: string;
  bytes: number;
  archived: string | null;
  /** The start of the answer, for reading in the report. */
  head: string;
  /** For a Hydroviewer `get-plots` answer: the river and the return periods the portal draws for it. */
  portalReturnPeriods?: { riverId: number; values: ReturnPeriodValue[] };
}

interface PortalProbe {
  url: string;
  status: string;
  archived: string | null;
  /** The page and every bundle reached from it. */
  files: PortalFile[];
  /** URL-like literals in them that look like endpoints, with the code around each. */
  endpoints: EndpointHit[];
  /** URLs asked for by `--try`, to follow up what an earlier run found. */
  tries: PortalTry[];
}

/** Words whose surroundings say how the app asks for return periods and hydropower plants. */
const PORTAL_KEYWORDS = [
  "return_period",
  "returnPeriod",
  "return-period",
  "retorno",
  "rperiod",
  "hydropowers/",
  "selectedHydropower=",
  "comid=",
];

/** At most this many bundles are walked, so a page that names hundreds of chunks cannot run away. */
const MAX_BUNDLES = 80;
/** Bundles are archived with the page when all of them together are smaller than this, compressed or not. */
const MAX_ARCHIVE_BYTES = 12_000_000;

async function getText(url: string): Promise<{ status: number; text: string; contentType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { "user-agent": USER_AGENT } });
  return { status: response.status, text: await response.text(), contentType: response.headers.get("content-type") ?? "" };
}

/** A Hydroviewer chart's return periods, when the answer is one. */
function portalCheck(url: string, text: string): Pick<PortalTry, "portalReturnPeriods"> {
  const comid = /\/hydroviewer\/get-plots\?comid=(\d+)/.exec(url)?.[1];
  if (!comid) return {};
  try {
    const values = portalReturnPeriods([...parsePlotTraces(text, "hs").keys()]);
    return values.length ? { portalReturnPeriods: { riverId: Number(comid), values } } : {};
  } catch {
    return {};
  }
}

async function probePortal(tries: readonly string[]): Promise<PortalProbe> {
  const date = nowUtc().slice(0, 10);
  const dir = `inamhi/hydroviewer-ecuador_${date}`;
  const empty = { archived: null, files: [], endpoints: [], tries: [] };
  let page: Awaited<ReturnType<typeof getText>>;
  try {
    page = await getText(PORTAL);
  } catch (error) {
    return { url: PORTAL, status: `no answer: ${String(error)}`, ...empty };
  }
  if (page.status !== 200) return { url: PORTAL, status: `HTTP ${page.status}`, ...empty };

  const files: PortalFile[] = [{ url: PORTAL, status: "HTTP 200", bytes: page.text.length }];
  const bodies = new Map<string, string>([[PORTAL, page.text]]);
  const base = baseOf(page.text, PORTAL);
  const queue = bundleRefs(page.text).map((ref) => resolveRef(ref, base));
  const queued = new Set(queue);
  while (queue.length > 0 && files.length <= MAX_BUNDLES) {
    const url = queue.shift()!;
    try {
      const got = await getText(url);
      const shell = isHtml(got.text);
      files.push({ url, status: `HTTP ${got.status}${shell ? ", the app's HTML shell, not a bundle" : ""}`, bytes: got.text.length });
      if (got.status !== 200 || shell) continue;
      bodies.set(url, got.text);
      for (const ref of bundleRefs(got.text)) {
        const next = resolveRef(ref, url);
        if (!queued.has(next) && new URL(next).host === new URL(PORTAL).host) {
          queued.add(next);
          queue.push(next);
        }
      }
    } catch (error) {
      files.push({ url, status: `no answer: ${String(error)}`, bytes: 0 });
    }
  }
  const endpoints = [...bodies].flatMap(([url, text]) => [
    ...endpointsIn(text, url.replace(/^.*\//, "")),
    ...keywordHits(text, url.replace(/^.*\//, ""), PORTAL_KEYWORDS),
  ]);

  mkdirSync(`${DATA_RAW}/${dir}`, { recursive: true });
  const total = [...bodies.values()].reduce((a, t) => a + t.length, 0);
  for (const [url, text] of bodies) {
    if (url !== PORTAL && total > MAX_ARCHIVE_BYTES) continue;
    const name = url === PORTAL ? "index.html" : url.replace(/^.*\//, "");
    writeFileSync(`${DATA_RAW}/${dir}/${name}.gz`, gzipSync(text));
  }

  const tried: PortalTry[] = [];
  for (const url of tries) {
    try {
      const got = await getText(url);
      // Named after the URL, so a second run on the same day adds to the archive instead of overwriting it.
      const archived = `${dir}/try-${createHash("sha256").update(url).digest("hex").slice(0, 12)}.gz`;
      writeFileSync(`${DATA_RAW}/${archived}`, gzipSync(`${url}\n\n${got.text}`));
      tried.push({
        url,
        status: `HTTP ${got.status}`,
        contentType: got.contentType,
        bytes: got.text.length,
        archived,
        head: got.text.slice(0, 1500),
        ...portalCheck(url, got.text),
      });
    } catch (error) {
      tried.push({ url, status: `no answer: ${String(error)}`, contentType: "", bytes: 0, archived: null, head: "" });
    }
  }
  return {
    url: PORTAL,
    status: `HTTP 200, ${files.length - 1} bundles reached, ${total.toLocaleString("en")} characters in all`,
    archived: total > MAX_ARCHIVE_BYTES ? `${dir}/index.html.gz (bundles too large to archive)` : `${dir}/`,
    files,
    endpoints,
    tries: tried,
  };
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

interface SiteResult {
  site: Site;
  match: RiverMatch;
  geoglows: {
    /** What INAMHI's Hydroviewer draws: the 1980 → simulation's annual maxima, fitted the same way. */
    inamhi: ReturnPeriodValue[];
    daily: ReturnPeriodValue[];
    hourly: ReturnPeriodValue[];
    maxSimulated: number;
  } | null;
  observed: { maxima: AnnualMaximum[]; fit: ReturnPeriodValue[] | null } | null;
  /** The model's simulated daily flow against CELEC's measured inflow, on the days both have. */
  agreement: FlowAgreement | null;
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
    `Simulated flow: \`${SIMULATED.replace(BUCKET, "s3://geoglows-v2")}\`. Store: \`${STORE.replace(BUCKET, "s3://geoglows-v2")}\` — "${store.title}", revision ${store.revision ?? "?"} of ${store.revisionDate}, licence ${store.license}.`,
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
    "## INAMHI's return periods against the measured record",
    "",
    "Return-period flows, m³/s. **INAMHI** is what the Hydroviewer draws: a method-of-moments Gumbel on the annual maxima of",
    `GEOGLOWS' daily simulation from ${INAMHI_FIRST_YEAR}, every calendar year counted, the current one included. It is not the store's`,
    "fit: **GEOGLOWS daily** and **hourly** are the store's own, on the simulation from 1940. **Portal** is the Hydroviewer's",
    "chart for the river, where this run asked for it. **Measured** is the same Gumbel on the annual maxima of CELEC's daily",
    `inflow, over calendar years with at least 330 readings; it needs ${MIN_OBSERVED_YEARS} such years.`,
    "",
    `| site | source | ${store.periods.map((p) => `${p} y`).join(" | ")} | years |`,
    `|---|---|${store.periods.map(() => "---").join("|")}|---|`,
  );
  for (const r of results) {
    if (r.geoglows)
      push(
        `| ${r.site.site} | **INAMHI** (GEOGLOWS, ${INAMHI_FIRST_YEAR} →) | ${r.geoglows.inamhi.map((v) => fmt(v.m3s, 1)).join(" | ")} | ${INAMHI_FIRST_YEAR} → |`,
      );
    const portalValues = portal.tries.find((t) => t.portalReturnPeriods?.riverId === r.match.chosen?.segment.riverId)?.portalReturnPeriods;
    if (portalValues) push(`| ${r.site.site} | portal, as drawn | ${portalValues.values.map((v) => fmt(v.m3s, 1)).join(" | ")} | |`);
    if (r.geoglows) push(`| ${r.site.site} | GEOGLOWS daily | ${r.geoglows.daily.map((v) => fmt(v.m3s)).join(" | ")} | 1940 → |`);
    if (r.geoglows)
      push(`| ${r.site.site} | GEOGLOWS hourly (Hydroviewer) | ${r.geoglows.hourly.map((v) => fmt(v.m3s)).join(" | ")} | 1940 → |`);
    const fit = r.observed?.fit;
    push(
      `| ${r.site.site} | measured (CELEC) | ${fit ? fit.map((v) => fmt(v.m3s)).join(" | ") : store.periods.map(() => "—").join(" | ")} | ${r.observed?.maxima.length ?? 0} |`,
    );
    if (r.geoglows && fit) {
      push(`| ${r.site.site} | INAMHI ÷ measured | ${r.geoglows.inamhi.map((v, i) => `${fmt(v.m3s / fit[i]!.m3s, 2)}×`).join(" | ")} | |`);
    }
  }
  push(
    "",
    "## The model's daily flow against the measured inflow",
    "",
    "GEOGLOWS' simulated daily mean flow (`retrospective/daily.zarr`) at the matched river, on every day CELEC also published an",
    "inflow. **Ratio** is mean simulated ÷ mean measured; **r** the correlation of the daily values, and of monthly means; **KGE** the Kling–Gupta",
    "efficiency (1 is perfect; below −0.41 the measured mean would do better). The **p** columns compare each series' own",
    "percentile, simulated ÷ measured: independent of timing, so a model that is the measured distribution scaled reads a flat",
    "row even when it gets the days wrong, and a reading that saturates at high flow shows as a row that climbs at the top.",
    "",
    `| site | days | from | ratio | r | r, monthly | KGE | ${FLOW_PERCENTILES.map((p) => `p${p}`).join(" | ")} | 2 y, model on the record's years | 2 y, measured |`,
    `|---|---|---|---|---|---|---|${FLOW_PERCENTILES.map(() => "---").join("|")}|---|---|`,
  );
  for (const r of results) {
    const a = r.agreement;
    if (!a) {
      push(`| ${r.site.site} | — | | | | | |${FLOW_PERCENTILES.map(() => " |").join("")} | |`);
      continue;
    }
    push(
      `| ${r.site.site} | ${fmt(a.days)} | ${a.first} | ${fmt(a.ratio, 2)}× | ${fmt(a.r, 2)} | ${fmt(a.rMonthly, 2)} | ${fmt(a.kge, 2)} | ` +
        `${a.quantiles.map((q) => `${fmt(q.ratio, 2)}×`).join(" | ")} | ${fmt(a.simulatedSameYears?.[0]?.m3s)} | ${fmt(r.observed?.fit?.[0]?.m3s)} |`,
    );
  }
  push("", "Annual maxima on the shared days, measured / simulated (m³/s):", "", "| site | year: measured / simulated |", "|---|---|");
  for (const r of results) {
    if (r.agreement)
      push(`| ${r.site.site} | ${r.agreement.annual.map((y) => `${y.year}: ${fmt(y.measured)} / ${fmt(y.simulated)}`).join("; ")} |`);
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
    `\`${portal.url}\`: ${portal.status}.${portal.archived ? ` Archived under \`data/raw/${portal.archived}\`.` : ""}`,
    "",
    ...(portal.files.length > 1
      ? ["Files read:", "", ...portal.files.map((f) => `- \`${f.url}\`: ${f.status}, ${f.bytes.toLocaleString("en")} characters`), ""]
      : []),
    ...(portal.endpoints.length > 0
      ? [
          "URL-like literals in the page and its bundles (hosts, API-looking paths, hydrology words), with the code around each:",
          "",
          ...portal.endpoints.map((e) => `- \`${e.literal}\` (${e.file}): \`${e.context.replaceAll("`", "'")}\``),
          "",
        ]
      : ["No endpoint was read from it on this run.", ""]),
    ...(portal.tries.length > 0
      ? [
          "Asked with `--try`:",
          "",
          ...portal.tries.map(
            (t) =>
              `- \`${t.url}\`: ${t.status}, ${t.contentType || "no content type"}, ${t.bytes.toLocaleString("en")} characters` +
              `${t.archived ? ` (\`data/raw/${t.archived}\`)` : ""}: \`${t.head.slice(0, 300).replace(/\s+/g, " ").replaceAll("`", "'")}\``,
          ),
          "",
        ]
      : []),
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

  const { values: args } = parseArgs({ args: process.argv.slice(2), options: { try: { type: "string", multiple: true, default: [] } } });
  const tries = (args.try ?? []).flatMap((t) => t.split(/[\s,]+/)).filter((t) => /^https:\/\/(?:inamhi|services)\.geoglows\.org\//.test(t));
  const portal = probePortal(tries);
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

  const simulated = await readSimulated(riverIds);
  const series = loadSeries();
  const results: SiteResult[] = matches.map(({ site, match }) => {
    const v = match.chosen ? store.values.get(match.chosen.segment.riverId)! : null;
    const table = (xs: number[] | undefined) => store.periods.map((years, i) => ({ years, m3s: round(xs?.[i] ?? NaN, 1) }));
    const inflow = series.get(site.site, "caudal_m3s");
    const maxima = inflow.size > 0 ? annualMaxima(inflow) : [];
    const sim = match.chosen ? simulated.series.get(match.chosen.segment.riverId) : undefined;
    return {
      site,
      match,
      agreement: sim && inflow.size > 0 ? compareFlows(inflow, sim, MIN_OBSERVED_YEARS) : null,
      geoglows: v
        ? {
            inamhi: roundTable(inamhiReturnPeriods(sim!)),
            daily: table(v["gumbel_daily"]),
            hourly: table(v["gumbel_hourly"]),
            maxSimulated: round(v["max_simulated"]![0]!, 1),
          }
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
    ...RETURN_PERIODS.map((p) => `q${p}_inamhi_m3s`),
    ...RETURN_PERIODS.map((p) => `q${p}_m3s`),
    ...RETURN_PERIODS.map((p) => `q${p}_hourly_m3s`),
    "max_simulated_m3s",
    "sim_days",
    "sim_ratio",
    "sim_r",
    "sim_r_monthly",
    "sim_kge",
    "sim_p50_ratio",
    "sim_p99_ratio",
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
        ...Object.fromEntries(r.geoglows.inamhi.map((v) => [`q${v.years}_inamhi_m3s`, v.m3s])),
        ...Object.fromEntries(r.geoglows.daily.map((v) => [`q${v.years}_m3s`, v.m3s])),
        ...Object.fromEntries(r.geoglows.hourly.map((v) => [`q${v.years}_hourly_m3s`, v.m3s])),
        max_simulated_m3s: r.geoglows.maxSimulated,
        sim_days: r.agreement?.days ?? "",
        sim_ratio: r.agreement ? round(r.agreement.ratio, 3) : "",
        sim_r: r.agreement ? round(r.agreement.r, 3) : "",
        sim_r_monthly: r.agreement?.rMonthly != null ? round(r.agreement.rMonthly, 3) : "",
        sim_kge: r.agreement ? round(r.agreement.kge, 3) : "",
        sim_p50_ratio: r.agreement ? round(r.agreement.quantiles.find((q) => q.percentile === 50)!.ratio, 3) : "",
        sim_p99_ratio: r.agreement ? round(r.agreement.quantiles.find((q) => q.percentile === 99)!.ratio, 3) : "",
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
          agreement: r.agreement,
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
