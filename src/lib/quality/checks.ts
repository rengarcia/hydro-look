/**
 * Checks on what is *on disk*, as opposed to the zod contracts, which guard what is written.
 *
 * The two do different jobs and neither replaces the other. A contract runs inside `upsert` and
 * refuses a drifted parse before it can touch a file; these run over the committed CSVs and
 * catch what a row-by-row contract structurally cannot see: a duplicated key, a column order
 * that moved, a level that parsed as a number but is nowhere near its reservoir, a reference
 * table naming a site the registry does not have. They also cover the files no contract
 * governs at all — everything under `data/reference/`, which is committed input.
 *
 * Findings are graded. `fail` is for something that is wrong: a shape that cannot be right, or
 * a value no plausible reading produces. `warn` is for something that deserves a look but has
 * a legitimate explanation. `info` carries counts worth watching, including the documented SMEC
 * anomalies of §6 Phase 2 — those are expected, and the point of counting them is that a change
 * in the count is visible rather than silent.
 */

import { SITES } from "../registry.ts";
import type { TableSpec } from "../contracts/tables.ts";

export type Level = "fail" | "warn" | "info";

export interface Finding {
  check: string;
  level: Level;
  message: string;
}

export type Rows = Record<string, string>[];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isNumeric(value: string): boolean {
  return value !== "" && Number.isFinite(Number(value));
}

/** Header, key uniqueness and column shape for one curated table. */
export function checkTableShape<T>(spec: TableSpec<T>, rows: Rows, header: string[] | null): Finding[] {
  const out: Finding[] = [];
  const check = `shape:${spec.name}`;
  if (rows.length === 0) {
    out.push({ check, level: "info", message: `${spec.name} is empty` });
    return out;
  }

  if (header && header.join(",") !== spec.columns.join(",")) {
    out.push({
      check,
      level: "fail",
      message: `${spec.name} header is ${header.join(",")}, the contract says ${spec.columns.join(",")}`,
    });
  }

  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = spec.key.map((column) => row[column] ?? "").join("\u0000");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen].filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    out.push({
      check,
      level: "fail",
      message:
        `${spec.name} has ${duplicates.length} duplicated key(s) on (${spec.key.join(", ")}), ` +
        `first: ${duplicates[0]![0].replaceAll("\u0000", "|")}`,
    });
  }
  return out;
}

export interface Band {
  min: number;
  max: number;
}

/**
 * The widest band declared for each site, across every declaration in `thresholds.csv`.
 *
 * Widest, because the three declarations disagree — Amaluza's floor is 1975, 1970 or 1960
 * depending on who you ask — and a range check has no business picking a winner between them.
 */
export function widestBands(thresholds: Rows): Map<string, Band> {
  const bands = new Map<string, Band>();
  for (const row of thresholds) {
    const site = row["site"] ?? "";
    const min = Number(row["cota_min_masl"]);
    const max = Number(row["cota_max_masl"]);
    if (!site || !Number.isFinite(min) || !Number.isFinite(max)) continue;
    const current = bands.get(site);
    bands.set(site, current ? { min: Math.min(current.min, min), max: Math.max(current.max, max) } : { min, max });
  }
  return bands;
}

/**
 * Values that no plausible reading produces.
 *
 * The level bound is deliberately loose: half a band width outside the declared band. A
 * reservoir really does draw below its minimum and really does spill above its maximum, so a
 * tight bound would cry wolf every drought. What it does catch is the failure that matters —
 * a parser reading the wrong column, or a unit change — which lands orders of magnitude out.
 */
/** Mirrors the parser's ceiling: the gate and the rule it backs up must not disagree. */
const INFLOW_CEILING_M3S = 10_000;

