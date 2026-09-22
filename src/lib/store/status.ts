/** Freshness summary written after every run, so a stalled source is visible without digging. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_CURATED, DATA_LATEST } from "../util/paths.ts";
import { parseCsv } from "./csv.ts";

export interface TableStatus {
  rows: number;
  first_date: string | null;
  last_date: string | null;
  files: number;
}

export function summariseTable(name: string, dateColumn: string): TableStatus {
  const directory = join(DATA_CURATED, name);
  const single = join(DATA_CURATED, `${name}.csv`);
  const paths = existsSync(directory)
    ? readdirSync(directory)
        .filter((f) => f.endsWith(".csv"))
        .map((f) => join(directory, f))
    : existsSync(single)
      ? [single]
      : [];

  let rows = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const path of paths) {
    for (const row of parseCsv(readFileSync(path, "utf8"))) {
      rows++;
      const value = row[dateColumn];
      if (!value) continue;
      const date = value.slice(0, 10);
      if (first === null || date < first) first = date;
      if (last === null || date > last) last = date;
    }
  }
  return { rows, first_date: first, last_date: last, files: paths.length };
}

export function writeStatus(payload: Record<string, unknown>): string {
  mkdirSync(DATA_LATEST, { recursive: true });
  const path = join(DATA_LATEST, "status.json");
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}
