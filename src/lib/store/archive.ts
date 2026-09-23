/**
 * Raw response archive.
 *
 * Every response is kept verbatim so that a parser bug is a reprocessing job rather than a
 * re-scrape (and a re-scrape of 2016 may not be possible at all).
 *
 * Layout: plain NDJSON, one file per source-endpoint-day under monthly directories, keyed by
 * request inside the file:
 *
 *   data/raw/<source>/<YYYY>/<MM>/<endpoint>.<YYYY-MM-DD>.ndjson
 *   data/raw/<source>/<YYYY>/<MM>/<endpoint>.<YYYY-MM-DDTHHMMSSZ>.ndjson   (one per run)
 *
 * The day is the one the *data* belongs to, so a backfill of 2018 files under 2018/; live
 * endpoints file under the day they were fetched, and snapshots taken several times a day get a
 * file per run. The layout exists for git's sake. The archive used to be one gzip bundle per
 * source-month-endpoint, rewritten whole whenever a key was added; git cannot delta gzip
 * output, so every run stored a fresh full copy of every bundle it touched and the pack grew
 * with the square of the month. Here a file is written once and, at most, re-written when the
 * same day is fetched again — and because it is not compressed, git's own zlib and delta
 * compression see the text and store only what changed.
 *
 * Re-fetching a key replaces its record: the archive holds the latest copy of each response,
 * not a history of fetches. A failed answer is the exception: it is filed under a key of its
 * own, so an outage never overwrites the good response that earlier rows point at.
 *
 * `raw_ref` is `<path relative to data/raw>#<key>`. Refs written before the layout change name
 * a bundle (`<source>/<YYYY>/<MM>/<endpoint>.ndjson.gz#<key>`); `read` and `has` still accept
 * them, from the bundle while it exists and from the migrated day files after.
 */

import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { DATA_RAW } from "../util/paths.ts";
import { writeFileAtomic } from "./files.ts";

export interface ArchiveRecord {
  key: string;
  url: string;
  method: string;
  status: number;
  fetched_at: string;
  body: string;
}

/**
 * Which file a response is filed in: the day its data describes (`YYYY-MM-DD`), the day it was
 * fetched (`null`, for live endpoints), or a file of its own (`"run"`, for a snapshot taken
 * several times a day, which would otherwise rewrite one file all day).
 */
// `"run"` is one of the strings; it is spelt out in the comment, not the type, which would absorb it.
export type ArchiveSlot = string | null;

const LEGACY_SUFFIX = ".ndjson.gz";
const SUFFIX = ".ndjson";

/** Endpoints the pre-2026-09 layout bundled by month but which are now filed one run each. */
export const RUN_FILED_ENDPOINTS: ReadonlySet<string> = new Set(["cenace_operativa/InformacionOperativa"]);

/** Splits a `raw_ref` cell into its refs: XM rows name two answers, space-separated. */
export function splitRawRef(cell: string): string[] {
  return cell.split(/\s+/).filter(Boolean);
}

function parseRef(ref: string): { path: string; key: string } | null {
  const hash = ref.indexOf("#");
  if (hash <= 0) return null;
  return { path: ref.slice(0, hash), key: ref.slice(hash + 1) };
}

/** Relative paths always use `/`, whatever the platform, because they are stored in CSV. */
const toPosix = (path: string) => path.split(sep).join("/");

export function isLegacyRef(ref: string): boolean {
  return parseRef(ref)?.path.endsWith(LEGACY_SUFFIX) ?? false;
}

/** `2026-09-22T01:19:06Z` -> `2026-09-22T011906Z`: sortable, readable, and no colons. */
function runStamp(fetchedAt: string): string {
  return `${fetchedAt.slice(0, 10)}T${fetchedAt.slice(11, 19).replaceAll(":", "")}Z`;
}

/** The file (relative to the archive root) a response lands in. */
export function archiveFile(source: string, endpoint: string, slot: ArchiveSlot, fetchedAt: string): string {
  const day = slot === "run" || slot === null ? fetchedAt.slice(0, 10) : slot;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error(`archive: ${source}/${endpoint} needs a YYYY-MM-DD day, got ${JSON.stringify(day)}`);
  const stamp = slot === "run" ? runStamp(fetchedAt) : day;
  return `${source}/${day.slice(0, 4)}/${day.slice(5, 7)}/${endpoint}.${stamp}${SUFFIX}`;
}

