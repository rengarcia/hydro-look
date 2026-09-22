#!/usr/bin/env node
/**
 * hydro-look ingestion CLI.
 *
 *   npm run ingest -- daily                       the previous day from every source
 *   npm run ingest -- backfill --source ords-levels --from 2015-09-20
 *   npm run ingest -- latest                      live tiles only, no history written
 *   npm run ingest -- smec-earliest               binary search for SMEC's oldest report
 *
 * Global flags: --dry-run (parse and validate, write nothing), --rate-ms, --max-requests,
 * --to, --plants. Every command is resumable: a backfill skips days already in the store, so
 * a long history is filled by repeated dispatches of the same command.
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
import { parseArgs } from "node:util";
import { HttpClient } from "../src/lib/http/client.ts";
import { checkPin, closeAgents } from "../src/lib/http/tls.ts";
import { CelecOrds } from "../src/lib/sources/celec-ords.ts";
import { CenaceOperativa, CenaceSmec } from "../src/lib/sources/cenace.ts";
import { emptyBatch, type IngestBatch } from "../src/lib/sources/batch.ts";
import { CuratedStore, foldBands } from "../src/lib/store/curated.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { summariseTable, writeStatus } from "../src/lib/store/status.ts";
import {
  NATIONAL_BALANCE_DAILY,
  OBSERVATIONS_DAILY,
  OPERATING_BANDS,
  OPERATIVA_SNAPSHOTS,
} from "../src/lib/contracts/tables.ts";
import { ENERGY_BACKFILL_ONLY_CODES, ENERGY_MODULES, type EnergyPlantCode } from "../src/lib/registry.ts";
import { DATA_CURATED, DATA_LATEST } from "../src/lib/util/paths.ts";
import { addDays, assertIsoDate, eachDay, nowUtc, todayEc, yearOf, type IsoDate } from "../src/lib/util/dates.ts";

const BACKFILL_SOURCES = [
  "ords-levels",
  "ords-energy",
  "ords-daily",
  "ords-plant-energy",
  "ords-basin",
  "smec",
  "all",
] as const;
type BackfillSource = (typeof BACKFILL_SOURCES)[number];

/** Endpoints that must be asked one day at a time, with the source id their rows carry. */
const DAILY_REPORTS = [
  { endpoint: "repDiaNivQIng", source: "ords:repDiaNivQIng" },
  { endpoint: "repDiaPotQTurb", source: "ords:repDiaPotQTurb" },
  { endpoint: "repDiaEnerAyerHoy", source: "ords:repDiaEnerAyerHoy" },
  { endpoint: "repDiaRegAyer", source: "ords:repDiaRegAyer" },
  { endpoint: "repDiaVolAlm", source: "ords:repDiaVolAlm" },
] as const;

interface Options {
  command: string;
  dryRun: boolean;
  rateMs: number;
  maxRequests: number;
  from?: IsoDate;
  to?: IsoDate;
  date?: IsoDate;
  days: number;
  source: BackfillSource;
  plants: EnergyPlantCode[];
  /** Stage the run's output here instead of writing the store (see `apply`). */
  out?: string;
  /** Directory a staged run wrote, to be merged into the store. */
  in?: string;
}

function parseOptions(argv: string[]): Options {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      "rate-ms": { type: "string" },
      "max-requests": { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      date: { type: "string" },
      days: { type: "string" },
      source: { type: "string" },
      plants: { type: "string" },
      out: { type: "string" },
      in: { type: "string" },
    },
  });

  const source = (values.source ?? "all") as BackfillSource;
  if (!BACKFILL_SOURCES.includes(source)) {
    throw new Error(`--source must be one of ${BACKFILL_SOURCES.join(", ")}`);
  }
  const plants = (values.plants ?? ENERGY_BACKFILL_ONLY_CODES.join(","))
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as EnergyPlantCode[];
  for (const plant of plants) {
    if (!Object.hasOwn(ENERGY_MODULES, plant)) throw new Error(`unknown plant code "${plant}"`);
  }

  return {
    command: positionals[0] ?? "daily",
    dryRun: values["dry-run"] ?? false,
    rateMs: Number(values["rate-ms"] ?? 1000),
    maxRequests: Number(values["max-requests"] ?? Infinity),
    from: values.from ? assertIsoDate(values.from) : undefined,
    to: values.to ? assertIsoDate(values.to) : undefined,
    date: values.date ? assertIsoDate(values.date) : undefined,
    days: Number(values.days ?? 1),
    source,
    plants,
    out: values.out,
    in: values.in,
  };
}

