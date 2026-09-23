#!/usr/bin/env node
/**
 * hydro-look ingestion CLI.
 *
 *   npm run ingest -- daily                       the last three days from every source (--days)
 *   npm run ingest -- backfill --source ords-levels --from 2014-09-20
 *   npm run ingest -- latest                      live tiles only, no history written
 *   npm run ingest -- smec-earliest               binary search for SMEC's oldest report
 *
 * Global flags: --dry-run (parse and validate, write nothing), --rate-ms, --max-requests,
 * --to, --plants, --summary <file> (a Markdown run summary for the workflow's step summary).
 * Every command is resumable: a backfill skips days already in the store, so a long history is
 * filled by repeated dispatches of the same command.
 *
 * In CI the fetch and the write are separated, because two runs finishing at once would
 * otherwise collide in a rebase over generated CSV:
 *
 *   npm run ingest -- daily --out "$RUNNER_TEMP/batch"    fetch and stage, touching no data
 *   npm run ingest -- apply --in "$RUNNER_TEMP/batch"     merge onto the current branch tip
 *
 * `apply` is idempotent, so a rejected push is retried by resetting to the tip and applying
 * again rather than by resolving conflicts in files nobody wrote by hand.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HttpClient } from "../src/lib/http/client.ts";
import { closeAgents } from "../src/lib/http/tls.ts";
import { CelecOrds } from "../src/lib/sources/celec-ords.ts";
import { CenaceOperativa, CenaceSmec } from "../src/lib/sources/cenace.ts";
import { Covariates, ingestCovariates } from "../src/lib/sources/covariates.ts";
import { Xm, ingestXm } from "../src/lib/sources/xm.ts";
import { emptyBatch, type IngestBatch } from "../src/lib/sources/batch.ts";
import { CuratedStore, foldBands } from "../src/lib/store/curated.ts";
import { RawArchive, splitRawRef } from "../src/lib/store/archive.ts";
import { writeFileAtomic } from "../src/lib/store/files.ts";
import { summariseNarrativeSpend, summariseTable, writeStatus } from "../src/lib/store/status.ts";
import { runSummary, type RequestCounts } from "../src/lib/store/summary.ts";
import {
  NATIONAL_BALANCE_DAILY,
  OBSERVATIONS_DAILY,
  OPERATING_BANDS,
  OPERATIVA_SNAPSHOTS,
  WEATHER_DAILY,
  ENSO_MONTHLY,
  XM_EXCHANGE_DAILY,
  XM_SYSTEM_DAILY,
} from "../src/lib/contracts/tables.ts";
import { DATA_DATE_OFFSET_DAYS, ENERGY_MODULES, HISTORIAN_SERIES, type EnergyPlantCode } from "../src/lib/registry.ts";
import { walkHistorian } from "../src/lib/sources/historian.ts";
import { parseOptions, type BackfillSource, type Options } from "../src/lib/options.ts";
import { DATA_CURATED, DATA_LATEST } from "../src/lib/util/paths.ts";
import {
  addDays,
  eachDay,
  eachMonth,
  monthEnd,
  monthOfDate,
  monthStart,
  nowUtc,
  previousMonth,
  todayEc,
  yearOf,
  type IsoDate,
} from "../src/lib/util/dates.ts";

/** Endpoints that must be asked one day at a time, with the source id their rows carry. */
const DAILY_REPORTS = [
  { endpoint: "repDiaNivQIng", source: "ords:repDiaNivQIng" },
  { endpoint: "repDiaPotQTurb", source: "ords:repDiaPotQTurb" },
  { endpoint: "repDiaEnerAyerHoy", source: "ords:repDiaEnerAyerHoy" },
  { endpoint: "repDiaRegAyer", source: "ords:repDiaRegAyer" },
  { endpoint: "repDiaVolAlm", source: "ords:repDiaVolAlm" },
] as const;

