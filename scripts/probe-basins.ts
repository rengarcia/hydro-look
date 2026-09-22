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

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(DEADLINE_MS),
    ...init,
    headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) },
  });
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
async function probeElevation(points: { key: string; lat: number; lon: number }[]): Promise<Record<string, number | null>> {
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
      probe: "elevation (open-meteo)",
      url,
      status: response.status,
      bytes: body.length,
      note: values.length
        ? points.map((p, i) => `${p.key} ${values[i] ?? "?"}`).join("; ")
        : `no elevations returned: ${body.slice(0, 80).replace(/\s+/g, " ")}`,
    });
  } catch (error) {
    record({ probe: "elevation (open-meteo)", url, error: String(error) });
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
 */
async function probeContains(points: { key: string; lat: number; lon: number }[]): Promise<ContainmentRow[]> {
  const out: ContainmentRow[] = [];
  const layers = boundaries.filter((b) => b.source === "arcgis");
  for (const layer of layers) {
    for (const point of points) {
      const url = new URL(layer.url);
      url.searchParams.set("f", "json");
      url.searchParams.set("geometry", `${point.lon},${point.lat}`);
      url.searchParams.set("geometryType", "esriGeometryPoint");
      url.searchParams.set("inSR", "4326");
      url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
      url.searchParams.set("returnGeometry", "false");
      url.searchParams.set("outFields", "*");
      try {
        const response = await get(url.toString(), { headers: { accept: "application/json" } });
        const body = await response.text();
        const json = response.ok ? (JSON.parse(body) as { features?: { attributes?: Record<string, unknown> }[]; error?: { message?: string } }) : null;
        const feature = json?.features?.[0]?.attributes;
        out.push({
          site: point.key,
          layer: layer.title,
          url: url.toString(),
          status: response.status,
          attributes: feature
            ? Object.entries(feature)
                .filter(([k]) => !/^(OBJECTID|FID|GlobalID)/i.test(k))
                .map(([k, v]) => `${k}=${String(v)}`)
                .join(", ")
            : "",
          note: json?.error?.message ? `error: ${json.error.message}` : feature ? "contained" : "no polygon contains this point",
        });
      } catch (error) {
        out.push({ site: point.key, layer: layer.title, url: url.toString(), status: null, attributes: "", note: String(error) });
      }
      await sleep(1000);
    }
  }
  return out;
}

/** Great-circle distance, to say whether two sources describe the same dam or two places. */
function kmApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

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
        ].join(" ")
      : "No candidate layer was asked: none of this run's boundary candidates was a queryable feature layer.",
    "",
    ...(containment.length
      ? [
          "| site | layer | status | attributes | note |",
          "|---|---|---|---|---|",
          ...containment.map((r) => `| ${r.site} | ${r.layer.slice(0, 46)} | ${r.status ?? "—"} | ${r.attributes || "—"} | ${r.note} |`),
          "",
        ]
      : []),
  ].join("\n");

  return { report, coordinates };
}

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf("--out");
  const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  const startedAt = nowUtc();

  /** Write what is known so far. Cheap, local, and the only thing a killed job leaves behind. */
  const flush = (): void => {
    if (!outDir) return;
    const { report, coordinates } = buildReport(startedAt);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "probe-basins.md"), `${report}\n`);
    writeFileSync(join(outDir, "probe-basins.json"), `${JSON.stringify({ startedAt, finishedAt: nowUtc(), rows, boundaries, coordinates }, null, 1)}\n`);
  };

  // Is the 403 the address, the client or the path? Then: who else serves this data?
  await probeHydroshedsBlock();
  flush();
  await probeMirrors();
  flush();
  await probeArcgis();
  flush();

  for (const host of ["data.hydrosheds.org", "zenodo.org", "api.figshare.com", "www.arcgis.com", "query.wikidata.org", "overpass-api.de"]) {
    await probeRobots(host);
    await sleep(1000);
  }
  flush();

  wikidataFound = await probeWikidata();
  flush();
  await sleep(1000);
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

  // And the read the last run promised: which polygon of which candidate contains each dam.
  await sleep(1000);
  containment = await probeContains(
    PLANTS.flatMap((plant) => {
      const a = wikidataFound[plant.site];
      return a ? [{ key: plant.site, lat: a.lat, lon: a.lon }] : [];
    }),
  );

  const { report } = buildReport(startedAt);
  console.log(report);
  flush();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
