#!/usr/bin/env node
/**
 * What the dashboard's `mridCaud` series actually is.
 *
 * Phase 3 brought in daily level and inflow for Coca Codo Sinclair, Agoyán and Manduriacu from
 * the historian mrids, and proved the *level* mrids are the same series the report endpoints
 * publish — Mazar's cota matched `repDiaHid12m` on all 31 control days to 0.0000 m. The flow
 * mrids inherited none of that. They are declared beside the level mrids in the same dashboard
 * component (`this.mridCota` / `this.mridCaud`), which makes "flow into the reservoir" the
 * obvious reading, but the ORDS publishes two flows per plant and they are nothing alike: on
 * 2026-09-21 Mazar's inflow was 37.6 m³/s and its turbined flow 100.8 m³/s. Reading one as the
 * other would not look wrong on a chart. It would quietly invert the relationship between rain
 * and reservoir for the three plants this project has no second source for.
 *
 * Mazar is the one plant where the question can be answered rather than argued: the historian
 * publishes mrid 30538 and the reports publish both candidate meanings for the same days. This
 * script lines all three up.
 *
 * Two independent readings, because either alone can mislead:
 *
 * 1. **Direct comparison.** Historian against each candidate, at a one-day shift in each
 *    direction, over every day they share. A series that *is* another series agrees to the
 *    digit, the way the cota control did; a series that merely correlates with it does not.
 * 2. **Clipping.** Turbined flow is bounded by the machines: it piles up against a ceiling and
 *    stops. Inflow has no ceiling and keeps a long right tail. Measuring how often each series
 *    sits within 1% of its own maximum separates the two shapes without knowing any plant's
 *    design flow, and it applies to the three plants the direct comparison cannot reach.
 *
 *   npm run crosscheck:caudal     writes data/crosschecks/caudal-semantics.md and .json
 *
 * Reads only what is committed under data/curated; no network.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED, DATA_ROOT } from "../src/lib/util/paths.ts";
import { addDays, nowUtc, type IsoDate } from "../src/lib/util/dates.ts";
import { HISTORIAN_SERIES, type SiteId } from "../src/lib/registry.ts";

/** The historian series under test, as stored: one source id, told apart by mrid. */
const HISTORIAN_SOURCE = "ords:pointValues";

/**
 * Below this many shared days, a winning candidate says more about which days each side has
 * been backfilled to than about what the series means.
 */
const MIN_DAYS_FOR_VERDICT = 30;

/**
 * How much worse the runner-up must be before the winner is called the answer. The two
 * candidates here are not close — inflow and turbined flow differ by a factor of three on an
 * ordinary day — so anything less than a clear order of magnitude between their errors means
 * the run has not separated them and should say so instead of picking.
 */
const SEPARATION = 10;

/** Within this fraction of a series' own maximum counts as sitting on its ceiling. */
const CEILING_BAND = 0.01;

interface Candidate {
  /** How the report endpoint names the quantity. */
  meaning: string;
  site: SiteId;
  variable: string;
  source: string;
}

/**
 * The two meanings the ORDS itself publishes for Mazar, plus the level pair as a calibration
 * line: cota is known to be the same series through both routes, so its numbers are what
 * "identical" looks like in this table.
 */
const CANDIDATES: Candidate[] = [
  { meaning: "inflow, 12-month report", site: "mazar", variable: "caudal_m3s", source: "ords:repDiaHid12m" },
  { meaning: "inflow, per-day report", site: "mazar", variable: "caudal_m3s", source: "ords:repDiaNivQIng" },
  { meaning: "turbined flow", site: "mazar", variable: "q_turbinado_m3s", source: "ords:repDiaPotQTurb" },
];

const REFERENCE: Candidate = {
  meaning: "level (known identical)",
  site: "mazar",
  variable: "cota_masl",
  source: "ords:repDiaHid12m",
};

interface Series {
  label: string;
  values: Map<IsoDate, number>;
}

interface Comparison {
  meaning: string;
  source: string;
  offset_days: number;
  compared: number;
  mean_abs_diff: number;
  median_abs_diff: number;
  p95_abs_diff: number;
  max_abs_diff: number;
  /** Share of days agreeing to within 0.1% of the report's value. */
  agree_pct: number;
  mean_ratio: number;
  correlation: number;
}

