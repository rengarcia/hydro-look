/**
 * The Markdown a run writes for `$GITHUB_STEP_SUMMARY`: what landed, what it cost the hosts,
 * and what went wrong, on the run's page rather than in a log someone has to download.
 */

import type { UpsertReport } from "./curated.ts";
import type { NarrativeSpend } from "./status.ts";

/** Attempts the hosts saw, retries included, as `HttpClient.count` reports them. */
export interface RequestCounts {
  total: number;
  byHost: Record<string, number>;
}

const escape = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");

export function runSummary(input: {
  command: string;
  source?: string;
  reports: UpsertReport[];
  requests?: RequestCounts;
  errors: string[];
  notes: string[];
}): string {
  const lines = [`### Ingest: ${input.command}${input.command === "backfill" && input.source ? ` (${input.source})` : ""}`, ""];

  const rows = input.reports.flatMap((report) => {
    const sources = Object.entries(report.bySource);
    if (sources.length === 0) return [[report.table, "", report.added, report.updated] as const];
    return sources.sort(([a], [b]) => (a < b ? -1 : 1)).map(([source, n]) => [report.table, source, n.added, n.updated] as const);
  });
  if (rows.length === 0) lines.push("No rows in this batch.");
  else {
    lines.push("| Table | Source | Added | Updated |", "|---|---|---:|---:|");
    for (const [table, source, added, updated] of rows) lines.push(`| ${table} | ${escape(source)} | ${added} | ${updated} |`);
    const unchanged = input.reports.reduce((n, r) => n + r.unchanged, 0);
    lines.push("", `${unchanged} rows re-read unchanged.`);
  }

  lines.push("");
  if (input.requests) {
    const hosts = Object.entries(input.requests.byHost)
      .map(([host, n]) => `${host} ${n}`)
      .join(", ");
    lines.push(`**Requests:** ${input.requests.total}, retries included${hosts ? ` (${hosts})` : ""}.`);
  } else lines.push("**Requests:** not recorded by the run that staged this batch.");

  const quarantined = input.reports.filter((r) => r.quarantined > 0);
  for (const report of quarantined) {
    lines.push("", `**Quarantined:** ${report.quarantined} ${report.table} rows in \`${report.quarantinePath}\`.`);
  }

  lines.push("", `**Errors:** ${input.errors.length}`);
  for (const error of input.errors.slice(0, 30)) lines.push(`- ${escape(error).slice(0, 300)}`);
  if (input.errors.length > 30) lines.push(`- … and ${input.errors.length - 30} more`);
  if (input.notes.length > 0) lines.push("", `${input.notes.length} notes; see the run log.`);
  return `${lines.join("\n")}\n`;
}

/** One gateway call's cost and latency, with the spend to date from `narrative_snapshots`. */
export function narrativeSummary(input: {
  latest: Record<string, string> | null;
  spend: NarrativeSpend | null;
  latencyMs?: number;
}): string {
  const lines = ["### Narrative", ""];
  const row = input.latest;
  if (!row) lines.push("No snapshot was written by this run.");
  else {
    const cost = row["cost_usd"] ? `$${Number(row["cost_usd"]).toFixed(4)}` : "not reported";
    const tokens = row["input_tokens"] ? `${row["input_tokens"]} in / ${row["output_tokens"] || "?"} out` : "none";
    lines.push(
      `**${row["status"]}** with \`${row["model_id"]}\` (prompt ${row["prompt_version"]}), origin ${row["origin_date"]}.`,
      "",
      `Cost ${cost}; tokens ${tokens}${input.latencyMs === undefined ? "" : `; step took ${(input.latencyMs / 1000).toFixed(1)} s`}.`,
    );
    if (row["reason"]) lines.push("", `Reason: ${escape(row["reason"]).slice(0, 300)}`);
  }
  if (input.spend) {
    const month = input.latest?.["generated_at"]?.slice(0, 7) ?? Object.keys(input.spend.by_month).sort().at(-1);
    const monthSpend = month ? (input.spend.by_month[month] ?? 0) : 0;
    lines.push(
      "",
      `Spend to date: $${input.spend.spend_usd.toFixed(4)} over ${input.spend.calls} calls` +
        `${month ? ` ($${monthSpend.toFixed(4)} in ${month})` : ""}` +
        `${input.spend.calls_without_cost ? `; ${input.spend.calls_without_cost} billed calls reported no cost` : ""}.`,
    );
  }
  return `${lines.join("\n")}\n`;
}
