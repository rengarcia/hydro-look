/**
 * The pure half of `scripts/probe-basins.ts`: everything that decides what a response *means*,
 * kept apart from the requests so it can be tested without a network, which the sandbox this
 * repository is developed in does not have.
 *
 * Nothing here fetches, and nothing here writes. The probe asks; these functions read the answers.
 */

/** Accents, case and punctuation folded away, so "Agoyán" and "Daule-Peripa" match plain text. */
export const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export interface LatLon {
  lat: number;
  lon: number;
}

/** Great-circle distance in km, rounded to 10 m, to say whether two sources describe one place. */
export function kmApart(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

// ---------------------------------------------------------------------------------------------
// Bounding boxes
// ---------------------------------------------------------------------------------------------

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * The envelope of every point given, widened by `padDeg` on each side.
 *
 * Built from points rather than from one centre because the question it serves has two ends: a
 * Wikidata coordinate that may be a powerhouse, and a dam that sits upstream of it by the length
 * of a headrace. A box centred on either end alone is the confirmation test §2.4 already warns
 * about; a box over both, padded, is a search.
 */
export function bboxAround(points: readonly LatLon[], padDeg: number): Bbox {
  if (points.length === 0) throw new Error("bboxAround needs at least one point");
  if (!(padDeg >= 0)) throw new Error(`padding must be a non-negative number of degrees, got ${padDeg}`);
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    south: round(Math.max(-90, Math.min(...lats) - padDeg)),
    west: round(Math.max(-180, Math.min(...lons) - padDeg)),
    north: round(Math.min(90, Math.max(...lats) + padDeg)),
    east: round(Math.min(180, Math.max(...lons) + padDeg)),
  };
}

/** Overpass order: south, west, north, east. */
export const overpassBbox = (b: Bbox): string => `${b.south},${b.west},${b.north},${b.east}`;

export const bboxContains = (b: Bbox, p: LatLon): boolean => p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;

/** Width and height of the box in km, measured across its middle, for the report. */
export function bboxSizeKm(b: Bbox): { widthKm: number; heightKm: number } {
  const midLat = (b.south + b.north) / 2;
  const midLon = (b.west + b.east) / 2;
  return {
    widthKm: kmApart({ lat: midLat, lon: b.west }, { lat: midLat, lon: b.east }),
    heightKm: kmApart({ lat: b.south, lon: midLon }, { lat: b.north, lon: midLon }),
  };
}

// ---------------------------------------------------------------------------------------------
// Geometry on a local plane
// ---------------------------------------------------------------------------------------------

/** km east and north of an origin; accurate to well under 1% over the tens of km these boxes span. */
function toPlane(origin: LatLon, p: LatLon): { x: number; y: number } {
  const kx = 111.32 * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (p.lon - origin.lon) * kx, y: (p.lat - origin.lat) * 110.57 };
}

/** Shortest distance from a point to a polyline, in km. `Infinity` for an empty line. */
export function kmToLine(p: LatLon, line: readonly LatLon[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return kmApart(p, line[0]!);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = toPlane(p, line[i - 1]!);
    const b = toPlane(p, line[i]!);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    const d = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (d < best) best = d;
  }
  return Math.round(best * 1000) / 1000;
}