function log(message: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  // With --out, the run writes nothing into data/: it stages its rows and raw files so that
  // `apply` can merge them onto whatever the branch holds at that moment. Two runs finishing
  // at once then queue instead of colliding in a rebase over generated files.
  const archive = new RawArchive(options.out ? join(options.out, "raw") : undefined);
  const store = new CuratedStore(DATA_CURATED, options.dryRun);
  const batch = emptyBatch();

  if (options.command === "apply") {
    applyStaged(options);
    return;
  }

  // Each pinned host's certificate is checked before its first request, inside the client, so
  // a failed handshake or an enforced mismatch is that source's error and not the run's: SMEC
  // being down no longer stops ORDS and operativa from being asked.
  const http = new HttpClient({
    minIntervalMs: options.rateMs,
    onAttempt: ({ key, attempt, status, error }) => {
      if (attempt > 1 || error) log(`  retry ${key} attempt ${attempt}${status ? ` -> ${status}` : ""}${error ? `: ${error}` : ""}`);
    },
    onPin: (check) => {
      if (check.ok) log(`TLS pin ok for ${check.host}:${check.port}`);
      else {
        log(`TLS pin CHANGED for ${check.host}:${check.port} (advisory): ${check.observed}`);
        batch.notes.push(
          `TLS pin changed for ${check.host}:${check.port} (advisory): observed ${check.observed}, pinned ${check.expected}`,
        );
      }
    },
  });
  const ords = new CelecOrds(http, archive);
  const smec = new CenaceSmec(http, archive);
  const operativa = new CenaceOperativa(http, archive);

  // Two budgets, either of which ends the fetch phase cleanly so the staged batch still gets
  // archived and applied. The wall-clock one matters because the client waits `rate-ms` after
  // each response rather than on a fixed cadence, so a request costs latency + rate-ms — about
  // 1.4 s against these hosts, not the 1.0 s a request count suggests.
  const budget = { left: options.maxRequests, deadline: Date.now() + options.maxMinutes * 60_000 };
  let stoppedBy = "";
  const spend = async (work: () => Promise<void>): Promise<boolean> => {
    if (budget.left <= 0) {
      stoppedBy ||= `request budget (${options.maxRequests})`;
      return false;
    }
    if (Date.now() >= budget.deadline) {
      stoppedBy ||= `time budget (${options.maxMinutes} min)`;
      return false;
    }
    budget.left--;
    await work();
    return true;
  };

  switch (options.command) {
    case "covariates": {
      await ingestCovariates(new Covariates(http, archive), store, batch, options);
      break;
    }
    case "xm": {
      await ingestXm(new Xm(http, archive), store, batch, options);
      break;
    }
    case "daily": {
      const end = options.date ?? todayEc();

      // The 12m reports re-deliver a year and six months of history on every run, which
      // repairs any gap left by an earlier failure without a separate backfill.
      log("ORDS: levels and inflows (12 months) + energy (6 months)");
      await ords.repDiaHid12m(batch, end);
      await ords.repDiaEner12m(batch, end);

      for (const date of eachDay(addDays(end, -(options.days - 1)), end)) {
        log(`ORDS: per-day reports for ${date}`);
        await ords.repDiaNivQIng(batch, date);
        await ords.repDiaPotQTurb(batch, date);
        await ords.repDiaEnerAyerHoy(batch, date);
        await ords.repDiaRegAyer(batch, date);
        await ords.repDiaVolAlm(batch, date);
        for (const code of Object.keys(ENERGY_MODULES) as EnergyPlantCode[]) {
          await ords.enerDia(batch, code, addDays(date, -1));
        }
      }

      await ords.caudCuenAniosAvg(batch, "2010-01-01", `${yearOf(end) + 1}-01-01`);

      // The historian is the only route to Coca Codo Sinclair, Agoyán and Manduriacu levels
      // and inflows. Asking for the whole running month every day is what repairs a day the
      // endpoint answered null for — §2.1's blank window is a property of when you ask, not of
      // the day you ask about — because the rows are upserted and the value lands on the first
      // run made outside it. Early in a month the previous one is asked for again, since its
      // last days are still settling when it closes. Mazar rides along as the control: it costs
      // two requests and builds the running overlap against `repDiaHid12m` that Phase 3 needs
      // to confirm the caudal mrids really are `q_ingresado`.
      log("ORDS: historian month for the plants the reports do not cover");
      const runningMonth = monthOfDate(end);
      const historianMonths = Number(end.slice(8, 10)) <= 3 ? [runningMonth, previousMonth(runningMonth)] : [runningMonth];
      for (const ym of historianMonths) {
        for (const series of HISTORIAN_SERIES) {
          await ords.pointValuesMesH24(batch, series.site, series.variable, series.mrid, ym);
        }
      }

      // SMEC closes a day at D+1 around 11:15 local; re-asking the last few days also picks up
      // any revision CENACE publishes after the fact.
      for (const date of eachDay(addDays(end, -(options.days + 2)), addDays(end, -1))) {
        log(`SMEC: ${date}`);
        await smec.day(batch, date);
      }

      log("CENACE: Información Operativa snapshot");
      await operativa.snapshot(batch);
      break;
    }

    case "backfill": {
      if (!options.from) throw new Error("backfill needs --from YYYY-MM-DD");
      const from = options.from;
      const to = options.to ?? addDays(todayEc(), -1);
      const wanted = options.source;
      const runs = (name: BackfillSource) => wanted === "all" || wanted === name;
      const years = Array.from({ length: yearOf(to) - yearOf(from) + 1 }, (_, i) => yearOf(from) + i);
      const present = indexBySourceAndDate(store, years);
      const smecDates = new Set([...store.existingKeys(NATIONAL_BALANCE_DAILY, years)].map((key) => key.split("\u0000")[0]!));

      if (runs("ords-levels")) {
        // One request per year returns 365 days ending the day before `fecha`.
        for (let year = yearOf(from); year <= yearOf(to) + 1; year++) {
          const fecha = `${year}-09-20`;
          if (fecha > addDays(todayEc(), 1)) continue;
          if (!(await spend(() => ords.repDiaHid12m(batch, fecha)))) break;
          log(`ords-levels: ${fecha} (${batch.observations.length} observations so far)`);
        }
      }

      if (runs("ords-energy")) {
        // Six months per request; step by 180 days to leave an overlap.
        for (let cursor = from; cursor <= addDays(to, 180); cursor = addDays(cursor, 180)) {
          if (!(await spend(() => ords.repDiaEner12m(batch, cursor > to ? to : cursor)))) break;
          log(`ords-energy: ${cursor}`);
        }
      }

      if (runs("ords-basin")) {
        await spend(() => ords.caudCuenAniosAvg(batch, "2010-01-01", `${yearOf(to) + 1}-01-01`));
      }

      // `all` spends the budget in this order deliberately. The windowed endpoints above cost
      // tens of requests for years of history, so they always finish. SMEC comes next because
      // it is the national backbone and one request buys a whole closed day; the historian
      // follows at a month per request for the three plants no report covers; the per-day CELEC
      // reports come last because they cost five requests per day for variables the windowed
      // reports largely already cover.
      if (runs("smec")) {
        for (const date of eachDay(from, to)) {
          if (smecDates.has(date)) continue;
          if (!(await spend(async () => void (await smec.day(batch, date))))) break;
          if (daysSinceLog(date)) log(`smec: reached ${date}, ${budget.left} requests left`);
        }
      }

      if (runs("ords-plant-energy")) {
        outer: for (const code of options.plants) {
          for (const date of eachDay(from, to)) {
            if (present.has(`${date}|ords:${code}EnerDia`)) continue;
            if (!(await spend(() => ords.enerDia(batch, code, date)))) break outer;
            if (daysSinceLog(date)) log(`ords-plant-energy ${code}: reached ${date}, ${budget.left} requests left`);
          }
        }
      }

      if (runs("ords-historian")) {
        const today = todayEc();
        const walk = await walkHistorian({
          months: eachMonth(from, to),
          today,
          // A closed month that already holds a day for this mrid was fetched by an earlier
          // run: one request writes every non-null day of the month at once, so there is
          // nothing left to ask for. The running month is never skipped — its days are still
          // arriving, and re-asking is how a day that was null yesterday gets filled.
          isDone: (ym, mrid) =>
            monthEnd(ym) < today && eachDay(monthStart(ym), monthEnd(ym)).some((day) => present.has(`${day}|ords:pointValues|${mrid}`)),
          fetchMonth: async (series, ym) => {
            let added: number | null = null;
            await spend(async () => {
              const before = batch.observations.length;
              await ords.pointValuesMesH24(batch, series.site, series.variable, series.mrid, ym);
              added = batch.observations.length - before;
            });
            return added;
          },
        });
        batch.notes.push(...walk.notes);
        for (const line of walk.logs) log(`${line}, ${budget.left} requests left`);
      }

      if (runs("ords-daily")) {
        outer: for (const date of eachDay(from, to)) {
          for (const report of DAILY_REPORTS) {
            // Ask by the date the endpoint answers to, but skip by the date the answer is
            // stored under: repDiaNivQIng returns the previous day's reading, so a run that
            // checked the requested date would find nothing stored and re-fetch the whole
            // range on every dispatch.
            const stored = addDays(date, DATA_DATE_OFFSET_DAYS[report.source] ?? 0);
            if (present.has(`${stored}|${report.source}`)) continue;
            const call = {
              repDiaNivQIng: () => ords.repDiaNivQIng(batch, date),
              repDiaPotQTurb: () => ords.repDiaPotQTurb(batch, date),
              repDiaEnerAyerHoy: () => ords.repDiaEnerAyerHoy(batch, date),
              repDiaRegAyer: () => ords.repDiaRegAyer(batch, date),
              repDiaVolAlm: () => ords.repDiaVolAlm(batch, date),
            }[report.endpoint];
            if (!(await spend(call))) break outer;
          }
          if (daysSinceLog(date)) log(`ords-daily: reached ${date}, ${budget.left} requests left in this run`);
        }
      }
      if (stoppedBy) {
        batch.notes.push(`backfill stopped early on the ${stoppedBy}; dispatch it again to continue where it left off`);
        log(`stopped on the ${stoppedBy} — this run is incomplete, dispatch it again to continue`);
      } else {
        log("backfill reached the end of its range with budget to spare");
      }
      break;
    }

    case "smec-earliest": {
      const earliest = await smec.earliestAvailable(batch, { good: options.from ?? "2016-05-01", bad: options.to ?? "2010-01-01" });
      log(`SMEC earliest complete report: ${earliest}`);
      break;
    }

    case "latest": {
      const latest = await ords.latest();
      mkdirSync(DATA_LATEST, { recursive: true });
      if (!options.dryRun) {
        writeFileSync(join(DATA_LATEST, "celec_ords.json"), `${JSON.stringify(latest, null, 2)}\n`);
      }
      log(`latest: ${latest.live.length} live readings, ${latest.units.length} units`);
      await operativa.snapshot(batch);
      break;
    }

    default:
      throw new Error(`unknown command "${options.command}"; try daily, backfill, covariates, xm, apply, latest or smec-earliest`);
  }

  const requests: RequestCounts = { total: http.count, byHost: http.countByHost };
  log(`${requests.total} requests sent, retries included`);
  let quarantined = 0;
  if (options.out && !options.dryRun) stageBatch(archive, batch, options, requests);
  else quarantined = writeBatch(store, archive, batch, options, requests);
  await closeAgents();
  process.exitCode = batch.errors.length > 0 || quarantined > 0 ? 1 : 0;
}