/**
 * Where a record from a pre-2026-09 bundle belongs in the current layout. The bundle's name
 * gives the source, endpoint and month; the day comes from the record's key, which in every
 * endpoint names the date asked about — the first date in the key that falls inside the
 * bundle's month is the one the old layout filed it by. A key stamped with its own fetch time is
 * a live endpoint, filed by fetch day like the current code does. Nothing ever leaves its month
 * directory, which is what lets an old ref find its record after migration.
 */
export function legacyTarget(bundle: string, record: ArchiveRecord): string {
  const parts = toPosix(bundle).split("/");
  const [source, year, month, file] = parts.slice(-4) as [string, string, string, string];
  const endpoint = file.slice(0, -LEGACY_SUFFIX.length);
  const ym = `${year}-${month}`;
  if (RUN_FILED_ENDPOINTS.has(`${source}/${endpoint}`)) return archiveFile(source, endpoint, "run", record.fetched_at);
  let day: string | undefined;
  if (record.key.endsWith(`:${record.fetched_at}`) && record.fetched_at.startsWith(ym)) day = record.fetched_at.slice(0, 10);
  day ??= record.key.match(/\d{4}-\d{2}-\d{2}/g)?.find((d) => d.startsWith(ym));
  return archiveFile(source, endpoint, day ?? `${ym}-01`, record.fetched_at);
}

/** The key of one NDJSON line, read without parsing the (large) body behind it. */
function lineKey(line: string): string | undefined {
  const match = /^\{"key":("(?:[^"\\]|\\.)*")/.exec(line);
  return match ? (JSON.parse(match[1]!) as string) : undefined;
}

function readRecords(path: string): ArchiveRecord[] {
  const text = path.endsWith(LEGACY_SUFFIX) ? gunzipSync(readFileSync(path)).toString("utf8") : readFileSync(path, "utf8");
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ArchiveRecord);
}

export class RawArchive {
  /** Loaded files, by path relative to the root. */
  private readonly files = new Map<string, Map<string, ArchiveRecord>>();
  private readonly touched = new Set<string>();
  /** Keys per file, for `has` over thousands of refs without holding every body. */
  private readonly keyIndex = new Map<string, Set<string>>();
  private readonly listings = new Map<string, string[]>();

  constructor(readonly root: string = DATA_RAW) {}

  private file(rel: string): Map<string, ArchiveRecord> {
    let records = this.files.get(rel);
    if (records) return records;
    records = new Map();
    const path = join(this.root, rel);
    if (existsSync(path)) for (const record of readRecords(path)) records.set(record.key, record);
    this.files.set(rel, records);
    return records;
  }

  /** Files a record and returns the `raw_ref` to store alongside the rows parsed from it. */
  add(source: string, endpoint: string, slot: ArchiveSlot, record: ArchiveRecord): string {
    const rel = archiveFile(source, endpoint, slot, record.fetched_at);
    // A failed answer gets a key of its own, so it sits beside the good response for the same
    // request instead of replacing it: rows written from that response keep resolving.
    const key = record.status >= 200 && record.status < 300 ? record.key : `${record.key}~http${record.status}@${record.fetched_at}`;
    this.put(rel, { ...record, key });
    return `${rel}#${key}`;
  }

  /** Files a record at an explicit path; used when folding in a staged or legacy archive. */
  put(rel: string, record: ArchiveRecord): void {
    this.file(rel).set(record.key, record);
    this.keyIndex.get(rel)?.add(record.key);
    this.touched.add(rel);
  }

  /** Reads one archived response back by its `raw_ref`, for reprocessing without the network. */
  read(ref: string): ArchiveRecord | undefined {
    const parsed = parseRef(ref);
    if (!parsed) return undefined;
    const direct = this.readFrom(parsed.path, parsed.key);
    if (direct || !parsed.path.endsWith(LEGACY_SUFFIX)) return direct;
    const migrated = this.locateLegacy(parsed.path, parsed.key);
    return migrated ? this.file(migrated).get(parsed.key) : undefined;
  }

  private readFrom(rel: string, key: string): ArchiveRecord | undefined {
    if (rel.endsWith(LEGACY_SUFFIX)) {
      const path = join(this.root, rel);
      if (!existsSync(path)) return undefined;
      return readRecords(path).find((r) => r.key === key);
    }
    return this.file(rel).get(key);
  }