export function checkObservationRanges(observations: Rows, bands: Map<string, Band>): Finding[] {
  const out: Finding[] = [];
  const check = "range:observations_daily";
  let offBand = 0;
  let firstOffBand = "";
  let offBook = 0;
  let firstOffBook = "";

  for (const row of observations) {
    const variable = row["variable"] ?? "";
    const site = row["site"] ?? "";
    const raw = row["value"] ?? "";
    if (!isNumeric(raw)) {
      out.push({ check, level: "fail", message: `${site}/${variable} on ${row["date"]} has a non-numeric value ${JSON.stringify(raw)}` });
      continue;
    }
    const value = Number(raw);

    if (variable === "cota_masl") {
      const band = bands.get(site);
      if (band) {
        const slack = (band.max - band.min) / 2;
        if (value < band.min - slack || value > band.max + slack) {
          offBand++;
          firstOffBand ||= `${site} ${row["date"]} ${value} outside ${band.min}..${band.max}`;
        }
      }
    } else if (
      (variable === "caudal_m3s" ||
        variable === "q_turbinado_m3s" ||
        variable === "caudal_cuenca_m3s" ||
        variable === "produccion_mwh" ||
        variable === "energia_plan_mwh" ||
        variable === "volumen_vertido_hm3" ||
        variable === "unidades_linea") &&
      value < 0
    ) {
      out.push({ check, level: "fail", message: `${site}/${variable} on ${row["date"]} is negative (${value})` });
    } else if (variable === "caudal_m3s" && (value > INFLOW_CEILING_M3S || (value === 0 && row["source"] === "ords:pointValues"))) {
      // The parser drops both of these on the way in, so anything reaching the table came by a
      // route that rule does not cover — which is the case worth failing on. They are one fault
      // seen twice: the historian gave Mazar 23,221.10 m3/s on 2013-11-27 and then 0.00 on the two
      // days after, and its 82 zeros sit below every one of those series' own non-zero minimums,
      // the lowest of which is 10.40. Neither is a river.
      //
      // The zero half is asked only of the historian, because only there does it mean anything.
      // The 12-month reports publish whole m3/s, so their 0 is `round(x)` for x below 0.5 — on
      // 2024-11-08 `repDiaHid12m` published 0 and the historian published 0.142 for the same day.
      // Failing that row would fail the truest reading in the drought.
      out.push({
        check,
        level: "fail",
        message:
          value === 0
            ? `${site}/${variable} on ${row["date"]} is zero on ${row["source"]}, which publishes decimals, so it is a missing reading rather than a stopped river`
            : `${site}/${variable} on ${row["date"]} is ${value}, above the ${INFLOW_CEILING_M3S} m3/s no Ecuadorian intake sees`,
      });
    } else if (variable === "nivel_pct_banda" || variable === "factor_planta_pct") {
      // These percentages are the same reading as the level above, divided by a declared band,
      // so they inherit its looseness and this rule has to match the one for cota. Mazar sat
      // above its declared 2153 maximum on 25 days of June and July 2026, peaking at 2154.05 —
      // 102% of a band it is perfectly entitled to exceed — and Minas San Francisco ran at
      // 100.8% of a nominal capacity that is a press figure. Failing on those taught nothing
      // except to stop reading the gate. Beyond half a band width either way there is no
      // reading left to explain, only a parser in the wrong column or a fraction stored as a
      // percent, and that still fails.
      if (value < -50 || value > 150) {
        out.push({ check, level: "fail", message: `${site}/${variable} on ${row["date"]} is ${value}, outside -50..150` });
      } else if (value < 0 || value > 100) {
        offBook++;
        firstOffBook ||= `${site}/${variable} ${row["date"]} ${value}`;
      }
    }
  }

  if (offBand > 0) {
    out.push({
      check,
      level: "fail",
      message: `${offBand} level reading(s) sit more than half a band width outside the declared band; first: ${firstOffBand}`,
    });
  }
  if (offBook > 0) {
    out.push({
      check,
      level: "warn",
      message: `${offBook} percentage(s) sit outside 0..100 — a reservoir above its declared band or a plant above nominal capacity, not an error; first: ${firstOffBook}`,
    });
  }
  return out;
}