/**
 * Writes the run's result to a staging directory: the rows as JSON, the raw responses as the
 * same files they will become in data/raw/. Nothing under data/ is touched. The directory is
 * uploaded as a workflow artifact before anything tries to apply it, so a batch that fails to
 * land can be replayed by hand with `apply --in` (see the README).
 */
function stageBatch(archive: RawArchive, batch: IngestBatch, options: Options, requests: RequestCounts): void {
  const directory = options.out!;
  mkdirSync(directory, { recursive: true });
  const files = archive.flush();
  writeFileAtomic(
    join(directory, "batch.json"),
    `${JSON.stringify({ generated_at: nowUtc(), run_id: runId(), command: options.command, source: options.source, requests, ...batch }, null, 1)}\n`,
  );
  log(
    `staged ${batch.observations.length + batch.national.length + batch.operativa.length + batch.weather.length + batch.enso.length + batch.xmExchange.length + batch.xmSystem.length} rows and ${files.length} raw files in ${directory}`,
  );
  for (const note of dedupe(batch.notes).slice(0, 40)) log(`note: ${note}`);
  for (const error of batch.errors.slice(0, 40)) log(`ERROR ${error}`);
}

/**
 * Merges a staged run into the store. Run this after resetting the checkout to the branch tip,
 * so the rows land on the newest data rather than on whatever the run started from; if the
 * push is still rejected, reset and apply again — the merge is idempotent.
 */
