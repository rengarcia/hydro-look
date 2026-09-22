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
 * **Three more questions this run adds**, each one something the 2026-09-22 runs left open:
 *
 * 3. **What each point *is*.** Delsitanisagua's two sources name the plant 8.18 km apart, which is
 *    too far to be mapping imprecision, and until it is known whether they name the intake or the
 *    machines neither point may be used, because a catchment is defined at the intake. The evidence
 *    was already in hand and thrown away: `out center tags` returns every tag and only the name was
 *    kept. Tags are now reported, and with them two independent readings. A `wikidata=Q…` tag on the
 *    OSM element settles it outright — both sources would then name one entity, and one of them
 *    simply has the coordinate wrong. Failing that, height settles it: water enters a run-of-river
 *    scheme at the intake and leaves at the powerhouse, so the intake is higher by the gross head,
 *    and a terrain reading separates the two ends of a headrace by a margin no mapping error
 *    imitates. Elevations come from the host this repository already fetches its weather from.
 * 4. **A second route into OpenStreetMap.** Minas San Francisco has now ended five runs `no answer`
 *    — a 429 and two timeouts in the last one — which says nothing about the map and everything
 *    about three busy servers. Nominatim reads the same database from different machines, so a site
 *    Overpass will not answer can still be confirmed, or genuinely not found, which would be the
 *    first time that phrase meant anything here. It searches by name rather than by box, so it also
 *    reaches a dam OSM places outside the box drawn around the Wikidata point — the limit the last
 *    run wrote down and could not fix.
 * 5. **Whether any boundary candidate contains these dams.** The last run ended with four of them
 *    and a sentence promising the next would pick one and read it. This is that read, put as a
 *    point-in-polygon question rather than a download: an ArcGIS feature layer will say which
 *    polygon a coordinate falls in without serving the dataset at all. What comes back is the
 *    unit's own attributes — for the Pfafstetter layer a NIVEL_4 code, whose digits carry the
 *    nesting this exercise needs. Three of the four candidates map Mira-Mataje in the far north and
 *    should contain none of these dams; that they say so is the test working, not a failure.
 *
 * **Three more, for what PLAN.md §2.4 and Phase 4 left open after run 35739164652:**
 *
 * 6. **Minas San Francisco, by geometry.** Six runs failed to find it by name, and the last said
 *    why: Nominatim answered both aliases with no name match. So this asks Overpass for every dam,
 *    weir, intake, reservoir, hydro plant and CELEC-operated element in a wide box over the Jubones
 *    gorge, whatever it is called, plus the river itself, and ranks them by what ties them to the
 *    scheme (a QID, a name variant, the operator), what they are, and whether they sit on the river.
 * 7. **Delsitanisagua's intake lead.** node/2489320895 is a `waterway=dam` with no QID. What would
 *    tie it to the scheme is a mapped conduit — canal, tunnel, penstock — running from it to the
 *    powerhouse way/690695824, so the probe fetches both and every conduit between them and traces a
 *    chain.
 * 8. **Official hydrographic units.** The ArcGIS lead is closed; the agencies are asked directly.
 *    Their directory pages, their GeoServers' capabilities, INAMHI's GeoNode, the national CKAN and
 *    ArcGIS Online restricted to agency accounts and tags, and every matching layer gets the same
 *    point-in-polygon test as the ArcGIS candidates.
 *
 * Those three run first, right after Wikidata, so a run that runs short spends its time on what
 * is still unknown; `--phases` picks a subset (see `PHASES` in src/lib/probe/basins.ts).
 *
 * Read-only, writes nothing under data/, and every probe is guarded on its own so one dead host
 * does not cost the answers from the others.
 *
 *   npm run probe:basins -- --out "$RUNNER_TEMP/probe"
 *   npm run probe:basins -- --out "$RUNNER_TEMP/probe" --phases jubones,delsitanisagua,official
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { USER_AGENT } from "../src/lib/http/client.ts";
import {
  bboxAround,
  bboxContains,
  bboxSizeKm,
  capabilitiesUrl,
  fold,
  geometryContains,
  harvestServiceUrls,
  kmApart,
  kmBetweenLines,
  kmToLine,
  layerPriority,
  lineKm,
  matchesLayerPattern,
  overpassBbox,
  parseCapabilities,
  parsePhases,
  PHASES,
  rankArcgisItems,
  rankCandidates,
  relevantService,
  tieEvidence,
  traceChain,
  type ArcgisItem,
  type Bbox,
  type GeoJsonGeometry,
  type HarvestedService,
  type LatLon,
  type Phase,
  type RankedCandidate,
  type SchemeIdentity,
  type Tags,
  type WayGeom,
} from "../src/lib/probe/basins.ts";
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

/**
 * The real naming, read off the product page on 2026-09-22: one zip per continent carrying all
 * twelve levels, not one per level. The 2026-09-22 run asked for `hybas_sa_lev06_v1c.zip` and
 * four siblings that do not exist — which cost nothing only because the host refuses this
 * address whatever is asked of it, and would have been four wrong 404s the day that changes.
 */
const HYBAS_SA = "https://data.hydrosheds.org/file/hydrobasins/standard/hybas_sa_lev01-12_v1c.zip";

/** What a browser sends, used once, to tell a User-Agent block apart from an address block. */
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

/**
 * Overpass instances, tried in order, and every one of them carrying the whole planet.
 *
 * `overpass.osm.ch` was in this list on 2026-09-22 and had to come out. It serves Switzerland
 * only, so an Ecuadorian bounding box is not an error to it — it is a question with no answer,
 * and it returns **200 with an empty element list**, 272 bytes, indistinguishable from a box
 * with nothing in it. Agoyán's three 504s fell through to it, the run pinned itself to the
 * instance that had just "worked", and five sites were reported as `empty box` — including
 * Agoyán and Daule-Peripa, which the previous run had found at 0.56 and 0.46 km. A regional
 * mirror answering 200 is the most expensive kind of wrong answer, because nothing about it
 * looks like a failure.
 */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** A box with nine mapped features in it, used to ask an instance whether it holds Ecuador. */
const EC_CONTROL_BBOX = "-2.715,-78.742,-2.475,-78.502";

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
/**
 * Held here rather than in `main` so the report can be assembled from whatever has been
 * answered so far. Run 35732611773 spent ten minutes asking and was killed at the job limit
 * with nothing written, because the report was built once, at the end. It is now flushed at
 * every phase boundary, so a run that dies still leaves the answers it had already got.
 */
let wikidataFound: Record<string, (Point & { matchedBy: string }) | null> = {};
let overpassFound: Record<string, OsmResult> = {};
/** Ground height at every candidate point, keyed `site/source`. The intake is the higher end. */
let elevations: Record<string, number | null> = {};
/** Every mapped structure between two points that disagree, so the scheme can be read off. */
const schemes: Record<string, SchemeElement[]> = {};
/** Which polygon of which candidate boundary set contains each dam. */
let containment: ContainmentRow[] = [];
/** Which phases this run was asked for, and which it skipped because the job's clock ran down. */
let phasesAsked: Phase[] = [];
const phasesSkipped: Phase[] = [];
const record = (row: Partial<Row> & { probe: string; url: string }): void => {
  rows.push({ status: null, bytes: null, note: "", error: "", ...row });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every request carries a deadline. `fetch` has none by default, and a probe without one does
 * not fail, it hangs: the 2026-09-22 run 35732611773 was killed at the job's ten-minute limit
 * with its report unwritten, because a busy Overpass instance can hold a connection open far
 * longer than the 25 seconds its own query header asks for.
 */
const DEADLINE_MS = 40_000;

async function get(url: string, init: RequestInit = {}, deadlineMs = DEADLINE_MS): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(deadlineMs),
    ...init,
    headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) },
  });
}

const bytesOf = (n: number | null): string => (n === null ? "—" : n.toLocaleString("en-US"));

/**
 * The tags that say which part of a scheme an element is, in the order they answer the question.
 *
 * `waterway=dam` and `power=plant` are not two words for one place. On a run-of-river scheme they
 * sit at opposite ends of a headrace, and a catchment drawn at the wrong one is a catchment with
 * several kilometres of river in it that the plant never sees. `wikidata` is here because it is the
 * strongest answer of all: if the OSM element carries the same QID the SPARQL query returned, the
 * two sources are not describing different structures at all — they are describing one thing, and
 * the distance between them is somebody's error rather than a headrace.
 */
const STRUCTURE_TAGS = ["wikidata", "waterway", "man_made", "power", "plant:source", "generator:source", "plant:output:electricity", "operator", "start_date"];
const structureOf = (tags: Record<string, string>): string =>
  STRUCTURE_TAGS.filter((k) => tags[k])
    .map((k) => `${k}=${tags[k]}`)
    .join(", ") || "no identifying tags";

/**
 * Words that make a title or a layer name plausibly about drainage boundaries.
 *
 * The 2026-09-22 run needed this and did not have it: it took the three top hits of every search
 * and called the largest file in each a boundary candidate, so its report led with fourteen of
 * them — a Tibetan Plateau hydrograph set, EU ecosystem services, Global Fishing Watch, and a
 * PLOS figure of the Cauca River. A search engine answering *something* is not a source, and a
 * probe that cannot tell the difference is worse than one that finds nothing, because the report
 * is what the plan gets written from.
 */
const HYDRO_WORDS = ["cuenca", "subcuenca", "microcuenca", "hidrograf", "pfafstetter", "watershed", "basin", "drenaje", "catchment", "hydrobasins", "hydroatlas", "hydrosheds"];
const hydroScore = (s: string): number => HYDRO_WORDS.filter((w) => fold(s).includes(w)).length;

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