/** `data/reference/` is committed input, so nothing else validates it. */
export function checkReference(reference: { plants: Rows; thresholds: Rows; rationing: Rows }): Finding[] {
  const out: Finding[] = [];
  const known = new Set(Object.keys(SITES));

  for (const row of reference.plants) {
    const site = row["site_id"] ?? "";
    if (site && !known.has(site)) {
      out.push({ check: "reference:plants", level: "fail", message: `plants.csv names site_id "${site}", which the registry does not have` });
    }
    if (row["capacity_mw"] && !isNumeric(row["capacity_mw"])) {
      out.push({ check: "reference:plants", level: "fail", message: `plants.csv capacity_mw "${row["capacity_mw"]}" is not a number` });
    }
    // The capacities came from press and the plan asked for them to stay marked until checked
    // against ARCONEL. An unverified row is expected; a row claiming verification without a
    // date is the one that would mislead.
    if (row["capacity_status"] === "verified" && !ISO_DATE.test(row["verified_on"] ?? "")) {
      out.push({ check: "reference:plants", level: "fail", message: `plants.csv marks ${row["plant"]} verified with no verified_on date` });
    }
  }

  for (const row of reference.thresholds) {
    const site = row["site"] ?? "";
    if (!known.has(site)) {
      out.push({ check: "reference:thresholds", level: "fail", message: `thresholds.csv names site "${site}", which the registry does not have` });
    }
    const min = Number(row["cota_min_masl"]);
    const max = Number(row["cota_max_masl"]);
    if (Number.isFinite(min) && Number.isFinite(max) && min >= max) {
      out.push({ check: "reference:thresholds", level: "fail", message: `thresholds.csv has ${site} min ${min} >= max ${max} (${row["source"]})` });
    }
  }

  for (const row of reference.rationing) {
    const start = row["start"] ?? "";
    const end = row["end"] ?? "";
    if (!ISO_DATE.test(start)) {
      out.push({ check: "reference:rationing", level: "fail", message: `rationing_episodes.csv start "${start}" is not YYYY-MM-DD` });
      continue;
    }
    if (end !== "" && (!ISO_DATE.test(end) || end < start)) {
      out.push({ check: "reference:rationing", level: "fail", message: `rationing_episodes.csv episode from ${start} ends "${end}"` });
    }
    if (row["end_status"] === "open" && end !== "") {
      out.push({ check: "reference:rationing", level: "fail", message: `rationing_episodes.csv row from ${start} is marked open but carries an end date` });
    }
  }

  const unverified = reference.rationing.filter((r) => r["status"] !== "verified").length;
  if (unverified > 0) {
    out.push({
      check: "reference:rationing",
      level: "info",
      message: `${unverified}/${reference.rationing.length} rationing episodes are still unverified against a source article`,
    });
  }
  return out;
}

/**
 * The SMEC anomalies §6 Phase 2 recorded and deliberately left in the data.
 *
 * They are flagged, not dropped, so the check counts them rather than failing on them. What
 * would be new information is the count changing: a backfill that re-fetched one of these days
 * and got a different answer, or a new day joining them.
 */
export function checkNationalBalance(national: Rows): Finding[] {
  const byDate = new Map<string, Map<string, number>>();
  for (const row of national) {
    const date = row["date"] ?? "";
    const value = Number(row["dia_kwh"]);
    if (!date || !Number.isFinite(value)) continue;
    (byDate.get(date) ?? byDate.set(date, new Map()).get(date)!).set(row["concepto"] ?? "", value);
  }

  let demandOverSupply = 0;
  const overTwice: string[] = [];
  for (const [date, concepts] of byDate) {
    const generation = concepts.get("total_generacion");
    const demand = concepts.get("demanda_distribucion");
    const imports = concepts.get("total_importacion") ?? 0;
    const exports = concepts.get("total_exportacion") ?? 0;
    if (generation === undefined || demand === undefined || demand <= 0) continue;
    const load = generation + imports - exports;
    if (demand > load) demandOverSupply++;
    if (load >= 2 * demand) overTwice.push(date);
  }

  return [
    { check: "smec:anomalies", level: "info", message: `${byDate.size} SMEC days stored` },
    {
      check: "smec:anomalies",
      level: "info",
      message:
        `${demandOverSupply} day(s) report distribution demand above generación + importación − exportación ` +
        `(documented in §6 Phase 2 as flagged, not dropped; any model should exclude them — ` +
        `\`features/balance.ts\` does)`,
    },
    {
      // The opposite fault, and it is not symmetric with the one above: that one is a page
      // rendered before its generation metering arrived, this one is a page whose generation is
      // present and wrong. 2025-07-17 and -18 are the only two in the record — CENACE published
      // "generación de otros tipos" at 153.62 and 113.19 GWh against a fortnight's median of
      // 2.2, flagging it in its own pct_dia column at +6,284% — and they lift national
      // generation to 247 GWh on a 91 GWh day. Counted rather than dropped, for the same reason
      // as the others: a change in the count should be visible.
      check: "smec:anomalies",
      level: overTwice.length > 2 ? "warn" : "info",
      message:
        `${overTwice.length} day(s) report generación + importación − exportación at twice distribution ` +
        `demand or more${overTwice.length > 0 ? ` (${overTwice.slice(0, 5).join(", ")})` : ""}; ` +
        `excluded by \`features/balance.ts\``,
    },
  ];
}