function applyStaged(options: Options): void {
  const directory = options.in;
  if (!directory) throw new Error("apply needs --in <directory written by a staged run>");
  const staged = JSON.parse(readFileSync(join(directory, "batch.json"), "utf8")) as IngestBatch & {
    command?: string;
    source?: BackfillSource;
    run_id?: string;
    requests?: RequestCounts;
  };

  const archive = new RawArchive();
  const merged = archive.mergeFrom(join(directory, "raw"));
  // A batch staged before the raw layout changed carries bundle refs; its bundles were just
  // refiled as day files, so point its rows at those.
  canonicaliseRefs(archive, staged);
  const store = new CuratedStore(DATA_CURATED, options.dryRun);
  const quarantined = writeBatch(
    store,
    archive,
    staged,
    { ...options, command: staged.command ?? options.command, source: staged.source ?? options.source },
    staged.requests,
    staged.run_id,
  );
  log(`applied ${merged} archived responses`);
  process.exitCode = staged.errors.length > 0 || quarantined > 0 ? 1 : 0;
}

/**
 * `date|source` pairs already in observations_daily, used to skip finished work, plus the
 * `date|source|mrid` form.
 *
 * The historian series all carry the same source id (`ords:pointValues`) and are told apart
 * only by their mrid, so the pair alone would report Agoyán's level as already fetched the
 * moment Mazar's was. Both forms go in one set because the walk over existing keys is the
 * expensive part and a second index would double it.
 */
