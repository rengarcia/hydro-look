#!/usr/bin/env node
/**
 * Probe the CELEC ORDS historian endpoints (`pointValuesMesH24`, `pointValues`).
 *
 * Every Phase 0 run (23:37, 23:56 and 00:09 UTC) got the timestamp skeleton with every
 * `valueedit` null, while the community scrapers got values from the same endpoints at 18:08
 * and 23:10 UTC the same day. The working hypothesis is a time-of-day window; this probe is
 * the experiment. It asks for a handful of series, prints how many points came back non-null,
 * and writes nothing under data/. Mazar (mrid 30031 / 30538) is the control: its values are
 * known from `repDiaHid12m`, so a non-null answer can be checked, not just counted.
 *
 *   npm run probe:ords -- --out "$RUNNER_TEMP/probe"
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HttpClient } from "../src/lib/http/client.ts";
import { closeAgents } from "../src/lib/http/tls.ts";
import { parsePointValues } from "../src/lib/parse/ords.ts";
import type { SiteId } from "../src/lib/registry.ts";
import { ORDS_MODULE_CSR } from "../src/lib/sources/celec-ords.ts";
import { addDays, nowUtc, ordsFecha, todayEc, type IsoDate } from "../src/lib/util/dates.ts";

type Variable = "cota_masl" | "caudal_m3s";

interface Target {
  site: SiteId;
  variable: Variable;
  mrid: number;
  /** Values known from the report endpoints, so an answer can be verified. */
  control?: boolean;
}

/** From data/reference/mrids.csv. */
const TARGETS: Target[] = [
  { site: "mazar", variable: "cota_masl", mrid: 30031, control: true },
  { site: "mazar", variable: "caudal_m3s", mrid: 30538, control: true },
  { site: "coca_codo_sinclair", variable: "cota_masl", mrid: 100540 },
  { site: "coca_codo_sinclair", variable: "caudal_m3s", mrid: 100037 },
  { site: "agoyan", variable: "cota_masl", mrid: 140031 },
  { site: "agoyan", variable: "caudal_m3s", mrid: 140537 },
  { site: "manduriacu", variable: "cota_masl", mrid: 110031 },
  { site: "manduriacu", variable: "caudal_m3s", mrid: 110537 },
];

interface ProbeRow {
  probe: string;
  mrid: number;
  series: string;
  status: number | null;
  items: number | null;
  nonNull: number | null;
  first: string;
  last: string;
  error: string;
}

/**
 * The window as the dashboard itself sends it, deliberately *without* the day of overlap the
 * ingestion adds. The 2026-08 control probe returned 30 values for 31 days through this window,
 * which is how the exclusive local end was found; keeping the probe on the narrow window is what
 * lets a later run notice if that behaviour ever changes.
 */
function monthWindow(year: number, month: number): Record<string, string> {
  const start: IsoDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const next: IsoDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    fechaInicio: `${start}T00:00:00.000Z`,
    fechaFin: `${next}T00:00:00.000Z`,
    fecha: ordsFecha(start),
  };
}

/** The same window the dashboard uses for one local day of hourly points. */
function dayWindow(day: IsoDate): Record<string, string> {
  return {
    fechaInicio: `${day}T06:00:00.000Z`,
    fechaFin: `${addDays(day, 1)}T05:00:00.000Z`,
    fecha: ordsFecha(day, "01:00:00"),
  };
}

function previousMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

async function probe(
  http: HttpClient,
  label: string,
  endpoint: "pointValuesMesH24" | "pointValues",
  target: Target,
  params: Record<string, string>,
): Promise<ProbeRow> {
  const row: ProbeRow = {
    probe: label,
    mrid: target.mrid,
    series: `${target.site}/${target.variable}${target.control ? " (control)" : ""}`,
    status: null,
    items: null,
    nonNull: null,
    first: "",
    last: "",
    error: "",
  };
  try {
    const response = await http.fetch({
      key: `${label}:${target.mrid}`,
      url: `${ORDS_MODULE_CSR}/${endpoint}`,
      params: { mrid: String(target.mrid), ...params },
      allowStatus: [400, 404],
    });
    row.status = response.status;
    if (response.status !== 200) {
      row.error = response.body.slice(0, 200).replace(/\s+/g, " ");
      return row;
    }
    const items = (JSON.parse(response.body) as { items?: unknown[] }).items;
    row.items = Array.isArray(items) ? items.length : null;
    const parsed = parsePointValues(response.body, target.site, target.variable, target.mrid, {
      hourEnding: endpoint === "pointValues",
    });
    row.nonNull = parsed.observations.length;
    const first = parsed.observations[0];
    const last = parsed.observations[parsed.observations.length - 1];
    if (first) row.first = `${first.date} ${first.value}`;
    if (last) row.last = `${last.date} ${last.value}`;
  } catch (error) {
    row.error = String(error).slice(0, 200);
  }
  return row;
}

function markdown(rows: ProbeRow[], startedAt: string, finishedAt: string): string {
  const lines = [
    `# ORDS historian probe`,
    ``,
    `Started ${startedAt}, finished ${finishedAt} (Ecuador is UTC-5).`,
    ``,
    `| probe | mrid | series | status | items | non-null | first | last | error |`,
    `|---|---|---|---|---|---|---|---|---|`,
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.probe} | ${r.mrid} | ${r.series} | ${r.status ?? ""} | ${r.items ?? ""} | ${r.nonNull ?? ""} | ${r.first} | ${r.last} | ${r.error} |`,
    );
  }
  const answered = rows.filter((r) => (r.nonNull ?? 0) > 0).length;
  lines.push(``, `**${answered} of ${rows.length} probes returned values.**`, ``);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf("--out");
  const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;

  const startedAt = nowUtc();
  const http = new HttpClient({
    onAttempt: ({ key, attempt, status, error }) =>
      console.log(`[${nowUtc().slice(11, 19)}] ${key} attempt ${attempt}: ${status ?? error}`),
  });

  const today = todayEc();
  const yesterday = addDays(today, -1);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const [prevYear, prevMonth] = previousMonth(year, month);

  const rows: ProbeRow[] = [];
  // Current month, daily aggregation, for every series.
  for (const target of TARGETS) {
    rows.push(await probe(http, `MesH24 ${today.slice(0, 7)}`, "pointValuesMesH24", target, monthWindow(year, month)));
  }
  // A closed month for the control, in case only the running month is blanked.
  const control = TARGETS[0]!;
  rows.push(
    await probe(
      http,
      `MesH24 ${prevYear}-${String(prevMonth).padStart(2, "0")}`,
      "pointValuesMesH24",
      control,
      monthWindow(prevYear, prevMonth),
    ),
  );
  // Hourly points for yesterday: the control and one target plant.
  rows.push(await probe(http, `hourly ${yesterday}`, "pointValues", control, dayWindow(yesterday)));
  rows.push(await probe(http, `hourly ${yesterday}`, "pointValues", TARGETS[2]!, dayWindow(yesterday)));

  const finishedAt = nowUtc();
  const report = markdown(rows, startedAt, finishedAt);
  console.log(``);
  console.log(report);

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "probe.md"), report);
    writeFileSync(join(outDir, "probe.json"), JSON.stringify({ startedAt, finishedAt, rows }, null, 2));
  }
  await closeAgents();
}

main().catch(async (error) => {
  console.error(error);
  await closeAgents();
  process.exit(1);
});
