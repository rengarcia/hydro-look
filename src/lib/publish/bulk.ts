/**
 * Bulk exports: one gzipped CSV per curated table, for a consumer who wants the whole history
 * without cloning the repository or stitching year partitions together.
 *
 * The tables are partitioned by year because that is what keeps git's diffs small; a consumer
 * wants the opposite, one file. Concatenation is exact — the header once, then every partition's
 * rows in year order, byte for byte — so a row in the export is the row in the repository.
 *
 * The files are built, not committed: `npm run export:bulk` runs before `next build`, writes
 * into `public/api/bulk/` (ignored by git), and the export copies them into `out/`. Committing
 * them would add a fresh multi-megabyte gzip blob to the pack on every run, which is exactly the
 * growth `ENHANCEMENTS.md` §2.1 is trying to stop.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export interface BulkTable {
  table: string;
  /** Published file name, relative to the bulk directory. */
  file: string;
  rows: number;
  columns: string[];
  /** Year partitions (or the single file) the export was concatenated from. */
  parts: string[];
}

/** Every curated table: a directory of `<year>.csv` partitions or a single `<table>.csv`. */
export function curatedTables(curated: string): { table: string; paths: string[] }[] {
  if (!existsSync(curated)) return [];
  const out: { table: string; paths: string[] }[] = [];
  for (const entry of readdirSync(curated).sort()) {
    const path = join(curated, entry);
    if (statSync(path).isDirectory()) {
      const parts = readdirSync(path).filter((f) => f.endsWith(".csv")).sort().map((f) => join(path, f));
      if (parts.length > 0) out.push({ table: entry, paths: parts });
    } else if (entry.endsWith(".csv")) {
      out.push({ table: entry.slice(0, -4), paths: [path] });
    }
  }
  return out;
}

/**
 * The partitions joined into one CSV. Every partition must carry the same header — `npm run
 * check` already fails the build when one does not — and a mismatch here throws rather than
 * writing a file whose columns change halfway down.
 */
export function concatenate(texts: readonly string[]): { csv: string; header: string; rows: number } {
  let header: string | null = null;
  const body: string[] = [];
  for (const text of texts) {
    const lines = text.split("\n");
    const first = lines.shift() ?? "";
    if (header === null) header = first;
    else if (first !== header) throw new Error(`partition header differs: ${first.slice(0, 60)}`);
    const rows = lines.join("\n").replace(/\n+$/, "");
    if (rows !== "") body.push(rows);
  }
  if (header === null) return { csv: "", header: "", rows: 0 };
  const csv = [header, ...body].join("\n") + "\n";
  // Rows are counted as records, not lines: a quoted field may hold a newline.
  let rows = 0;
  let quoted = false;
  for (let i = header.length + 1; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') quoted = !quoted;
    else if (c === "\n" && !quoted) rows++;
  }
  return { csv, header, rows };
}

/** One table, gzipped. `gzipSync` writes a zero mtime, so the same rows give the same bytes. */
export function exportTable(table: string, paths: readonly string[]): { meta: BulkTable; gz: Buffer } {
  const { csv, header, rows } = concatenate(paths.map((p) => readFileSync(p, "utf8")));
  return {
    meta: {
      table,
      file: `${table}.csv.gz`,
      rows,
      columns: header === "" ? [] : header.split(","),
      parts: paths.map((p) => p.split(/[\\/]/).slice(-2).join("/")),
    },
    gz: gzipSync(csv, { level: 9 }),
  };
}