function indexBySourceAndDate(store: CuratedStore, years: number[]): Set<string> {
  const keys = new Set<string>();
  for (const key of store.existingKeys(OBSERVATIONS_DAILY, years)) {
    const [date, , , source, mrid] = key.split("\u0000");
    keys.add(`${date}|${source}`);
    if (mrid) keys.add(`${date}|${source}|${mrid}`);
  }
  return keys;
}

let lastLoggedMonth = "";
function daysSinceLog(date: IsoDate): boolean {
  const month = date.slice(0, 7);
  if (month === lastLoggedMonth) return false;
  lastLoggedMonth = month;
  return true;
}

/** The id a run's quarantine file is named by: the workflow run where there is one. */
function runId(): string {
  const run = process.env["GITHUB_RUN_ID"];
  if (run) return `${run}-${process.env["GITHUB_RUN_ATTEMPT"] ?? "1"}`;
  return `local-${nowUtc().replaceAll(/[-:]/g, "")}`;
}

/** Rewrites every row's legacy bundle refs to the day files that now hold them. */
function canonicaliseRefs(archive: RawArchive, batch: IngestBatch): void {
  const tables = [
    batch.observations,
    batch.national,
    batch.operativa,
    batch.weather ?? [],
    batch.enso ?? [],
    batch.xmExchange ?? [],
    batch.xmSystem ?? [],
  ];
  for (const rows of tables) {
    for (const row of rows as { raw_ref: string }[]) {
      if (!row.raw_ref?.includes(".ndjson.gz#")) continue;
      row.raw_ref = splitRawRef(row.raw_ref)
        .map((ref) => archive.resolvesTo(ref) ?? ref)
        .join(" ");
    }
  }
}