interface CeilingProfile {
  series: string;
  mrid: number | null;
  days: number;
  p50: number;
  p99: number;
  max: number;
  /** Share of days within CEILING_BAND of this series' own maximum. */
  on_ceiling_pct: number;
}

const round = (n: number, places = 3): number => Math.round(n * 10 ** places) / 10 ** places;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;
}

/** Every curated observation, keyed `site|variable|source|mrid` with an empty mrid for reports. */
function observations(): Map<string, Map<IsoDate, number>> {
  const directory = join(DATA_CURATED, "observations_daily");
  if (!existsSync(directory)) throw new Error(`no curated observations yet at ${directory}; run the ingest first`);
  const out = new Map<string, Map<IsoDate, number>>();
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv"))) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      const value = Number(row["value"]);
      if (!Number.isFinite(value)) continue;
      const key = `${row["site"]}|${row["variable"]}|${row["source"]}|${row["mrid"] ?? ""}`;
      const series = out.get(key) ?? out.set(key, new Map()).get(key)!;
      series.set(row["date"] as IsoDate, value);
    }
  }
  return out;
}

function compare(ours: Series, theirs: Series, candidate: Candidate, offset: number): Comparison {
  const pairs: { ours: number; theirs: number }[] = [];
  for (const [date, ourValue] of ours.values) {
    const theirValue = theirs.values.get(addDays(date, offset));
    if (theirValue === undefined) continue;
    pairs.push({ ours: ourValue, theirs: theirValue });
  }
  const absolute = pairs.map((p) => Math.abs(p.ours - p.theirs)).sort((a, b) => a - b);
  const n = pairs.length || 1;
  const meanOurs = pairs.reduce((a, p) => a + p.ours, 0) / n;
  const meanTheirs = pairs.reduce((a, p) => a + p.theirs, 0) / n;
  const cov = pairs.reduce((a, p) => a + (p.ours - meanOurs) * (p.theirs - meanTheirs), 0);
  const varOurs = pairs.reduce((a, p) => a + (p.ours - meanOurs) ** 2, 0);
  const varTheirs = pairs.reduce((a, p) => a + (p.theirs - meanTheirs) ** 2, 0);
  const ratios = pairs.filter((p) => p.theirs !== 0).map((p) => p.ours / p.theirs);

  return {
    meaning: candidate.meaning,
    source: candidate.source,
    offset_days: offset,
    compared: pairs.length,
    mean_abs_diff: round(absolute.reduce((a, b) => a + b, 0) / n, 4),
    median_abs_diff: round(quantile(absolute, 0.5), 4),
    p95_abs_diff: round(quantile(absolute, 0.95), 4),
    max_abs_diff: round(absolute.at(-1) ?? 0, 4),
    agree_pct: round((pairs.filter((p) => Math.abs(p.ours - p.theirs) <= Math.abs(p.theirs) * 0.001).length / n) * 100, 2),
    mean_ratio: ratios.length === 0 ? 0 : round(ratios.reduce((a, b) => a + b, 0) / ratios.length, 4),
    correlation: varOurs === 0 || varTheirs === 0 ? 0 : round(cov / Math.sqrt(varOurs * varTheirs), 4),
  };
}

function ceiling(label: string, mrid: number | null, values: Map<IsoDate, number>): CeilingProfile {
  const sorted = [...values.values()].sort((a, b) => a - b);
  const max = sorted.at(-1) ?? 0;
  return {
    series: label,
    mrid,
    days: sorted.length,
    p50: round(quantile(sorted, 0.5), 2),
    p99: round(quantile(sorted, 0.99), 2),
    max: round(max, 2),
    on_ceiling_pct: round((sorted.filter((v) => v >= max * (1 - CEILING_BAND)).length / (sorted.length || 1)) * 100, 2),
  };
}