/** Shortest distance between two polylines (or points, as one-vertex lines), in km. */
export function kmBetweenLines(a: readonly LatLon[], b: readonly LatLon[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  let best = Infinity;
  for (const p of a) best = Math.min(best, kmToLine(p, b));
  for (const p of b) best = Math.min(best, kmToLine(p, a));
  return best;
}

/** Length of a polyline in km. */
export function lineKm(line: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += kmApart(line[i - 1]!, line[i]!);
  return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------------------------------
// Point in polygon (GeoJSON, lon/lat)
// ---------------------------------------------------------------------------------------------

type Ring = readonly (readonly number[])[];

function inRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inPolygon = (rings: readonly Ring[], x: number, y: number): boolean =>
  rings.length > 0 && inRing(rings[0]!, x, y) && !rings.slice(1).some((hole) => inRing(hole, x, y));

export interface GeoJsonGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

/**
 * Whether a GeoJSON polygon geometry contains a point, holes respected.
 *
 * This is the client-side half of the containment test for services that cannot run one
 * themselves: a WFS is asked for the features whose box touches a tiny box around the dam, and
 * this decides which of them actually contains it, since a bounding-box hit is not containment.
 * Returns `null` for a geometry it cannot rule on — a line, a point, or coordinates that are
 * plainly not degrees (a server that ignored `srsName` and answered in UTM) — so that "no" is
 * never said about a question that was not answered.
 */
export function geometryContains(geometry: GeoJsonGeometry | null | undefined, lon: number, lat: number): boolean | null {
  if (!geometry) return null;
  if (geometry.type === "GeometryCollection") {
    const verdicts = (geometry.geometries ?? []).map((g) => geometryContains(g, lon, lat));
    if (verdicts.includes(true)) return true;
    return verdicts.includes(false) ? false : null;
  }
  const polygons: Ring[][] =
    geometry.type === "Polygon" ? [geometry.coordinates as Ring[]] : geometry.type === "MultiPolygon" ? (geometry.coordinates as Ring[][]) : [];
  if (polygons.length === 0) return null;
  const degrees = polygons.every((rings) => rings.every((ring) => ring.every((c) => Math.abs(Number(c[0])) <= 180 && Math.abs(Number(c[1])) <= 90)));
  if (!degrees) return null;
  return polygons.some((rings) => inPolygon(rings, lon, lat));
}

// ---------------------------------------------------------------------------------------------
// OSM candidates for a scheme
// ---------------------------------------------------------------------------------------------

export type Tags = Record<string, string>;

/** Which part of a hydro scheme an element is, as far as its tags say. */
export type StructureKind = "dam" | "weir" | "intake" | "reservoir" | "plant" | "generator" | "water_works" | "conduit" | "other";

/**
 * Most catchment-relevant first. A catchment is defined where the river is taken, so a dam, weir
 * or intake outranks the reservoir it creates, which outranks the machines downstream.
 */
export const KIND_ORDER: readonly StructureKind[] = ["dam", "weir", "intake", "reservoir", "water_works", "plant", "generator", "conduit", "other"];

export function structureKind(tags: Tags): StructureKind {
  if (tags["waterway"] === "dam" || tags["man_made"] === "dam") return "dam";
  if (tags["waterway"] === "weir" || tags["man_made"] === "weir") return "weir";
  if (tags["man_made"] === "intake" || tags["water_works"] === "intake" || /\b(intake|captacion|toma|bocatoma)\b/.test(fold(tags["name"] ?? ""))) return "intake";
  if (tags["water"] === "reservoir" || tags["landuse"] === "reservoir" || tags["natural"] === "reservoir") return "reservoir";
  if (tags["man_made"] === "water_works") return "water_works";
  if (tags["power"] === "plant") return "plant";
  if (tags["power"] === "generator") return "generator";
  if (/^(canal|pressurised|tunnel|penstock)$/.test(tags["waterway"] ?? "") || tags["man_made"] === "pipeline") return "conduit";
  return "other";
}

export interface SchemeIdentity {
  /** The QID the SPARQL query returned for the plant. */
  qid: string;
  /** Names the scheme or its structures are known by, compared folded. */
  aliases: readonly string[];
  /** Who runs it; matched against `operator` and `owner`. */
  operator: RegExp;
}

/** Every name-bearing tag OSM uses, since a dam mapped under `alt_name` is still this dam. */
const NAME_KEYS = ["name", "name:es", "name:en", "alt_name", "official_name", "old_name", "short_name", "loc_name", "reg_name"];

/**
 * What in an element's own tags ties it to one scheme, as a list of reasons.
 *
 * An empty list is the finding for most elements, and it is reported as such: a dam in the right
 * gorge with no name, no operator and no QID is a candidate, not an identification. The reasons
 * are kept separate rather than summed into a score because they are not the same kind of
 * evidence — a `wikidata` tag is an identity, a name is a string, and an operator is a company
 * that runs more than one plant.
 */
export function tieEvidence(tags: Tags, scheme: SchemeIdentity): string[] {
  const reasons: string[] = [];
  for (const key of ["wikidata", "operator:wikidata", "subject:wikidata", "owner:wikidata"]) {
    if (tags[key] && tags[key].split(";").map((s) => s.trim()).includes(scheme.qid)) reasons.push(`${key}=${scheme.qid}`);
  }
  for (const key of NAME_KEYS) {
    const value = tags[key];
    if (value && scheme.aliases.some((a) => fold(value).includes(fold(a)))) reasons.push(`${key}="${value}"`);
  }
  for (const key of ["operator", "owner"]) {
    const value = tags[key];
    if (value && scheme.operator.test(value)) reasons.push(`${key}="${value}"`);
  }
  return reasons;
}

/** Tie strength: an identity outranks a name, which outranks an operator. */
export function tieStrength(reasons: readonly string[]): number {
  if (reasons.some((r) => r.includes("wikidata="))) return 3;
  if (reasons.some((r) => !/^(operator|owner)=/.test(r))) return 2;
  return reasons.length > 0 ? 1 : 0;
}

export interface Candidate extends LatLon {
  id: string;
  tags: Tags;
}

export interface RankedCandidate extends Candidate {
  name: string;
  kind: StructureKind;
  ties: string[];
  kmFromAnchor: number;
  /** Distance to the named river, when the river came back; `null` when it did not. */
  kmToRiver: number | null;
}

/**
 * Candidates in the order a reader should look at them: named or identified as this scheme first,
 * then by what they are (the intake end first), then operator-tied before untied, then on the
 * river before off it, then by distance from the anchor.
 *
 * An operator tie ranks below the kind of structure, not above it, because CELEC runs substations,
 * offices and other plants in the same valley: a CELEC building must not bury an unnamed dam on
 * the Jubones. The river test is a band rather than a distance because a dam axis mapped across
 * the channel and a weir node mapped on the bank are both "on the river", and ranking them by
 * metres would be ranking mapping style.
 */
export function rankCandidates(candidates: readonly Candidate[], anchor: LatLon, scheme: SchemeIdentity, river: readonly (readonly LatLon[])[] = [], onRiverKm = 0.5): RankedCandidate[] {
  const ranked = candidates.map((c) => {
    const ties = tieEvidence(c.tags, scheme);
    const kmToRiver = river.length ? Math.min(...river.map((line) => kmToLine(c, line))) : null;
    return { ...c, name: c.tags["name"] ?? "", kind: structureKind(c.tags), ties, kmFromAnchor: kmApart(anchor, c), kmToRiver };
  });
  const onRiver = (c: RankedCandidate) => (c.kmToRiver !== null && c.kmToRiver <= onRiverKm ? 1 : 0);
  const named = (c: RankedCandidate) => (tieStrength(c.ties) >= 2 ? tieStrength(c.ties) : 0);
  return ranked.sort(
    (a, b) =>
      named(b) - named(a) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      Math.min(tieStrength(b.ties), 1) - Math.min(tieStrength(a.ties), 1) ||
      onRiver(b) - onRiver(a) ||
      a.kmFromAnchor - b.kmFromAnchor,
  );
}

// ---------------------------------------------------------------------------------------------
// Tracing a scheme's conduits
// ---------------------------------------------------------------------------------------------

export interface WayGeom {
  id: string;
  tags: Tags;
  nodes: readonly number[];
  geometry: readonly LatLon[];
}

export interface ChainResult {
  /** Ways from the one nearest the start to the one reaching the target, or empty if none does. */
  path: string[];
  /** Ways that touch the start at all, whether or not a path went on from them. */
  fromStart: string[];
  /** Ways that touch the target at all. */
  toTarget: string[];
}

/**
 * Is there a chain of mapped conduits from an intake to a powerhouse?
 *
 * Two ways are linked when they share a node, or when an end of one lies within `tolKm` of the
 * other — mappers do not always join a tunnel portal to the penstock that continues it, and a
 * gap of a few metres is a drawing habit, not a break in the scheme. The start is a point (the
 * intake node) and the target a shape (the powerhouse outline); a way "touches" either when it
 * comes within `tolKm`, or when it carries the start node. Breadth-first, so the chain reported is
 * the one with fewest links.
 *
 * A path is the tie §2.4 asks for: water taken at this dam and delivered to these machines. No
 * path is not a denial — tunnels are often unmapped — and the report says which end is bare.
 */
export function traceChain(ways: readonly WayGeom[], start: LatLon & { nodeId?: number }, target: readonly LatLon[], tolKm = 0.1): ChainResult {
  const touchesStart = (w: WayGeom) => (start.nodeId !== undefined && w.nodes.includes(start.nodeId)) || kmToLine(start, w.geometry) <= tolKm;
  const touchesTarget = (w: WayGeom) => kmBetweenLines(w.geometry, target) <= tolKm;
  const ends = (w: WayGeom) => [w.geometry[0], w.geometry[w.geometry.length - 1]].filter((p): p is LatLon => p !== undefined);
  const linked = (a: WayGeom, b: WayGeom) =>
    a.nodes.some((n) => b.nodes.includes(n)) || ends(a).some((p) => kmToLine(p, b.geometry) <= tolKm) || ends(b).some((p) => kmToLine(p, a.geometry) <= tolKm);

  const fromStart = ways.filter(touchesStart).map((w) => w.id);
  const toTarget = ways.filter(touchesTarget).map((w) => w.id);
  const byId = new Map(ways.map((w) => [w.id, w]));
  const previous = new Map<string, string | null>(fromStart.map((id) => [id, null]));
  const queue = [...fromStart];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const way = byId.get(id)!;
    if (touchesTarget(way)) {
      const path: string[] = [];
      for (let at: string | null = id; at !== null; at = previous.get(at) ?? null) path.unshift(at);
      return { path, fromStart, toTarget };
    }
    for (const other of ways) {
      if (previous.has(other.id) || !linked(way, other)) continue;
      previous.set(other.id, id);
      queue.push(other.id);
    }
  }
  return { path: [], fromStart, toTarget };
}

// ---------------------------------------------------------------------------------------------
// Official services: capabilities documents, directories, catalogues
// ---------------------------------------------------------------------------------------------

/**
 * What a layer has to be called to be worth a containment test: a hydrographic unit, a
 * Pfafstetter coding, or a basin. Tested against the raw and the accent-folded text, so both
 * "Unidades Hidrográficas", "unidades_hidrograficas" and "UH_NIVEL5_PFAFSTETTER" match.
 */
export const LAYER_PATTERN = /unidad(es)?.?hidrogr|pfafstetter|pfastetter|cuenca/i;

export const matchesLayerPattern = (...texts: (string | undefined)[]): boolean =>
  texts.some((t) => t !== undefined && (LAYER_PATTERN.test(t) || LAYER_PATTERN.test(fold(t)) || LAYER_PATTERN.test(t.replace(/_/g, " "))));

export interface CapabilityLayer {
  name: string;
  title: string;
  abstract: string;
  keywords: string[];
  matched: boolean;
}

export interface Capabilities {
  service: "WMS" | "WFS" | "unknown";
  /** An OGC exception report, or a capabilities document with no layers at all. */
  error: string;
  layers: CapabilityLayer[];
}

const decodeXml = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

/** The text of the first `<tag>` (any namespace prefix) in a fragment, decoded. */
function firstText(fragment: string, tag: string): string {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "i").exec(fragment);
  return m ? decodeXml(m[1]!) : "";
}

