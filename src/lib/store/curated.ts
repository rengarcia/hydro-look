/**
 * Curated table store: year-partitioned CSV, upserted by key.
 *
 * Partitioning matters more than it looks. A daily run that rewrote one multi-megabyte CSV
 * would add a new multi-megabyte blob to the repository every day; writing only the current
 * year's file keeps each commit to the rows that actually changed.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DATA_CURATED, DATA_ROOT } from "../util/paths.ts";
import { parseCsv, toCsv } from "./csv.ts";
import { writeFileAtomic } from "./files.ts";
import { validateRows, type TableSpec } from "../contracts/tables.ts";

/** Rows an ingest could not store, kept for a person to read; `npm run check` fails while any exist. */
export const DATA_QUARANTINE = resolve(DATA_ROOT, "quarantine");

export interface UpsertReport {
  table: string;
  files: { path: string; added: number; updated: number; unchanged: number; total: number }[];
  added: number;
  updated: number;
  unchanged: number;
  /** Added and updated rows by their `source` column, for tables that carry one. */
  bySource: Record<string, { added: number; updated: number }>;
  /** Rows set aside instead of written, and the file they went to. */
  quarantined: number;
  quarantinePath?: string;
}

export interface UpsertOptions {
  /**
   * Set aside rows that fail the contract instead of refusing the whole table. Without it, one
   * bad row throws before any file is touched — right for the models, whose rows are all or
   * nothing. The ingest sets it: one drifted row from one endpoint must not keep a thousand
   * good rows from other endpoints out of the store, and must not stop the run halfway either.
   */
  quarantine?: { root?: string; run: string };
}

function keyOf<T>(spec: TableSpec<T>, row: Record<string, unknown>): string {
  return spec.key.map((c) => String(row[c] ?? "")).join("\u0000");
}

/** Numbers survive a CSV round-trip as strings; compare on the rendered form. */
function renderRow<T>(spec: TableSpec<T>, row: T): Record<string, string> {
  const out: Record<string, string> = {};
  for (const column of spec.columns) {
    const value = (row as Record<string, unknown>)[column];
    out[column] = value === null || value === undefined ? "" : String(value);
  }
  return out;
}

export class CuratedStore {
  constructor(
    private readonly root: string = DATA_CURATED,
    private readonly dryRun = false,
  ) {}

  private fileFor<T>(spec: TableSpec<T>, row: Record<string, unknown>): string {
    if (!spec.partitionBy) return join(this.root, `${spec.name}.csv`);
    const value = String(row[spec.partitionBy] ?? "");
    const year = value.slice(0, 4);
    if (!/^\d{4}$/.test(year)) throw new Error(`${spec.name}: cannot partition on ${spec.partitionBy}=${value}`);
    return join(this.root, spec.name, `${year}.csv`);
  }

  read(path: string): Record<string, string>[] {
    return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
  }

