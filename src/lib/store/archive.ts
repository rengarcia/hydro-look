/**
 * Raw response archive.
 *
 * Every response is kept verbatim so that a parser bug is a reprocessing job rather than a
 * re-scrape (and a re-scrape of 2016 may not be possible at all). Responses are bundled one
 * gzipped NDJSON file per source-month-endpoint, keyed by request, because the alternative —
 * one file per request — would put tens of thousands of 1 KB files in the repository.
 *
 * Re-fetching a key replaces its record: the archive holds the latest copy of each response,
 * not a history of fetches.
 */

import { gunzipSync, gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_RAW } from "../util/paths.ts";

export interface ArchiveRecord {
  key: string;
  url: string;
  method: string;
  status: number;
  fetched_at: string;
  body: string;
}

export class RawArchive {
  private readonly bundles = new Map<string, Map<string, ArchiveRecord>>();
  private readonly touched = new Set<string>();

  constructor(private readonly root: string = DATA_RAW) {}

  /**
   * `period` is the month the *data* belongs to (not the fetch time), so a backfill of 2018
   * files under data/raw/<source>/2018/. Pass null for live endpoints.
   */
  path(source: string, endpoint: string, period: { year: number; month: string } | null, fetchedAt: string): string {
    const year = period?.year ?? Number(fetchedAt.slice(0, 4));
    const month = period?.month ?? fetchedAt.slice(5, 7);
    return join(this.root, source, String(year), month, `${endpoint}.ndjson.gz`);
  }

  private bundle(path: string): Map<string, ArchiveRecord> {
    let bundle = this.bundles.get(path);
    if (bundle) return bundle;
    bundle = new Map();
    if (existsSync(path)) {
      const text = gunzipSync(readFileSync(path)).toString("utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const record = JSON.parse(line) as ArchiveRecord;
        bundle.set(record.key, record);
      }
    }
    this.bundles.set(path, bundle);
    return bundle;
  }

  /** Returns the `raw_ref` to store alongside the parsed rows. */
  add(
    source: string,
    endpoint: string,
    period: { year: number; month: string } | null,
    record: ArchiveRecord,
  ): string {
    const path = this.path(source, endpoint, period, record.fetched_at);
    this.bundle(path).set(record.key, record);
    this.touched.add(path);
    return `${path.slice(this.root.length + 1)}#${record.key}`;
  }

  /** Reads one archived response back, for reprocessing without the network. */
  get(path: string, key: string): ArchiveRecord | undefined {
    return this.bundle(path).get(key);
  }

  flush(): string[] {
    const written: string[] = [];
    for (const path of this.touched) {
      const bundle = this.bundles.get(path)!;
      const lines = [...bundle.values()]
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map((r) => JSON.stringify(r));
      mkdirSync(dirname(path), { recursive: true });
      // Node leaves the gzip MTIME field at 0, so an unchanged bundle re-compresses to the
      // same bytes and produces no git diff.
      writeFileSync(path, gzipSync(`${lines.join("\n")}\n`, { level: 9 }));
      written.push(path);
    }
    this.touched.clear();
    return written;
  }

  /**
   * Folds bundles staged by an earlier run (a run writes to a staging root, then applies)
   * into this archive, record by record so a staged bundle never clobbers a month that
   * another run filled in the meantime. Staged records win on a key collision.
   */
  mergeFrom(stagedRoot: string): number {
    let merged = 0;
    for (const relative of listBundles(stagedRoot)) {
      const staged = new RawArchive(stagedRoot).bundle(join(stagedRoot, relative));
      const target = join(this.root, relative);
      const bundle = this.bundle(target);
      for (const [key, record] of staged) {
        bundle.set(key, record);
        merged++;
      }
      this.touched.add(target);
    }
    return merged;
  }
}

/** Every `*.ndjson.gz` under `root`, as paths relative to it. */
function listBundles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const next = join(prefix, entry.name);
      if (entry.isDirectory()) walk(join(directory, entry.name), next);
      else if (entry.name.endsWith(".ndjson.gz")) out.push(next);
    }
  };
  walk(root, "");
  return out;
}