function allText(fragment: string, tag: string): string[] {
  return [...fragment.matchAll(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "gi"))].map((m) => decodeXml(m[1]!));
}

/**
 * The named layers of a WMS or WFS GetCapabilities document, each marked for whether it looks
 * like a hydrographic unit.
 *
 * Deliberately a tolerant scan rather than an XML parse: capabilities documents from government
 * GeoServers arrive with namespace prefixes, nested `<Layer>` groups, CDATA and the occasional
 * malformed fragment, and a parser that rejects the whole document over one bad abstract would
 * report "no layers" for a server that has them. Each layer is read up to the next `<Layer>` or
 * `</Layer>`, whichever comes first, so a group's own name is never confused with its children's.
 * WMS groups without a `<Name>` cannot be requested and are left out.
 */
export function parseCapabilities(xml: string): Capabilities {
  const exception = /<(?:[\w-]+:)?(ServiceException|ExceptionText)\b[^>]*>([\s\S]*?)</i.exec(xml);
  const isWfs = /<(?:[\w-]+:)?WFS_Capabilities\b/i.test(xml);
  const isWms = /<(?:[\w-]+:)?(WMS_Capabilities|WMT_MS_Capabilities)\b/i.test(xml);
  const service = isWfs ? "WFS" : isWms ? "WMS" : "unknown";
  const layers: CapabilityLayer[] = [];
  const tag = isWfs ? "FeatureType" : "Layer";
  const open = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>`, "gi");
  const boundary = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>|</(?:[\\w-]+:)?${tag}>`, "i");
  for (const m of xml.matchAll(open)) {
    const rest = xml.slice(m.index! + m[0].length);
    const stop = boundary.exec(rest);
    const own = stop ? rest.slice(0, stop.index) : rest;
    const name = firstText(own, "Name");
    if (!name) continue;
    const title = firstText(own, "Title");
    const abstract = firstText(own, "Abstract");
    const keywords = allText(own, "Keyword");
    layers.push({ name, title, abstract, keywords, matched: matchesLayerPattern(name, title, abstract, ...keywords) });
  }
  const error = exception ? decodeXml(exception[2] ?? "").slice(0, 200) || exception[1]! : service === "unknown" ? "not a WMS or WFS capabilities document" : "";
  return { service, error, layers };
}

