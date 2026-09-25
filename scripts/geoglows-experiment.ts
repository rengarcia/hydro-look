#!/usr/bin/env node
/**
 * Does the GEOGLOWS forecast — raw from its archive, or corrected by INAMHI — improve this
 * repository's inflow forecasts? PLAN.md Phase 7.
 *
 * Reads what the two backtests already archived, so it touches the network only for the
 * retrospective simulation (a few chunks per river):
 *
 * - `data/reports/geoglows-forecast.json` → `runs`: every third day's high-resolution forecast
 *   since 2024-07-01, daily means at leads 1–10, per dam (`npm run geoglows:forecast`);
 * - `data/raw/inamhi/hydropower/*.ndjson.gz`: INAMHI's corrected forecasts, every third day since
 *   2025-05-29, ensemble mean to 15 days, per plant (`npm run inamhi:hydropower`).
 *
 * A forecast issued at 00 UTC on day F is used at origin F − 1, the last day CELEC has published
 * when the daily job runs, and scored on the mean inflow of `(origin, origin + h]` — the §5.3
 * target — against the three rungs `backtestInflow` scores, all on the same cases. See
 * `src/lib/models/geoglows-inflow.ts` for the candidates.
 *
 * Writes `data/reports/geoglows-experiment.{md,json}`.
 *
 *   npm run geoglows:experiment
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { loadSeries, type DailySeries } from "../src/lib/features/series.ts";
import { PLANT_PRECIP_BASIN, readEra5ByBasin, selectPrecipBasin } from "../src/lib/features/weather.ts";
import { readSimulated } from "../src/lib/geo/geoglows-stores.ts";
import {
  anomalyForecast,
  blockBootstrap,
  forecastWindowMean,
  originForIssue,
  windowClimatology,
  type PairedDifference,
} from "../src/lib/models/geoglows-inflow.ts";
import { dailyMeans } from "../src/lib/models/geoglows-forecast.ts";
import { predictInflow, windowMean, type InflowModelId } from "../src/lib/models/inflow.ts";
import { INAMHI_PLANTS, parseForecastCsv } from "../src/lib/parse/inamhi-hydropower.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { nowUtc, type IsoDate } from "../src/lib/util/dates.ts";
import { DATA_RAW, repoPath } from "../src/lib/util/paths.ts";

const SITES = ["mazar", "amaluza", "coca_codo_sinclair", "agoyan", "manduriacu", "minas_san_francisco", "delsitanisagua"] as const;
const GEOGLOWS_HORIZONS = [7, 10] as const;
const INAMHI_HORIZONS = [7, 14] as const;
/** The simulation's climatology is taken from this year on: the whole retrospective. */
const SIM_FIRST_YEAR = 1940;
/** Origins are three days apart and windows up to 14 days long: about this many neighbours share days. */
const BOOTSTRAP_BLOCK = 5;
const BASELINES: InflowModelId[] = ["persistence", "climatology", "analogue"];

type Runs = Map<IsoDate, (number | null)[]>;

function geoglowsRuns(): Map<string, Runs> {
  const path = repoPath("data", "reports", "geoglows-forecast.json");
  const doc = JSON.parse(readFileSync(path, "utf8")) as { runs?: Record<string, { origin: IsoDate; daily: (number | null)[] }[]> };
  if (!doc.runs) {
    console.warn(`${path} has no "runs" (written before they were kept): rerun npm run geoglows:forecast; GEOGLOWS is skipped`);
    return new Map();
  }
  return new Map(Object.entries(doc.runs).map(([site, runs]) => [site, new Map(runs.map((r) => [r.origin, r.daily]))]));
}

function inamhiRuns(): Map<string, Runs> {
  const dir = join(DATA_RAW, "inamhi", "hydropower");
  const out = new Map<string, Runs>();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ndjson.gz"))) {
    for (const line of gunzipSync(readFileSync(join(dir, file)))
      .toString("utf8")
      .split("\n")) {
      if (!line.trim()) continue;
      const a = JSON.parse(line) as { url: string; status: number; body: string };
      const m = /get-forecast-csv\?hydropower=([^&]+)&date=(\d{4}-\d{2}-\d{2})/.exec(a.url);
      if (!m || a.status !== 200 || !a.body.startsWith("datetime")) continue;
      const site = INAMHI_PLANTS[decodeURIComponent(m[1]!)];
      if (!site) continue;
      const parsed = parseForecastCsv(a.body, m[2]!);
      const runs = out.get(site) ?? out.set(site, new Map()).get(site)!;
      runs.set(m[2]!, dailyMeans(parsed["flow_avg"]!.hours, parsed["flow_avg"]!.values, 15, 6));
    }
  }
  return out;
}

