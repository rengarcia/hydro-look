/**
 * One record per day the models stood on, for the daily permalinks under `/dia/`.
 *
 * `forecast.json`, `adequacy.json` and `narrative.json` are overwritten every run, so a reading
 * quoted last week cannot be checked against the page today. The curated tables keep every run:
 * `forecast_runs`/`forecast_values`, `adequacy_runs`/`adequacy_values` and
 * `narrative_snapshots`. A day's page is rebuilt from them, so it says what was published about
 * that day and keeps saying it after the numbers move.
 *
 * When a day was run more than once — a model change, a rerun after a late feed — the page shows
 * the last run, as the site did at the end of that day, and says how many there were. A
 * narrative counts only if the validator passed it; rejected and failed attempts are history,
 * not text anyone was shown.
 *
 * Everything here is a pure function of rows except `days()`, which reads them.
 */

import type { IsoDate } from "../util/dates.ts";

type Row = Record<string, string>;

export interface DayHorizon {
  horizon_days: number;
  target_date: IsoDate;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  model_id: string;
}

export interface DayAdequacyHorizon {
  horizon_days: number;
  target_date: IsoDate;
  deficit_gwh_day: number | null;
  margin_pct: number | null;
  tier: string;
}

export interface DayRecord {
  date: IsoDate;
  forecast: { run_id: string; generated_at: string; site: string; model_id: string; origin_level_masl: number | null; horizons: DayHorizon[] } | null;
  adequacy: { run_id: string; generated_at: string; model_id: string; horizons: DayAdequacyHorizon[] } | null;
  narrative: {
    run_id: string;
    generated_at: string;
    model_id: string;
    risk_tier: string;
    confidence: string;
    outlook_es: string;
    drivers: string[];
  } | null;
  /** Runs recorded for the day, including the ones superseded or rejected. */
  runs: { forecast: number; adequacy: number; narrative: number };
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The newest row per origin day, by `generated_at`, and how many rows each day had. */
function lastPerDay(rows: readonly Row[]): Map<IsoDate, { row: Row; count: number }> {
  const out = new Map<IsoDate, { row: Row; count: number }>();
  for (const row of rows) {
    const date = row["origin_date"] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const seen = out.get(date);
    if (seen === undefined) out.set(date, { row, count: 1 });
    else {
      seen.count += 1;
      if ((row["generated_at"] ?? "") > (seen.row["generated_at"] ?? "")) seen.row = row;
    }
  }
  return out;
}

function parseDrivers(json: string | undefined): string[] {
  try {
    const value = JSON.parse(json ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export interface DayTables {
  forecastRuns: readonly Row[];
  forecastValues: readonly Row[];
  adequacyRuns: readonly Row[];
  adequacyValues: readonly Row[];
  narrativeSnapshots: readonly Row[];
}

/** Every day any model stood on, newest first. */
export function daysFrom(tables: DayTables): DayRecord[] {
  const forecasts = lastPerDay(tables.forecastRuns);
  const adequacies = lastPerDay(tables.adequacyRuns);
  const narrativesOk = lastPerDay(tables.narrativeSnapshots.filter((r) => r["status"] === "ok"));
  const narrativeAttempts = lastPerDay(tables.narrativeSnapshots);
  const dates = new Set<IsoDate>([...forecasts.keys(), ...adequacies.keys(), ...narrativesOk.keys()]);

  const valuesOf = (rows: readonly Row[], runId: string) =>
    rows.filter((r) => r["run_id"] === runId).sort((a, b) => Number(a["horizon_days"]) - Number(b["horizon_days"]));

  return [...dates]
    .sort()
    .reverse()
    .map((date) => {
      const f = forecasts.get(date);
      const a = adequacies.get(date);
      const n = narrativesOk.get(date);
      return {
        date,
        forecast: f
          ? {
              run_id: f.row["run_id"] ?? "",
              generated_at: f.row["generated_at"] ?? "",
              site: f.row["site"] ?? "",
              model_id: f.row["model_id"] ?? "",
              origin_level_masl: numberOrNull(f.row["origin_level_masl"]),
              horizons: valuesOf(tables.forecastValues, f.row["run_id"] ?? "").map((v) => ({
                horizon_days: Number(v["horizon_days"]),
                target_date: v["target_date"] ?? "",
                p10: numberOrNull(v["p10"]),
                p50: numberOrNull(v["p50"]),
                p90: numberOrNull(v["p90"]),
                // Rows written before per-horizon models existed leave this empty: they are all
                // the run's own model.
                model_id: v["model_id"] || f.row["model_id"] || "",
              })),
            }
          : null,
        adequacy: a
          ? {
              run_id: a.row["run_id"] ?? "",
              generated_at: a.row["generated_at"] ?? "",
              model_id: a.row["model_id"] ?? "",
              horizons: valuesOf(tables.adequacyValues, a.row["run_id"] ?? "").map((v) => ({
                horizon_days: Number(v["horizon_days"]),
                target_date: v["target_date"] ?? "",
                deficit_gwh_day: numberOrNull(v["deficit_gwh_day"]),
                margin_pct: numberOrNull(v["margin_pct"]),
                tier: v["tier"] ?? "",
              })),
            }
          : null,
        narrative: n
          ? {
              run_id: n.row["run_id"] ?? "",
              generated_at: n.row["generated_at"] ?? "",
              model_id: n.row["model_id"] ?? "",
              risk_tier: n.row["risk_tier"] ?? "",
              confidence: n.row["confidence"] ?? "",
              outlook_es: n.row["outlook_es"] ?? "",
              drivers: parseDrivers(n.row["drivers_json"]),
            }
          : null,
        runs: { forecast: f?.count ?? 0, adequacy: a?.count ?? 0, narrative: narrativeAttempts.get(date)?.count ?? 0 },
      };
    });
}

/** The worst tier among a day's horizons, by the order the adequacy model ranks them. */
export function worstTierOf(horizons: readonly { tier: string }[]): string | null {
  const rank = ["holgado", "vigilancia", "ajustado", "deficit"];
  let worst: string | null = null;
  for (const h of horizons) if (worst === null || rank.indexOf(h.tier) > rank.indexOf(worst)) worst = h.tier;
  return worst;
}
