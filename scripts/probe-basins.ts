#!/usr/bin/env node
/**
 * Reconnaissance for the one thing Phase 4 still owes: real catchments.
 *
 * `data/reference/basins.csv` holds a single row — a Paute sampling point picked during Phase 0,
 * marked `provisional` because that is what it is. Everything downstream inherits that: the ERA5
 * climatology now runs 1990→ over one point that nobody has checked sits in the catchment, and
 * the other six basins have no row at all, so the fleet has no weather. §3 asks for "centroid
 * lat/lon and area for the catchments feeding Mazar (upper Paute), Coca (CCS), Pastaza, Jubones,
 * Guayllabamba, Daule". A centroid is not a thing you can look up: it is a property of a
 * catchment boundary, and a catchment boundary is a property of a dam location and a flow
 * network.
 *
 * So two questions have to be answered from the live services before any of that can be built,
 * and neither can be answered from the sandbox this repository is developed in — its proxy
 * refuses every host but GitHub. This probe asks them from a runner, the way Phase 0 did:
 *
 * 1. **Is HydroSHEDS' HydroBASINS reachable, and which level is small enough to process in a
 *    job?** The dataset carries `NEXT_DOWN` topology, so the catchment above a dam is the
 *    sub-basins that drain into it, and `SUB_AREA` gives the area without any geometry work.
 *    Level 12 is the finest and the largest; a coarser level may be small enough and still
 *    resolve a 5,000 km² catchment. Only the response headers decide that.
 * 2. **Can each dam's position be had from two independent public sources that agree?** One
 *    source is a number to copy; two that agree within a kilometre is a coordinate this project
 *    can mark `verified` the way it marks everything else. Wikidata and OpenStreetMap are both
 *    citable, both queryable without a key, and are edited by different people.
 *
 * Read-only, writes nothing under data/, and every probe is guarded on its own so one dead host
 * does not cost the answers from the others.
 *
 *   npm run probe:basins -- --out "$RUNNER_TEMP/probe"
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { USER_AGENT } from "../src/lib/http/client.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

/** Plants whose catchment §3 asks for, with the basin id basins.csv would use. */
const PLANTS = [
  { site: "mazar", basin: "paute", query: "Mazar Dam hydroelectric Ecuador" },
  { site: "coca_codo_sinclair", basin: "coca", query: "Coca Codo Sinclair" },
  { site: "agoyan", basin: "pastaza", query: "Agoyán Dam" },
  { site: "minas_san_francisco", basin: "jubones", query: "Minas San Francisco hydroelectric" },
  { site: "manduriacu", basin: "guayllabamba", query: "Manduriacu" },
  { site: "delsitanisagua", basin: "zamora", query: "Delsitanisagua" },
  { site: "marcel_laniado", basin: "daule", query: "Daule-Peripa Dam" },
] as const;

const HYDROSHEDS = "https://data.hydrosheds.org/file/hydrobasins/standard";
/** South America, the four levels worth weighing: coarse and small against fine and large. */
const HYBAS_LEVELS = [6, 8, 10, 12];

interface Row {
  probe: string;
  url: string;
  status: number | null;
  bytes: number | null;
  note: string;
  error: string;
}

const rows: Row[] = [];
const record = (row: Partial<Row> & { probe: string; url: string }): void => {
  rows.push({ status: null, bytes: null, note: "", error: "", ...row });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) } });
}

