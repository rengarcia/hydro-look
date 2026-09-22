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
 * network. Neither question can be asked from the sandbox this repository is developed in — its
 * proxy refuses every host but GitHub — so they are asked from a runner, the way Phase 0 did.
 *
 * **The first run (2026-09-22, run 35727122874) answered both, and neither answer was usable.**
 * `data.hydrosheds.org` returned 403 with a 5,767-byte HTML page for all four HydroBASINS levels,
 * and Overpass returned 504 to the Ecuador-wide query, leaving the six Wikidata coordinates as
 * one source rather than the two this repository requires before it writes `verified` anywhere.
 * So this run asks the same two questions differently, because both failures are the kind that a
 * different request can get past:
 *
 * 1. **Boundaries.** A 403 is not one fact, it is three possibilities, and they have different
 *    fixes: the host refuses the runner's address, or it refuses this client's User-Agent, or
 *    that path is gone. The root, a browser User-Agent and the product page separate them. Then,
 *    independently of what HydroSHEDS says, the probe asks the hosts that mirror this kind of
 *    data — Zenodo and figshare, both unauthenticated, both durable — and ArcGIS Online, where
 *    Ecuador's own agencies publish the Pfafstetter `unidades hidrográficas` that are the
 *    national answer to the same question. Every one of those is a *search*, not a guessed URL,
 *    so a run a year from now finds what exists then rather than what existed today.
 * 2. **Coordinates.** The Ecuador-wide Overpass query asked one server for every dam in the
 *    country and timed out. Seven small queries, one bounding box per dam, cost that server far
 *    less and can fail one at a time; four public instances are tried in turn so a single busy
 *    endpoint is not the end of it. Note what this trades away: a box drawn around the Wikidata
 *    point is a *confirmation* test, not an independent search. It can say "OSM agrees, 140 m
 *    away", and it can say "OSM has nothing within 13 km of where Wikidata puts this", which is
 *    a real finding. It cannot find a dam that OSM places somewhere else entirely — only the
 *    country-wide query can, and that is the one to retry if a site comes back empty.
 *
 * The matching is also fixed. The first run looked for the first word of a query string in a
 * label, which is why Marcel Laniado matched nothing: its reservoir is Daule-Peripa and its label
 * is neither string's first word. Sites now carry alias lists, compared with accents and
 * punctuation folded away, and every label the query returned is printed whether it matched or
 * not — an unmatched list is how the next run's aliases get written.
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

/**
 * Plants whose catchment §3 asks for, with the basin id basins.csv would use.
 *
 * `qid` is what the 2026-09-22 run found and PLAN.md §2.4 records; it is kept as a second way to
 * match, never as the only one, so that a regression in the label search shows up as a site that
 * matched by QID alone rather than as a silent pass.
 */
const PLANTS = [
  { site: "mazar", basin: "paute", qid: "Q1751861", aliases: ["mazar"] },
  { site: "coca_codo_sinclair", basin: "coca", qid: "Q19277520", aliases: ["coca codo", "coca codo sinclair"] },
  { site: "agoyan", basin: "pastaza", qid: "Q5760779", aliases: ["agoyan"] },
  { site: "minas_san_francisco", basin: "jubones", qid: "Q65196242", aliases: ["minas san francisco", "minas de san francisco"] },
  { site: "manduriacu", basin: "guayllabamba", qid: "Q65196233", aliases: ["manduriacu"] },
  { site: "delsitanisagua", basin: "zamora", qid: "Q65196191", aliases: ["delsitanisagua"] },
  { site: "marcel_laniado", basin: "daule", qid: "", aliases: ["marcel laniado", "daule peripa"] },
] as const;

const HYDROSHEDS = "https://data.hydrosheds.org/file/hydrobasins/standard";
/** South America, the four levels worth weighing: coarse and small against fine and large. */
const HYBAS_LEVELS = [6, 8, 10, 12];

/** What a browser sends, used once, to tell a User-Agent block apart from an address block. */
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

/** Overpass instances, tried in order; the first that answers is used for every site. */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

interface Row {
  probe: string;
  url: string;
  status: number | null;
  bytes: number | null;
  note: string;
  error: string;
}

