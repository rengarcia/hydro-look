#!/usr/bin/env node
/**
 * One-off: fill the days our own runs never saw from a community archive of the same page.
 *
 *   npx tsx scripts/import-operativa-archive.ts [--csv path] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--dry-run]
 *
 * Información Operativa shows only its newest closed day, so a day no run of ours read is gone
 * from CENACE. From 2026-11-06 to 2026-11-16 no scheduled run started at all (the jobs were never
 * given a runner), and SMEC was failing over the same days, which left 2026-11-05 → 11 with
 * neither source. jp1309/cenace-operacion reads the same page every two hours and keeps each
 * day; its rows for 2026-11-03 and 2026-11-12, the two days we also hold, match ours to the MWh.
 *
 * Its `data/diario_resumen.csv` is archived verbatim under `data/raw/jp1309_cenace_operacion/`,
 * and each day it holds that our own snapshots do not becomes the six "diaria" rows of an
 * `operativa_snapshots` snapshot stamped with its `capturado_utc` and `source =
 * jp1309:cenace-operacion`, so the rows say where they came from and point at the copy they were
 * read from. Days we already hold are left alone. `diario_huecos.csv` (multi-day sums worked
 * out from the year-to-date block) is not imported: a sum over two days is not a closed day.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { OPERATIVA_SNAPSHOTS } from "../src/lib/contracts/tables.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED, DATA_RAW } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

const UPSTREAM = "https://raw.githubusercontent.com/jp1309/cenace-operacion/main/data/diario_resumen.csv";
const SOURCE = "jp1309:cenace-operacion";

const METRICS: [string, string][] = [
  ["produccion_total", "produccion_total_mwh"],
  ["hidraulica", "hidraulica_mwh"],
  ["termica", "termica_mwh"],
  ["renovable_no_convencional", "no_convencional_mwh"],
  ["importacion", "importacion_mwh"],
  ["exportacion", "exportacion_mwh"],
];

function ourDays(): Set<string> {
  const directory = join(DATA_CURATED, OPERATIVA_SNAPSHOTS.name);
  const out = new Set<string>();
  if (!existsSync(directory)) return out;
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv"))) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      if (row["block"] === "diaria" && row["period_date"] && row["source"] !== SOURCE) out.add(row["period_date"]);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      csv: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const fetchedAt = nowUtc();
  let body: string;
  if (values.csv) body = readFileSync(values.csv, "utf8");
  else {
    const response = await fetch(UPSTREAM);
    if (!response.ok) throw new Error(`${UPSTREAM}: HTTP ${response.status}`);
    body = await response.text();
  }
  body = body.replace(/^\uFEFF/, "");

  const archive = new RawArchive(DATA_RAW);
  const rawRef = archive.add("jp1309_cenace_operacion", "diario_resumen", "run", {
    key: `diario_resumen:${fetchedAt}`,
    url: UPSTREAM,
    method: "GET",
    status: 200,
    fetched_at: fetchedAt,
    body,
  });

  const held = ourDays();
  const rows: Record<string, unknown>[] = [];
  const taken: string[] = [];
  for (const record of parseCsv(body)) {
    const date = record["fecha"] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || held.has(date)) continue;
    if (values.from && date < values.from) continue;
    if (values.to && date > values.to) continue;
    const captured = record["capturado_utc"] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(captured)) continue;
    const metrics = METRICS.map(([metric, column]) => [metric, Number(record[column])] as const);
    if (metrics.some(([, value]) => !Number.isFinite(value))) continue;
    for (const [metric, value] of metrics) {
      rows.push({
        fetched_at: captured,
        block: "diaria",
        period_label: `${date} (jp1309/cenace-operacion diario_resumen)`,
        period_date: date,
        metric,
        value,
        unit: "MWh",
        source: SOURCE,
        raw_ref: rawRef,
      });
    }
    taken.push(date);
  }

  console.log(`${taken.length} day(s) not in our own snapshots: ${taken.join(", ") || "none"}`);
  if (values["dry-run"] || taken.length === 0) return;
  const report = new CuratedStore().upsert(OPERATIVA_SNAPSHOTS, rows);
  archive.flush();
  console.log(`operativa_snapshots: +${report.added} new, ~${report.updated} updated; archived at ${rawRef}`);
}

await main();