/**
 * The GetCapabilities URL for a service base, whatever form the base was found in.
 *
 * Directory pages list services every way there is — `/geoserver/wms`, `/geoserver/ows?service=WMS`,
 * a workspace path, a full GetCapabilities URL with the wrong version — so the query string is
 * rebuilt from the path rather than appended to. ArcGIS REST bases are returned with `?f=json`,
 * which is their capabilities.
 */
export function capabilitiesUrl(base: string, service: "WMS" | "WFS"): string {
  const url = new URL(base);
  if (/\/(MapServer|FeatureServer)\/?$/i.test(url.pathname) || /\/rest\/services/i.test(url.pathname)) {
    url.search = "";
    url.searchParams.set("f", "json");
    return url.toString();
  }
  const keep = [...url.searchParams.entries()].filter(([k]) => !/^(service|request|version|acceptversions)$/i.test(k));
  url.search = "";
  if (service === "WFS") url.pathname = url.pathname.replace(/\/wms\/?$/i, "/wfs");
  if (service === "WMS") url.pathname = url.pathname.replace(/\/wfs\/?$/i, "/wms");
  for (const [k, v] of keep) url.searchParams.set(k, v);
  url.searchParams.set("service", service);
  url.searchParams.set("request", "GetCapabilities");
  // 1.1.0 for WFS keeps FeatureType lists flat on every GeoServer version; 1.3.0 for WMS is the
  // current one and what these servers default to anyway.
  url.searchParams.set("version", service === "WFS" ? "1.1.0" : "1.3.0");
  return url.toString();
}