interface Case {
  origin: IsoDate;
  actual: number;
  p: Record<string, number>;
}

interface Scored {
  site: string;
  source: "geoglows" | "inamhi";
  horizon: number;
  n: number;
  first: IsoDate | null;
  last: IsoDate | null;
  mae: Record<string, number>;
  /** Candidate − analogue and candidate − the better of persistence and climatology, paired. */
  vsAnalogue: Record<string, PairedDifference>;
  vsBestBaseline: Record<string, PairedDifference>;
  /** Blend − control, and the three-way blend − control. */
  vsControl: PairedDifference;
  blend3VsControl: PairedDifference;
}

function cut(series: DailySeries, origin: IsoDate): DailySeries {
  const out: DailySeries = new Map();
  for (const [d, v] of series) {
    if (d > origin) break;
    out.set(d, v);
  }
  return out;
}

function score(site: string, source: Scored["source"], horizon: number, cases: Case[], candidates: string[]): Scored {
  const names = [...BASELINES, ...candidates];
  const mae = Object.fromEntries(names.map((n) => [n, cases.reduce((a, c) => a + Math.abs(c.actual - c.p[n]!), 0) / cases.length]));
  const bestBaseline = mae["persistence"]! <= mae["climatology"]! ? "persistence" : "climatology";
  const paired = (a: string, b: string) =>
    blockBootstrap(
      cases.map((c) => Math.abs(c.actual - c.p[a]!) - Math.abs(c.actual - c.p[b]!)),
      BOOTSTRAP_BLOCK,
    );
  return {
    site,
    source,
    horizon,
    n: cases.length,
    first: cases[0]?.origin ?? null,
    last: cases.at(-1)?.origin ?? null,
    mae,
    vsAnalogue: Object.fromEntries(candidates.map((c) => [c, paired(c, "analogue")])),
    vsBestBaseline: Object.fromEntries(candidates.map((c) => [c, paired(c, bestBaseline)])),
    vsControl: paired("blend", "control"),
    blend3VsControl: paired("blend3", "control"),
  };
}

const fmt = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const interval = (d: PairedDifference | undefined) =>
  d ? `${d.meanDiff > 0 ? "+" : ""}${fmt(d.meanDiff)} [${fmt(d.lo)}, ${fmt(d.hi)}]${d.hi < 0 ? " ✓" : ""}` : "—";