/** Size and reachability without pulling the file: HEAD, or a one-byte range when HEAD is refused. */
async function probeDownload(probe: string, url: string): Promise<void> {
  try {
    let response = await get(url, { method: "HEAD" });
    let how = "HEAD";
    if (!response.ok) {
      await sleep(1000);
      response = await get(url, { headers: { range: "bytes=0-1023" } });
      how = "ranged GET";
    }
    const length = response.headers.get("content-range")?.split("/")[1] ?? response.headers.get("content-length");
    // A zip starts "PK\u0003\u0004"; anything else means a login page or an error document
    // dressed as a download, which is exactly what a size alone would hide.
    let magic = "";
    if (how === "ranged GET" && response.ok) {
      const head = new Uint8Array((await response.arrayBuffer()).slice(0, 4));
      magic = [...head].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    }
    record({
      probe,
      url,
      status: response.status,
      bytes: length ? Number(length) : null,
      note: [
        how,
        `type=${response.headers.get("content-type") ?? "?"}`,
        magic && `first bytes=${magic}${magic.startsWith("50 4b") ? " (zip)" : " (NOT a zip)"}`,
      ]
        .filter(Boolean)
        .join("; "),
    });
  } catch (error) {
    record({ probe, url, error: String(error) });
  }
}

async function probeRobots(host: string): Promise<void> {
  const url = `https://${host}/robots.txt`;
  try {
    const response = await get(url);
    const body = response.ok ? await response.text() : "";
    record({
      probe: `robots ${host}`,
      url,
      status: response.status,
      bytes: body.length,
      note: body
        .split("\n")
        .filter((l) => /^\s*(user-agent|disallow|crawl-delay)/i.test(l))
        .slice(0, 6)
        .join(" | "),
    });
  } catch (error) {
    record({ probe: `robots ${host}`, url, error: String(error) });
  }
}

/**
 * Wikidata by label search rather than by QID: the QIDs are not in this repository, and looking
 * them up by hand is the kind of step that cannot be re-run a year from now.
 */
