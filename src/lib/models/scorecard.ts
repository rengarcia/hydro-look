/**
 * §5.1: how the published forecasts did, once their horizons have passed.
 *
 * Every forecast and adequacy run writes its quantiles to `forecast_values` and
 * `adequacy_values`, and until this module nothing read them back. The backtest says how a
 * model *would have* done at monthly origins it never published from; this says how the numbers
 * that were actually published did against what then happened — the only check a reader has no
 * reason to doubt, because nothing about it can be re-fitted after the fact.
 *
 * Three rules keep it honest.
 *
 * 1. **Scored under the version that made it.** Rows are grouped by the model that published the
 *    row (a run's 7-day row can be M4 while the rest are M3) and by the run's `model_version`, so
 *    a method change starts a new line in the table instead of blending into the old one. This
 *    is why §5.2's version bump had to come first.
 * 2. **One run per origin and version.** A rerun on revised data writes a second run for the same
 *    origin; scoring both would count that origin twice. The last one generated is the one the
 *    site showed, and it is the one scored.
 * 3. **Only what was observed.** A level row is scored when the target day has a level; an
 *    adequacy row when every day of its window has a usable balance day and none of them was
 *    rationed — a rationed day's load is the load that was allowed, not the load that was wanted,
 *    exactly as the adequacy backtest treats it. Everything else is counted as pending or excluded
 *    and said so, never silently dropped.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../store/csv.ts";
import { DATA_CURATED } from "../util/paths.ts";
import { addDays, type IsoDate } from "../util/dates.ts";
import { mean, pinballLoss } from "../util/stats.ts";
import { roundOrNull } from "../util/numbers.ts";
import type { DailySeries } from "../features/series.ts";
import { suppressed, type BalanceDay, type RationingEpisode } from "../features/balance.ts";

export type Row = Record<string, string>;

/** Every row of a curated table, whatever its partitions. */
export function readCuratedTable(name: string, root: string = DATA_CURATED): Row[] {
  const directory = join(root, name);
  if (!existsSync(directory)) return [];
  const rows: Row[] = [];
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    rows.push(...parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  return rows;
}

/** One published row set against its outcome. */
export interface ScoredRow {
  runId: string;
  modelId: string;
  modelVersion: string;
  originDate: IsoDate;
  horizonDays: number;
  targetDate: IsoDate;
  p10: number | null;
  p50: number;
  p90: number | null;
  observed: number;
}

export interface ScoreGroup {
  modelId: string;
  modelVersion: string;
  horizonDays: number;
  n: number;
  mae: number | null;
  bias: number | null;
  nBand: number;
  coverageP10P90: number | null;
  pinballMean: number | null;
  firstOrigin: IsoDate | null;
  lastOrigin: IsoDate | null;
}

export interface Scorecard {
  kind: "level" | "requirement";
  units: string;
  observedThrough: IsoDate | null;
  runsConsidered: number;
  runsSuperseded: number;
  rowsScored: number;
  rowsPending: number;
  rowsExcluded: number;
  groups: ScoreGroup[];
  scored: ScoredRow[];
}

/** The last generated run for each (origin, model version), with the others counted. */
export function latestRunPerOrigin(runs: readonly Row[]): { kept: Row[]; superseded: number } {
  const best = new Map<string, Row>();
  for (const run of runs) {
    const key = `${run["origin_date"]}|${run["model_version"]}|${run["site"] ?? ""}`;
    const current = best.get(key);
    if (!current || (run["generated_at"] ?? "") > (current["generated_at"] ?? "")) best.set(key, run);
  }
  return { kept: [...best.values()], superseded: runs.length - best.size };
}

const num = (raw: string | undefined): number | null => {
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

export function summarise(rows: readonly ScoredRow[]): ScoreGroup[] {
  const groups = new Map<string, ScoredRow[]>();
  for (const row of rows) {
    const key = `${row.modelId}\u0000${row.modelVersion}\u0000${row.horizonDays}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }
  return [...groups.values()]
    .map((list) => {
      const banded = list.filter((r) => r.p10 !== null && r.p90 !== null);
      const origins = list.map((r) => r.originDate).sort();
      return {
        modelId: list[0]!.modelId,
        modelVersion: list[0]!.modelVersion,
        horizonDays: list[0]!.horizonDays,
        n: list.length,
        mae: mean(list.map((r) => Math.abs(r.observed - r.p50))),
        bias: mean(list.map((r) => r.observed - r.p50)),
        nBand: banded.length,
        coverageP10P90: banded.length === 0 ? null : banded.filter((r) => r.observed >= r.p10! && r.observed <= r.p90!).length / banded.length,
        pinballMean:
          banded.length === 0
            ? null
            : mean(banded.flatMap((r) => [pinballLoss(r.observed, r.p10!, 0.1), pinballLoss(r.observed, r.p50, 0.5), pinballLoss(r.observed, r.p90!, 0.9)])),
        firstOrigin: origins[0] ?? null,
        lastOrigin: origins.at(-1) ?? null,
      };
    })
    .sort((a, b) => a.modelVersion.localeCompare(b.modelVersion) || a.modelId.localeCompare(b.modelId) || a.horizonDays - b.horizonDays);
}

/** The level forecasts against the level observed on each target day. */
export function scoreLevelForecasts(runs: readonly Row[], values: readonly Row[], levelsBySite: (site: string) => DailySeries): Scorecard {
  const { kept, superseded } = latestRunPerOrigin(runs);
  const byRun = new Map(kept.map((r) => [r["run_id"]!, r]));
  const scored: ScoredRow[] = [];
  let pending = 0;
  let excluded = 0;
  let observedThrough: IsoDate | null = null;
  const sites = new Set(kept.map((r) => r["site"] ?? ""));
  for (const site of sites) {
    const last = [...levelsBySite(site).keys()].at(-1) ?? null;
    if (last !== null && (observedThrough === null || last > observedThrough)) observedThrough = last;
  }
  for (const value of values) {
    const run = byRun.get(value["run_id"] ?? "");
    if (!run) continue;
    const p50 = num(value["p50"]);
    const target = value["target_date"] ?? "";
    if (p50 === null) continue;
    const levels = levelsBySite(run["site"] ?? "");
    const observed = levels.get(target);
    if (observed === undefined) {
      const last = [...levels.keys()].at(-1) ?? "";
      if (target > last) pending++;
      else excluded++;
      continue;
    }
    scored.push({
      runId: run["run_id"]!,
      // An empty `model_id` predates the column and means the run's own model.
      modelId: value["model_id"] || run["model_id"]!,
      modelVersion: run["model_version"]!,
      originDate: run["origin_date"]!,
      horizonDays: Number(value["horizon_days"]),
      targetDate: target,
      p10: num(value["p10"]),
      p50,
      p90: num(value["p90"]),
      observed,
    });
  }
  return {
    kind: "level",
    units: "m",
    observedThrough,
    runsConsidered: kept.length,
    runsSuperseded: superseded,
    rowsScored: scored.length,
    rowsPending: pending,
    rowsExcluded: excluded,
    groups: summarise(scored),
    scored,
  };
}

/**
 * The adequacy runs' net requirement (demand − hydro, GWh/day, the quantity the band is
 * calibrated on) against the mean realised over the window. The deficit is a counterfactual and
 * is never scored; the requirement is what it is built from and what the balance measures.
 */
export function scoreAdequacyRuns(
  runs: readonly Row[],
  values: readonly Row[],
  days: readonly BalanceDay[],
  episodes: readonly RationingEpisode[],
): Scorecard {
  const { kept, superseded } = latestRunPerOrigin(runs);
  const byRun = new Map(kept.map((r) => [r["run_id"]!, r]));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const last = days.at(-1)?.date ?? null;
  const scored: ScoredRow[] = [];
  let pending = 0;
  let excluded = 0;
  for (const value of values) {
    const run = byRun.get(value["run_id"] ?? "");
    if (!run) continue;
    const p50 = num(value["requirement_gwh_day"]);
    const origin = run["origin_date"]!;
    const h = Number(value["horizon_days"]);
    if (p50 === null || !Number.isFinite(h)) continue;
    const target = value["target_date"] || addDays(origin, h);
    if (last === null || target > last) {
      pending++;
      continue;
    }
    let total = 0;
    let ok = true;
    for (let day = 1; day <= h && ok; day++) {
      const date = addDays(origin, day);
      const found = byDate.get(date);
      if (!found || suppressed(episodes, date)) ok = false;
      else total += found.loadGwh - found.hydroGwh;
    }
    if (!ok) {
      excluded++;
      continue;
    }
    scored.push({
      runId: run["run_id"]!,
      modelId: run["model_id"]!,
      modelVersion: run["model_version"]!,
      originDate: origin,
      horizonDays: h,
      targetDate: target,
      p10: num(value["requirement_p10"]),
      p50,
      p90: num(value["requirement_p90"]),
      observed: total / h,
    });
  }
  return {
    kind: "requirement",
    units: "GWh/day",
    observedThrough: last,
    runsConsidered: kept.length,
    runsSuperseded: superseded,
    rowsScored: scored.length,
    rowsPending: pending,
    rowsExcluded: excluded,
    groups: summarise(scored),
    scored,
  };
}

/**
 * The `scorecard` block of `forecast.json` and `adequacy.json`. Additive: it sits beside the
 * backtest block and never replaces it, because the two answer different questions — what the
 * method scores at monthly origins, and what the published numbers scored.
 */
export function scorecardBlock(card: Scorecard, generatedAt: string, recent = 10): Record<string, unknown> {
  const digits = 3;
  return {
    generated_at: generatedAt,
    observed_through: card.observedThrough,
    target: card.kind === "level" ? "level on the target day, m" : "net requirement (demand − hydro), mean over the horizon window, GWh/day",
    units: card.units,
    runs_considered: card.runsConsidered,
    runs_superseded: card.runsSuperseded,
    rows_scored: card.rowsScored,
    rows_pending: card.rowsPending,
    rows_excluded: card.rowsExcluded,
    method:
      "Every published run whose horizon has passed, scored under the model and version that made it; the last run " +
      "generated for each origin and version only. Pending rows have not reached their target date yet" +
      (card.kind === "requirement" ? "; excluded rows fall on a missing or rationed day." : "; excluded rows have no observation on the target day."),
    by_horizon: card.groups.map((g) => ({
      model_id: g.modelId,
      model_version: g.modelVersion,
      horizon_days: g.horizonDays,
      n: g.n,
      mae: roundOrNull(g.mae, digits),
      bias: roundOrNull(g.bias, digits),
      n_band: g.nBand,
      coverage_p10_p90: roundOrNull(g.coverageP10P90, 4),
      pinball_mean: roundOrNull(g.pinballMean, digits),
      first_origin: g.firstOrigin,
      last_origin: g.lastOrigin,
    })),
    recent: [...card.scored]
      .sort((a, b) => (a.targetDate === b.targetDate ? a.horizonDays - b.horizonDays : a.targetDate < b.targetDate ? 1 : -1))
      .slice(0, recent)
      .map((r) => ({
        run_id: r.runId,
        model_id: r.modelId,
        model_version: r.modelVersion,
        origin_date: r.originDate,
        horizon_days: r.horizonDays,
        target_date: r.targetDate,
        p10: r.p10,
        p50: r.p50,
        p90: r.p90,
        observed: roundOrNull(r.observed, digits),
        error: roundOrNull(r.observed - r.p50, digits),
        in_band: r.p10 === null || r.p90 === null ? null : r.observed >= r.p10 && r.observed <= r.p90,
      })),
  };
}

const fmt = (value: number | null, digits = 3): string => (value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits));

/** `data/reports/scorecard.md`. */
export function renderScorecardReport(input: { generatedAt: string; level: Scorecard; adequacy: Scorecard }): string {
  const lines: string[] = [];
  lines.push("# Scorecard — how the published forecasts did");
  lines.push("");
  lines.push(
    `Generated ${input.generatedAt} by \`npm run score\` from the committed tables; no network. The backtest ` +
      "reports (`backtest.md`, `adequacy.md`) say how each method scores at monthly origins it never published " +
      "from; this says how the numbers the site actually published did once their horizons passed.",
  );
  lines.push("");
  lines.push(
    "Rows are grouped by the model that published them and the version of the run that made them, so a method " +
      "change starts a new line rather than blending into the old one. Where an origin was published more than " +
      "once (a rerun on revised data), only the last run generated is scored.",
  );
  lines.push("");
  for (const [title, card] of [
    ["Mazar level (forecast_values)", input.level],
    ["National net requirement (adequacy_values)", input.adequacy],
  ] as const) {
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(
      `Observed through ${card.observedThrough ?? "—"}. ${card.runsConsidered} runs considered (${card.runsSuperseded} superseded by a later run ` +
        `for the same origin and version); ${card.rowsScored} rows scored, ${card.rowsPending} pending, ${card.rowsExcluded} excluded.`,
    );
    lines.push("");
    if (card.groups.length === 0) {
      lines.push("No published row has reached its target date with an observation yet. The table fills in as they do.");
      lines.push("");
      continue;
    }
    lines.push(`| model | version | horizon | n | MAE (${card.units}) | bias | coverage p10–p90 (n) | pinball | origins |`);
    lines.push("|---|---|---:|---:|---:|---:|---:|---:|---|");
    for (const g of card.groups) {
      lines.push(
        `| ${g.modelId} | ${g.modelVersion} | ${g.horizonDays} d | ${g.n} | ${fmt(g.mae)} | ${fmt(g.bias)} | ` +
          `${g.coverageP10P90 === null ? "—" : `${(g.coverageP10P90 * 100).toFixed(0)}%`} (${g.nBand}) | ${fmt(g.pinballMean)} | ` +
          `${g.firstOrigin ?? "—"} → ${g.lastOrigin ?? "—"} |`,
      );
    }
    lines.push("");
    lines.push("A handful of rows is an anecdote, not a score: read `n` before reading the MAE, and the backtest before either.");
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
