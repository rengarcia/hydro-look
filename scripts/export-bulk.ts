#!/usr/bin/env node
/**
 * Writes one `<table>.csv.gz` per curated table, and an `index.json` listing them.
 *
 *   npm run export:bulk                        write public/api/bulk/ (ignored by git)
 *   npm run export:bulk -- --out dir           write somewhere else (the release workflow does)
 *
 * It runs as `prebuild`, so every deploy serves the tables as they are in the commit being
 * deployed, at `/api/bulk/<table>.csv.gz`. No network and no clock: the output is a function of
 * `data/curated` alone. See `src/lib/publish/bulk.ts` for why the files are built and not
 * committed.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { curatedTables, exportTable, type BulkTable } from "../src/lib/publish/bulk.ts";
import { ATTRIBUTION, LICENSE, SCHEMA_VERSION, SITE_URL } from "../src/lib/publish/contract.ts";
import { DATA_CURATED, repoPath } from "../src/lib/util/paths.ts";

function main(): void {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { out: { type: "string" } } });
  const outDir = values.out?.trim() || repoPath("public", "api", "bulk");
  mkdirSync(outDir, { recursive: true });

  const tables: (BulkTable & { url: string; bytes: number })[] = [];
  for (const { table, paths } of curatedTables(DATA_CURATED)) {
    const { meta, gz } = exportTable(table, paths);
    writeFileSync(join(outDir, meta.file), gz);
    tables.push({ ...meta, url: `${SITE_URL}/api/bulk/${meta.file}`, bytes: gz.length });
    console.log(`${meta.file.padEnd(34)} ${String(meta.rows).padStart(7)} rows  ${(gz.length / 1024).toFixed(0).padStart(6)} KiB`);
  }

  const index = { schema_version: SCHEMA_VERSION, format: "csv, gzip, UTF-8, header on the first line", tables, license: LICENSE, attribution: ATTRIBUTION };
  writeFileSync(join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`wrote ${tables.length} tables and index.json to ${outDir}`);
}

main();