  /**
   * Every row is contract-checked before any file is touched. A row that fails either throws
   * (the default) or, with `quarantine`, is written with its reason to
   * `data/quarantine/<table>/<run>.csv` and left out of the table.
   */
  upsert<T>(spec: TableSpec<T>, rows: unknown[], options: UpsertOptions = {}): UpsertReport {
    const report: UpsertReport = { table: spec.name, files: [], added: 0, updated: 0, unchanged: 0, bySource: {}, quarantined: 0 };
    const byFile = new Map<string, T[]>();
    const rejected: { row: unknown; reason: string }[] = [];

    if (options.quarantine) {
      for (const row of rows) {
        const result = spec.schema.safeParse(row);
        if (!result.success) {
          rejected.push({ row, reason: result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") });
          continue;
        }
        try {
          const path = this.fileFor(spec, result.data as Record<string, unknown>);
          (byFile.get(path) ?? byFile.set(path, []).get(path)!).push(result.data);
        } catch (error) {
          rejected.push({ row, reason: String(error) });
        }
      }
    } else {
      for (const row of validateRows(spec, rows)) {
        const path = this.fileFor(spec, row as Record<string, unknown>);
        (byFile.get(path) ?? byFile.set(path, []).get(path)!).push(row);
      }
    }

    if (rejected.length > 0) {
      const root = options.quarantine!.root ?? DATA_QUARANTINE;
      const path = join(root, spec.name, `${options.quarantine!.run}.csv`);
      const cell = (value: unknown) =>
        value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
      const lines = rejected.map(({ row, reason }) => {
        const record = (row ?? {}) as Record<string, unknown>;
        return { ...Object.fromEntries(spec.columns.map((c) => [c, cell(record[c])])), reason };
      });
      if (!this.dryRun) writeFileAtomic(path, toCsv([...spec.columns, "reason"], lines));
      report.quarantined = rejected.length;
      report.quarantinePath = path;
    }

    const source = (spec.columns as readonly string[]).includes("source") ? "source" : null;
    const count = (row: Record<string, string>, field: "added" | "updated") => {
      if (!source) return;
      const bucket = (report.bySource[row[source] ?? ""] ??= { added: 0, updated: 0 });
      bucket[field]++;
    };

    for (const [path, incoming] of [...byFile].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const existing = this.read(path);
      const index = new Map(existing.map((row) => [keyOf(spec, row), row]));
      let added = 0;
      let updated = 0;
      let unchanged = 0;

      for (const row of incoming) {
        const rendered = renderRow(spec, row);
        const key = keyOf(spec, rendered);
        const previous = index.get(key);
        if (!previous) {
          added++;
          count(rendered, "added");
        } else if (spec.columns.some((c) => (previous[c] ?? "") !== rendered[c])) {
          updated++;
          count(rendered, "updated");
        } else unchanged++;
        index.set(key, rendered);
      }

      const merged = [...index.values()].sort((a, b) => {
        for (const column of spec.columns) {
          const left = a[column] ?? "";
          const right = b[column] ?? "";
          if (left !== right) return left < right ? -1 : 1;
        }
        return 0;
      });

      if (!this.dryRun && (added > 0 || updated > 0 || !existsSync(path))) {
        writeFileAtomic(path, toCsv(spec.columns, merged));
      }
      report.files.push({ path, added, updated, unchanged, total: merged.length });
      report.added += added;
      report.updated += updated;
      report.unchanged += unchanged;
    }
    return report;
  }

  /** Keys already present, so a resumable backfill can skip work it has already done. */
  existingKeys<T>(spec: TableSpec<T>, years: number[]): Set<string> {
    const keys = new Set<string>();
    const paths = spec.partitionBy ? years.map((y) => join(this.root, spec.name, `${y}.csv`)) : [join(this.root, `${spec.name}.csv`)];
    for (const path of paths) {
      for (const row of this.read(path)) keys.add(keyOf(spec, row));
    }
    return keys;
  }
}

/**
 * Folds per-day band readings into one row per distinct band, with the span over which it was
 * observed, so a change of declared operating rules shows up as a new row in the diff.
 */
export function foldBands(
  readings: { date: string; site: string; cota_min: number | null; cota_max: number | null; qmax_m3s: number | null; source: string }[],
  existing: Record<string, string>[] = [],
): Record<string, unknown>[] {
  const folded = new Map<
    string,
    {
      site: string;
      cota_min: number | null;
      cota_max: number | null;
      qmax_m3s: number | null;
      source: string;
      first_date: string;
      last_date: string;
    }
  >();

  const add = (r: {
    date?: string;
    first_date?: string;
    last_date?: string;
    site: string;
    cota_min: number | null;
    cota_max: number | null;
    qmax_m3s: number | null;
    source: string;
  }) => {
    const first = r.first_date ?? r.date!;
    const last = r.last_date ?? r.date!;
    const key = [r.site, r.source, r.cota_min, r.cota_max, r.qmax_m3s].join("|");
    const current = folded.get(key);
    if (!current) {
      folded.set(key, {
        site: r.site,
        cota_min: r.cota_min,
        cota_max: r.cota_max,
        qmax_m3s: r.qmax_m3s,
        source: r.source,
        first_date: first,
        last_date: last,
      });
      return;
    }
    if (first < current.first_date) current.first_date = first;
    if (last > current.last_date) current.last_date = last;
  };

  const num = (v: string) => (v === "" ? null : Number(v));
  for (const row of existing) {
    add({
      site: row["site"]!,
      cota_min: num(row["cota_min"] ?? ""),
      cota_max: num(row["cota_max"] ?? ""),
      qmax_m3s: num(row["qmax_m3s"] ?? ""),
      source: row["source"]!,
      first_date: row["first_date"]!,
      last_date: row["last_date"]!,
    });
  }
  for (const reading of readings) add(reading);
  return [...folded.values()];
}