async function probeWikidata(): Promise<Record<string, { lat: number; lon: number; id: string } | null>> {
  const found: Record<string, { lat: number; lon: number; id: string } | null> = {};
  const sparql = `SELECT ?item ?itemLabel ?coord WHERE {
  ?item wdt:P31/wdt:P279* ?class .
  VALUES ?class { wd:Q15911738 wd:Q185187 wd:Q12323 }
  ?item wdt:P17 wd:Q736 .
  ?item wdt:P625 ?coord .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  try {
    const response = await get(url, { headers: { accept: "application/sparql-results+json" } });
    const body = await response.text();
    if (!response.ok) {
      record({ probe: "wikidata sparql", url: "https://query.wikidata.org/sparql", status: response.status, note: body.slice(0, 200) });
      return found;
    }
    const json = JSON.parse(body) as {
      results: { bindings: { item: { value: string }; itemLabel: { value: string }; coord: { value: string } }[] };
    };
    const items = json.results.bindings.map((b) => ({
      label: b.itemLabel.value,
      id: b.item.value.split("/").pop() ?? "",
      // "Point(-78.6 -2.6)" is lon lat, in that order.
      point: /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value),
    }));
    for (const plant of PLANTS) {
      const needle = plant.query.split(" ")[0]!.toLowerCase();
      const hit = items.find((i) => i.label.toLowerCase().includes(needle) && i.point);
      found[plant.site] = hit?.point ? { lon: Number(hit.point[1]), lat: Number(hit.point[2]), id: hit.id } : null;
    }
    record({
      probe: "wikidata sparql",
      url: "https://query.wikidata.org/sparql",
      status: response.status,
      bytes: body.length,
      note: `${items.length} Ecuadorian dams/plants with coordinates; matched ${Object.values(found).filter(Boolean).length}/${PLANTS.length}`,
    });
  } catch (error) {
    record({ probe: "wikidata sparql", url: "https://query.wikidata.org/sparql", error: String(error) });
  }
  return found;
}

/** OpenStreetMap, as the second opinion: same plants, different mappers, different licence. */
async function probeOverpass(): Promise<Record<string, { lat: number; lon: number; id: string } | null>> {
  const found: Record<string, { lat: number; lon: number; id: string } | null> = {};
  const query = `[out:json][timeout:60];
area["ISO3166-1"="EC"][admin_level=2]->.ec;
(
  nwr["power"="plant"]["plant:source"="hydro"](area.ec);
  nwr["waterway"="dam"]["name"](area.ec);
);
out center tags;`;
  const url = "https://overpass-api.de/api/interpreter";
  try {
    const response = await get(url, { method: "POST", body: new URLSearchParams({ data: query }) });
    const body = await response.text();
    if (!response.ok) {
      record({ probe: "overpass", url, status: response.status, note: body.slice(0, 200) });
      return found;
    }
    const json = JSON.parse(body) as {
      elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
    };
    const items = json.elements.map((e) => ({
      name: (e.tags?.["name"] ?? "").toLowerCase(),
      id: `${e.type}/${e.id}`,
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
    }));
    for (const plant of PLANTS) {
      const needle = plant.query.split(" ")[0]!.toLowerCase();
      const hit = items.find((i) => i.name.includes(needle) && i.lat !== undefined);
      found[plant.site] = hit?.lat !== undefined ? { lat: hit.lat, lon: hit.lon!, id: hit.id } : null;
    }
    record({
      probe: "overpass",
      url,
      status: response.status,
      bytes: body.length,
      note: `${items.length} hydro plants/dams in Ecuador; matched ${Object.values(found).filter(Boolean).length}/${PLANTS.length}`,
    });
  } catch (error) {
    record({ probe: "overpass", url, error: String(error) });
  }
  return found;
}

/** Great-circle distance, to say whether two sources describe the same dam or two places. */
function kmApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf("--out");
  const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  const startedAt = nowUtc();

  for (const level of HYBAS_LEVELS) {
    await probeDownload(`hydrobasins lev${String(level).padStart(2, "0")}`, `${HYDROSHEDS}/hybas_sa_lev${String(level).padStart(2, "0")}_v1c.zip`);
    await sleep(1000);
  }
  for (const host of ["data.hydrosheds.org", "query.wikidata.org", "overpass-api.de"]) {
    await probeRobots(host);
    await sleep(1000);
  }
  const wikidata = await probeWikidata();
  await sleep(1000);
  const overpass = await probeOverpass();

  const coordinates = PLANTS.map((plant) => {
    const a = wikidata[plant.site];
    const b = overpass[plant.site];
    return {
      site: plant.site,
      basin: plant.basin,
      wikidata: a,
      osm: b,
      km_apart: a && b ? kmApart(a, b) : null,
    };
  });

  const finishedAt = nowUtc();
  const report = [
    "# Probe: what it would take to put real catchments in basins.csv",
    "",
    `Started ${startedAt}, finished ${finishedAt}. Read-only; nothing under data/ was touched.`,
    "",
    "## Reachability and size",
    "",
    "| probe | status | bytes | note | error |",
    "|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.probe} | ${r.status ?? "—"} | ${r.bytes === null ? "—" : r.bytes.toLocaleString("en-US")} | ${r.note} | ${r.error} |`,
    ),
    "",
    "## Dam coordinates, from two sources that do not share editors",
    "",
    "| site | basin | Wikidata | OSM | km apart |",
    "|---|---|---|---|---|",
    ...coordinates.map(
      (c) =>
        `| ${c.site} | ${c.basin} | ${c.wikidata ? `${c.wikidata.lat}, ${c.wikidata.lon} (${c.wikidata.id})` : "—"} | ` +
        `${c.osm ? `${c.osm.lat}, ${c.osm.lon} (${c.osm.id})` : "—"} | ${c.km_apart ?? "—"} |`,
    ),
    "",
    "A pair that agrees within a kilometre is a pour point worth delineating from; a pair that",
    "disagrees by more than a sub-basin is two different places and must not be averaged into one.",
    "",
  ].join("\n");

  console.log(report);
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "probe-basins.md"), `${report}\n`);
    writeFileSync(join(outDir, "probe-basins.json"), `${JSON.stringify({ startedAt, finishedAt, rows, coordinates }, null, 1)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