async function main(): Promise<void> {
  const startedAt = nowUtc();
  const series = loadSeries();
  const era5 = readEra5ByBasin();
  const reference = parseCsv(readFileSync(repoPath("data", "reference", "geoglows_return_periods.csv"), "utf8"));
  const riverOf = new Map(reference.map((r) => [r["site"]!, Number(r["river_id"])]));
  const geoglows = geoglowsRuns();
  const inamhi = inamhiRuns();
  const simulated = await readSimulated(SITES.flatMap((s) => (riverOf.has(s) ? [riverOf.get(s)!] : [])));
  console.log(
    `GEOGLOWS runs for ${geoglows.size} sites, INAMHI runs for ${inamhi.size}; simulation read for ${simulated.series.size} rivers`,
  );

  const results: Scored[] = [];
  for (const site of SITES) {
    const inflow = series.get(site, "caudal_m3s");
    const choice = selectPrecipBasin(era5, PLANT_PRECIP_BASIN[site] ?? "", "");
    const precip = choice.preferred ? choice.series : null;
    const sim = riverOf.has(site) ? simulated.series.get(riverOf.get(site)!) : undefined;

    for (const [source, runsBySite, horizons] of [
      ["geoglows", geoglows, GEOGLOWS_HORIZONS],
      ["inamhi", inamhi, INAMHI_HORIZONS],
    ] as const) {
      const runs = runsBySite.get(site);
      if (!runs || (source === "geoglows" && !sim)) continue;
      const byH = new Map<number, Case[]>(horizons.map((h) => [h, []]));
      for (const [issued, daily] of [...runs].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const origin = originForIssue(issued);
        if (!inflow.has(origin)) continue;
        const known = cut(inflow, origin);
        const knownPrecip = precip ? cut(precip, origin) : null;
        for (const h of horizons) {
          const actual = windowMean(inflow, origin, h);
          const f = forecastWindowMean(daily, h);
          if (actual === null || f === null) continue;
          const base = BASELINES.map((m) => predictInflow(m, known, origin, h, undefined, knownPrecip));
          if (base.some((b) => b === null)) continue;
          const [persistence, climatology, analogue] = base.map((b) => b!.p50) as [number, number, number];
          // The control: any average of two different guesses can beat each, so the candidates must beat this one.
          const p: Record<string, number> = { persistence, climatology, analogue, control: (analogue + climatology) / 2 };
          if (source === "geoglows") {
            const simClimatology = windowClimatology(sim!, origin, h, SIM_FIRST_YEAR);
            const anomaly = simClimatology === null ? null : anomalyForecast(climatology, f, simClimatology);
            if (anomaly === null) continue;
            p["anomaly"] = anomaly;
            p["blend"] = (analogue + anomaly) / 2;
            p["blend3"] = (analogue + climatology + anomaly) / 3;
          } else {
            p["inamhi"] = f;
            p["blend"] = (analogue + f) / 2;
            p["blend3"] = (analogue + climatology + f) / 3;
          }
          byH.get(h)!.push({ origin, actual, p });
        }
      }
      for (const h of horizons) {
        const cases = byH.get(h)!;
        if (cases.length < 20) continue;
        const scored = score(
          site,
          source,
          h,
          cases,
          source === "geoglows" ? ["anomaly", "blend", "blend3", "control"] : ["inamhi", "blend", "blend3", "control"],
        );
        results.push(scored);
        console.log(
          `${site} ${source} ${h}d n=${scored.n}: ` +
            Object.entries(scored.mae)
              .map(([k, v]) => `${k} ${v.toFixed(1)}`)
              .join(", "),
        );
      }
    }
  }

  const lines = [
    "# GEOGLOWS' forecast as a covariate for the inflow forecasts",
    "",
    `Generated by \`npm run geoglows:experiment\` (\`scripts/geoglows-experiment.ts\`), started ${startedAt}, finished ${nowUtc()}.`,
    "",
    "Target: mean measured inflow over `(origin, origin + h]`, the §5.3 target. A forecast issued at 00 UTC on day F is used at",
    "origin F − 1. **persistence**, **climatology** and **analogue** are `predictInflow`'s rungs exactly as `npm run forecast`",
    "runs them (the analogue rain-conditioned where the plant's ERA5 is adequate). Candidates:",
    "",
    `- **anomaly** (GEOGLOWS): measured climatology × forecast ÷ the simulation's own climatology for the same window (${SIM_FIRST_YEAR} →),`,
    "  the ratio clamped to 0.33–3 — the forecast's *change* from usual, with its volume bias cancelled;",
    "- **inamhi**: INAMHI's corrected ensemble mean, as served;",
    "- **blend**: the mean of the analogue rung and the candidate;",
    "- **blend3**: the mean of the analogue rung, climatology and the candidate;",
    "- **control**: the mean of the analogue rung and climatology — no forecast at all. Averaging two different guesses",
    "  often beats both, so a blend earns its keep only by beating the control.",
    "",
    "Δ columns are the candidate's mean absolute error minus the analogue's, and minus the better of persistence and",
    `climatology, in m³/s, with a 90% moving-block bootstrap interval (blocks of ${BOOTSTRAP_BLOCK} origins). **✓** marks an interval`,
    "wholly below zero: better, beyond what neighbouring origins sharing days could produce by chance.",
    "",
    "| site | source | h | cases | origins | MAE persistence | MAE climatology | MAE analogue | MAE candidate | MAE blend | MAE blend3 | MAE control | Δ blend vs analogue | Δ blend vs control | Δ blend3 vs control |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...results.map((r) => {
      const cand = r.source === "geoglows" ? "anomaly" : "inamhi";
      return (
        `| ${r.site} | ${r.source} | ${r.horizon} | ${r.n} | ${r.first} → ${r.last} | ${fmt(r.mae["persistence"])} | ${fmt(r.mae["climatology"])} | ` +
        `${fmt(r.mae["analogue"])} | ${fmt(r.mae[cand])} | ${fmt(r.mae["blend"])} | ${fmt(r.mae["blend3"])} | ${fmt(r.mae["control"])} | ${interval(r.vsAnalogue["blend"])} | ${interval(r.vsControl)} | ${interval(r.blend3VsControl)} |`
      );
    }),
  ];
  mkdirSync(repoPath("data", "reports"), { recursive: true });
  writeFileSync(repoPath("data", "reports", "geoglows-experiment.md"), `${lines.join("\n")}\n`);
  writeFileSync(
    repoPath("data", "reports", "geoglows-experiment.json"),
    `${JSON.stringify({ startedAt, finishedAt: nowUtc(), results }, null, 1)}\n`,
  );
  console.log("wrote data/reports/geoglows-experiment.{md,json}");
}

await main();
