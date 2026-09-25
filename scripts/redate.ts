#!/usr/bin/env node
/**
 * Re-date one source's stored rows after its entry in `DATA_DATE_OFFSET_DAYS` changes.
 *
 *   npx tsx scripts/redate.ts ords:repDiaPotQTurb --dry-run    count, write nothing
 *   npx tsx scripts/redate.ts ords:repDiaPotQTurb              rebuild and rewrite
 *
 * The offset is applied by the parser, so it only reaches rows written after it changed; the
 * curated store upserts by key, and `date` is part of the key, so a re-run of the ingest would
 * add the re-dated rows beside the old ones instead of moving them. This moves them. Every
 * stored row of the source is rebuilt from the archived response its `raw_ref` names, with
 * today's parser, keeping `fetched_at` and `raw_ref`, which is exactly what a fresh ingest of
 * that same response would store.
 *
 * It refuses to write unless the rebuild changes nothing but dates, and each one by the same
 * number of days. A parser that has drifted since the rows were stored is a different change,
 * and should not ride along with a re-dating.
 *
 * Idempotent: a second run rebuilds the rows it already wrote and reports nothing to move.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OBSERVATIONS_DAILY } from "../src/lib/contracts/tables.ts";
import { parseRepDiaNivQIng, parseRepDiaPotQTurb } from "../src/lib/parse/ords.ts";
import type { ParseResult } from "../src/lib/parse/types.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { parseCsv, toCsv } from "../src/lib/store/csv.ts";
import { writeFileAtomic } from "../src/lib/store/files.ts";
import { DATA_CURATED, DATA_RAW } from "../src/lib/util/paths.ts";

/** Sources whose rows can be rebuilt from one archived response alone. */
const PARSERS: Record<string, (body: string) => ParseResult> = {
  "ords:repDiaNivQIng": parseRepDiaNivQIng,
  "ords:repDiaPotQTurb": parseRepDiaPotQTurb,
};

type Row = Record<string, string>;

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
/** Everything but the date, which is what may change. */
const identity = (row: Row) => [row["site"], row["variable"], row["mrid"], row["raw_ref"]].join("\u0000");

function main(): void {
  const source = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const parse = source ? PARSERS[source] : undefined;
  if (!source || !parse) throw new Error(`usage: redate.ts <source> [--dry-run], source one of ${Object.keys(PARSERS).join(", ")}`);

  const directory = join(DATA_CURATED, OBSERVATIONS_DAILY.name);
  const partitions = new Map<string, Row[]>();
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv"))) {
    partitions.set(file, parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  const stored = [...partitions.values()].flat().filter((row) => row["source"] === source);

  // Rebuild from the archive, one response per distinct raw_ref.
  const archive = new RawArchive(DATA_RAW);
  const rebuilt: Row[] = [];
  for (const ref of new Set(stored.map((row) => row["raw_ref"] ?? ""))) {
    const record = archive.read(ref);
    if (!record) throw new Error(`${ref}: not in the archive, so its rows cannot be rebuilt`);
    const fetchedAt = stored.find((row) => row["raw_ref"] === ref)!["fetched_at"] ?? "";
    for (const observation of parse(record.body).observations) {
      const row = { ...observation, fetched_at: fetchedAt, raw_ref: ref };
      rebuilt.push(Object.fromEntries(OBSERVATIONS_DAILY.columns.map((c) => [c, String(row[c] ?? "")])));
    }
  }

  // Only the date may move, and every row by the same amount.
  const before = new Map(stored.map((row) => [identity(row), row]));
  if (before.size !== stored.length) throw new Error(`${source}: two stored rows share a site, variable and raw_ref`);
  if (rebuilt.length !== stored.length) throw new Error(`${source}: ${stored.length} rows stored, ${rebuilt.length} rebuilt`);
  const shifts = new Set<number>();
  for (const row of rebuilt) {
    const old = before.get(identity(row));
    if (!old) throw new Error(`${source}: rebuilt a row nothing stored: ${JSON.stringify(row)}`);
    for (const column of OBSERVATIONS_DAILY.columns) {
      if (column !== "date" && old[column] !== row[column]) {
        throw new Error(`${source}: ${column} changed from ${old[column]} to ${row[column]} on ${identity(row)}`);
      }
    }
    shifts.add(daysBetween(old["date"]!, row["date"]!));
  }
  if (shifts.size > 1) throw new Error(`${source}: rows moved by different amounts: ${[...shifts].join(", ")} days`);
  const shift = [...shifts][0] ?? 0;
  console.log(`${source}: ${stored.length} rows from ${new Set(stored.map((r) => r["raw_ref"])).size} responses, moved ${shift} days`);
  if (shift === 0 || dryRun) {
    console.log(shift === 0 ? "nothing to move" : "dry run: nothing written");
    return;
  }

  // Swap the rows in and rewrite each touched partition in the store's own row order.
  for (const [file, rows] of partitions)
    partitions.set(
      file,
      rows.filter((row) => row["source"] !== source),
    );
  const touched = new Set(stored.map((row) => `${row["date"]!.slice(0, 4)}.csv`));
  for (const row of rebuilt) {
    const file = `${row["date"]!.slice(0, 4)}.csv`;
    (partitions.get(file) ?? partitions.set(file, []).get(file)!).push(row);
    touched.add(file);
  }
  const order = (a: Row, b: Row) => {
    for (const column of OBSERVATIONS_DAILY.columns) {
      const left = a[column] ?? "";
      const right = b[column] ?? "";
      if (left !== right) return left < right ? -1 : 1;
    }
    return 0;
  };
  for (const file of [...touched].sort()) {
    writeFileAtomic(join(directory, file), toCsv(OBSERVATIONS_DAILY.columns, partitions.get(file)!.sort(order)));
    console.log(`rewrote ${OBSERVATIONS_DAILY.name}/${file}`);
  }
}

main();