/** `host` may carry its scheme (`http://host`) for the government hosts that serve no HTTPS. */
async function probeRobots(host: string, deadlineMs = DEADLINE_MS): Promise<void> {
  const url = /^https?:\/\//.test(host) ? `${host}/robots.txt` : `https://${host}/robots.txt`;
  try {
    const response = await get(url, {}, deadlineMs);
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
    record({ probe: `robots ${host}`, url, error: describeError(error) });
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
  await probeDownload("hydrobasins sa (repo UA)", HYBAS_SA);
  await sleep(1000);
  await probeDownload("hydrobasins sa (browser UA)", HYBAS_SA, {
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
    for (const link of links.filter((l) => /hybas_sa_/i.test(l)).slice(0, 1)) {
      await sleep(1000);
      const bytes = await probeDownload("hydrobasins sa (link from the page)", link);
      if (bytes) boundaries.push({ source: "hydrosheds", title: "HydroBASINS South America, levels 1-12", url: link, bytes, note: "NEXT_DOWN topology and SUB_AREA per sub-basin" });
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
  // Quoted, and matched against the title afterwards. Unquoted, `global dam watch` is three
  // OR-ed words and Zenodo answers with 300,885 records led by Global Fishing Watch.
  for (const q of ['"HydroBASINS"', '"HydroATLAS"', '"Global Dam Watch"', '"GRanD" reservoirs']) {
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
      // The title has to name the thing searched for, or it is a coincidence, not a mirror.
      const needle = fold(q.replace(/"/g, ""));
      for (const hit of hits.filter((h) => fold(h.title).includes(needle)).slice(0, 3)) {
        const biggest = (hit.files ?? []).sort((a, b) => b.size - a.size)[0];
        if (biggest?.links?.self) {
          boundaries.push({
            source: `zenodo ${q}`,
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
        note: `${json.hits.total ?? hits.length} records; kept ${hits.filter((h) => fold(h.title).includes(needle)).length} whose title names it; top: ${hits.slice(0, 3).map((h) => h.title.slice(0, 44)).join(" / ") || "none"}`,
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
      body: JSON.stringify({ search_for: '"HydroATLAS" OR "HydroBASINS"', page_size: 10 }),
    });
    const body = await response.text();
    if (!response.ok) {
      record({ probe: "figshare HydroATLAS", url: search, status: response.status, note: body.slice(0, 160) });
      return;
    }
    const articles = JSON.parse(body) as { id: number; title: string; url_public_html?: string }[];
    // Only an article whose own title names it is worth opening; the 2026-09-22 run opened a
    // PLOS figure of the Cauca River because it was simply first.
    const first = articles.find((a) => hydroScore(a.title) > 0);
    record({
      probe: "figshare HydroATLAS",
      url: search,
      status: response.status,
      bytes: body.length,
      note: `${articles.length} articles; ${first ? `opening ${first.id} ${first.title.slice(0, 40)}` : "none whose title names a drainage dataset"}`,
    });
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
  const queries = [
    'unidades hidrograficas Ecuador type:"Feature Service"',
    'cuencas hidrograficas Ecuador type:"Feature Service"',
    'Ecuador Pfafstetter type:"Feature Service"',
    'Ecuador subcuencas type:"Feature Service"',
  ];
  // Scored and pooled across every query, because the run that matters is the one that opens
  // the right service. The 2026-09-22 run took the first four it saw, which came from the two
  // queries that returned nothing relevant, and so never opened the one hit that was:
  // "Fig 13_ B_UnidadesHidrográficasN4Pfastet".
  const services = new Map<string, { title: string; url: string; score: number }>();
  for (const q of queries) {
    const url = `https://www.arcgis.com/sharing/rest/search?f=json&num=10&q=${encodeURIComponent(q)}`;
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
      for (const r of results) {
        if (!r.url) continue;
        const score = hydroScore(r.title);
        const seen = services.get(r.url);
        if (!seen || score > seen.score) services.set(r.url, { title: `${r.title} (${r.owner})`, url: r.url, score });
      }
      record({
        probe: `arcgis "${q.replace(' type:"Feature Service"', "")}"`,
        url,
        status: response.status,
        bytes: body.length,
        note: `${json.total ?? results.length} items; ${results.slice(0, 4).map((r) => `${r.title.slice(0, 40)} [${r.type}]${hydroScore(r.title) ? " *" : ""}`).join(" / ") || "none"}`,
      });
    } catch (error) {
      record({ probe: `arcgis "${q}"`, url, error: String(error) });
    }
    await sleep(1000);
  }

  const ranked = [...services.values()].sort((a, b) => b.score - a.score).slice(0, 4);
  for (const service of ranked) {
    const url = `${service.url}?f=json`;
    try {
      const response = await get(url, { headers: { accept: "application/json" } });
      const body = await response.text();
      const json = response.ok ? (JSON.parse(body) as { layers?: { id: number; name: string }[]; error?: { message?: string } }) : null;
      const layers = json?.layers ?? [];
      // Which layer, if any, is actually a drainage boundary — not just which service answered.
      const best = layers.map((l) => ({ ...l, score: hydroScore(l.name) })).sort((a, b) => b.score - a.score)[0];
      record({
        probe: `arcgis service ${service.title.slice(0, 40)}`,
        url: service.url,
        status: response.status,
        bytes: body.length,
        note: json?.error
          ? `needs a token: ${json.error.message ?? ""}`
          : `${layers.length} layers; best drainage match ${best && best.score > 0 ? `"${best.name}"` : "none"}`,
      });
      if (!best || best.score === 0 || json?.error) {
        await sleep(1000);
        continue;
      }

      // The fields are the answer to the question behind the question: Pfafstetter codes encode
      // the upstream topology in their digits, so a code column is worth as much as NEXT_DOWN.
      await sleep(1000);
      const layerUrl = `${service.url}/${best.id}?f=json`;
      const lresponse = await get(layerUrl, { headers: { accept: "application/json" } });
      const lbody = await lresponse.text();
      const layer = lresponse.ok ? (JSON.parse(lbody) as { name?: string; geometryType?: string; fields?: { name: string }[] }) : null;
      const fields = (layer?.fields ?? []).map((f) => f.name);
      record({
        probe: `arcgis layer "${best.name.slice(0, 34)}"`,
        url: layerUrl,
        status: lresponse.status,
        bytes: lbody.length,
        note: `${layer?.geometryType ?? "?"}; fields: ${fields.slice(0, 12).join(", ") || "none"}`,
      });
      if (layer?.geometryType === "esriGeometryPolygon") {
        boundaries.push({
          source: "arcgis",
          title: `${service.title} — layer ${best.id} "${best.name}"`,
          url: `${service.url}/${best.id}/query`,
          bytes: null,
          note: `polygons, queryable per feature, no download; fields: ${fields.slice(0, 8).join(", ")}`,
        });
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
 * Does this instance hold Ecuador? Asked only when one answers an Ecuadorian box with nothing,
 * because that is the one answer a regional mirror and a genuinely empty box give identically.
 * Tri-state on purpose: a 504 on the control says nothing about coverage, and must not condemn
 * an instance that was merely busy.
 */
async function overpassHoldsEcuador(endpoint: string): Promise<"yes" | "no" | "unknown"> {
  const query = `[out:json][timeout:25];
(
  nwr["waterway"="dam"](${EC_CONTROL_BBOX});
  nwr["power"="plant"](${EC_CONTROL_BBOX});
);
out center tags;`;
  try {
    const response = await get(endpoint, { method: "POST", body: new URLSearchParams({ data: query }) });
    if (!response.ok) return "unknown";
    const json = JSON.parse(await response.text()) as { elements?: unknown[] };
    return (json.elements ?? []).length > 0 ? "yes" : "no";
  } catch {
    return "unknown";
  }
}

/** What came back for a site, so a blank cell cannot be read as a statement about OSM. */
type OsmHit = Point & { name: string; kmFromWikidata: number; byName: boolean; tags: Record<string, string>; via: string };
interface OsmResult {
  hit: OsmHit | null;
  /** `match`, `nearest-only`, `empty box`, `no answer`, or `no anchor`. */
  outcome: string;
}

/**
 * OpenStreetMap as the second opinion, one small box per dam instead of the country-wide query
 * that timed out. Both the name match and the nearest named feature are reported: a name match
 * at 140 m is a confirmed pour point, and a nearest feature at 9 km under a different name is
 * the kind of near-miss that must not be averaged into a coordinate.
 *
 * Every site now carries the outcome that produced its row, because the 2026-09-22 run could not
 * tell two very different things apart. It pinned itself to the first instance that answered and
 * never left it, so when that server returned 504 to Coca Codo Sinclair and Minas San Francisco
 * and 429 to Manduriacu and Delsitanisagua, four sites were printed with an empty OSM column
 * under a paragraph explaining that an empty column means OSM has nothing within 13 km. It means
 * no such thing when nobody answered the question.
 */
async function probeOverpass(
  wikidata: Record<string, (Point & { matchedBy: string }) | null>,
  flush: () => void,
): Promise<Record<string, OsmResult>> {
  const found: Record<string, OsmResult> = {};
  let lastGood: string | null = null;
  /**
   * The control verdict per instance, asked at most once each. Whether a server holds Ecuador
   * is a fact about the server, so re-asking it for every site spends the run's whole budget on
   * a question already answered.
   */
  const control = new Map<string, "yes" | "no" | "unknown">();
  const dead = new Set<string>();

  for (const plant of PLANTS) {
    const anchor = wikidata[plant.site];
    if (!anchor) {
      found[plant.site] = { hit: null, outcome: "no anchor" };
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

    // Start with whichever instance last answered, then fall through to the others, skipping
    // any that has already proven it does not hold this country.
    const live = OVERPASS.filter((o) => !dead.has(o));
    const attempts: string[] = lastGood && !dead.has(lastGood) ? [lastGood, ...live.filter((o) => o !== lastGood)] : live;
    found[plant.site] = { hit: null, outcome: "no answer" };
    for (const candidate of attempts) {
      try {
        const response = await get(candidate, { method: "POST", body: new URLSearchParams({ data: query }) });
        const body = await response.text();
        if (!response.ok) {
          record({ probe: `overpass ${plant.site}`, url: candidate, status: response.status, note: body.slice(0, 80).replace(/\s+/g, " ") });
          // 429 is "you, slower" and 504 is "me, busy". Both deserve another server and a pause
          // long enough to be an apology rather than a retry storm.
          await sleep(response.status === 429 ? 5000 : 1500);
          continue;
        }
        const json = JSON.parse(body) as {
          elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
        };
        const items = json.elements
          .map((e) => ({
            name: e.tags?.["name"] ?? "",
            id: `${e.type}/${e.id}`,
            lat: e.lat ?? e.center?.lat,
            lon: e.lon ?? e.center?.lon,
            // Kept, not discarded: which structure of a scheme this element is cannot be read
            // off a name, and the answer is already in the response the query paid for.
            tags: e.tags ?? {},
          }))
          .filter((i): i is { name: string; id: string; lat: number; lon: number; tags: Record<string, string> } => i.lat !== undefined && i.lon !== undefined);
        // Nothing found is only a finding if this instance holds Ecuador at all.
        if (items.length === 0 && control.get(candidate) !== "yes") {
          let verdict = control.get(candidate);
          if (!verdict) {
            await sleep(1500);
            verdict = await overpassHoldsEcuador(candidate);
            control.set(candidate, verdict);
            record({
              probe: `overpass control ${new URL(candidate).host}`,
              url: candidate,
              status: response.status,
              note:
                verdict === "yes"
                  ? "answers the Mazar control box, so its empty answers are real"
                  : verdict === "no"
                    ? "returns nothing for the Mazar control box: this mirror does not hold Ecuador, and its answers are discarded"
                    : "could not answer the Mazar control box, so its empty answers prove nothing",
            });
          }
          if (verdict !== "yes") {
            if (verdict === "no") dead.add(candidate);
            if (lastGood === candidate) lastGood = null;
            found[plant.site] = { hit: null, outcome: "empty, unconfirmed" };
            await sleep(1000);
            continue;
          }
        }
        if (items.length > 0) control.set(candidate, "yes");
        lastGood = candidate;
        // Several elements can share a name, and `find` took whichever the server happened to list
        // first. Manduriacu maps its plant, its dam and an untagged reservoir outline under two
        // spellings of the same string, so one run reported it at 0.02 km and the next at 1.19 —
        // from identical data. Prefer the element carrying the QID the SPARQL query returned, then
        // the nearest: a QID match is the two sources naming one entity, which is the whole test.
        const named = items.filter((i) => plant.aliases.some((a) => fold(i.name).includes(fold(a))));
        const byName = [...named].sort(
          (a, b) => Number(b.tags["wikidata"] === plant.qid) - Number(a.tags["wikidata"] === plant.qid) || kmApart(anchor, a) - kmApart(anchor, b),
        )[0];
        const nearest = items.filter((i) => i.name).sort((a, b) => kmApart(anchor, a) - kmApart(anchor, b))[0];
        const hit = byName ?? nearest;
        found[plant.site] = {
          hit: hit
            ? { lat: hit.lat, lon: hit.lon, id: hit.id, name: hit.name || "(unnamed)", kmFromWikidata: kmApart(anchor, hit), byName: Boolean(byName), tags: hit.tags, via: "overpass" }
            : null,
          outcome: byName ? "match" : nearest ? "nearest-only" : "empty box",
        };
        record({
          probe: `overpass ${plant.site}`,
          url: candidate,
          status: response.status,
          bytes: body.length,
          note:
            `${items.length} dams/plants in the box; ` +
            `${byName ? `name match ${byName.name} [${structureOf(byName.tags)}]` : nearest ? `no name match, nearest named is ${nearest.name}` : "nothing named"}`,
        });
        break;
      } catch (error) {
        record({ probe: `overpass ${plant.site}`, url: candidate, error: String(error) });
        await sleep(1500);
      }
    }
    overpassFound = found;
    flush();
    await sleep(1000);
  }
  return found;
}

/** One mapped structure found between two points that disagree about where a plant is. */
interface SchemeElement {
  id: string;
  name: string;
  what: string;
  lat: number;
  lon: number;
  kmFromWikidata: number;
  kmFromOsm: number;
}

/** One dam, one candidate boundary layer, and the polygon of it the dam falls in. */
interface ContainmentRow {
  /** `lead` for the ArcGIS candidates §2.4 closed, `official` for the agency layers. */
  group: "lead" | "official";
  site: string;
  layer: string;
  url: string;
  status: number | null;
  attributes: string;
  note: string;
}

/**
 * Ground height at every candidate point, from the host this repository already fetches weather
 * from and therefore already knows a runner can reach.
 *
 * This is the instrument the earlier runs lacked. When two sources place one plant 8 km apart the
 * useful question is not which coordinate is *right* — both can be — but which structure each one
 * names, and on a run-of-river scheme that is a question about height: the intake is above the
 * machines by the whole gross head, which for a plant of this kind is hundreds of metres. A pair
 * that comes back within a few metres of each other is the other answer, and a valuable one: it
 * would mean the disagreement is not intake-versus-powerhouse at all and one source is simply
 * wrong. One request carries every point, so the whole fleet costs what a single reading costs.
 */
async function probeElevation(points: { key: string; lat: number; lon: number }[], probe = "elevation (open-meteo)"): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  if (points.length === 0) return out;
  const url =
    "https://api.open-meteo.com/v1/elevation" +
    `?latitude=${points.map((p) => p.lat.toFixed(5)).join(",")}` +
    `&longitude=${points.map((p) => p.lon.toFixed(5)).join(",")}`;
  try {
    const response = await get(url, { headers: { accept: "application/json" } });
    const body = await response.text();
    const json = response.ok ? (JSON.parse(body) as { elevation?: number[] }) : null;
    const values = json?.elevation ?? [];
    points.forEach((p, i) => {
      out[p.key] = typeof values[i] === "number" ? values[i] : null;
    });
    record({
      probe,
      url,
      status: response.status,
      bytes: body.length,
      note: values.length
        ? points.map((p, i) => `${p.key} ${values[i] ?? "?"}`).join("; ").slice(0, 600)
        : `no elevations returned: ${body.slice(0, 80).replace(/\s+/g, " ")}`,
    });
  } catch (error) {
    record({ probe, url, error: String(error) });
  }
  return out;
}

/**
 * Everything mapped between two points that disagree, so the scheme can be read rather than guessed.
 *
 * The per-site query asks only for dams and plants, which is why it can report two points 8 km apart
 * and say nothing about what lies between them. A run-of-river scheme is a chain — intake, headrace
 * or penstock, powerhouse, tailrace — and the chain is what distinguishes "two sources naming
 * opposite ends of one plant" from "two sources naming two different plants". This asks for the
 * whole chain over a box covering both candidates, and reports each element with the tags that say
 * what it is and its distance from each of the two claims.
 */
async function probeScheme(site: string, a: Point, b: Point): Promise<SchemeElement[]> {
  const pad = 0.03;
  const bbox =
    `${(Math.min(a.lat, b.lat) - pad).toFixed(3)},${(Math.min(a.lon, b.lon) - pad).toFixed(3)},` +
    `${(Math.max(a.lat, b.lat) + pad).toFixed(3)},${(Math.max(a.lon, b.lon) + pad).toFixed(3)}`;
  const query = `[out:json][timeout:40];
(
  nwr["waterway"~"^(dam|weir|canal|penstock|ditch)$"](${bbox});
  nwr["man_made"~"^(intake|pipeline|water_works|penstock|tunnel)$"](${bbox});
  nwr["power"~"^(plant|generator)$"](${bbox});
  nwr["water"="reservoir"](${bbox});
  nwr["natural"="water"]["name"](${bbox});
);
out center tags;`;
  for (const endpoint of OVERPASS) {
    try {
      const response = await get(endpoint, { method: "POST", body: new URLSearchParams({ data: query }) });
      const body = await response.text();
      if (!response.ok) {
        record({ probe: `scheme ${site}`, url: endpoint, status: response.status, note: body.slice(0, 80).replace(/\s+/g, " ") });
        await sleep(response.status === 429 ? 5000 : 1500);
        continue;
      }
      const json = JSON.parse(body) as {
        elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
      };
      const found = json.elements
        .map((e) => ({
          id: `${e.type}/${e.id}`,
          name: e.tags?.["name"] ?? "",
          what: structureOf(e.tags ?? {}),
          lat: e.lat ?? e.center?.lat,
          lon: e.lon ?? e.center?.lon,
        }))
        .filter((e): e is { id: string; name: string; what: string; lat: number; lon: number } => e.lat !== undefined && e.lon !== undefined)
        .map((e) => ({ ...e, kmFromWikidata: kmApart(a, e), kmFromOsm: kmApart(b, e) }))
        .sort((x, y) => x.kmFromWikidata - y.kmFromWikidata);
      record({
        probe: `scheme ${site}`,
        url: endpoint,
        status: response.status,
        bytes: body.length,
        note: `${found.length} structures in a box covering both claims`,
      });
      return found;
    } catch (error) {
      record({ probe: `scheme ${site}`, url: endpoint, error: String(error) });
      await sleep(1500);
    }
  }
  return [];
}

/**
 * OpenStreetMap by a different door, for the sites Overpass would not answer.
 *
 * `no answer` is a fact about three busy servers, not about the map, and a site that collects five
 * of them in a row is still unmeasured rather than unmapped. Nominatim runs on different machines
 * against the same database, and it searches by name, so it answers a question the bounding boxes
 * structurally cannot: where OSM puts this dam, including somewhere the box never covered.
 */
/**
 * How far a Nominatim hit may sit from the Wikidata point and still be about the same dam.
 *
 * The first run with this route returned "Agoyan" 131 km away, at 2,876 m against the dam's 1,638,
 * and the name match alone was enough to put it in the coordinates table — where its elevation was
 * then compared against the real site's as though the pair meant something. A free-text search
 * answers with whatever carries the string, and Ecuador has more than one Agoyán. Thirteen
 * kilometres is the radius the bounding boxes already use, so the two routes agree on what
 * "near this dam" means, and a hit beyond it is recorded as the finding it is rather than adopted.
 */
const MAX_NOMINATIM_KM = 13;

async function probeNominatim(plant: (typeof PLANTS)[number], anchor: Point): Promise<OsmHit | null> {
  for (const alias of plant.aliases) {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=jsonv2&limit=10&countrycodes=ec&extratags=1&q=${encodeURIComponent(alias)}`;
    try {
      const response = await get(url, { headers: { accept: "application/json" } });
      const body = await response.text();
      if (!response.ok) {
        record({ probe: `nominatim ${plant.site}`, url, status: response.status, note: body.slice(0, 80).replace(/\s+/g, " ") });
        await sleep(2000);
        continue;
      }
      const items = (JSON.parse(body) as { lat: string; lon: string; name?: string; display_name?: string; osm_type?: string; osm_id?: number; category?: string; type?: string; extratags?: Record<string, string> }[])
        .map((i) => ({
          lat: Number(i.lat),
          lon: Number(i.lon),
          name: i.name || i.display_name?.split(",")[0] || "",
          id: i.osm_type && i.osm_id ? `${i.osm_type}/${i.osm_id}` : "(no osm id)",
          tags: { ...(i.extratags ?? {}), ...(i.category ? { [i.category]: i.type ?? "" } : {}) },
        }))
        .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon));
      const byName = items.find((i) => plant.aliases.some((x) => fold(i.name).includes(fold(x))));
      record({
        probe: `nominatim ${plant.site}`,
        url,
        status: response.status,
        bytes: body.length,
        note:
        `"${alias}": ${items.length} results; ` +
        (byName
          ? `name match ${byName.name} at ${kmApart(anchor, byName)} km [${structureOf(byName.tags)}]` +
            (kmApart(anchor, byName) > MAX_NOMINATIM_KM ? ` — beyond ${MAX_NOMINATIM_KM} km, so this is something else with the same name, not this dam` : "")
          : `no name match${items.length ? `, first is ${items[0]!.name}` : ""}`),
      });
      if (byName && kmApart(anchor, byName) <= MAX_NOMINATIM_KM) {
        return { lat: byName.lat, lon: byName.lon, id: byName.id, name: byName.name, kmFromWikidata: kmApart(anchor, byName), byName: true, tags: byName.tags, via: "nominatim" };
      }
      await sleep(2000);
    } catch (error) {
      record({ probe: `nominatim ${plant.site}`, url, error: String(error) });
      await sleep(2000);
    }
  }
  return null;
}

/** A layer that can be asked which of its polygons contains a point, and how to ask it. */
interface ContainableLayer {
  title: string;
  /** `arcgis`: a feature/map-service layer's `/query`. `wfs`: GetFeature near the point, tested here. `wms`: GetFeatureInfo. */
  kind: "arcgis" | "wfs" | "wms";
  /** For `arcgis` the layer's `/query` URL; for `wfs`/`wms` the service base. */
  url: string;
  /** The WFS/WMS layer name; unused for `arcgis`. */
  typeName?: string;
}

const attributeText = (attributes: Record<string, unknown> | undefined): string =>
  attributes
    ? Object.entries(attributes)
        .filter(([k]) => !/^(OBJECTID|FID|GlobalID|Shape__|SHAPE_|the_geom|geom$)/i.test(k))
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ")
        .slice(0, 300)
    : "";

/** The request that asks one layer about one point, by the only route that layer offers. */
function containmentUrl(layer: ContainableLayer, point: LatLon): string {
  const url = new URL(layer.url);
  const d = 0.0005; // ~55 m: a box small enough that a hit is about this point, big enough to be non-degenerate
  if (layer.kind === "arcgis") {
    url.searchParams.set("f", "json");
    url.searchParams.set("geometry", `${point.lon},${point.lat}`);
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("outFields", "*");
  } else if (layer.kind === "wfs") {
    // WFS 1.0.0 because its EPSG:4326 axis order is lon,lat everywhere; 1.1 and 2.0 flip it, and
    // a flipped box around an Ecuadorian dam lands in the Southern Ocean and answers "nothing".
    url.search = "";
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "1.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeName", layer.typeName ?? "");
    url.searchParams.set("bbox", `${point.lon - d},${point.lat - d},${point.lon + d},${point.lat + d},EPSG:4326`);
    url.searchParams.set("srsName", "EPSG:4326");
    url.searchParams.set("maxFeatures", "10");
    url.searchParams.set("outputFormat", "application/json");
  } else {
    url.search = "";
    url.searchParams.set("service", "WMS");
    url.searchParams.set("version", "1.1.1");
    url.searchParams.set("request", "GetFeatureInfo");
    url.searchParams.set("layers", layer.typeName ?? "");
    url.searchParams.set("query_layers", layer.typeName ?? "");
    url.searchParams.set("styles", "");
    url.searchParams.set("srs", "EPSG:4326");
    url.searchParams.set("bbox", `${point.lon - d},${point.lat - d},${point.lon + d},${point.lat + d}`);
    url.searchParams.set("width", "3");
    url.searchParams.set("height", "3");
    url.searchParams.set("x", "1");
    url.searchParams.set("y", "1");
    url.searchParams.set("info_format", "application/json");
    url.searchParams.set("feature_count", "5");
  }
  return url.toString();
}

/**
 * Which polygon of each candidate boundary set each dam falls in.
 *
 * The promise the last run left was that the next would pick a candidate and read it. This reads
 * all of them, and as a question rather than a download: a feature layer will answer which of its
 * polygons contains a coordinate without serving the dataset, which is the difference between a
 * lead and a usable source. The attributes that come back are the whole point — a Pfafstetter code
 * carries its nesting in its digits, so a layer that returns one has the upstream topology that
 * HydroSHEDS was wanted for. A layer that contains none of these dams has answered too: three of
 * the four candidates map Mira-Mataje in the far north, and their saying so is this test working.
 *
 * The official-sources phase asks the same question of servers that are not ArcGIS. A WFS cannot
 * run a point-in-polygon query without knowing the geometry column's name, so it is asked for the
 * features near the point and the containment is decided here, from the geometry it returns. A
 * WMS with no WFS behind it is asked by GetFeatureInfo, which is the server's own point query.
 */
async function probeContains(
  points: { key: string; lat: number; lon: number }[],
  layers: ContainableLayer[],
  group: ContainmentRow["group"],
  stillTime: () => boolean = () => true,
): Promise<ContainmentRow[]> {
  const out: ContainmentRow[] = [];
  for (const layer of layers) {
    for (const point of points) {
      const url = containmentUrl(layer, point);
      const title = layer.typeName && layer.kind !== "arcgis" ? `${layer.title} [${layer.kind} ${layer.typeName}]` : layer.title;
      if (!stillTime()) {
        out.push({ group, site: point.key, layer: title, url, status: null, attributes: "", note: "not asked: the phase's time budget was spent" });
        continue;
      }
      try {
        const response = await get(url, { headers: { accept: "application/json" } }, layer.kind === "arcgis" ? DEADLINE_MS : OFFICIAL_DEADLINE_MS);
        const body = await response.text();
        let json: {
          features?: { attributes?: Record<string, unknown>; properties?: Record<string, unknown>; geometry?: GeoJsonGeometry | null }[];
          error?: { message?: string };
        } | null = null;
        try {
          json = response.ok ? JSON.parse(body) : null;
        } catch {
          json = null;
        }
        if (layer.kind === "arcgis") {
          const feature = json?.features?.[0]?.attributes;
          out.push({
            group,
            site: point.key,
            layer: title,
            url,
            status: response.status,
            attributes: attributeText(feature),
            note: json?.error?.message ? `error: ${json.error.message}` : feature ? "contained" : "no polygon contains this point",
          });
        } else if (!json) {
          out.push({ group, site: point.key, layer: title, url, status: response.status, attributes: "", note: `not JSON: ${body.slice(0, 120).replace(/\s+/g, " ")}` });
        } else if (layer.kind === "wfs") {
          const features = json.features ?? [];
          const verdicts = features.map((f) => ({ f, inside: geometryContains(f.geometry, point.lon, point.lat) }));
          const inside = verdicts.find((v) => v.inside === true);
          const undecided = verdicts.filter((v) => v.inside === null).length;
          out.push({
            group,
            site: point.key,
            layer: title,
            url,
            status: response.status,
            attributes: attributeText(inside?.f.properties),
            note: inside
              ? `contained (${features.length} features near the point, tested here)`
              : features.length === 0
                ? "no feature within ~55 m of this point"
                : undecided === features.length
                  ? `${features.length} features near the point, none testable (not polygons in degrees)`
                  : `${features.length} features near the point, none contains it`,
          });
        } else {
          const feature = json.features?.[0]?.properties;
          out.push({
            group,
            site: point.key,
            layer: title,
            url,
            status: response.status,
            attributes: attributeText(feature),
            note: feature ? "contained (GetFeatureInfo)" : "GetFeatureInfo returned no feature at this point",
          });
        }
      } catch (error) {
        out.push({ group, site: point.key, layer: title, url, status: null, attributes: "", note: String(error) });
      }
      await sleep(1000);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Shared by the three phases below
// ---------------------------------------------------------------------------------------------

/** What Overpass returns for `out center;` and `out geom;`, whichever was asked. */
interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
  nodes?: number[];
  geometry?: ({ lat: number; lon: number } | null)[];
}

/** Why a request failed, with the cause Node hides behind "fetch failed" — a TLS code, a DNS miss, a reset. */
function describeError(error: unknown): string {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const detail = cause ? cause.code ?? cause.message ?? "" : "";
  return `${String(error)}${detail ? ` (${detail})` : ""}`.slice(0, 200);
}

const elementPoint = (e: OverpassElement): LatLon | null => {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (lat !== undefined && lon !== undefined) return { lat, lon };
  const line = geometryOf(e);
  if (line.length === 0) return null;
  return { lat: line.reduce((s, p) => s + p.lat, 0) / line.length, lon: line.reduce((s, p) => s + p.lon, 0) / line.length };
};

const geometryOf = (e: OverpassElement): LatLon[] => (e.geometry ?? []).filter((p): p is LatLon => p !== null && p !== undefined);

/**
 * One Overpass question, asked of each planet-wide instance in turn until one answers.
 *
 * The two ways an instance can answer without answering are both handled. A server-side timeout
 * arrives as **200 with a `remark`** and whatever it had collected so far, which reads as a small
 * result unless the remark is checked. And an empty answer is believed only from an instance that
 * has shown it holds Ecuador, for the reason the `OVERPASS` list records.
 */
async function askOverpass(probe: string, query: string, deadlineMs = 60_000): Promise<{ elements: OverpassElement[]; endpoint: string } | null> {
  for (const endpoint of OVERPASS) {
    try {
      const response = await get(endpoint, { method: "POST", body: new URLSearchParams({ data: query }) }, deadlineMs);
      const body = await response.text();
      if (!response.ok) {
        record({ probe, url: endpoint, status: response.status, note: body.slice(0, 80).replace(/\s+/g, " ") });
        await sleep(response.status === 429 ? 5000 : 1500);
        continue;
      }
      const json = JSON.parse(body) as { elements?: OverpassElement[]; remark?: string };
      const elements = json.elements ?? [];
      if (json.remark && /error|timed out|out of memory/i.test(json.remark)) {
        record({ probe, url: endpoint, status: response.status, bytes: body.length, note: `partial answer, discarded: ${json.remark.slice(0, 100)}` });
        await sleep(1500);
        continue;
      }
      if (elements.length === 0) {
        await sleep(1500);
        const holds = await overpassHoldsEcuador(endpoint);
        if (holds !== "yes") {
          record({ probe, url: endpoint, status: response.status, bytes: body.length, note: `empty, and the instance ${holds === "no" ? "does not hold" : "could not show it holds"} Ecuador; not believed` });
          await sleep(1000);
          continue;
        }
      }
      record({ probe, url: endpoint, status: response.status, bytes: body.length, note: `${elements.length} elements` });
      return { elements, endpoint };
    } catch (error) {
      record({ probe, url: endpoint, error: describeError(error) });
      await sleep(1500);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// 6. Minas San Francisco, by geometry
// ---------------------------------------------------------------------------------------------

/**
 * Where the repository already puts Minas San Francisco: the Wikidata coordinate PLAN.md §2.4
 * records for Q65196242. Used only when this run's own SPARQL query does not answer, so the phase
 * can still run; the report says which one it used.
 */
const MINAS_RECORDED: LatLon = { lat: -3.3221588, lon: -79.6016026 };

/**
 * How far to widen the box around that point. The scheme is a dam on the Jubones (La Unión),
 * a tunnel, and a powerhouse downstream in El Oro, and nobody here knows which end Wikidata's
 * point is. A quarter of a degree each way (~55 × 55 km) covers a headrace of any plausible
 * length in any direction and reaches Pucará, the Azuay canton on the dam side, while staying a
 * box Overpass answers in seconds. The Pucará check point is general knowledge, not repository
 * data, and is used only to say whether the box covers it — never to draw it.
 */
const JUBONES_PAD_DEG = 0.25;
const PUCARA_TOWN: LatLon = { lat: -3.17, lon: -79.47 };

const MINAS_SCHEME: SchemeIdentity = {
  qid: "Q65196242",
  aliases: ["minas san francisco", "minas de san francisco", "enerjubones", "la union"],
  operator: /celec|enerjubones/i,
};

/** Everything a hydro scheme is made of, plus anything carrying the scheme's name or QID, and the river. */
function jubonesQuery(bbox: Bbox): string {
  const b = overpassBbox(bbox);
  return `[out:json][timeout:50];
(
  nwr["waterway"~"^(dam|weir)$"](${b});
  nwr["man_made"~"^(dam|weir|intake|water_works)$"](${b});
  nwr["power"="plant"](${b});
  nwr["power"="generator"]["generator:source"="hydro"](${b});
  nwr["plant:source"="hydro"](${b});
  nwr["natural"="water"]["water"="reservoir"](${b});
  nwr["water"="reservoir"](${b});
  nwr["landuse"="reservoir"](${b});
  nwr["operator"~"celec|enerjubones",i]["power"!~"^(tower|pole|line|minor_line|cable|portal|insulator|switch|busbar|bay|transformer|terminal|catenary_mast)$"](${b});
  nwr["wikidata"="${MINAS_SCHEME.qid}"](${b});
  nwr["name"~"minas.{0,4}san francisco|enerjubones",i]["highway"!~"."]["place"!~"."](${b});
)->.c;
.c out center;
way["waterway"="river"]["name"~"jubones",i](${b});
out tags geom;`;
}

interface JubonesResult {
  anchor: LatLon & { source: string };
  bbox: Bbox;
  sizeKm: { widthKm: number; heightKm: number };
  coversPucara: boolean;
  answeredBy: string | null;
  riverWays: number;
  riverKm: number;
  anchorM: number | null;
  candidates: (RankedCandidate & { m: number | null })[];
}

let jubones: JubonesResult | null = null;

/**
 * Minas San Francisco has failed six runs, and the last one said why: Nominatim answered both
 * aliases with results and no name match, so the dam is either unnamed in OSM or named something
 * nobody here has guessed. A string search cannot find either. This asks for every structure a
 * hydro scheme is built from inside a wide box over the Jubones gorge, whatever it is called, and
 * ranks what comes back by what ties it to this scheme (a QID, a name, CELEC as operator), then by
 * what it is (the intake end first), then by whether it sits on the Jubones, then by distance.
 *
 * Nothing found here is seated in `basins.csv`: an unnamed dam on the right river is a candidate
 * until something in its tags or a second source says it is this one.
 */
async function probeJubones(anchor: LatLon & { source: string }, flush: () => void): Promise<void> {
  const bbox = bboxAround([anchor], JUBONES_PAD_DEG);
  jubones = {
    anchor,
    bbox,
    sizeKm: bboxSizeKm(bbox),
    coversPucara: bboxContains(bbox, PUCARA_TOWN),
    answeredBy: null,
    riverWays: 0,
    riverKm: 0,
    anchorM: null,
    candidates: [],
  };
  const answer = await askOverpass("jubones by geometry", jubonesQuery(bbox), 70_000);
  if (!answer) {
    flush();
    return;
  }
  const rivers = answer.elements.filter((e) => e.tags?.["waterway"] === "river" && e.geometry);
  const riverLines = rivers.map(geometryOf).filter((l) => l.length > 1);
  const candidates = answer.elements
    .filter((e) => !rivers.includes(e))
    .flatMap((e) => {
      const p = elementPoint(e);
      return p ? [{ id: `${e.type}/${e.id}`, tags: e.tags ?? {}, ...p }] : [];
    });
  const ranked = rankCandidates(candidates, anchor, MINAS_SCHEME, riverLines);
  jubones = {
    ...jubones,
    answeredBy: new URL(answer.endpoint).host,
    riverWays: rivers.length,
    riverKm: Math.round(riverLines.reduce((s, l) => s + lineKm(l), 0) * 10) / 10,
    candidates: ranked.map((c) => ({ ...c, m: null })),
  };
  flush();

  // Height tells the two ends of a scheme apart: the dam sits above the powerhouse by the gross head.
  await sleep(1000);
  const top = ranked.slice(0, 60);
  const heights = await probeElevation(
    [{ key: "jubones/anchor", ...anchor }, ...top.map((c) => ({ key: `jubones/${c.id}`, lat: c.lat, lon: c.lon }))],
    "elevation, Jubones candidates",
  );
  jubones = {
    ...jubones,
    anchorM: heights["jubones/anchor"] ?? null,
    candidates: jubones.candidates.map((c) => ({ ...c, m: heights[`jubones/${c.id}`] ?? null })),
  };
  flush();
}

// ---------------------------------------------------------------------------------------------
// 7. Delsitanisagua's intake lead
// ---------------------------------------------------------------------------------------------

/** The `waterway=dam` node with no QID that §2.4 calls the best intake candidate. */
const DELSITA_INTAKE_NODE = 2489320895;
/** The powerhouse, `wikidata=Q65196191`, confirmed by identity in run 35739164652. */
const DELSITA_POWERHOUSE_WAY = 690695824;
const DELSITA_SCHEME: SchemeIdentity = { qid: "Q65196191", aliases: ["delsitanisagua", "delsi tanisagua"], operator: /celec|gensur/i };

interface DelsitaConduit {
  id: string;
  what: string;
  lengthKm: number;
  kmFromIntake: number;
  kmFromPowerhouse: number;
}

interface DelsitaResult {
  intake: (LatLon & { tags: Tags; ties: string[] }) | null;
  powerhouse: { tags: Tags; centre: LatLon; geometry: LatLon[] } | null;
  /** Ways that carry the intake node: the river it dams, or the dam's own line. */
  carriedBy: { id: string; what: string; name: string }[];
  conduits: DelsitaConduit[];
  structures: { id: string; name: string; what: string; kmFromIntake: number; kmFromPowerhouse: number }[];
  chain: { path: string[]; fromStart: string[]; toTarget: string[] } | null;
  heights: { intake: number | null; powerhouse: number | null; wikidata: number | null };
  answered: string;
}

let delsita: DelsitaResult | null = null;

/** Tags that say what a conduit is, in the order they answer it. */
const CONDUIT_TAGS = ["waterway", "man_made", "usage", "tunnel", "substance", "name", "operator", "location", "layer"];
const conduitOf = (tags: Tags): string =>
  CONDUIT_TAGS.filter((k) => tags[k])
    .map((k) => `${k}=${tags[k]}`)
    .join(", ") || "no tags";

/**
 * node/2489320895 is still only a lead: a `waterway=dam` upstream of the Delsitanisagua powerhouse
 * and about 500 m above it, with no QID, no operator, and a name that is also a place. What would
 * tie it to this scheme is the water's route — a headrace canal, a tunnel, a penstock — running
 * from it to the machines. This fetches the node's own tags and the ways it sits on, the
 * powerhouse's outline, and every conduit in a box over both, then asks whether a chain of mapped
 * conduits connects one to the other. A chain is the tie; no chain is not a denial, since a
 * headrace tunnel is the part of a scheme OSM most often leaves unmapped, and the report says
 * which end of the chain is bare.
 */
async function probeDelsitanisagua(wikidataPoint: LatLon | null, flush: () => void): Promise<void> {
  delsita = { intake: null, powerhouse: null, carriedBy: [], conduits: [], structures: [], chain: null, heights: { intake: null, powerhouse: null, wikidata: null }, answered: "not answered" };
  const byId = `[out:json][timeout:25];
node(${DELSITA_INTAKE_NODE});
out;
way(bn);
out geom;
way(${DELSITA_POWERHOUSE_WAY});
out geom;`;
  const first = await askOverpass("delsitanisagua intake and powerhouse", byId, 45_000);
  if (!first) {
    flush();
    return;
  }
  const node = first.elements.find((e) => e.type === "node" && e.id === DELSITA_INTAKE_NODE);
  const house = first.elements.find((e) => e.type === "way" && e.id === DELSITA_POWERHOUSE_WAY);
  const carriers = first.elements.filter((e) => e.type === "way" && e.id !== DELSITA_POWERHOUSE_WAY);
  const intakePoint = node ? elementPoint(node) : null;
  const houseLine = house ? geometryOf(house) : [];
  const houseCentre = house ? elementPoint(house) : null;
  delsita = {
    ...delsita,
    answered: new URL(first.endpoint).host,
    intake: node && intakePoint ? { ...intakePoint, tags: node.tags ?? {}, ties: tieEvidence(node.tags ?? {}, DELSITA_SCHEME) } : null,
    powerhouse: house && houseCentre ? { tags: house.tags ?? {}, centre: houseCentre, geometry: houseLine } : null,
    carriedBy: carriers.map((w) => ({ id: `way/${w.id}`, what: conduitOf(w.tags ?? {}), name: w.tags?.["name"] ?? "" })),
  };
  flush();
  if (!intakePoint || !houseCentre) return;

  await sleep(1500);
  const bbox = overpassBbox(bboxAround([intakePoint, houseCentre], 0.02));
  const between = `[out:json][timeout:40];
(
  way["waterway"~"^(canal|pressurised|tunnel|penstock|dam|weir)$"](${bbox});
  way["man_made"="pipeline"](${bbox});
  way["usage"~"penstock|headrace|tailrace"](${bbox});
  way["tunnel"]["waterway"](${bbox});
);
out geom;
(
  node["man_made"~"^(intake|water_works|surge_tank|adit|pipeline_valve)$"](${bbox});
  node["waterway"~"^(dam|weir)$"](${bbox});
  nwr["power"~"^(plant|generator|substation)$"](${bbox});
);
out center;`;
  const second = await askOverpass("delsitanisagua conduits", between, 55_000);
  if (second) {
    const target = houseLine.length ? houseLine : [houseCentre];
    const ways: WayGeom[] = second.elements
      .filter((e) => e.type === "way" && e.geometry && e.id !== DELSITA_POWERHOUSE_WAY)
      .map((e) => ({ id: `way/${e.id}`, tags: e.tags ?? {}, nodes: e.nodes ?? [], geometry: geometryOf(e) }))
      .filter((w) => w.geometry.length > 1);
    delsita = {
      ...delsita,
      conduits: ways
        .map((w) => ({
          id: w.id,
          what: conduitOf(w.tags),
          lengthKm: lineKm(w.geometry),
          kmFromIntake: kmToLine(intakePoint, w.geometry),
          kmFromPowerhouse: Math.round(kmBetweenLines(w.geometry, target) * 1000) / 1000,
        }))
        .sort((a, b) => a.kmFromIntake - b.kmFromIntake),
      structures: second.elements
        .filter((e) => !(e.type === "way" && e.geometry))
        .flatMap((e) => {
          const p = elementPoint(e);
          return p
            ? [{ id: `${e.type}/${e.id}`, name: e.tags?.["name"] ?? "", what: structureOf(e.tags ?? {}), kmFromIntake: kmApart(intakePoint, p), kmFromPowerhouse: kmApart(houseCentre, p) }]
            : [];
        })
        .sort((a, b) => a.kmFromIntake - b.kmFromIntake),
      chain: traceChain(ways, { ...intakePoint, nodeId: DELSITA_INTAKE_NODE }, target, 0.1),
    };
    flush();
  }

  await sleep(1000);
  const heights = await probeElevation(
    [
      { key: "delsita/intake", ...intakePoint },
      { key: "delsita/powerhouse", ...houseCentre },
      ...(wikidataPoint ? [{ key: "delsita/wikidata", ...wikidataPoint }] : []),
    ],
    "elevation, Delsitanisagua intake lead",
  );
  delsita = { ...delsita, heights: { intake: heights["delsita/intake"] ?? null, powerhouse: heights["delsita/powerhouse"] ?? null, wikidata: heights["delsita/wikidata"] ?? null } };
  flush();
}

// ---------------------------------------------------------------------------------------------
// 8. Official hydrographic units
// ---------------------------------------------------------------------------------------------

/**
 * Where Ecuador's own Pfafstetter units might be served, and why each is on the list.
 *
 * The sandbox this was written in reaches no host but GitHub, so none of these has been opened
 * from here. Each `origin` says where the URL came from: a web search run on 2026-09-22 while this
 * phase was written (the URL or its host appeared in the results), or a guess from a convention
 * (GeoServer's `/geoserver/ows`, GeoNode's `/api/v2/`), in which case a 404 or a DNS failure is the
 * expected answer and still worth having. The directories are the most valuable entries: they are
 * the agencies' own lists of what they serve, so the services harvested from them are found rather
 * than guessed, and the list stays current without editing this file.
 */
interface OfficialSource {
  label: string;
  url: string;
  kind: "directory" | "ogc" | "geonode" | "ckan" | "document";
  origin: string;
}

const OFFICIAL_SOURCES: OfficialSource[] = [
  // Directories: harvested for service URLs.
  { label: "SNI geoservicios directory", kind: "directory", url: "https://sni.gob.ec/geoservicios-ecuador", origin: "web search 2026-09-22: SNI's list of national geoservices by institution" },
  { label: "IEDG service list (SNI)", kind: "directory", url: "https://iedg.sni.gob.ec/geoportal-iedg/servicios.html", origin: "web search 2026-09-22: IEDG list of geographic web services with URL, by institution" },
  { label: "SNI coberturas (downloads)", kind: "directory", url: "https://sni.gob.ec/coberturas", origin: "web search 2026-09-22: SNI 'Archivos de Información Geográfica', reported to carry unidades hidrográficas nivel 5, 1:50.000, 2014" },
  { label: "MAG list of other institutions' services", kind: "directory", url: "http://geoportal.agricultura.gob.ec/geoservicios/otras_instituciones.html", origin: "web search 2026-09-22: MAG geoportal's page of other institutions' geoservices" },
  { label: "IGM geoservicios page", kind: "directory", url: "https://www.geoportaligm.gob.ec/portal/index.php/geoservicios/", origin: "web search 2026-09-22: IGM geoportal's geoservices page" },
  { label: "ARCA GeoARCA announcement", kind: "directory", url: "https://www.regulacionagua.gob.ec/geoarca-tecnologia-e-informacion-para-fortalecer-la-gestion-del-agua-en-el-ecuador/", origin: "web search 2026-09-22: the water regulator's geoportal (GeoARCA); harvested for any service links" },
  // The method, as a citation, not a dataset.
  { label: "SNI Pfafstetter methodology (PDF)", kind: "document", url: "https://app.sni.gob.ec/sni-link/sni/PORTAL_SNI/PORTAL/IG/7_delimitacion_codificacion_metodologia_pfafstetter.pdf", origin: "web search 2026-09-22: 'delimitación y codificación de unidades hidrográficas del Ecuador'" },
  // OGC endpoints: WFS capabilities first, WMS if there is no WFS.
  { label: "MAATE mapainteractivo GeoServer", kind: "ogc", url: "http://mapainteractivo.ambiente.gob.ec/geoserver/ows", origin: "web search 2026-09-22: cited as MAE's WMS (cobertura vegetal) at mapainteractivo.ambiente.gob.ec:80/geoserver/wms" },
  { label: "MAATE ide GeoServer", kind: "ogc", url: "http://ide.ambiente.gob.ec/geoserver/ows", origin: "guess: GeoServer path on ide.ambiente.gob.ec, whose /mapainteractivo/ viewer appeared in the search" },
  { label: "SENAGUA geoportal GeoServer", kind: "ogc", url: "https://geoportal.agua.gob.ec/geoserver/ows", origin: "guess: the former Secretaría del Agua host; no search result names it, so a DNS failure here is itself the answer" },
  { label: "MAG geoportal GeoServer", kind: "ogc", url: "http://geoportal.agricultura.gob.ec/geoserver/ows", origin: "web search 2026-09-22 shows MAG publishes OGC services; the /geoserver/ows path is GeoServer's convention" },
  { label: "IGM GeoServer", kind: "ogc", url: "https://www.geoportaligm.gob.ec/geoserver/ows", origin: "web search 2026-09-22: www.geoportaligm.gob.ec/geoserver/wms?request=GetCapabilities" },
  { label: "IGM 1:250.000 base cartography", kind: "ogc", url: "https://www.geoportaligm.gob.ec/regional/wms", origin: "web search 2026-09-22: 'WMS Ecuador Cartografia Base escala 1:250.000'" },
  { label: "IGM 1:1.000.000 base cartography", kind: "ogc", url: "https://www.geoportaligm.gob.ec/nacional/wms", origin: "web search 2026-09-22: 'WMS Ecuador Cartografia Base escala 1:1'000.000'" },
  { label: "INAMHI GeoServer (GeoNode)", kind: "ogc", url: "https://geoservicios.inamhi.gob.ec/geoserver/ows", origin: "web search 2026-09-22: INAMHI's GeoNode node; a tile path names layer geonode:u95_el_coca" },
  { label: "IEDG GeoServer (SNI)", kind: "ogc", url: "https://iedg.sni.gob.ec/geoserver/ows", origin: "guess: GeoServer path on the IEDG host found by the search" },
  // Catalogues with an API.
  ...["hidrograf", "cuenca", "pfafstetter"].map(
    (term): OfficialSource => ({
      label: `INAMHI GeoNode search "${term}"`,
      kind: "geonode",
      url: `https://geoservicios.inamhi.gob.ec/api/v2/datasets?search=${term}&page_size=50`,
      origin: "guess: GeoNode 4's REST API on the INAMHI host the search found",
    }),
  ),
  {
    label: "datosabiertos.gob.ec CKAN 'pfafstetter'",
    kind: "ckan",
    url: "https://www.datosabiertos.gob.ec/api/3/action/package_search?q=pfafstetter&rows=20",
    origin: "web search 2026-09-22: the portal has a Pfafstetter tag; §2.5 records 403 to runners, so this is asked once as a control",
  },
];

/** A deadline for government hosts, shorter than the Overpass one: a hung GeoServer should cost 20 s, not 40. */
const OFFICIAL_DEADLINE_MS = 20_000;
/** The whole phase gets this long, and stops starting requests after it. The job's own limit is 20 minutes. */
const OFFICIAL_BUDGET_MS = 9 * 60_000;
/** How many directory-harvested services, and how many matching layers, the phase will spend requests on. */
const MAX_HARVESTED = 10;
const MAX_CONTAINMENT_LAYERS = 6;

interface OfficialRow {
  label: string;
  kind: string;
  origin: string;
  url: string;
  status: number | null;
  bytes: number | null;
  service: string;
  layers: number | null;
  matched: string[];
  note: string;
}

const officialRows: OfficialRow[] = [];

type OfficialLayer = ContainableLayer & { priority: number; source: string };

/** Key that treats `/geoserver/wms`, `/geoserver/wfs` and `/geoserver/ows` on one host as one service. */
const serviceKey = (url: string): string => {
  const u = new URL(url);
  return `${u.host}${u.pathname.replace(/\/(wms|wfs|ows)\/?$/i, "").replace(/\/+$/, "")}`.toLowerCase();
};

/**
 * Ecuador's official hydrographic units, asked for where they would be published.
 *
 * §2.4 closed the ArcGIS lead negatively: the one national-looking layer was a figure from a paper.
 * What is left is to ask the agencies themselves — MAATE (which absorbed SENAGUA), SNI (which
 * republishes agency layers), IGM (the base cartography), INAMHI (hydrology) — and the national
 * open-data catalogue. For each: whether it answers, whether its capabilities list a layer whose
 * name, title, abstract or keywords match /unidad(es)?.?hidrogr|pfafstetter|cuenca/i, and, for
 * each matching layer that can be queried, the same point-in-polygon test the probe runs on the
 * ArcGIS candidates, against the same seven pour points. A match is a lead to an official
 * dataset; a Pfafstetter code in the attributes that come back is the dataset.
 *
 * Read-only, one request a second, a 20 s deadline per request, a host that fails once is not
 * asked again, and the whole phase stops starting requests after nine minutes.
 */
async function probeOfficial(points: { key: string; lat: number; lon: number }[], flush: () => void): Promise<void> {
  const phaseEnd = Date.now() + OFFICIAL_BUDGET_MS;
  const stillTime = () => Date.now() < phaseEnd;
  const deadHosts = new Map<string, string>();
  const robotsAsked = new Set<string>();
  const layers: OfficialLayer[] = [];
  const ogcQueue: { label: string; url: string; origin: string }[] = OFFICIAL_SOURCES.filter((s) => s.kind === "ogc").map((s) => ({ ...s }));
  const arcgisQueue: { label: string; url: string; origin: string }[] = [];
  const downloads: HarvestedService[] = [];

  const row = (source: { label: string; url: string; origin: string }, kind: string, fields: Partial<OfficialRow>): void => {
    officialRows.push({ label: source.label, kind, origin: source.origin, url: source.url, status: null, bytes: null, service: "", layers: null, matched: [], note: "", ...fields });
  };

  /** One polite GET: robots first for a new host, a dead host skipped, one second after every request. */
  const fetchText = async (source: { label: string; url: string; origin: string }, kind: string, url = source.url, method = "GET"): Promise<{ status: number; body: string; type: string } | null> => {
    const host = new URL(url).host;
    if (!stillTime()) {
      row(source, kind, { url, note: "not asked: the phase's time budget was spent" });
      return null;
    }
    if (deadHosts.has(host)) {
      row(source, kind, { url, note: `not asked: ${host} did not answer earlier (${deadHosts.get(host)})` });
      return null;
    }
    if (!robotsAsked.has(host)) {
      robotsAsked.add(host);
      await probeRobots(`${new URL(url).protocol}//${host}`, OFFICIAL_DEADLINE_MS);
      await sleep(1000);
    }
    try {
      const response = await get(url, { method, headers: { accept: "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.5" } }, OFFICIAL_DEADLINE_MS);
      const body = method === "HEAD" ? "" : await response.text();
      return { status: response.status, body, type: response.headers.get("content-type") ?? "?" };
    } catch (error) {
      const why = describeError(error);
      deadHosts.set(host, why.slice(0, 80));
      row(source, kind, { url, note: `error: ${why}` });
      return null;
    } finally {
      await sleep(1000);
    }
  };

  // 1. The agencies' own lists of what they serve, and the one document that names the method.
  for (const source of OFFICIAL_SOURCES.filter((s) => s.kind === "directory" || s.kind === "document")) {
    if (source.kind === "document") {
      const r = await fetchText(source, "document", source.url, "HEAD");
      if (r) row(source, "document", { status: r.status, note: `type=${r.type}` });
      continue;
    }
    const r = await fetchText(source, "directory");
    if (!r) continue;
    if (r.status !== 200) {
      row(source, "directory", { status: r.status, bytes: r.body.length, note: `refused: ${r.body.slice(0, 120).replace(/\s+/g, " ")}` });
      continue;
    }
    const harvested = harvestServiceUrls(r.body, source.url);
    const relevant = harvested.filter(relevantService);
    for (const h of relevant) {
      const origin = `harvested from ${source.label}: “${h.context.slice(0, 90)}”`;
      if (h.kind === "ogc" && !ogcQueue.some((q) => serviceKey(q.url) === serviceKey(h.url)) && ogcQueue.length < OFFICIAL_SOURCES.filter((s) => s.kind === "ogc").length + MAX_HARVESTED) {
        ogcQueue.push({ label: `${new URL(h.url).host} (harvested)`, url: h.url, origin });
      } else if (h.kind === "arcgis" && !arcgisQueue.some((q) => q.url === h.url) && arcgisQueue.length < 4) {
        arcgisQueue.push({ label: `${new URL(h.url).host} (harvested)`, url: h.url.replace(/(MapServer|FeatureServer)\/.*$/i, "$1"), origin });
      } else if (h.kind === "download" && matchesLayerPattern(h.url, h.context)) {
        downloads.push(h);
      }
    }
    row(source, "directory", {
      status: r.status,
      bytes: r.body.length,
      note:
        `${harvested.length} service/download links, ${relevant.length} about water, environment or basins` +
        (relevant.length ? `: ${relevant.slice(0, 5).map((h) => `${h.kind} ${h.url.slice(0, 70)}`).join("; ")}` : ""),
    });
    flush();
  }

  // 2. Catalogues with an API.
  for (const source of OFFICIAL_SOURCES.filter((s) => s.kind === "geonode" || s.kind === "ckan")) {
    const r = await fetchText(source, source.kind);
    if (!r) continue;
    let note = r.body.slice(0, 120).replace(/\s+/g, " ");
    const matched: string[] = [];
    try {
      if (r.status === 200 && source.kind === "geonode") {
        const json = JSON.parse(r.body) as { total?: number; datasets?: { alternate?: string; title?: string; abstract?: string; subtype?: string }[] };
        const datasets = json.datasets ?? [];
        for (const d of datasets.filter((x) => x.alternate && matchesLayerPattern(x.alternate, x.title, x.abstract))) {
          matched.push(`${d.alternate} (${d.title ?? ""})`);
          const base = `${new URL(source.url).origin}/geoserver/ows`;
          if (!layers.some((l) => l.typeName === d.alternate)) {
            layers.push({ title: `INAMHI GeoNode ${d.title ?? d.alternate}`, kind: "wfs", url: base, typeName: d.alternate!, priority: layerPriority(d.alternate!, d.title), source: "official wfs" });
          }
        }
        note = `${json.total ?? datasets.length} datasets; titles: ${datasets.slice(0, 5).map((d) => d.title ?? d.alternate).join(" / ") || "none"}`;
      } else if (r.status === 200 && source.kind === "ckan") {
        const json = JSON.parse(r.body) as { result?: { count?: number; results?: { title: string; organization?: { title?: string }; resources?: { format?: string; url?: string; name?: string }[] }[] } };
        const results = json.result?.results ?? [];
        for (const p of results) {
          for (const res of p.resources ?? []) {
            if (!res.url) continue;
            matched.push(`${p.title.slice(0, 50)} [${res.format ?? "?"}] ${res.url.slice(0, 80)}`);
            for (const h of harvestServiceUrls(`<a href="${res.url}">${p.title}</a>`, source.url)) {
              if (h.kind === "ogc" && !ogcQueue.some((q) => serviceKey(q.url) === serviceKey(h.url))) ogcQueue.push({ label: `${new URL(h.url).host} (from CKAN)`, url: h.url, origin: `CKAN dataset "${p.title}"` });
              if (h.kind === "download") downloads.push({ ...h, context: p.title });
            }
          }
        }
        note = `${json.result?.count ?? results.length} datasets: ${results.slice(0, 4).map((p) => `${p.title.slice(0, 40)} (${p.organization?.title ?? "?"})`).join(" / ") || "none"}`;
      }
    } catch (error) {
      note = `unparseable: ${describeError(error)}`;
    }
    row(source, source.kind, { status: r.status, bytes: r.body.length, matched, note });
    flush();
  }

  // 3. OGC capabilities: WFS first, because a WFS layer can be tested here; WMS when there is no WFS.
  for (const source of ogcQueue) {
    let done = false;
    for (const service of ["WFS", "WMS"] as const) {
      if (done) break;
      const url = capabilitiesUrl(source.url, service);
      const r = await fetchText(source, `${service} capabilities`, url);
      if (!r) break; // the host is dead or time is up; WMS on the same host will not do better
      const caps = r.status === 200 ? parseCapabilities(r.body) : null;
      const matches = caps?.layers.filter((l) => l.matched) ?? [];
      row(source, `${service} capabilities`, {
        url,
        status: r.status,
        bytes: r.body.length,
        service: caps?.service ?? "",
        layers: caps ? caps.layers.length : null,
        matched: matches.map((l) => `${l.name}${l.title && l.title !== l.name ? ` (${l.title})` : ""}`),
        note: caps ? caps.error || (caps.layers.length ? `sample: ${caps.layers.slice(0, 4).map((l) => l.name).join(", ")}` : "") : r.body.slice(0, 100).replace(/\s+/g, " "),
      });
      if (caps && caps.service === service && caps.layers.length > 0) {
        done = true;
        for (const l of matches) {
          const base = new URL(url);
          base.search = "";
          if (!layers.some((x) => x.typeName === l.name && serviceKey(x.url) === serviceKey(base.toString()))) {
            layers.push({
              title: `${source.label}: ${l.title || l.name}`,
              kind: service === "WFS" ? "wfs" : "wms",
              url: base.toString(),
              typeName: l.name,
              priority: layerPriority(l.name, l.title),
              source: `official ${service.toLowerCase()}`,
            });
          }
        }
      }
      flush();
    }
  }

  // 4. ArcGIS Online, restricted to the agencies: their accounts, their tags, their names in the credits.
  const agol = "https://www.arcgis.com/sharing/rest";
  const items: ArcgisItem[] = [];
  const owners: string[] = [];
  for (const q of ["senagua", "maate", "secretaria del agua"]) {
    const source = { label: `ArcGIS Online users "${q}"`, url: `${agol}/community/users?f=json&num=10&q=${encodeURIComponent(q)}`, origin: "ArcGIS Online community search (public profiles), as §2.4's probe already uses for items" };
    const r = await fetchText(source, "arcgis users");
    if (!r) continue;
    if (r.status !== 200) {
      row(source, "arcgis users", { status: r.status, bytes: r.body.length, note: `refused: ${r.body.slice(0, 120).replace(/\s+/g, " ")}` });
      continue;
    }
    try {
      const json = JSON.parse(r.body) as { results?: { username: string; fullName?: string; orgId?: string }[]; error?: { message?: string } };
      const users = json.results ?? [];
      for (const u of users) if (!owners.includes(u.username) && owners.length < 4) owners.push(u.username);
      row(source, "arcgis users", { status: r.status, bytes: r.body.length, note: json.error?.message ?? (users.map((u) => `${u.username} (${u.fullName ?? ""})`).join("; ") || "no public users") });
    } catch (error) {
      row(source, "arcgis users", { status: r.status, note: `unparseable: ${describeError(error)}` });
    }
  }
  const itemQueries = [
    ...owners.map((o) => `owner:"${o}"`),
    'tags:"SENAGUA"',
    'tags:"MAATE"',
    'tags:"Secretaría del Agua"',
    '"unidades hidrográficas" (SENAGUA OR MAATE OR "Secretaría del Agua" OR "Ministerio del Ambiente")',
    "pfafstetter Ecuador",
  ];
  for (const q of itemQueries) {
    const source = { label: `ArcGIS Online items ${q.slice(0, 50)}`, url: `${agol}/search?f=json&num=25&q=${encodeURIComponent(q)}`, origin: "ArcGIS Online item search, restricted to agency owners/tags/credits" };
    const r = await fetchText(source, "arcgis search");
    if (!r) continue;
    if (r.status !== 200) {
      row(source, "arcgis search", { status: r.status, bytes: r.body.length, note: `refused: ${r.body.slice(0, 120).replace(/\s+/g, " ")}` });
      continue;
    }
    try {
      const json = JSON.parse(r.body) as { total?: number; results?: ArcgisItem[] };
      const results = json.results ?? [];
      items.push(...results);
      row(source, "arcgis search", {
        status: r.status,
        bytes: r.body.length,
        matched: results.filter((i) => matchesLayerPattern(i.title, i.snippet ?? "", ...(i.tags ?? []))).map((i) => `${i.title.slice(0, 50)} [${i.type}] (${i.owner})`),
        note: `${json.total ?? results.length} items; top: ${results.slice(0, 3).map((i) => `${i.title.slice(0, 36)} (${i.owner})`).join(" / ") || "none"}`,
      });
    } catch (error) {
      row(source, "arcgis search", { status: r.status, note: `unparseable: ${describeError(error)}` });
    }
  }
  for (const item of rankArcgisItems(items).slice(0, 5)) {
    arcgisQueue.push({
      label: `${item.title.slice(0, 40)} (${item.owner})`,
      url: item.url!,
      origin: item.agency.length ? `ArcGIS Online, agency tie: ${item.agency.join("; ")}` : "ArcGIS Online, NO agency tie (listed because its title matches)",
    });
  }
  for (const source of arcgisQueue) {
    const url = `${source.url.replace(/\/+$/, "")}?f=json`;
    const r = await fetchText(source, "arcgis service", url);
    if (!r) continue;
    if (r.status !== 200) {
      row(source, "arcgis service", { url, status: r.status, bytes: r.body.length, note: `refused: ${r.body.slice(0, 120).replace(/\s+/g, " ")}` });
      continue;
    }
    try {
      const json = JSON.parse(r.body) as { layers?: { id: number; name: string; geometryType?: string }[]; error?: { message?: string } };
      const all = json.layers ?? [];
      const matches = all.filter((l) => matchesLayerPattern(l.name) && (!l.geometryType || l.geometryType === "esriGeometryPolygon"));
      for (const l of matches) {
        layers.push({ title: `${source.label} — ${l.name}`, kind: "arcgis", url: `${source.url.replace(/\/+$/, "")}/${l.id}/query`, priority: layerPriority(l.name), source: "official arcgis" });
      }
      row(source, "arcgis service", { url, status: r.status, bytes: r.body.length, service: "ArcGIS REST", layers: all.length, matched: matches.map((l) => l.name), note: json.error?.message ?? "" });
    } catch (error) {
      row(source, "arcgis service", { url, status: r.status, note: `unparseable: ${describeError(error)}` });
    }
    flush();
  }

  // 5. Archives the directories link that name hydrographic units: size and whether it is really a zip.
  for (const d of downloads.slice(0, 3)) {
    if (!stillTime()) break;
    const bytes = await probeDownload(`official download ${new URL(d.url).host}`, d.url);
    boundaries.push({ source: "official download", title: d.context.slice(0, 90) || d.url, url: d.url, bytes, note: "archive linked from an agency page; not opened by this probe" });
    await sleep(1000);
  }

  // 6. The same point-in-polygon test as the ArcGIS candidates, on the best-named matching layers.
  const chosen = [...layers].sort((a, b) => b.priority - a.priority).slice(0, MAX_CONTAINMENT_LAYERS);
  for (const l of chosen) {
    boundaries.push({ source: l.source, title: l.title, url: l.kind === "arcgis" ? l.url : `${l.url} (${l.typeName})`, bytes: null, note: `matched ${LAYER_PATTERN_TEXT}; asked for containment below` });
  }
  if (layers.length > chosen.length) {
    record({ probe: "official layers", url: "", note: `${layers.length} matching layers, containment asked of the ${chosen.length} best-named: ${layers.slice(chosen.length).map((l) => l.typeName ?? l.title).join(", ").slice(0, 200)} not asked` });
  }
  flush();
  containment = [...containment, ...(await probeContains(points, chosen, "official", stillTime))];
  flush();
}

const LAYER_PATTERN_TEXT = "/unidad(es)?.?hidrogr|pfafstetter|cuenca/i";

/**
 * The structures between two claims, printed only for the sites that have two claims to reconcile.
 *
 * A site whose sources agree needs no such section, and an empty heading in a report is a question
 * nobody asked being mistaken for a question with no answer.
 */
function schemeSection(): string[] {
  const sites = Object.keys(schemes);
  if (sites.length === 0) return [];
  const lines: string[] = ["## What lies between two claims that disagree", ""];
  for (const site of sites) {
    const found = schemes[site] ?? [];
    lines.push(
      `**${site}** — every dam, weir, intake, penstock, powerhouse and named water body in a box`,
      "covering both candidate points, nearest to the Wikidata claim first. On a run-of-river scheme",
      "the intake and the machines sit at opposite ends of a headrace of roughly this length, so a",
      "chain of structures running between the two claims is the reading; two unrelated clusters is",
      "the other one.",
      "",
      "| element | name | what it is | km from Wikidata | km from OSM |",
      "|---|---|---|---|---|",
      ...(found.length
        ? found.slice(0, 30).map((e) => `| ${e.id} | ${e.name || "(unnamed)"} | ${e.what} | ${e.kmFromWikidata} | ${e.kmFromOsm} |`)
        : ["| — | nothing answered | — | — | — |"]),
      "",
    );
  }
  return lines;
}

/** A markdown table cell: pipes escaped, newlines flattened. */
const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\s+/g, " ");

/** The tags that say what a candidate is and whose it is; everything else is dropped from the table. */
const TIE_TAG_KEYS = /^(name(:\w+)?|alt_name|official_name|old_name|short_name|waterway|man_made|power|plant:.*|generator:.*|water|natural|landuse|reservoir_type|operator|owner|wikidata|wikipedia|start_date|ele|height|usage|tunnel)$/;
const tagText = (tags: Tags): string =>
  cell(
    Object.entries(tags)
      .filter(([k]) => TIE_TAG_KEYS.test(k))
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
      .slice(0, 220) || "no identifying tags",
  );

function jubonesSection(): string[] {
  if (!jubones) return [];
  const j = jubones;
  const tied = j.candidates.filter((c) => c.ties.length > 0);
  const lines = [
    "## Minas San Francisco, searched by geometry",
    "",
    `Anchor: ${j.anchor.lat}, ${j.anchor.lon} (${j.anchor.source})${j.anchorM !== null ? `, ${j.anchorM} m` : ""}. Box ${overpassBbox(j.bbox)} (S,W,N,E),`,
    `${j.sizeKm.widthKm} × ${j.sizeKm.heightKm} km, the anchor widened by ${JUBONES_PAD_DEG}° each way; it ${j.coversPucara ? "covers" : "does NOT cover"} Pucará town (~${PUCARA_TOWN.lat}, ${PUCARA_TOWN.lon}).`,
    j.answeredBy
      ? `Answered by ${j.answeredBy}: **${j.candidates.length} dam, weir, intake, reservoir, plant or CELEC-operated elements**, and ${j.riverWays} way${j.riverWays === 1 ? "" : "s"} of the Jubones river (${j.riverKm} km) to measure them against.`
      : "**No Overpass instance answered**, so nothing here says anything about the map.",
    "",
    "How to read it. Rows are ranked by what ties them to this scheme, then by what they are, then by",
    "whether they sit on the Jubones, then by distance from the anchor. **ties** lists the tags that name",
    `this scheme — \`wikidata=${MINAS_SCHEME.qid}\` is an identity, a name is a string, \`operator=CELEC…\` is a company that runs`,
    "other plants too — and is empty for most rows, which is the finding for those rows: a structure in",
    "the right gorge with nothing that says it is this one. **km to Jubones** ≤ 0.5 puts it on the river.",
    "**Δm** is its ground height minus the anchor's: the intake end of a scheme is higher than the",
    "powerhouse by the gross head, so a dam on the Jubones well above the anchor is the shape a La Unión",
    "dam upstream of a powerhouse anchor would have. Nothing here is seated in `basins.csv`.",
    "",
    `**${tied.length} candidate${tied.length === 1 ? "" : "s"} carr${tied.length === 1 ? "ies" : "y"} a tie to this scheme.**`,
    "",
    "| # | element | name | kind | ties | km from Wikidata | km to Jubones | m | Δm | tags |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...(j.candidates.length
      ? j.candidates
          .slice(0, 40)
          .map(
            (c, i) =>
              `| ${i + 1} | ${c.id} | ${cell(c.name || "(unnamed)")} | ${c.kind} | ${cell(c.ties.join("; ")) || "—"} | ${c.kmFromAnchor} | ${c.kmToRiver ?? "—"} | ` +
              `${c.m ?? "—"} | ${c.m !== null && j.anchorM !== null ? Math.round(c.m - j.anchorM) : "—"} | ${tagText(c.tags)} |`,
          )
      : ["| — | nothing answered | — | — | — | — | — | — | — | — |"]),
    ...(j.candidates.length > 40 ? ["", `${j.candidates.length - 40} further rows are in probe-basins.json.`] : []),
    "",
  ];
  return lines;
}

function delsitaSection(): string[] {
  if (!delsita) return [];
  const d = delsita;
  const chain = d.chain;
  const verdict = !chain
    ? "The conduit query was not answered, so there is no reading of the chain."
    : chain.path.length
      ? `**A chain of mapped conduits connects the intake lead to the powerhouse: ${chain.path.join(" → ")}.** That is the tie §2.4 asked for; check the conduits' tags below before relying on it.`
      : `**No chain of mapped conduits connects them.** ${chain.fromStart.length} way${chain.fromStart.length === 1 ? "" : "s"} touch the intake (${chain.fromStart.join(", ") || "none"}); ` +
        `${chain.toTarget.length} touch the powerhouse (${chain.toTarget.join(", ") || "none"}). A bare end is where the headrace is unmapped — likely a tunnel — and is not evidence against the lead.`;
  return [
    `## Delsitanisagua: does anything mapped tie node/${DELSITA_INTAKE_NODE} to the powerhouse?`,
    "",
    `Answered by: ${d.answered}.`,
    "",
    `- **Intake lead node/${DELSITA_INTAKE_NODE}**: ${d.intake ? `${d.intake.lat}, ${d.intake.lon}; tags: ${tagText(d.intake.tags)}; ties to the scheme: ${d.intake.ties.join("; ") || "none"}` : "not returned"}`,
    `- **Powerhouse way/${DELSITA_POWERHOUSE_WAY}**: ${d.powerhouse ? `centre ${d.powerhouse.centre.lat.toFixed(5)}, ${d.powerhouse.centre.lon.toFixed(5)}; tags: ${tagText(d.powerhouse.tags)}` : "not returned"}`,
    `- **Ways carrying the intake node**: ${
      !d.intake ? "not answered" : d.carriedBy.map((w) => `${w.id} ${w.name ? `"${w.name}" ` : ""}[${w.what}]`).join("; ") || "none (the node is not on any mapped way)"
    }`,
    `- **Heights**: intake ${d.heights.intake ?? "—"} m, powerhouse ${d.heights.powerhouse ?? "—"} m, Wikidata point ${d.heights.wikidata ?? "—"} m` +
      (d.heights.intake !== null && d.heights.powerhouse !== null ? ` — the intake is ${Math.round(d.heights.intake - d.heights.powerhouse)} m above the powerhouse` : ""),
    "",
    verdict,
    "",
    "Every conduit-like way (canal, pressurised waterway, tunnel, penstock, pipeline, dam or weir line) in a box over both,",
    "nearest the intake first. A way is linked to the next when they share a node or an end of one lies within 100 m of the other.",
    "",
    "| way | what it is | length km | km from intake | km from powerhouse | on the chain |",
    "|---|---|---|---|---|---|",
    ...(d.conduits.length
      ? d.conduits.slice(0, 30).map((c) => `| ${c.id} | ${cell(c.what)} | ${c.lengthKm} | ${c.kmFromIntake} | ${c.kmFromPowerhouse} | ${chain?.path.includes(c.id) ? "yes" : ""} |`)
      : ["| — | none mapped or not answered | — | — | — | — |"]),
    "",
    ...(d.structures.length
      ? [
          "Point structures and plants in the same box:",
          "",
          "| element | name | what it is | km from intake | km from powerhouse |",
          "|---|---|---|---|---|",
          ...d.structures.slice(0, 20).map((s) => `| ${s.id} | ${cell(s.name || "(unnamed)")} | ${cell(s.what)} | ${s.kmFromIntake} | ${s.kmFromPowerhouse} |`),
          "",
        ]
      : []),
  ];
}

function officialSection(): string[] {
  if (officialRows.length === 0) return [];
  const withMatches = officialRows.filter((r) => r.matched.length > 0);
  const answered = officialRows.filter((r) => r.status === 200);
  const officialContainment = containment.filter((c) => c.group === "official");
  const contained = officialContainment.filter((c) => c.note.startsWith("contained"));
  return [
    "## Official hydrographic units (SENAGUA / MAATE / SNI / IGM / INAMHI)",
    "",
    `**${answered.length} of ${officialRows.length} requests answered 200; ${withMatches.length} listed something matching ${LAYER_PATTERN_TEXT}; ` +
      `${contained.length} containment answer${contained.length === 1 ? "" : "s"} placed a pour point inside an official polygon.**`,
    "",
    "How to read it. Each row is one request. **origin** says why the URL was asked: a web search while this phase was",
    "written, a guess from a GeoServer or GeoNode convention (a 404 or a DNS error is then an expected answer), or a",
    "link harvested from an agency's own directory page. **layers** is how many named layers a capabilities document",
    "lists, and **matching** the ones whose name, title, abstract or keywords match the pattern. Matching layers go into",
    "the boundary candidates above and into the containment table below, where a WFS layer is asked for the features",
    "within ~55 m of each pour point and the containment is decided here from their geometry, a WMS-only layer is asked by",
    "GetFeatureInfo, and an ArcGIS layer by the same `/query` as before. `error: … (ENOTFOUND)` means the host does not",
    "exist; `(UND_ERR_CONNECT_TIMEOUT)` or a timeout means it refused this address, as `datosabiertos.gob.ec` does.",
    "",
    "| source | kind | status | bytes | service | layers | matching | note | origin |",
    "|---|---|---|---|---|---|---|---|---|",
    ...officialRows.map(
      (r) =>
        `| [${cell(r.label)}](${r.url}) | ${r.kind} | ${r.status ?? "—"} | ${bytesOf(r.bytes)} | ${r.service || "—"} | ${r.layers ?? "—"} | ` +
        `${cell(r.matched.slice(0, 8).join("; ")) || "—"}${r.matched.length > 8 ? ` (+${r.matched.length - 8})` : ""} | ${cell(r.note.slice(0, 220))} | ${cell(r.origin)} |`,
    ),
    "",
  ];
}

/** The report as it stands right now, from whatever has been answered so far. */
function buildReport(startedAt: string): { report: string; coordinates: unknown[] } {
  const coordinates = PLANTS.map((plant) => {
    const a = wikidataFound[plant.site] ?? null;
    const b = overpassFound[plant.site]?.hit ?? null;
    return {
      site: plant.site,
      basin: plant.basin,
      wikidata: a,
      osm: b,
      outcome: overpassFound[plant.site]?.outcome ?? "not asked",
      km_apart: a && b ? kmApart(a, b) : null,
      agrees: Boolean(a && b && b.byName && kmApart(a, b) <= 1),
      wikidata_m: elevations[`${plant.site}/wikidata`] ?? null,
      osm_m: elevations[`${plant.site}/osm`] ?? null,
    };
  });

  const verdict = boundaries.length
    ? [
        `**${boundaries.length} boundary candidate${boundaries.length === 1 ? "" : "s"}**, listed above, each one a dataset whose own`,
        "title or layer name says it is about drainage. The next run picks one, reads it inside the job,",
        "and writes the per-dam catchments; nothing in `basins.csv` changes until a delineation exists to",
        "put in it.",
      ].join(" ")
    : [
        "**No boundary source answered.** Until one does, `basins.csv` cannot hold a verified centroid or",
        "area, and the ERA5 climatology stays a single provisional point — that is the finding, not a gap",
        "to paper over.",
      ].join(" ");
  const agreed = coordinates.filter((c) => c.agrees).length;
  const unanswered = coordinates.filter((c) => c.outcome === "no answer").length;

  const finishedAt = nowUtc();
  const report = [
    "# Probe: what it would take to put real catchments in basins.csv",
    "",
    `Started ${startedAt}, finished ${finishedAt}. Read-only; nothing under data/ was touched.`,
    "",
    `Phases asked: ${phasesAsked.join(", ") || "none"}.${phasesSkipped.length ? ` **Skipped for time: ${phasesSkipped.join(", ")}.**` : ""}`,
    "",
    ...jubonesSection(),
    ...delsitaSection(),
    ...officialSection(),
    "## Boundary candidates found",
    "",
    "| source | dataset | bytes | note |",
    "|---|---|---|---|",
    ...(boundaries.length
      ? boundaries.map((b) => `| ${b.source} | [${b.title}](${b.url}) | ${bytesOf(b.bytes)} | ${b.note} |`)
      : ["| — | none | — | every route probed below refused or returned nothing about drainage |"]),
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
    "| site | basin | Wikidata | OSM | km apart | Wikidata m | OSM m | Δm | outcome | agrees |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...coordinates.map(
      (c) =>
        `| ${c.site} | ${c.basin} | ${c.wikidata ? `${c.wikidata.lat}, ${c.wikidata.lon} (${c.wikidata.id}, by ${c.wikidata.matchedBy})` : "—"} | ` +
        `${c.osm ? `${c.osm.lat}, ${c.osm.lon} (${c.osm.id}, ${c.osm.name}${c.osm.via === "nominatim" ? ", via nominatim" : ""})` : "—"} | ${c.km_apart ?? "—"} | ` +
        `${c.wikidata_m ?? "—"} | ${c.osm_m ?? "—"} | ${c.wikidata_m !== null && c.osm_m !== null ? Math.round(c.wikidata_m - c.osm_m) : "—"} | ${c.outcome} | ${c.agrees ? "yes" : "no"} |`,
    ),
    "",
    `**${agreed} of ${PLANTS.length} sites** have two sources that name the same dam within a kilometre. Only those`,
    "are pour points this repository may mark `verified`; a pair that disagrees by more than a sub-basin",
    "is two different places and must not be averaged into one.",
    "",
    "Read the outcome column before the blank cells, because they do not all mean the same thing.",
    "`match` is a named agreement. `nearest-only` matched on proximity alone, which is a lead rather",
    "than a confirmation. `empty box` is the only one that says something about OSM: nothing mapped",
    "within 13 km of where Wikidata puts the dam, and since the box is drawn around the Wikidata point,",
    "even that cannot rule on a dam OSM places somewhere else entirely — the country-wide query is the",
    "only way to settle that. `empty, unconfirmed` is an empty answer from an instance that could not",
    "then show it holds Ecuador — a regional mirror returns 200 and nothing for a box it has no data",
    "for, which reads exactly like an empty box, so those are discarded rather than believed. `no",
    `answer\` says nothing about OSM at all: every instance refused. **${unanswered} site${unanswered === 1 ? "" : "s"}** ended`,
    "that way this run.",
    "",
    "## What OSM says each matched point is",
    "",
    "A catchment is defined at the intake, so the structure behind a coordinate decides whether the",
    "coordinate may be used. A `wikidata=` tag here is the strongest reading available: it means OSM",
    "and Wikidata name one entity, so any distance between them is an error in one of them rather",
    "than the two ends of a scheme.",
    "",
    "| site | element | identifying tags |",
    "|---|---|---|",
    ...coordinates.map((c) => `| ${c.site} | ${c.osm ? `${c.osm.id} (${c.osm.name})` : "—"} | ${c.osm ? structureOf(c.osm.tags) : "not answered"} |`),
    "",
    ...schemeSection(),
    "## Which mapped unit contains each dam",
    "",
    containment.length
      ? [
          "Each candidate boundary layer, asked which of its polygons contains each pour point. A layer",
          "that contains none of them has answered the question too — most of these map one region of the",
          "country — and a layer that returns a Pfafstetter code has the nesting HydroSHEDS was wanted for.",
          "`lead` rows are the ArcGIS candidates §2.4 closed; `official` rows are the agency layers found above.",
        ].join(" ")
      : "No candidate layer was asked: none of this run's boundary candidates was a queryable feature layer.",
    "",
    ...(containment.length
      ? [
          "| group | site | layer | status | attributes | note |",
          "|---|---|---|---|---|---|",
          ...containment.map((r) => `| ${r.group} | ${r.site} | ${cell(r.layer.slice(0, 80))} | ${r.status ?? "—"} | ${cell(r.attributes) || "—"} | ${cell(r.note)} |`),
          "",
        ]
      : []),
  ].join("\n");

  return { report, coordinates };
}

/**
 * The Wikidata coordinates PLAN.md §2.4 records for the seven sites, used only when this run's own
 * SPARQL query does not answer, so that the phases which need a point still have one. Every use is
 * labelled in the report, so a recorded coordinate is never mistaken for a fresh answer.
 */
const RECORDED_POINTS: Record<string, LatLon> = {
  manduriacu: { lat: 0.21480556, lon: -78.91233333 },
  coca_codo_sinclair: { lat: -0.1979037, lon: -77.6849914 },
  marcel_laniado: { lat: -0.927, lon: -79.75 },
  agoyan: { lat: -1.39852778, lon: -78.37755556 },
  mazar: { lat: -2.5953091, lon: -78.6218378 },
  delsitanisagua: { lat: -4.04588889, lon: -78.98377778 },
  minas_san_francisco: MINAS_RECORDED,
};

/**
 * The job is killed at 20 minutes; no phase starts after this, so the last flush always happens.
 * The report names every phase skipped for time, so a short run cannot pass for a complete one.
 */
const RUN_BUDGET_MS = 17 * 60_000;

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf("--out");
  const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  const phasesIndex = process.argv.indexOf("--phases");
  const phases = parsePhases(phasesIndex >= 0 ? process.argv[phasesIndex + 1] : undefined);
  phasesAsked = PHASES.filter((p) => phases.has(p));
  const startedAt = nowUtc();
  const t0 = Date.now();

  /** Write what is known so far. Cheap, local, and the only thing a killed job leaves behind. */
  const flush = (): void => {
    if (!outDir) return;
    const { report, coordinates } = buildReport(startedAt);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "probe-basins.md"), `${report}\n`);
    writeFileSync(
      join(outDir, "probe-basins.json"),
      `${JSON.stringify({ startedAt, finishedAt: nowUtc(), phasesAsked, phasesSkipped, rows, boundaries, coordinates, jubones, delsitanisagua: delsita, official: officialRows, containment }, null, 1)}\n`,
    );
  };

  /** Run a phase if it was asked for and the clock allows; say so either way. */
  const phase = async (name: Phase, run: () => Promise<void>): Promise<void> => {
    if (!phases.has(name)) return;
    if (Date.now() - t0 > RUN_BUDGET_MS) {
      phasesSkipped.push(name);
      flush();
      return;
    }
    await run();
    flush();
  };

  /** A site's point from this run's SPARQL answer, or the recorded one, labelled either way. */
  const anchorOf = (site: string): (LatLon & { source: string }) | null => {
    const fresh = wikidataFound[site];
    if (fresh) return { lat: fresh.lat, lon: fresh.lon, source: `Wikidata ${fresh.id}, this run` };
    const recorded = RECORDED_POINTS[site];
    return recorded ? { ...recorded, source: "Wikidata point recorded in PLAN.md §2.4 (this run's SPARQL did not answer)" } : null;
  };
  const pourPoints = () =>
    PLANTS.flatMap((plant) => {
      const a = anchorOf(plant.site);
      return a ? [{ key: plant.site, lat: a.lat, lon: a.lon }] : [];
    });

  // The anchor every later phase measures from.
  await phase("wikidata", async () => {
    wikidataFound = await probeWikidata();
    await sleep(1000);
  });

  // The three open items first, so a run that runs out of time spends it on what is still unknown.
  await phase("jubones", async () => {
    await probeJubones(anchorOf("minas_san_francisco")!, flush);
    await sleep(1500);
  });
  await phase("delsitanisagua", async () => {
    await probeDelsitanisagua(anchorOf("delsitanisagua"), flush);
    await sleep(1500);
  });
  await phase("official", async () => {
    await probeOfficial(pourPoints(), flush);
    await sleep(1000);
  });

  // Is the 403 the address, the client or the path? Then: who else serves this data?
  await phase("hydrosheds", probeHydroshedsBlock);
  await phase("mirrors", probeMirrors);
  await phase("arcgis", probeArcgis);
  await phase("robots", async () => {
    for (const host of ["data.hydrosheds.org", "zenodo.org", "api.figshare.com", "www.arcgis.com", "query.wikidata.org", "overpass-api.de", "nominatim.openstreetmap.org"]) {
      await probeRobots(host);
      await sleep(1000);
    }
  });

  await phase("overpass", async () => {
    overpassFound = await probeOverpass(wikidataFound, flush);
    flush();

    // A second door into the same database, for the sites three Overpass instances would not open.
    for (const plant of PLANTS) {
      const anchor = wikidataFound[plant.site];
      const result = overpassFound[plant.site];
      if (!anchor || result?.hit) continue;
      await sleep(1500);
      const hit = await probeNominatim(plant, anchor);
      if (hit) overpassFound[plant.site] = { hit, outcome: `${result?.outcome ?? "no answer"} → nominatim match` };
      flush();
    }

    // Height at every point that has one, in a single request: the discriminator for the sites whose
    // two sources name a plant kilometres apart, and cheap enough to take for all of them.
    const points = PLANTS.flatMap((plant) => {
      const a = wikidataFound[plant.site];
      const b = overpassFound[plant.site]?.hit ?? null;
      return [
        ...(a ? [{ key: `${plant.site}/wikidata`, lat: a.lat, lon: a.lon }] : []),
        ...(b ? [{ key: `${plant.site}/osm`, lat: b.lat, lon: b.lon }] : []),
      ];
    });
    elevations = await probeElevation(points);
    flush();

    // Then the full chain, but only where there is a disagreement to explain.
    for (const plant of PLANTS) {
      const a = wikidataFound[plant.site];
      const b = overpassFound[plant.site]?.hit ?? null;
      if (!a || !b || kmApart(a, b) <= 1) continue;
      await sleep(1500);
      schemes[plant.site] = await probeScheme(plant.site, a, b);
      flush();
    }
  });

  // And the read the last run promised: which polygon of which ArcGIS lead contains each dam.
  await phase("contains", async () => {
    await sleep(1000);
    const leads = boundaries.filter((b) => b.source === "arcgis").map((b): ContainableLayer => ({ title: b.title, kind: "arcgis", url: b.url }));
    containment = [...containment, ...(await probeContains(pourPoints(), leads, "lead"))];
  });

  const { report } = buildReport(startedAt);
  console.log(report);
  flush();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
