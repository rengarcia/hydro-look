#!/usr/bin/env node
/**
 * One-off: move data/raw/ from gzip bundles to plain NDJSON day files (ENHANCEMENTS §2.1).
 *
 *   npx tsx scripts/migrate-raw.ts --dry-run    count, write nothing
 *   npx tsx scripts/migrate-raw.ts              migrate, rewrite raw_ref, verify, delete bundles
 *
 * Four steps, and the last only if the third passes:
 *
 * 1. Every record of every `<source>/<YYYY>/<MM>/<endpoint>.ndjson.gz` bundle is refiled as
 *    `<source>/<YYYY>/<MM>/<endpoint>.<day>.ndjson` (or `.<run>.ndjson` for the operativa
 *    snapshot), by the rule in `legacyTarget`: the date its key asks about, which is the date
 *    the bundle's month came from. Records keep their bytes; only the container changes.
 * 2. Every `raw_ref` in data/curated/ is rewritten from `<bundle>#<key>` to `<file>#<key>`, cell
 *    by cell, leaving every other byte of every CSV as it was.
 * 3. Every `raw_ref` is resolved against the new files alone — the bundles are not consulted —
 *    and every migrated record is compared with its original. Any miss stops the script here.
 * 4. The bundles are deleted.
 *
 * Idempotent: a second run finds no bundles and only re-verifies. Readers still accept the old
 * ref form (see store/archive.ts), so a batch staged before this ran applies cleanly after it.
 */

import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { listArchiveFiles, legacyTarget, RawArchive, splitRawRef, type ArchiveRecord } from "../src/lib/store/archive.ts";
import { parseCsv, toCsv } from "../src/lib/store/csv.ts";
import { writeFileAtomic } from "../src/lib/store/files.ts";
import { DATA_CURATED, DATA_RAW } from "../src/lib/util/paths.ts";

const dryRun = process.argv.includes("--dry-run");
const log = (message: string) => console.log(message);

function readBundle(path: string): ArchiveRecord[] {
  return gunzipSync(readFileSync(path))
    .toString("utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ArchiveRecord);
}

/** Every curated CSV with a raw_ref column, relative to data/curated. */
function curatedFiles(): string[] {
  return listFiles(DATA_CURATED)
    .filter((rel) => rel.endsWith(".csv"))
    .filter((rel) => (readFileSync(join(DATA_CURATED, rel), "utf8").split("\n", 1)[0] ?? "").split(",").includes("raw_ref"));
}

/** Every file under `root`, relative to it (a recursive readdir names paths that way). */
function listFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((rel) => statSync(join(root, rel)).isFile())
    .sort();
}

function main(): void {
  const bundles = listArchiveFiles(DATA_RAW, { legacyOnly: true }).filter((rel) => rel.endsWith(".ndjson.gz"));
  const bundleBytes = bundles.reduce((n, rel) => n + statSync(join(DATA_RAW, rel)).size, 0);
  log(`${bundles.length} bundles, ${(bundleBytes / 1e6).toFixed(1)} MB gzipped`);

  // 1. Refile.
  const archive = new RawArchive(DATA_RAW);
  const mapping = new Map<string, string>();
  const originals = new Map<string, ArchiveRecord>();
  let records = 0;
  for (const bundle of bundles) {
    for (const record of readBundle(join(DATA_RAW, bundle))) {
      const target = legacyTarget(bundle, record);
      archive.put(target, record);
      const oldRef = `${bundle}#${record.key}`;
      const newRef = `${target}#${record.key}`;
      if (mapping.has(oldRef)) throw new Error(`duplicate key ${oldRef}`);
      mapping.set(oldRef, newRef);
      originals.set(newRef, record);
      records++;
    }
  }
  log(`${records} records refile into ${new Set([...mapping.values()].map((ref) => ref.split("#")[0])).size} day and run files`);
  if (dryRun) {
    log("dry run: nothing written");
    return;
  }
  const written = archive.flush();
  const writtenBytes = written.reduce((n, path) => n + statSync(path).size, 0);
  log(`wrote ${written.length} files, ${(writtenBytes / 1e6).toFixed(1)} MB uncompressed`);

  // 2. Rewrite refs, cell by cell.
  let rewritten = 0;
  const unmapped = new Set<string>();
  for (const rel of curatedFiles()) {
    const path = join(DATA_CURATED, rel);
    const text = readFileSync(path, "utf8");
    const header = (text.split("\n", 1)[0] ?? "").split(",");
    const rows = parseCsv(text);
    let changed = false;
    for (const row of rows) {
      const cell = row["raw_ref"] ?? "";
      if (!cell.includes(".ndjson.gz#")) continue;
      row["raw_ref"] = splitRawRef(cell)
        .map((ref) => {
          const next = mapping.get(ref);
          if (next === undefined && ref.includes(".ndjson.gz#")) unmapped.add(ref);
          return next ?? ref;
        })
        .join(" ");
      changed = true;
      rewritten++;
    }
    if (!changed) continue;
    const out = toCsv(header, rows);
    // The CSV must round-trip byte for byte apart from the refs; anything else is a bug here.
    if (out.split("\n").length !== text.split("\n").length) throw new Error(`${rel}: line count changed on rewrite`);
    writeFileAtomic(path, out);
  }
  log(`rewrote raw_ref on ${rewritten} rows`);
  if (unmapped.size > 0) throw new Error(`${unmapped.size} refs name a bundle record that does not exist; first: ${[...unmapped][0]}`);

  // 3. Verify against the new files alone, with a fresh archive that has never seen a bundle.
  const fresh = new RawArchive(DATA_RAW);
  for (const [ref, original] of originals) {
    const copy = fresh.read(ref);
    if (!copy || JSON.stringify(copy) !== JSON.stringify(original)) throw new Error(`verify: ${ref} did not survive the move`);
  }
  let refs = 0;
  for (const rel of curatedFiles()) {
    for (const row of parseCsv(readFileSync(join(DATA_CURATED, rel), "utf8"))) {
      for (const ref of splitRawRef(row["raw_ref"] ?? "")) {
        refs++;
        if (ref.includes(".ndjson.gz#")) throw new Error(`verify: ${rel} still holds the bundle ref ${ref}`);
        if (!fresh.has(ref)) throw new Error(`verify: ${rel} names ${ref}, which the new files do not hold`);
      }
    }
  }
  log(`verified ${originals.size} records byte for byte and ${refs} raw_refs`);

  // 4. Only now drop the bundles.
  for (const bundle of bundles) rmSync(join(DATA_RAW, bundle));
  log(`deleted ${bundles.length} bundles`);
}

main();