export interface HarvestedService {
  url: string;
  kind: "ogc" | "arcgis" | "download";
  /** The text around the link, for the report and for relevance. */
  context: string;
}

/**
 * Service and download URLs listed on a directory page — SNI's `geoservicios-ecuador`, the IEDG
 * service list, MAG's list of other institutions' services — with the text near each.
 *
 * These pages are the reason the official-sources phase does not have to guess every host: they
 * are the agencies' own list of what they serve. Links are read from `href`s and from bare URLs
 * in the text (several of these pages print the endpoint rather than linking it), resolved
 * against the page, and deduplicated. Only OGC services, ArcGIS REST services and archive
 * downloads are kept; the context is the surrounding text with tags stripped, which is what says
 * whether a given WMS is the water agency's or the tourism ministry's.
 */
export function harvestServiceUrls(html: string, pageUrl: string): HarvestedService[] {
  const out = new Map<string, HarvestedService>();
  const found: { raw: string; index: number }[] = [
    ...[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => ({ raw: m[1]!, index: m.index! })),
    ...[...html.matchAll(/https?:\/\/[^\s"'<>()]+/gi)].map((m) => ({ raw: m[0], index: m.index! })),
  ];
  for (const { raw, index } of found) {
    let url: URL;
    try {
      url = new URL(decodeXml(raw), pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    const full = url.toString();
    const kind: HarvestedService["kind"] | null = /\/(MapServer|FeatureServer)\b/i.test(url.pathname)
      ? "arcgis"
      : /\.(zip|rar|7z|gpkg|kmz)$/i.test(url.pathname)
        ? "download"
        : /\/(geoserver|ows|wms|wfs)\b|[?&]service=w[mf]s\b/i.test(full)
          ? "ogc"
          : null;
    if (!kind) continue;
    // Tiles and schemas are not services: a GeoWebCache TMS path or an XSD is a link, not a layer list.
    if (/\/gwc\/|\.xsd$|\/schemas\//i.test(url.pathname)) continue;
    const context = contextAt(html, index, raw.length);
    const key = kind === "ogc" ? `${url.origin}${url.pathname}`.replace(/\/+$/, "") : full;
    if (!out.has(key)) out.set(key, { url: full, kind, context });
  }
  return [...out.values()];
}

const stripTags = (s: string): string => decodeXml(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * The text that describes a link on a directory page: the nearest heading above it (these pages
 * group services by institution under headings) and the block the link sits in — its table row,
 * list item or paragraph. A fixed window of characters would do for one link and bleed into the
 * neighbouring institution's entry for the next, which is how a tourism WMS gets called a water one.
 */
function contextAt(html: string, index: number, length: number): string {
  const before = html.slice(Math.max(0, index - 20_000), index);
  const headings = [...before.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  const heading = headings.length ? stripTags(headings[headings.length - 1]![1]!) : "";
  const starts = [...before.matchAll(/<(tr|li|p|div|h[1-6]|section|article|dt|dd)\b[^>]*>/gi)];
  const blockStart = starts.length ? starts[starts.length - 1]!.index! : Math.max(0, before.length - 300);
  const after = html.slice(index + length, index + length + 2000);
  const end = /<\/(tr|li|p|div|h[1-6]|section|article|dt|dd)>/i.exec(after);
  const block = stripTags(before.slice(blockStart) + html.slice(index, index + length) + after.slice(0, end ? end.index : 300));
  return (heading && !block.startsWith(heading) ? `${heading} — ${block}` : block).slice(0, 240);
}

/** Words that say a directory entry belongs to the water or environment agencies, or is about basins. */
const RELEVANT_CONTEXT = /agua|senagua|ambiente|maate|\bmae\b|inamhi|hidro|hídric|hidric|cuenca|pfafstetter|drenaje|arca\b|regulacionagua/i;

export const relevantService = (s: HarvestedService): boolean => RELEVANT_CONTEXT.test(s.context) || RELEVANT_CONTEXT.test(s.url) || matchesLayerPattern(s.context, s.url);

// ---------------------------------------------------------------------------------------------
// ArcGIS Online, restricted to the agencies
// ---------------------------------------------------------------------------------------------

/**
 * Who counts as the agency. Ecuador's water authority has been SENAGUA, the Secretaría del Agua,
 * then part of MAATE (Ministerio del Ambiente, Agua y Transición Ecológica); earlier material is
 * signed MAE. Matched against the owner, the tags, the credits and the snippet — never the title
 * alone, which is how a student's figure got mistaken for a national dataset last time.
 */
export const AGENCY_PATTERN = /senagua|secretar[ií]a\s+del\s+agua|maate|ministerio\s+del\s+ambiente|ambiente[\s_-]*agua|\bmae\b|mae[\s_-]?ec|inamhi|\bigm\b|instituto\s+geogr[aá]fico\s+militar/i;

export interface ArcgisItem {
  id?: string;
  title: string;
  type: string;
  owner: string;
  url?: string | null;
  tags?: string[];
  accessInformation?: string | null;
  snippet?: string | null;
}

export interface ArcgisVerdict {
  agency: string[];
  hydro: boolean;
}

/** Why an ArcGIS item might be official, and whether it is about hydrographic units at all. */
export function judgeArcgisItem(item: ArcgisItem): ArcgisVerdict {
  const fields: [string, string][] = [
    ["owner", item.owner],
    ["tags", (item.tags ?? []).join(", ")],
    ["credits", item.accessInformation ?? ""],
    ["snippet", item.snippet ?? ""],
  ];
  const agency = fields.filter(([, v]) => AGENCY_PATTERN.test(v) || AGENCY_PATTERN.test(fold(v))).map(([k, v]) => `${k}: ${v.slice(0, 60)}`);
  return { agency, hydro: matchesLayerPattern(item.title, item.snippet ?? "", ...(item.tags ?? [])) };
}

/**
 * Which items to open: services only (a layer list is what gets asked), agency-attributed ones
 * first, and among those the ones that are about hydrographic units. An item with no agency tie
 * is still kept below the others when it is about hydrographic units, because the point of the
 * report is to show what exists — but the report marks it, so it cannot be mistaken for official.
 */
export function rankArcgisItems(items: readonly ArcgisItem[]): (ArcgisItem & ArcgisVerdict)[] {
  const byUrl = new Map<string, ArcgisItem & ArcgisVerdict>();
  for (const item of items) {
    if (!item.url || !/(Feature|Map) Service/i.test(item.type)) continue;
    const judged = { ...item, ...judgeArcgisItem(item) };
    if (!judged.hydro && judged.agency.length === 0) continue;
    const seen = byUrl.get(item.url);
    if (!seen || judged.agency.length > seen.agency.length) byUrl.set(item.url, judged);
  }
  return [...byUrl.values()].sort((a, b) => Number(b.agency.length > 0) - Number(a.agency.length > 0) || Number(b.hydro) - Number(a.hydro));
}

/**
 * Among matching layers, which to spend a containment test on first: Pfafstetter and unit layers
 * before generic "cuenca" layers, finer levels (a higher `nivel`) before coarser ones, since the
 * question is the catchment above one dam.
 */
export function layerPriority(name: string, title = ""): number {
  const text = fold(`${name} ${title}`);
  let score = 0;
  if (/pfaf?stetter/.test(text)) score += 4;
  if (/unidad(es)? ?hidrogr/.test(text)) score += 3;
  if (/cuenca/.test(text)) score += 1;
  const level = /(?:nivel|niv|n|lev|level)\s*_?\s*([1-7])\b/.exec(text.replace(/_/g, " "));
  if (level) score += Number(level[1]) / 10;
  return score;
}

// ---------------------------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------------------------

/** In the order the probe runs them: the open items first, the settled re-checks after. */
export const PHASES = ["wikidata", "jubones", "delsitanisagua", "official", "hydrosheds", "mirrors", "arcgis", "robots", "overpass", "contains"] as const;
export type Phase = (typeof PHASES)[number];

/**
 * `--phases jubones,official` → those phases, plus `wikidata` whenever a chosen phase needs an
 * anchor. Empty, missing or `all` means every phase. An unknown name is an error rather than a
 * silent skip, because a dispatch that runs nothing and reports nothing looks like a clean run.
 */
export function parsePhases(value: string | undefined): Set<Phase> {
  const raw = (value ?? "").trim();
  if (raw === "" || raw === "all") return new Set(PHASES);
  const chosen = raw.split(/[\s,]+/).filter(Boolean);
  const unknown = chosen.filter((p) => !(PHASES as readonly string[]).includes(p));
  if (unknown.length) throw new Error(`unknown phase${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}; known: ${PHASES.join(", ")}`);
  const set = new Set(chosen as Phase[]);
  if (["jubones", "delsitanisagua", "official", "overpass", "contains"].some((p) => set.has(p as Phase))) set.add("wikidata");
  return set;
}
