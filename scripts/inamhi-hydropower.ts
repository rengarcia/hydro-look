#!/usr/bin/env node
/**
 * Backtest INAMHI's hydropower inflow forecasts against the inflow CELEC measures.
 *
 * INAMHI's Hydropower app serves, for eight plants, a 15-day forecast corrected to each plant's
 * measured inflow, and serves it for past dates too (`src/lib/parse/inamhi-hydropower.ts`). This
 * asks for every `--step`-th day's forecast of every plant this repository measures, archives each
 * answer, and scores three readings of it — the ensemble mean and the high-resolution member from
 * the CSV, and the plot's central line pinned to the last observation — against persistence, on
 * the cases all of them cover. It also reads each plant's history once and compares it with
 * CELEC's inflow, so the report says what INAMHI's "observed" line is.
 *
 * The host answers GitHub's runners and not the development sandbox, so this runs from the
 * `inamhi-hydropower` phase of `probe-basins.yml`. One request every half second.
 *
 * Writes `data/reports/inamhi-hydropower.{md,json}` and the answers under
 * `data/raw/inamhi/hydropower/`.
 *
 *   npm run inamhi:hydropower -- --from 2025-10-01 --step 3
 *   npm run inamhi:hydropower -- --earliest          # find the first date the forecast is served
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { fetch } from "undici";
import { USER_AGENT } from "../src/lib/http/client.ts";
import { loadSeries } from "../src/lib/features/series.ts";
import { pearson } from "../src/lib/geo/geoglows.ts";
import { dailyMeans, scoreNamed, type NamedLeadScore, type RunsByOrigin } from "../src/lib/models/geoglows-forecast.ts";
import {
  forecastCsvUrl,
  forecastPlotUrl,
  INAMHI_PLANTS,
  observedDaily,
  observedPlotUrl,
  parseForecastCsv,
  plotMean,
} from "../src/lib/parse/inamhi-hydropower.ts";
import { addDays, nowUtc, type IsoDate } from "../src/lib/util/dates.ts";
import { DATA_RAW, repoPath } from "../src/lib/util/paths.ts";

const SHORT_LEADS = [1, 2, 3, 5] as const;
const LONG_LEADS = [1, 2, 3, 5, 7, 10, 15] as const;
const GAP_MS = 500;

interface Answer {
  url: string;
  status: number;
  fetched_at: string;
  body: string;
}

const archive: Answer[] = [];
let lastRequest = 0;

async function ask(url: string): Promise<Answer> {
  const wait = lastRequest + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  let answer: Answer;
  try {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
    answer = { url, status: response.status, fetched_at: nowUtc(), body: await response.text() };
  } catch (error) {
    answer = { url, status: 0, fetched_at: nowUtc(), body: String(error) };
  }
  archive.push(answer);
  return answer;
}

/** The first date whose forecast is served, by bisection between a date that fails and one that answers. */
async function earliest(plant: string, bad: IsoDate, good: IsoDate): Promise<IsoDate> {
  let lo = bad;
  let hi = good;
  while (Date.parse(hi) - Date.parse(lo) > 86_400_000) {
    const mid = new Date((Date.parse(lo) + Date.parse(hi)) / 2).toISOString().slice(0, 10);
    const a = await ask(forecastCsvUrl(plant, mid));
    if (a.status === 200 && a.body.startsWith("datetime")) hi = mid;
    else lo = mid;
    console.log(`  ${mid}: ${a.status}`);
  }
  return hi;
}

const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });

