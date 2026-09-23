/** Freshness summary written after every run, so a stalled source is visible without digging. */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_CURATED, DATA_LATEST } from "../util/paths.ts";
import { parseCsv } from "./csv.ts";
import { writeJsonUnlessOnlyStamped } from "./files.ts";

export interface TableStatus {
  rows: number;
  first_date: string | null;
  last_date: string | null;
  files: number;
}

function tableFiles(name: string, root: string): string[] {
  const directory = join(root, name);
  const single = join(root, `${name}.csv`);
  return existsSync(directory)
    ? readdirSync(directory)
        .filter((f) => f.endsWith(".csv"))
        .sort()
        .map((f) => join(directory, f))
    : existsSync(single)
      ? [single]
      : [];
}

export function summariseTable(name: string, dateColumn: string, root: string = DATA_CURATED): TableStatus {
  const paths = tableFiles(name, root);
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

export interface NarrativeSpend {
  /** Attempts that reached the gateway or were refused by it: every row of the table. */
  calls: number;
  by_status: Record<string, number>;
  /** Sum of `cost_usd` over every row that has one, rounded to the cent's hundredth. */
  spend_usd: number;
  /** Rows the gateway billed for but did not report a cost for; their cost is unknown, not zero. */
  calls_without_cost: number;
  /** Spend by UTC month of `generated_at`, the unit decision 8's budget is set in. */
  by_month: Record<string, number>;
  last_call_at: string | null;
}

/**
 * What the narrative has cost so far, from `narrative_snapshots`: the table is the spend log
 * (see contracts/tables.ts), so this is a sum over it rather than a second record to keep in
 * step. Null when the narrative has never run.
 */
export function summariseNarrativeSpend(root: string = DATA_CURATED): NarrativeSpend | null {
  const paths = tableFiles("narrative_snapshots", root);
  if (paths.length === 0) return null;
  const spend: NarrativeSpend = { calls: 0, by_status: {}, spend_usd: 0, calls_without_cost: 0, by_month: {}, last_call_at: null };
  for (const path of paths) {
    for (const row of parseCsv(readFileSync(path, "utf8"))) {
      spend.calls++;
      const status = row["status"] ?? "";
      spend.by_status[status] = (spend.by_status[status] ?? 0) + 1;
      const at = row["generated_at"] ?? "";
      if (spend.last_call_at === null || at > spend.last_call_at) spend.last_call_at = at;
      const cost = row["cost_usd"] === undefined || row["cost_usd"] === "" ? null : Number(row["cost_usd"]);
      if (cost === null || !Number.isFinite(cost)) {
        // A row with tokens but no cost was billed for an amount the gateway did not report.
        if ((row["input_tokens"] ?? "") !== "") spend.calls_without_cost++;
        continue;
      }
      spend.spend_usd += cost;
      const month = at.slice(0, 7);
      spend.by_month[month] = (spend.by_month[month] ?? 0) + cost;
    }
  }
  const round = (usd: number) => Math.round(usd * 10_000) / 10_000;
  spend.spend_usd = round(spend.spend_usd);
  for (const month of Object.keys(spend.by_month)) spend.by_month[month] = round(spend.by_month[month]!);
  return spend;
}

/**
 * Writes `data/latest/status.json`, unless nothing but `generated_at` would change: a run that
 * found nothing new then leaves the file, and the commit, alone. Returns the path, or null when
 * the file was left as it was.
 */
export function writeStatus(payload: Record<string, unknown>, directory: string = DATA_LATEST): string | null {
  const path = join(directory, "status.json");
  return writeJsonUnlessOnlyStamped(path, payload) ? path : null;
}