  /** Whether a `raw_ref` resolves, reading only the keys of the files it names. */
  has(ref: string): boolean {
    return this.resolvesTo(ref) !== undefined;
  }

  /**
   * The ref in the current layout that `ref` resolves to: itself when it already is one, the
   * migrated day file when it names a pre-2026-09 bundle. Undefined when nothing holds it.
   */
  resolvesTo(ref: string): string | undefined {
    const parsed = parseRef(ref);
    if (!parsed) return undefined;
    if (!parsed.path.endsWith(LEGACY_SUFFIX)) return this.keysOf(parsed.path).has(parsed.key) ? ref : undefined;
    const migrated = this.locateLegacy(parsed.path, parsed.key);
    if (migrated) return `${migrated}#${parsed.key}`;
    // Not migrated yet: the bundle itself still holds it.
    return this.keysOf(parsed.path).has(parsed.key) ? ref : undefined;
  }

  private keysOf(rel: string): Set<string> {
    let keys = this.keyIndex.get(rel);
    if (keys) return keys;
    keys = new Set();
    const loaded = this.files.get(rel);
    if (loaded) for (const key of loaded.keys()) keys.add(key);
    else if (rel.endsWith(LEGACY_SUFFIX)) {
      const path = join(this.root, rel);
      if (existsSync(path)) for (const record of readRecords(path)) keys.add(record.key);
    } else {
      const path = join(this.root, rel);
      if (existsSync(path)) {
        for (const line of readFileSync(path, "utf8").split("\n")) {
          const key = lineKey(line);
          if (key !== undefined) keys.add(key);
        }
      }
    }
    this.keyIndex.set(rel, keys);
    return keys;
  }

  /** A month directory's file names, read once: a check resolves thousands of refs per month. */
  private listing(directory: string): string[] {
    let names = this.listings.get(directory);
    if (!names) {
      const absolute = join(this.root, directory);
      names = existsSync(absolute) ? readdirSync(absolute) : [];
      this.listings.set(directory, names);
    }
    return names;
  }

  /** The day file in the bundle's month directory that holds `key`, if any. */
  private locateLegacy(bundle: string, key: string): string | undefined {
    const directory = dirname(bundle);
    const endpoint = basename(bundle).slice(0, -LEGACY_SUFFIX.length);
    const candidates = new Set<string>();
    for (const name of this.listing(directory)) {
      if (name.startsWith(`${endpoint}.`) && name.endsWith(SUFFIX)) candidates.add(`${directory}/${name}`);
    }
    for (const rel of this.files.keys()) {
      if (dirname(rel) === directory && basename(rel).startsWith(`${endpoint}.`)) candidates.add(rel);
    }
    return [...candidates].sort().find((rel) => this.keysOf(rel).has(key));
  }

  /** Writes every file touched since the last flush; returns their absolute paths. */
  flush(): string[] {
    const written: string[] = [];
    for (const rel of [...this.touched].sort()) {
      const records = this.files.get(rel)!;
      const lines = [...records.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((r) => JSON.stringify(r));
      const path = join(this.root, rel);
      const text = `${lines.join("\n")}\n`;
      // An unchanged file is left alone, so a re-fetch of an unrevised day is not even a touch.
      if (existsSync(path) && readFileSync(path, "utf8") === text) continue;
      writeFileAtomic(path, text);
      written.push(path);
    }
    this.touched.clear();
    return written;
  }

  /**
   * Folds files staged by an earlier run (a run writes to a staging root, then applies) into
   * this archive, record by record so a staged file never clobbers a day that another run
   * filled in the meantime. Staged records win on a key collision. A staging root written
   * before the layout change holds bundles; their records are refiled as the migration does.
   * Returns how many records were merged.
   */
  mergeFrom(stagedRoot: string): number {
    let merged = 0;
    for (const rel of listArchiveFiles(stagedRoot)) {
      for (const record of readRecords(join(stagedRoot, rel))) {
        this.put(rel.endsWith(LEGACY_SUFFIX) ? legacyTarget(rel, record) : rel, record);
        merged++;
      }
    }
    return merged;
  }
}

/** Every archive file under `root` (day files and legacy bundles), relative to it. */
export function listArchiveFiles(root: string, opts: { legacyOnly?: boolean } = {}): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(LEGACY_SUFFIX) || (!opts.legacyOnly && entry.name.endsWith(SUFFIX))) {
        out.push(toPosix(relative(root, path)));
      }
    }
  };
  walk(root);
  return out.sort();
}