async function main(): Promise<void> {
  const startedAt = nowUtc();
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      from: { type: "string", default: "2025-10-01" },
      to: { type: "string" },
      step: { type: "string", default: "3" },
      earliest: { type: "boolean", default: false },
    },
  });
  const series = loadSeries();
  const plants = Object.entries(INAMHI_PLANTS).filter((e): e is [string, string] => e[1] !== null);

  let firstServed: IsoDate | null = null;
  if (values.earliest) {
    firstServed = await earliest("Mazar", "2024-10-01", "2025-10-01");
    console.log(`first date served: ${firstServed}`);
  }
  const from = (firstServed ?? values.from);
  const lastObserved = plants
    .map(([, site]) => [...series.get(site, "caudal_m3s").keys()].at(-1)!)
    .sort()
    .at(-1)!;
  const to = (values.to) ?? lastObserved;
  const origins: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, Number(values.step))) origins.push(d);
  console.log(`${plants.length} plants × ${origins.length} origins (${from} → ${to})`);

  const results = [];
  for (const [plant, site] of plants) {
    const measured = series.get(site, "caudal_m3s");
    const history = await ask(observedPlotUrl(plant));
    let historyVsCelec = null;
    if (history.status === 200) {
      const inamhi = observedDaily(history.body);
      const days = [...inamhi.keys()].filter((d) => measured.has(d));
      if (days.length >= 30) {
        const a = days.map((d) => inamhi.get(d)!);
        const b = days.map((d) => measured.get(d)!);
        historyVsCelec = {
          days: days.length,
          first: [...inamhi.keys()][0]!,
          r: pearson(a, b),
          meanRatio: a.reduce((x, y) => x + y) / b.reduce((x, y) => x + y),
          identical: days.filter((d) => Math.abs(inamhi.get(d)! - measured.get(d)!) < 0.01).length,
        };
      }
    }

    const named: Record<string, RunsByOrigin> = { mean: new Map(), high_res: new Map(), plot: new Map() };
    let served = 0;
    for (const origin of origins) {
      const csv = await ask(forecastCsvUrl(plant, origin));
      if (csv.status !== 200 || !csv.body.startsWith("datetime")) continue;
      served++;
      const parsed = parseForecastCsv(csv.body, origin);
      named["mean"]!.set(origin, dailyMeans(parsed["flow_avg"]!.hours, parsed["flow_avg"]!.values, 15, 6));
      named["high_res"]!.set(origin, dailyMeans(parsed["high_res"]!.hours, parsed["high_res"]!.values, 10, 18));
      const plot = await ask(forecastPlotUrl(plant, origin));
      const line = plot.status === 200 ? plotMean(plot.body, origin) : null;
      if (line) named["plot"]!.set(origin, dailyMeans(line.hours, line.values, 5, 6));
    }
    const short: NamedLeadScore[] = scoreNamed(named, measured, SHORT_LEADS);
    const long: NamedLeadScore[] = scoreNamed({ mean: named["mean"]! }, measured, LONG_LEADS);
    console.log(`${plant}: ${served}/${origins.length} served; lead 1 skill ${JSON.stringify(short[0]?.skill)}`);
    results.push({ plant, site, served, historyVsCelec, short, long });
  }

  const dir = `${DATA_RAW}/inamhi/hydropower`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/forecasts_${from}_${to}_step${values.step}.ndjson.gz`, gzipSync(archive.map((a) => JSON.stringify(a)).join("\n")));
  mkdirSync(repoPath("data", "reports"), { recursive: true });
  writeFileSync(
    repoPath("data", "reports", "inamhi-hydropower.json"),
    `${JSON.stringify({ startedAt, finishedAt: nowUtc(), from, to, step: Number(values.step), firstServed, results }, null, 1)}\n`,
  );

  const lines = [
    "# INAMHI's hydropower inflow forecasts against the measured inflow",
    "",
    `Generated by \`npm run inamhi:hydropower\` (\`scripts/inamhi-hydropower.ts\`), started ${startedAt}, finished ${nowUtc()}.`,
    `Origins every ${values.step} days from ${from} to ${to}; ${archive.length} requests, archived under \`data/raw/inamhi/hydropower/\`.` +
      (firstServed ? ` The first date the forecast is served: ${firstServed}.` : ""),
    "",
    "INAMHI's Hydropower app (`inamhi.geoglows.org/apps/hydropower`) serves each plant's GEOGLOWS forecast corrected to its",
    "measured inflow: **mean** is the CSV's ensemble mean (15 days), **high_res** its high-resolution member (10 days), **plot**",
    "the central line of the app's chart, pinned to the last observation (5 days). Lead 1 is the origin's own UTC day;",
    "persistence is CELEC's inflow the day before the origin. Skill is 1 − MAE ÷ persistence MAE, on the cases all three cover.",
    "",
    "## INAMHI's inflow history against CELEC's",
    "",
    "| plant | site | shared days | from | r | INAMHI ÷ CELEC mean | identical days |",
    "|---|---|---|---|---|---|---|",
    ...results.map((r) =>
      r.historyVsCelec
        ? `| ${r.plant} | ${r.site} | ${fmt(r.historyVsCelec.days)} | ${r.historyVsCelec.first} | ${fmt(r.historyVsCelec.r, 3)} | ${fmt(r.historyVsCelec.meanRatio, 3)} | ${r.historyVsCelec.identical} |`
        : `| ${r.plant} | ${r.site} | — | | | | |`,
    ),
    "",
    "## Skill against persistence, leads 1–5",
    "",
    "| plant | lead | cases | MAE persistence | MAE mean | MAE high_res | MAE plot | skill mean | skill high_res | skill plot | bias mean |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...results.flatMap((r) =>
      r.short.map(
        (s) =>
          `| ${r.plant} | ${s.lead} | ${s.n} | ${fmt(s.mae["persistence"], 1)} | ${fmt(s.mae["mean"], 1)} | ${fmt(s.mae["high_res"], 1)} | ${fmt(s.mae["plot"], 1)} | ` +
          `${fmt(s.skill["mean"], 2)} | ${fmt(s.skill["high_res"], 2)} | ${fmt(s.skill["plot"], 2)} | ${fmt(s.bias["mean"], 1)} |`,
      ),
    ),
    "",
    "## The ensemble mean to 15 days",
    "",
    "| plant | lead | cases | MAE persistence | MAE mean | skill | bias |",
    "|---|---|---|---|---|---|---|",
    ...results.flatMap((r) =>
      r.long.map(
        (s) =>
          `| ${r.plant} | ${s.lead} | ${s.n} | ${fmt(s.mae["persistence"], 1)} | ${fmt(s.mae["mean"], 1)} | ${fmt(s.skill["mean"], 2)} | ${fmt(s.bias["mean"], 1)} |`,
      ),
    ),
  ];
  writeFileSync(repoPath("data", "reports", "inamhi-hydropower.md"), `${lines.join("\n")}\n`);
  console.log("wrote data/reports/inamhi-hydropower.{md,json}");
}

await main();