/**
 * Writes a batch into the store: the raw responses first, then the tables, so that a failure
 * part-way can never leave rows whose `raw_ref` names a file that was not written. A row that
 * fails its contract is quarantined (see CuratedStore.upsert) rather than stopping the write;
 * `npm run check` fails while a quarantine file exists. Returns how many rows were quarantined.
 */
function writeBatch(
  store: CuratedStore,
  archive: RawArchive,
  batch: IngestBatch,
  options: Options,
  requests?: RequestCounts,
  run: string = runId(),
): number {
  const archived = options.dryRun ? [] : archive.flush();

  const quarantine = { quarantine: { run } };
  const reports = [];
  if (batch.observations.length > 0) reports.push(store.upsert(OBSERVATIONS_DAILY, batch.observations, quarantine));
  if (batch.national.length > 0) reports.push(store.upsert(NATIONAL_BALANCE_DAILY, batch.national, quarantine));
  if (batch.operativa.length > 0) reports.push(store.upsert(OPERATIVA_SNAPSHOTS, batch.operativa, quarantine));
  // A backfill already running on the previous revision stages neither new field.
  if (batch.weather?.length) reports.push(store.upsert(WEATHER_DAILY, batch.weather, quarantine));
  if (batch.enso?.length) reports.push(store.upsert(ENSO_MONTHLY, batch.enso, quarantine));
  if (batch.xmExchange?.length) reports.push(store.upsert(XM_EXCHANGE_DAILY, batch.xmExchange, quarantine));
  if (batch.xmSystem?.length) reports.push(store.upsert(XM_SYSTEM_DAILY, batch.xmSystem, quarantine));
  if (batch.bands.length > 0) {
    const existing = store.read(join(DATA_CURATED, "operating_bands.csv"));
    reports.push(store.upsert(OPERATING_BANDS, foldBands(batch.bands, existing), quarantine));
  }

  const quarantined = reports.reduce((n, r) => n + r.quarantined, 0);
  for (const report of reports) {
    log(`${report.table}: +${report.added} new, ~${report.updated} updated, ${report.unchanged} unchanged`);
    if (report.quarantined > 0) log(`${report.table}: ${report.quarantined} rows QUARANTINED to ${report.quarantinePath}`);
  }
  log(`archived ${archived.length} raw files`);
  for (const note of dedupe(batch.notes).slice(0, 40)) log(`note: ${note}`);
  for (const error of batch.errors.slice(0, 40)) log(`ERROR ${error}`);
  if (batch.notes.length > 40) log(`... and ${batch.notes.length - 40} more notes`);

  const errors = [
    ...batch.errors,
    ...reports
      .filter((r) => r.quarantined > 0)
      .map((r) => `${r.table}: ${r.quarantined} rows failed the contract and were quarantined to ${r.quarantinePath}`),
  ];
  if (options.summary) {
    writeFileAtomic(
      options.summary,
      runSummary({ command: options.command, source: options.source, reports, requests, errors, notes: dedupe(batch.notes) }),
    );
  }

  if (!options.dryRun) {
    writeStatus({
      generated_at: nowUtc(),
      command: options.command,
      source: options.source,
      // Every attempt the hosts saw, retries included; absent for a batch staged before it was counted.
      requests: requests?.total,
      errors,
      notes: dedupe(batch.notes).slice(0, 100),
      tables: {
        observations_daily: summariseTable("observations_daily", "date"),
        national_balance_daily: summariseTable("national_balance_daily", "date"),
        operativa_snapshots: summariseTable("operativa_snapshots", "fetched_at"),
        operating_bands: summariseTable("operating_bands", "last_date"),
        weather_daily: summariseTable("weather_daily", "date"),
        enso_monthly: summariseTable("enso_monthly", "month"),
        xm_exchange_daily: summariseTable("xm_exchange_daily", "date"),
        xm_system_daily: summariseTable("xm_system_daily", "date"),
      },
      // The narrative's gateway spend to date, so the cost is visible without opening a CSV.
      narrative: summariseNarrativeSpend(),
    });
  }
  return quarantined;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

main().catch(async (error) => {
  console.error(error);
  await closeAgents();
  process.exit(1);
});
