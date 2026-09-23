#!/usr/bin/env node
/**
 * The narrative step's line in the workflow's step summary: what the gateway call cost and how
 * long it took, and the spend to date, from `narrative_snapshots`.
 *
 *   npx tsx scripts/narrative-summary.ts --since 2026-09-23T12:50:00Z --latency-ms 8400
 *
 * `--since` is when the step started, so a run that wrote no snapshot (no key, or a payload
 * the last snapshot already answered) says so instead of reporting yesterday's call. Latency is
 * the step's wall clock, measured by the shell around `npm run narrative`: the table records
 * tokens and cost but not time. Prints Markdown; never fails the step.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCsv } from "../src/lib/store/csv.ts";
import { summariseNarrativeSpend } from "../src/lib/store/status.ts";
import { narrativeSummary } from "../src/lib/store/summary.ts";
import { DATA_CURATED } from "../src/lib/util/paths.ts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { since: { type: "string" }, "latency-ms": { type: "string" } },
});

const directory = join(DATA_CURATED, "narrative_snapshots");
const rows = existsSync(directory)
  ? readdirSync(directory)
      .filter((f) => f.endsWith(".csv"))
      .flatMap((f) => parseCsv(readFileSync(join(directory, f), "utf8")))
  : [];
const since = values.since ?? "";
const latest = rows.filter((r) => (r["generated_at"] ?? "") >= since).sort((a, b) => ((a["generated_at"] ?? "") < (b["generated_at"] ?? "") ? -1 : 1)).at(-1) ?? null;
const latency = values["latency-ms"] ? Number(values["latency-ms"]) : undefined;

process.stdout.write(
  narrativeSummary({ latest, spend: summariseNarrativeSpend(), latencyMs: Number.isFinite(latency) ? latency : undefined }),
);
