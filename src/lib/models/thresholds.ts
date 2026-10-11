/**
 * The levels a reservoir forecast is read against, from `data/reference/thresholds.csv`.
 *
 * Three kinds of row live there, and the difference is the whole point of keeping them apart. A
 * *declaration* is a band CELEC publishes — Mazar's 2098 from the dashboard's chart title, 2100
 * from both report endpoints — with the days it was observed. An *operational minimum* is the
 * floor CELEC actually runs the plant to: Mazar's 2115, below which CELEC Sur takes the units
 * offline for sediment risk to the turbines. No endpoint publishes it; CELEC Sur's statements
 * through the press do, and the plant left service near it in April and November 2024, so it is
 * the minimum the pages and the forecast read Mazar against, with the design floors beside it. A
 * *marker* is this project's own number, with no ceiling and a declaration that says
 * `unverified`, which is how every output labels it so nobody downstream mistakes it for CELEC's.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../store/csv.ts";
import { DATA_REFERENCE } from "../util/paths.ts";
import type { ThresholdRef } from "./forecast.ts";

/** A row whose declaration says this is the project's marker rather than something published. */
export function isUnverifiedMarker(row: Record<string, string>): boolean {
  return /unverified/i.test(row["declaration"] ?? "");
}

/** A row giving the floor CELEC operates the plant to, as opposed to a design floor. */
export function isOperationalMinimum(row: Record<string, string>): boolean {
  return /operational minimum/i.test(row["declaration"] ?? "");
}

export function readThresholdRows(root: string = DATA_REFERENCE): Record<string, string>[] {
  const path = join(root, "thresholds.csv");
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

/** Every distinct floor for `site`, highest first; markers first among equals. */
export function thresholdsFor(site: string, rows: readonly Record<string, string>[] = readThresholdRows()): ThresholdRef[] {
  const out: ThresholdRef[] = [];
  const seen = new Set<number>();
  const ordered = [...rows]
    .filter((row) => (row["site"] ?? "") === site)
    .sort((a, b) => Number(isUnverifiedMarker(b)) - Number(isUnverifiedMarker(a)));
  for (const row of ordered) {
    const level = Number(row["cota_min_masl"] ?? "");
    if ((row["cota_min_masl"] ?? "") === "" || !Number.isFinite(level) || seen.has(level)) continue;
    seen.add(level);
    out.push(
      isUnverifiedMarker(row)
        ? {
            name: "critical (plan)",
            levelMasl: level,
            source: row["source"] ?? "",
            status: "unverified",
            note: "No upstream source publishes this level; it is this project's own critical marker.",
          }
        : isOperationalMinimum(row)
          ? {
              name: "operational minimum",
              levelMasl: level,
              source: row["source"] ?? "",
              status: "published",
              note: `Observed ${row["observed_from"] ?? "?"} → ${row["observed_to"] ?? "?"}. The floor CELEC operates the plant to; lower floors are design figures.`,
            }
          : {
              name: `declared minimum (${row["declaration"] ?? "unknown"})`,
              levelMasl: level,
              source: row["source"] ?? "",
              status: "published",
              note: `Observed ${row["observed_from"] ?? "?"} → ${row["observed_to"] ?? "?"}.`,
            },
    );
  }
  return out.sort((a, b) => b.levelMasl - a.levelMasl);
}

/**
 * The level a site's crisis check runs against: the project's own marker when it has one, else
 * its operational minimum, else null.
 */
export function criticalMarker(site: string, rows: readonly Record<string, string>[] = readThresholdRows()): ThresholdRef | null {
  const thresholds = thresholdsFor(site, rows);
  return thresholds.find((t) => t.status === "unverified") ?? thresholds.find((t) => t.name === "operational minimum") ?? null;
}