function log(message: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

/** Verify pinned certificates before the first request to each host. */
async function verifyPins(hosts: [string, number][]): Promise<void> {
  for (const [host, port] of hosts) {
    const check = await checkPin(host, port);
    if (!check) continue;
    log(check.ok ? `TLS pin ok for ${host}:${port}` : `TLS pin CHANGED for ${host}:${port} (advisory): ${check.observed}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  // With --out, the run writes nothing into data/: it stages its rows and raw bundles so that
  // `apply` can merge them onto whatever the branch holds at that moment. Two runs finishing
  // at once then queue instead of colliding in a rebase over generated files.
  const archive = new RawArchive(options.out ? join(options.out, "raw") : undefined);
  const store = new CuratedStore(DATA_CURATED, options.dryRun);
  const batch = emptyBatch();

  if (options.command === "apply") {
    applyStaged(options);
    return;
  }

  const http = new HttpClient({
    minIntervalMs: options.rateMs,
    onAttempt: ({ key, attempt, status, error }) => {
      if (attempt > 1 || error) log(`  retry ${key} attempt ${attempt}${status ? ` -> ${status}` : ""}${error ? `: ${error}` : ""}`);
    },
  });
  const ords = new CelecOrds(http, archive);
  const smec = new CenaceSmec(http, archive);
  const operativa = new CenaceOperativa(http, archive);

  const budget = { left: options.maxRequests };
  const spend = async (work: () => Promise<void>): Promise<boolean> => {
    if (budget.left <= 0) return false;
    budget.left--;
    await work();
    return true;
  };

  switch (options.command) {
    case "daily": {
      const end = options.date ?? todayEc();
      await verifyPins([
        ["generacioncsr.celec.gob.ec", 8443],
        ["smec.cenace.gob.ec", 443],
        ["www.cenace.gob.ec", 443],
      ]);

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
      const smecDates = new Set(
        [...store.existingKeys(NATIONAL_BALANCE_DAILY, years)].map((key) => key.split("\u0000")[0]!),
      );

      await verifyPins(
        runs("smec")
          ? [
              ["generacioncsr.celec.gob.ec", 8443],
              ["smec.cenace.gob.ec", 443],
            ]
          : [["generacioncsr.celec.gob.ec", 8443]],
      );

      if (runs("ords-levels")) {
        // One request per year returns 365 days ending the day before `fecha`.
        for (let year = yearOf(from); year <= yearOf(to) + 1; year++) {
          const fecha = `${year}-09-20` as IsoDate;
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

      if (runs("ords-daily")) {
        outer: for (const date of eachDay(from, to)) {
          for (const report of DAILY_REPORTS) {
            if (present.has(`${date}|${report.source}`)) continue;
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

      if (runs("ords-plant-energy")) {
        outer: for (const code of options.plants) {
          for (const date of eachDay(from, to)) {
            if (present.has(`${date}|ords:${code}EnerDia`)) continue;
            if (!(await spend(() => ords.enerDia(batch, code, date)))) break outer;
            if (daysSinceLog(date)) log(`ords-plant-energy ${code}: reached ${date}, ${budget.left} requests left`);
          }
        }
      }

      if (runs("smec")) {
        for (const date of eachDay(from, to)) {
          if (smecDates.has(date)) continue;
          if (!(await spend(async () => void (await smec.day(batch, date))))) break;
          if (daysSinceLog(date)) log(`smec: reached ${date}, ${budget.left} requests left`);
        }
      }
      break;
    }

    case "smec-earliest": {
      await verifyPins([["smec.cenace.gob.ec", 443]]);
      const earliest = await smec.earliestAvailable(batch, { good: options.from ?? "2016-05-01", bad: options.to ?? "2010-01-01" });
      log(`SMEC earliest complete report: ${earliest}`);
      break;
    }

    case "latest": {
      await verifyPins([["generacioncsr.celec.gob.ec", 8443]]);
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
      throw new Error(`unknown command "${options.command}"; try daily, backfill, apply, latest or smec-earliest`);
  }

  if (options.out) stageBatch(archive, batch, options);
  else writeBatch(store, archive, batch, options);
  await closeAgents();
  process.exitCode = batch.errors.length > 0 ? 1 : 0;
}

/**
 * Writes the run's result to a staging directory: the rows as JSON, the raw responses as the
 * same bundles they will become in data/raw/. Nothing under data/ is touched.
 */
function stageBatch(archive: RawArchive, batch: IngestBatch, options: Options): void {
  const directory = options.out!;
  mkdirSync(directory, { recursive: true });
  const bundles = archive.flush();
  writeFileSync(
    join(directory, "batch.json"),
    `${JSON.stringify({ generated_at: nowUtc(), command: options.command, source: options.source, ...batch }, null, 1)}\n`,
  );
  log(`staged ${batch.observations.length + batch.national.length + batch.operativa.length} rows and ${bundles.length} raw bundles in ${directory}`);
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
  };

  const archive = new RawArchive();
  const merged = archive.mergeFrom(join(directory, "raw"));
  const store = new CuratedStore(DATA_CURATED, options.dryRun);
  writeBatch(store, archive, staged, { ...options, command: staged.command ?? options.command });
  log(`applied ${merged} archived responses`);
  process.exitCode = staged.errors.length > 0 ? 1 : 0;
}

/** `date|source` pairs already in observations_daily, used to skip finished work. */
function indexBySourceAndDate(store: CuratedStore, years: number[]): Set<string> {
  const keys = new Set<string>();
  for (const key of store.existingKeys(OBSERVATIONS_DAILY, years)) {
    const [date, , , source] = key.split("\u0000");
    keys.add(`${date}|${source}`);
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

function writeBatch(store: CuratedStore, archive: RawArchive, batch: IngestBatch, options: Options): void {
  const reports = [];
  if (batch.observations.length > 0) reports.push(store.upsert(OBSERVATIONS_DAILY, batch.observations));
  if (batch.national.length > 0) reports.push(store.upsert(NATIONAL_BALANCE_DAILY, batch.national));
  if (batch.operativa.length > 0) reports.push(store.upsert(OPERATIVA_SNAPSHOTS, batch.operativa));
  if (batch.bands.length > 0) {
    const existing = store.read(join(DATA_CURATED, "operating_bands.csv"));
    reports.push(store.upsert(OPERATING_BANDS, foldBands(batch.bands, existing)));
  }

  const archived = options.dryRun ? [] : archive.flush();

  for (const report of reports) {
    log(`${report.table}: +${report.added} new, ~${report.updated} updated, ${report.unchanged} unchanged`);
  }
  log(`archived ${archived.length} raw bundles`);
  for (const note of dedupe(batch.notes).slice(0, 40)) log(`note: ${note}`);
  for (const error of batch.errors.slice(0, 40)) log(`ERROR ${error}`);
  if (batch.notes.length > 40) log(`... and ${batch.notes.length - 40} more notes`);

  if (!options.dryRun) {
    writeStatus({
      generated_at: nowUtc(),
      command: options.command,
      source: options.source,
      requests: reports.length === 0 ? 0 : undefined,
      errors: batch.errors,
      notes: dedupe(batch.notes).slice(0, 100),
      tables: {
        observations_daily: summariseTable("observations_daily", "date"),
        national_balance_daily: summariseTable("national_balance_daily", "date"),
        operativa_snapshots: summariseTable("operativa_snapshots", "fetched_at"),
        operating_bands: summariseTable("operating_bands", "last_date"),
      },
    });
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

main().catch(async (error) => {
  console.error(error);
  await closeAgents();
  process.exit(1);
});