/**
 * A concrete dataset a probe found and can name a URL for. This is what the whole exercise is
 * for: not "the host was up" but "these bytes, this many, from here, and this is what they say
 * about upstream topology".
 */
interface Boundary {
  source: string;
  title: string;
  url: string;
  bytes: number | null;
  note: string;
}

interface Point {
  lat: number;
  lon: number;
  id: string;
}

const rows: Row[] = [];
const boundaries: Boundary[] = [];
const record = (row: Partial<Row> & { probe: string; url: string }): void => {
  rows.push({ status: null, bytes: null, note: "", error: "", ...row });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) } });
}

/** Accents, case and punctuation folded away, so "Agoyán" and "Daule-Peripa" match plain text. */
const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const bytesOf = (n: number | null): string => (n === null ? "—" : n.toLocaleString("en-US"));

/** Size and reachability without pulling the file: HEAD, or a one-byte range when HEAD is refused. */
async function probeDownload(probe: string, url: string, headers: Record<string, string> = {}): Promise<number | null> {
  try {
    let response = await get(url, { method: "HEAD", headers });
    let how = "HEAD";
    if (!response.ok) {
      await sleep(1000);
      response = await get(url, { headers: { range: "bytes=0-1023", ...headers } });
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
    const bytes = length ? Number(length) : null;
    record({
      probe,
      url,
      status: response.status,
      bytes,
      note: [
        how,
        `type=${response.headers.get("content-type") ?? "?"}`,
        magic && `first bytes=${magic}${magic.startsWith("50 4b") ? " (zip)" : " (NOT a zip)"}`,
      ]
        .filter(Boolean)
        .join("; "),
    });
    return response.ok ? bytes : null;
  } catch (error) {
    record({ probe, url, error: String(error) });
    return null;
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
 * Why HydroSHEDS said 403, which decides whether the route can be reopened at all.
 *
 * The root separates "this host refuses GitHub's addresses" — the failure `datosabiertos.gob.ec`
 * already has in §2.5 — from "that path is gone". The browser User-Agent separates both from a
 * client filter. If it is the filter, the fix is not to wear a disguise in the ingest path: it is
 * to use a mirror, or to ask the maintainers, and the report says so rather than quietly
 * adopting the header.
 */
async function probeHydroshedsBlock(): Promise<void> {
  await probeDownload("hydrosheds root (repo UA)", "https://data.hydrosheds.org/");
  await sleep(1000);
  const file = `${HYDROSHEDS}/hybas_sa_lev06_v1c.zip`;
  await probeDownload("hydrobasins lev06 (browser UA)", file, {
    "user-agent": BROWSER_UA,
    accept: "*/*",
    referer: "https://www.hydrosheds.org/",
  });
  await sleep(1000);

  // What the project itself links today. If the files moved to another host, this is where it
  // shows, and it needs no guess about what the new host is called.
  const page = "https://www.hydrosheds.org/products/hydrobasins";
  try {
    const response = await get(page);
    const body = response.ok ? await response.text() : "";
    const links = [...body.matchAll(/https?:\/\/[^"'\s<>]+\.(?:zip|gdb|7z)/gi)].map((m) => m[0]);
    const hosts = [...new Set(links.map((l) => new URL(l).host))];
    record({
      probe: "hydrosheds product page",
      url: page,
      status: response.status,
      bytes: body.length,
      note: links.length ? `${links.length} archive links on ${hosts.join(", ")}; e.g. ${links[0]}` : "no archive links in the HTML (the page builds them in JS)",
    });
    for (const link of links.filter((l) => /hybas_sa_lev0?6/i.test(l)).slice(0, 1)) {
      await sleep(1000);
      const bytes = await probeDownload("hydrobasins lev06 (link from the page)", link);
      if (bytes) boundaries.push({ source: "hydrosheds", title: "HydroBASINS South America level 6", url: link, bytes, note: "NEXT_DOWN topology and SUB_AREA per sub-basin" });
    }
  } catch (error) {
    record({ probe: "hydrosheds product page", url: page, error: String(error) });
  }
}

/**
 * Zenodo and figshare: where datasets of this kind get deposited when the original host is
 * unreliable, both readable without a key, both giving file names and sizes in the search result
 * itself. HydroATLAS is the prize here — it is HydroBASINS level 12 with the topology columns
 * plus upstream area already summed, which is most of §3's arithmetic done.
 */
async function probeMirrors(): Promise<void> {
  for (const q of ["hydrobasins", "hydroatlas", "global dam watch"]) {
    const url = `https://zenodo.org/api/records?q=${encodeURIComponent(q)}&size=5`;
    try {
      const response = await get(url, { headers: { accept: "application/json" } });
      const body = await response.text();
      if (!response.ok) {
        record({ probe: `zenodo "${q}"`, url, status: response.status, note: body.slice(0, 160) });
        await sleep(1000);
        continue;
      }
      const json = JSON.parse(body) as {
        hits: { total?: number; hits: { title: string; doi?: string; links?: { self_html?: string }; files?: { key: string; size: number; links?: { self?: string } }[] }[] };
      };
      const hits = json.hits.hits ?? [];
      for (const hit of hits.slice(0, 3)) {
        const biggest = (hit.files ?? []).sort((a, b) => b.size - a.size)[0];
        if (biggest?.links?.self) {
          boundaries.push({
            source: `zenodo (${q})`,
            title: hit.title.slice(0, 90),
            url: biggest.links.self,
            bytes: biggest.size,
            note: `${(hit.files ?? []).length} files; doi ${hit.doi ?? "—"}`,
          });
        }
      }
      record({
        probe: `zenodo "${q}"`,
        url,
        status: response.status,
        bytes: body.length,
        note: `${json.hits.total ?? hits.length} records; top: ${hits.slice(0, 3).map((h) => h.title.slice(0, 50)).join(" / ") || "none"}`,
      });
    } catch (error) {
      record({ probe: `zenodo "${q}"`, url, error: String(error) });
    }
    await sleep(1000);
  }

  const search = "https://api.figshare.com/v2/articles/search";
  try {
    const response = await get(search, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ search_for: "HydroATLAS", page_size: 5 }),
    });
    const body = await response.text();
    if (!response.ok) {
      record({ probe: "figshare HydroATLAS", url: search, status: response.status, note: body.slice(0, 160) });
      return;
    }
    const articles = JSON.parse(body) as { id: number; title: string; url_public_html?: string }[];
    record({
      probe: "figshare HydroATLAS",
      url: search,
      status: response.status,
      bytes: body.length,
      note: `${articles.length} articles; top: ${articles.slice(0, 3).map((a) => `${a.id} ${a.title.slice(0, 40)}`).join(" / ") || "none"}`,
    });
    const first = articles[0];
    if (!first) return;
    await sleep(1000);
    const detail = `https://api.figshare.com/v2/articles/${first.id}`;
    const dresponse = await get(detail, { headers: { accept: "application/json" } });
    const dbody = await dresponse.text();
    if (!dresponse.ok) {
      record({ probe: `figshare article ${first.id}`, url: detail, status: dresponse.status, note: dbody.slice(0, 160) });
      return;
    }
    const article = JSON.parse(dbody) as { title: string; files?: { name: string; size: number; download_url: string }[] };
    const files = article.files ?? [];
    for (const file of files.sort((a, b) => b.size - a.size).slice(0, 2)) {
      boundaries.push({ source: "figshare", title: `${article.title.slice(0, 60)} — ${file.name}`, url: file.download_url, bytes: file.size, note: "HydroATLAS is HydroBASINS lev12 with topology and upstream area columns" });
    }
    record({
      probe: `figshare article ${first.id}`,
      url: detail,
      status: dresponse.status,
      bytes: dbody.length,
      note: `${files.length} files; largest ${files[0]?.name ?? "—"} at ${bytesOf(files[0]?.size ?? null)} bytes`,
    });
  } catch (error) {
    record({ probe: "figshare HydroATLAS", url: search, error: String(error) });
  }
}

/**
 * Ecuador's own answer to the same question. The country delineates `unidades hidrográficas` by
 * the Pfafstetter method, and its agencies publish them as ArcGIS feature services, which are
 * queryable per-feature over HTTP — no multi-gigabyte download, and the boundaries are the ones
 * the national hydrology actually uses. The search is public and needs no token; whether any
 * particular service answers anonymously is the second question, so each hit's own metadata is
 * asked for.
 */
async function probeArcgis(): Promise<void> {
  const queries = ["unidades hidrograficas Ecuador", "cuencas hidrograficas Ecuador", "Ecuador Pfafstetter"];
  const services: { title: string; url: string }[] = [];
  for (const q of queries) {
    const url = `https://www.arcgis.com/sharing/rest/search?f=json&num=8&q=${encodeURIComponent(q)}`;
    try {
      const response = await get(url, { headers: { accept: "application/json" } });
      const body = await response.text();
      if (!response.ok) {
        record({ probe: `arcgis "${q}"`, url, status: response.status, note: body.slice(0, 160) });
        await sleep(1000);
        continue;
      }
      const json = JSON.parse(body) as { total?: number; results?: { title: string; type: string; owner: string; url?: string }[] };
      const results = json.results ?? [];
      for (const r of results) if (r.url && services.length < 6) services.push({ title: `${r.title} (${r.owner})`, url: r.url });
      record({
        probe: `arcgis "${q}"`,
        url,
        status: response.status,
        bytes: body.length,
        note: `${json.total ?? results.length} items; ${results.slice(0, 4).map((r) => `${r.title.slice(0, 40)} [${r.type}]`).join(" / ") || "none"}`,
      });
    } catch (error) {
      record({ probe: `arcgis "${q}"`, url, error: String(error) });
    }
    await sleep(1000);
  }

  for (const service of services.slice(0, 4)) {
    const url = `${service.url}?f=json`;
    try {
      const response = await get(url, { headers: { accept: "application/json" } });
      const body = await response.text();
      const json = response.ok ? (JSON.parse(body) as { layers?: { id: number; name: string }[]; error?: { message?: string } }) : null;
      const layers = json?.layers ?? [];
      record({
        probe: `arcgis service ${service.title.slice(0, 40)}`,
        url: service.url,
        status: response.status,
        bytes: body.length,
        note: json?.error ? `needs a token: ${json.error.message ?? ""}` : `${layers.length} layers: ${layers.slice(0, 4).map((l) => l.name).join(", ")}`,
      });
      if (layers.length && !json?.error) {
        boundaries.push({ source: "arcgis", title: service.title, url: service.url, bytes: null, note: `queryable per feature; layers: ${layers.slice(0, 4).map((l) => l.name).join(", ")}` });
      }
    } catch (error) {
      record({ probe: `arcgis service ${service.title.slice(0, 40)}`, url: service.url, error: String(error) });
    }
    await sleep(1000);
  }
}

/**
 * Wikidata by label search rather than by QID: the QIDs are not in this repository, and looking
 * them up by hand is the kind of step that cannot be re-run a year from now. The recorded QIDs
 * are used only as a fallback match, so the report can say which route found each site.
 */
async function probeWikidata(): Promise<Record<string, (Point & { matchedBy: string }) | null>> {
  const found: Record<string, (Point & { matchedBy: string }) | null> = {};
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
    const matched = new Set<string>();
    for (const plant of PLANTS) {
      const byAlias = items.find((i) => plant.aliases.some((a) => fold(i.label).includes(fold(a))) && i.point);
      const byQid = plant.qid ? items.find((i) => i.id === plant.qid && i.point) : undefined;
      const hit = byAlias ?? byQid;
      found[plant.site] = hit?.point
        ? { lon: Number(hit.point[1]), lat: Number(hit.point[2]), id: hit.id, matchedBy: byAlias ? "label" : "recorded QID" }
        : null;
      if (hit) matched.add(hit.id);
    }
    // Everything the query returned that nothing claimed: this is where the next alias comes from.
    const unmatched = items.filter((i) => !matched.has(i.id)).map((i) => `${i.label} (${i.id})`);
    record({
      probe: "wikidata sparql",
      url: "https://query.wikidata.org/sparql",
      status: response.status,
      bytes: body.length,
      note: `${items.length} Ecuadorian dams/plants with coordinates; matched ${Object.values(found).filter(Boolean).length}/${PLANTS.length}; unclaimed: ${unmatched.join("; ") || "none"}`,
    });
  } catch (error) {
    record({ probe: "wikidata sparql", url: "https://query.wikidata.org/sparql", error: String(error) });
  }
  return found;
}

/**
 * OpenStreetMap as the second opinion, one small box per dam instead of the country-wide query
 * that timed out. Both the name match and the nearest named feature are reported: a name match
 * at 140 m is a confirmed pour point, and a nearest feature at 9 km under a different name is
 * the kind of near-miss that must not be averaged into a coordinate.
 */
async function probeOverpass(
  wikidata: Record<string, (Point & { matchedBy: string }) | null>,
): Promise<Record<string, (Point & { name: string; kmFromWikidata: number; byName: boolean }) | null>> {
  const found: Record<string, (Point & { name: string; kmFromWikidata: number; byName: boolean }) | null> = {};
  let endpoint: string | null = null;

  for (const plant of PLANTS) {
    const anchor = wikidata[plant.site];
    if (!anchor) {
      found[plant.site] = null;
      continue;
    }
    const d = 0.12; // ~13 km, wide enough to catch a disagreement and small enough to be cheap
    const bbox = `${(anchor.lat - d).toFixed(3)},${(anchor.lon - d).toFixed(3)},${(anchor.lat + d).toFixed(3)},${(anchor.lon + d).toFixed(3)}`;
    const query = `[out:json][timeout:25];
(
  nwr["waterway"="dam"](${bbox});
  nwr["man_made"="dam"](${bbox});
  nwr["power"="plant"](${bbox});
  nwr["power"="generator"]["generator:source"="hydro"](${bbox});
);
out center tags;`;

    let done = false;
    // Once one instance has answered, stay on it: spreading seven queries over four servers is
    // worse manners than sending them all to the one that is willing.
    const attempts: string[] = endpoint ? [endpoint] : OVERPASS;
    for (const candidate of attempts) {
      try {
        const response = await get(candidate, { method: "POST", body: new URLSearchParams({ data: query }) });
        const body = await response.text();
        if (!response.ok) {
          record({ probe: `overpass ${plant.site}`, url: candidate, status: response.status, note: body.slice(0, 120) });
          await sleep(1000);
          continue;
        }
        endpoint = candidate;
        const json = JSON.parse(body) as {
          elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
        };
        const items = json.elements
          .map((e) => ({
            name: e.tags?.["name"] ?? "",
            id: `${e.type}/${e.id}`,
            lat: e.lat ?? e.center?.lat,
            lon: e.lon ?? e.center?.lon,
          }))
          .filter((i): i is { name: string; id: string; lat: number; lon: number } => i.lat !== undefined && i.lon !== undefined);
        const byName = items.find((i) => plant.aliases.some((a) => fold(i.name).includes(fold(a))));
        const nearest = items
          .filter((i) => i.name)
          .sort((a, b) => kmApart(anchor, a) - kmApart(anchor, b))[0];
        const hit = byName ?? nearest;
        found[plant.site] = hit
          ? { lat: hit.lat, lon: hit.lon, id: hit.id, name: hit.name || "(unnamed)", kmFromWikidata: kmApart(anchor, hit), byName: Boolean(byName) }
          : null;
        record({
          probe: `overpass ${plant.site}`,
          url: candidate,
          status: response.status,
          bytes: body.length,
          note: `${items.length} dams/plants in the box; ${byName ? `name match ${byName.name}` : nearest ? `no name match, nearest named is ${nearest.name}` : "nothing named"}`,
        });
        done = true;
        break;
      } catch (error) {
        record({ probe: `overpass ${plant.site}`, url: candidate, error: String(error) });
        await sleep(1000);
      }
    }
    if (!done) found[plant.site] ??= null;
    await sleep(1000);
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

  // Is the 403 the address, the client or the path? Then: who else serves this data?
  await probeHydroshedsBlock();
  for (const level of HYBAS_LEVELS) {
    await probeDownload(`hydrobasins lev${String(level).padStart(2, "0")}`, `${HYDROSHEDS}/hybas_sa_lev${String(level).padStart(2, "0")}_v1c.zip`);
    await sleep(1000);
  }
  await probeMirrors();
  await probeArcgis();

  for (const host of ["data.hydrosheds.org", "zenodo.org", "api.figshare.com", "www.arcgis.com", "query.wikidata.org", "overpass-api.de"]) {
    await probeRobots(host);
    await sleep(1000);
  }

  const wikidata = await probeWikidata();
  await sleep(1000);
  const overpass = await probeOverpass(wikidata);

  const coordinates = PLANTS.map((plant) => {
    const a = wikidata[plant.site];
    const b = overpass[plant.site];
    return {
      site: plant.site,
      basin: plant.basin,
      wikidata: a,
      osm: b,
      km_apart: a && b ? kmApart(a, b) : null,
      agrees: Boolean(a && b && b.byName && kmApart(a, b) <= 1),
    };
  });

  // The largest reachable candidate is not the answer; a named one that actually serves bytes is.
  const reachable = boundaries.filter((b) => b.bytes === null || b.bytes > 0);
  const verdict = reachable.length
    ? [
        `**${reachable.length} boundary candidate${reachable.length === 1 ? "" : "s"} to weigh**, listed above. The next run picks one,`,
        "downloads it inside the job, clips it to Ecuador and writes the per-dam catchments; nothing",
        "in `basins.csv` changes until a delineation exists to put in it.",
      ].join(" ")
    : "**No boundary source answered.** Until one does, `basins.csv` cannot hold a verified centroid or area, and the ERA5 climatology stays a single provisional point — that is the finding, not a gap to paper over.";
  const agreed = coordinates.filter((c) => c.agrees).length;

  const finishedAt = nowUtc();
  const report = [
    "# Probe: what it would take to put real catchments in basins.csv",
    "",
    `Started ${startedAt}, finished ${finishedAt}. Read-only; nothing under data/ was touched.`,
    "",
    "## Boundary candidates found",
    "",
    "| source | dataset | bytes | note |",
    "|---|---|---|---|",
    ...(boundaries.length
      ? boundaries.map((b) => `| ${b.source} | [${b.title}](${b.url}) | ${bytesOf(b.bytes)} | ${b.note} |`)
      : ["| — | none | — | every route probed below refused or returned nothing |"]),
    "",
    verdict,
    "",
    "## Reachability and size",
    "",
    "| probe | status | bytes | note | error |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.probe} | ${r.status ?? "—"} | ${bytesOf(r.bytes)} | ${r.note} | ${r.error} |`),
    "",
    "## Dam coordinates, from two sources that do not share editors",
    "",
    "| site | basin | Wikidata | OSM | km apart | agrees |",
    "|---|---|---|---|---|---|",
    ...coordinates.map(
      (c) =>
        `| ${c.site} | ${c.basin} | ${c.wikidata ? `${c.wikidata.lat}, ${c.wikidata.lon} (${c.wikidata.id}, by ${c.wikidata.matchedBy})` : "—"} | ` +
        `${c.osm ? `${c.osm.lat}, ${c.osm.lon} (${c.osm.id}, ${c.osm.name}${c.osm.byName ? "" : ", NOT a name match"})` : "—"} | ${c.km_apart ?? "—"} | ${c.agrees ? "yes" : "no"} |`,
    ),
    "",
    `**${agreed} of ${PLANTS.length} sites** have two sources that name the same dam within a kilometre. Only those`,
    "are pour points this repository may mark `verified`; a pair that disagrees by more than a sub-basin",
    "is two different places and must not be averaged into one. A site whose OSM column says",
    "`NOT a name match` was matched only by proximity, which is a lead, not a confirmation — and the",
    "box is drawn around the Wikidata point, so a blank OSM column means *nothing within 13 km of",
    "where Wikidata puts it*, which the country-wide query is the only way to rule on.",
    "",
  ].join("\n");

  console.log(report);
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "probe-basins.md"), `${report}\n`);
    writeFileSync(join(outDir, "probe-basins.json"), `${JSON.stringify({ startedAt, finishedAt, rows, boundaries, coordinates }, null, 1)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