function main(): void {
  const all = observations();
  const pick = (site: SiteId, variable: string, source: string, mrid: number | "" = ""): Map<IsoDate, number> =>
    all.get(`${site}|${variable}|${source}|${mrid}`) ?? new Map();

  const mazarCaudalMrid = HISTORIAN_SERIES.find((s) => s.site === "mazar" && s.variable === "caudal_m3s")?.mrid;
  if (!mazarCaudalMrid) throw new Error("the registry no longer carries a Mazar caudal mrid");

  const historian: Series = {
    label: `mazar/caudal_m3s (mrid ${mazarCaudalMrid})`,
    values: pick("mazar", "caudal_m3s", HISTORIAN_SOURCE, mazarCaudalMrid),
  };

  const comparisons: Comparison[] = [];
  for (const candidate of CANDIDATES) {
    const theirs: Series = {
      label: `${candidate.site}/${candidate.variable} (${candidate.source})`,
      values: pick(candidate.site, candidate.variable, candidate.source),
    };
    for (const offset of [-1, 0, 1]) {
      const result = compare(historian, theirs, candidate, offset);
      if (result.compared > 0) comparisons.push(result);
    }
  }

  // The level pair through the same two routes, as the measurement floor.
  const cotaMrid = HISTORIAN_SERIES.find((s) => s.site === "mazar" && s.variable === "cota_masl")!.mrid;
  const reference = compare(
    { label: `mazar/cota_masl (mrid ${cotaMrid})`, values: pick("mazar", "cota_masl", HISTORIAN_SOURCE, cotaMrid) },
    { label: "mazar/cota_masl (ords:repDiaHid12m)", values: pick("mazar", "cota_masl", "ords:repDiaHid12m") },
    REFERENCE,
    0,
  );

  /** Best offset per candidate meaning, and whether the overlap is long enough to mean it. */
  const best = new Map<string, Comparison>();
  for (const result of comparisons) {
    const current = best.get(result.meaning);
    if (!current || result.mean_abs_diff < current.mean_abs_diff) best.set(result.meaning, result);
  }
  const ranked = [...best.values()]
    .filter((r) => r.compared >= MIN_DAYS_FOR_VERDICT)
    .sort((a, b) => a.mean_abs_diff - b.mean_abs_diff);
  const short = [...best.values()].filter((r) => r.compared < MIN_DAYS_FOR_VERDICT);

  const winner = ranked[0];
  const runnerUp = ranked[1];
  let verdict: string;
  let settled = false;
  if (!winner) {
    verdict =
      `No candidate has ${MIN_DAYS_FOR_VERDICT} shared days yet, so this run makes no claim about what ` +
      `mrid ${mazarCaudalMrid} means. Backfill the historian control and the per-day reports over the same span.`;
  } else if (!runnerUp) {
    verdict =
      `Only one candidate has ${MIN_DAYS_FOR_VERDICT} shared days (${winner.meaning}, mean absolute ` +
      `difference ${winner.mean_abs_diff} m³/s over ${winner.compared} days). A single candidate cannot be ` +
      `separated from the one it was not compared against; backfill the other before reading this as an answer.`;
  } else if (runnerUp.mean_abs_diff < winner.mean_abs_diff * SEPARATION) {
    verdict =
      `Not separated: ${winner.meaning} is off by ${winner.mean_abs_diff} m³/s and ${runnerUp.meaning} by ` +
      `${runnerUp.mean_abs_diff}, closer than the ${SEPARATION}x this check asks for before naming one. ` +
      `mrid ${mazarCaudalMrid} stays undeclared.`;
  } else {
    settled = true;
    verdict =
      `mrid ${mazarCaudalMrid} is **${winner.meaning}**: ${winner.mean_abs_diff} m³/s mean absolute difference ` +
      `over ${winner.compared} days at offset ${winner.offset_days >= 0 ? "+" : ""}${winner.offset_days}, ` +
      `against ${runnerUp.mean_abs_diff} for ${runnerUp.meaning} — ` +
      `${round(runnerUp.mean_abs_diff / (winner.mean_abs_diff || 1e-9), 1)}x worse.`;
  }

  // The shape check, on every plant. Mazar's two report series calibrate it: one is known
  // inflow, the other known turbined flow, so the three unreachable plants can be read against
  // a scale measured here rather than assumed.
  const profiles: CeilingProfile[] = [];
  for (const series of HISTORIAN_SERIES.filter((s) => s.variable === "caudal_m3s")) {
    const values = pick(series.site, "caudal_m3s", HISTORIAN_SOURCE, series.mrid);
    if (values.size > 0) profiles.push(ceiling(`${series.site}/caudal_m3s (historian)`, series.mrid, values));
  }
  for (const candidate of CANDIDATES) {
    const values = pick(candidate.site, candidate.variable, candidate.source);
    if (values.size > 0) profiles.push(ceiling(`mazar/${candidate.variable} (${candidate.meaning})`, null, values));
  }

  const dates = [...historian.values.keys()].sort();
  const report = {
    generated_at: nowUtc(),
    mrid: mazarCaudalMrid,
    historian_days: historian.values.size,
    historian_span: dates.length ? `${dates[0]} .. ${dates.at(-1)}` : "none",
    settled,
    verdict,
    comparisons,
    reference,
    short_overlap: short,
    ceiling_profiles: profiles,
  };

  const lines = [
    "# What `mridCaud` means",
    "",
    `Generated ${nowUtc()} from the committed tables; no network.`,
    "",
    `Mazar's flow mrid (${mazarCaudalMrid}) is the only one that can be checked: the ORDS reports publish both`,
    "candidate meanings for the same plant and the same days. The three plants that have no report",
    "coverage — Coca Codo Sinclair, Agoyán and Manduriacu — inherit the answer through the dashboard",
    "bundle, which declares their flow mrids exactly as it declares Mazar's.",
    "",
    "## Verdict",
    "",
    verdict,
    "",
    `Historian: ${report.historian_days} days, ${report.historian_span}.`,
    "",
    "## Historian against each meaning the reports publish",
    "",
    "| meaning | source | offset | days | mean abs diff (m³/s) | median | p95 | max | agree to 0.1% | mean ratio | r |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...comparisons
      .sort((a, b) => a.meaning.localeCompare(b.meaning) || a.offset_days - b.offset_days)
      .map(
        (r) =>
          `| ${r.meaning} | ${r.source} | ${r.offset_days >= 0 ? "+" : ""}${r.offset_days} d | ${r.compared} | ` +
          `${r.mean_abs_diff} | ${r.median_abs_diff} | ${r.p95_abs_diff} | ${r.max_abs_diff} | ${r.agree_pct}% | ` +
          `${r.mean_ratio} | ${r.correlation} |`,
      ),
    "",
    "The level pair, through the same two routes, is what agreement looks like when two series are",
    "the same series:",
    "",
    `| ${reference.meaning} | ${reference.source} | +0 d | ${reference.compared} | ${reference.mean_abs_diff} |` +
      ` ${reference.median_abs_diff} | ${reference.p95_abs_diff} | ${reference.max_abs_diff} |` +
      ` ${reference.agree_pct}% | ${reference.mean_ratio} | ${reference.correlation} |`,
    "",
    ...(short.length === 0
      ? []
      : [
          `Candidates with fewer than ${MIN_DAYS_FOR_VERDICT} shared days are listed but not ranked; over an`,
          "overlap that short the winner is decided by how far each side has been backfilled:",
          "",
          ...short.map((r) => `- ${r.meaning} (${r.source}): ${r.compared} days`),
          "",
        ]),
    "## Does the series run into a ceiling?",
    "",
    "Turbined flow stops at the machines and piles up against that limit; inflow does not. This needs",
    "no design-flow figure — a series that spends a large share of its days within",
    `${CEILING_BAND * 100}% of its own maximum is clipped, and one that touches its maximum once is not.`,
    "Mazar's two report series set the scale, since one is known inflow and the other known turbined",
    "flow.",
    "",
    "| series | mrid | days | p50 | p99 | max | days on ceiling |",
    "|---|---|---|---|---|---|---|",
    ...profiles.map(
      (p) => `| ${p.series} | ${p.mrid ?? "—"} | ${p.days} | ${p.p50} | ${p.p99} | ${p.max} | ${p.on_ceiling_pct}% |`,
    ),
    "",
  ];

  const directory = join(DATA_ROOT, "crosschecks");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "caudal-semantics.json"), `${JSON.stringify(report, null, 1)}\n`);
  writeFileSync(join(directory, "caudal-semantics.md"), `${lines.join("\n")}\n`);
  console.log(verdict);
  console.log(`wrote ${join(directory, "caudal-semantics.md")}`);
}

main();