export interface FreshnessRule {
  /** Label shown in the finding. */
  label: string;
  /** Most recent date found for this feed, or null when it has never been ingested. */
  latest: string | null;
  /** Days after which the feed counts as stale. */
  maxAgeDays: number;
}

/**
 * Staleness, which is the one check that depends on the clock — so it runs after an ingest,
 * not in CI, where it would start failing on a pull request the moment the data aged.
 *
 * A feed that has never produced a row is reported as `info`, not `fail`. "Not ingested yet"
 * and "stopped working" are different conditions and only the second is a problem; the
 * historian is exactly this case until its first run lands.
 */
export function checkFreshness(rules: FreshnessRule[], today: string): Finding[] {
  return rules.map((rule) => {
    if (rule.latest === null) {
      return { check: "freshness", level: "info" as Level, message: `${rule.label} has no rows yet` };
    }
    const age = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${rule.latest}T00:00:00Z`)) / 86_400_000);
    if (age > rule.maxAgeDays) {
      return { check: "freshness", level: "fail" as Level, message: `${rule.label} is ${age} days old (limit ${rule.maxAgeDays}), latest ${rule.latest}` };
    }
    return { check: "freshness", level: "info" as Level, message: `${rule.label} is ${age} days old, latest ${rule.latest}` };
  });
}

/** How a `raw_ref` resolved: in the current day-file layout, only through a pre-2026-09 bundle ref, or not at all. */
export type RefResolution = "current" | "legacy" | null;

/**
 * Every `raw_ref` in the curated tables names an archived response that exists.
 *
 * The README promises the raw response next to the row, and until this check nothing held the
 * promise: a write that stopped between the tables and the archive, or a migration that missed
 * a bundle, would leave rows pointing at nothing until someone tried to reprocess one. A ref
 * that resolves only in the old bundle form is a `warn` — it still reads, but it means a batch
 * staged before the layout change was applied without being rewritten.
 *
 * `resolve` is called once per distinct ref; XM rows carry two, space-separated.
 */
export function checkRawRefs(tables: { name: string; rows: Rows }[], resolve: (ref: string) => RefResolution): Finding[] {
  const out: Finding[] = [];
  const seen = new Map<string, RefResolution>();
  for (const table of tables) {
    const missing: string[] = [];
    let legacy = 0;
    let refs = 0;
    for (const row of table.rows) {
      const cell = row["raw_ref"] ?? "";
      const parts = cell.split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        missing.push("(empty)");
        continue;
      }
      for (const ref of parts) {
        refs++;
        let resolution = seen.get(ref);
        if (resolution === undefined) {
          resolution = resolve(ref);
          seen.set(ref, resolution);
        }
        if (resolution === null) missing.push(ref);
        else if (resolution === "legacy") legacy++;
      }
    }
    const check = `raw_ref:${table.name}`;
    if (missing.length > 0) {
      out.push({ check, level: "fail", message: `${table.name}: ${missing.length} raw_refs resolve to no archived response; first: ${missing[0]}` });
    }
    if (legacy > 0) {
      out.push({ check, level: "warn", message: `${table.name}: ${legacy} raw_refs still name a pre-2026-09 gzip bundle (scripts/migrate-raw.ts rewrites them)` });
    }
    out.push({ check, level: "info", message: `${table.name}: ${refs} raw_refs checked` });
  }
  return out;
}

/**
 * Rows the ingest set aside instead of writing (see CuratedStore.upsert). The write carries on
 * so one drifted endpoint cannot hold back every other; this is where it stops being quiet.
 * The file says which rows and why; once the parser or the data is fixed and the batch
 * re-applied, delete it.
 */
export function checkQuarantine(files: string[]): Finding[] {
  if (files.length === 0) return [{ check: "quarantine", level: "info", message: "quarantine is empty" }];
  return [
    {
      check: "quarantine",
      level: "fail",
      message: `${files.length} quarantine file(s) hold rows that failed their contract: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ", …" : ""}`,
    },
  ];
}

export function worstLevel(findings: Finding[]): Level {
  if (findings.some((f) => f.level === "fail")) return "fail";
  if (findings.some((f) => f.level === "warn")) return "warn";
  return "info";
}
