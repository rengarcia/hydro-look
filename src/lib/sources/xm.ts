/**
 * XM servapibi: POST /hourly or /daily with `{MetricId, StartDate, EndDate, Entity, Filter}`,
 * at most one calendar month per request (the official client, EquipoAnaliticaXM/API_XM,
 * splits the same way; the live catalogue says MaxDays 31). An unknown metric answers 400 in
 * plain text. Contract and fixtures: scripts/recon/RECON_REPORT.md §10a.
 */

import { XM_EXCHANGE_DAILY, XM_SYSTEM_DAILY, validateRows } from "../contracts/tables.ts";
import type { HttpClient } from "../http/client.ts";
import {
  XM_LINKS,
  XM_SYSTEM_METRICS,
  combineExchange,
  dailyMeanOfFullDays,
  parseXmDaily,
  parseXmHourly,
  type XmSystemMetric,
} from "../parse/xm.ts";
import type { RawArchive } from "../store/archive.ts";
import type { CuratedStore } from "../store/curated.ts";
import { addDays, eachDay, monthOf, todayEc, yearOf, type IsoDate } from "../util/dates.ts";
import type { Options } from "../options.ts";
import type { IngestBatch } from "./batch.ts";

const BASE = "https://servapibi.xm.com.co";

/**
 * How far back a routine run re-reads. The slowest series XM settles is the TIE purchase at
 * about five days, the exchanges at three (measured on the recon capture of 2026-09-22), and a
 * run that re-reads five weeks repairs a missed week without anyone dispatching a backfill.
 */
const RECENT_DAYS = 35;

/** Where the first backfill starts: SMEC's first day, so the two sides of the border overlap. */
export const XM_FIRST_DATE = "2016-05-01";

interface Answer {
  body: string;
  fetchedAt: string;
  rawRef: string;
}

export class Xm {
  constructor(
    private readonly http: Pick<HttpClient, "fetch">,
    private readonly archive: RawArchive,
  ) {}

  async metric(endpoint: "hourly" | "daily", metricId: string, entity: "Sistema" | "Enlace", from: IsoDate, to: IsoDate): Promise<Answer> {
    if (monthOf(from) !== monthOf(to) || yearOf(from) !== yearOf(to)) {
      throw new Error(`xm: ${metricId} window ${from}..${to} crosses a month; XM caps a request at one`);
    }
    const key = `${metricId}:${entity}:${from}:${to}`;
    const result = await this.http.fetch({
      key,
      url: `${BASE}/${endpoint}`,
      method: "POST",
      jsonBody: { MetricId: metricId, StartDate: from, EndDate: to, Entity: entity, Filter: [] },
      allowStatus: [400],
    });
    const rawRef = this.archive.add("xm", `${metricId}_${entity}`, from, {
      key,
      url: result.url,
      method: result.method,
      status: result.status,
      fetched_at: result.fetchedAt,
      body: result.body,
    });
    if (result.status !== 200) throw new Error(`HTTP ${result.status}: ${result.body.slice(0, 120)} (archived at ${rawRef})`);
    return { body: result.body, fetchedAt: result.fetchedAt, rawRef };
  }

  /** Both directions of both Ecuador circuits for one month-bounded window. */
  async exchange(batch: IngestBatch, from: IsoDate, to: IsoDate): Promise<void> {
    try {
      const exports = await this.metric("hourly", "ExpoEner", "Enlace", from, to);
      const imports = await this.metric("hourly", "ImpoEner", "Enlace", from, to);
      const rows = combineExchange(parseXmHourly(exports.body), parseXmHourly(imports.body), batch.notes);
      batch.xmExchange.push(
        ...validateRows(
          XM_EXCHANGE_DAILY,
          rows.map((row) => ({
            ...row,
            source: "xm:servapibi",
            fetched_at: exports.fetchedAt > imports.fetchedAt ? exports.fetchedAt : imports.fetchedAt,
            raw_ref: `${exports.rawRef} ${imports.rawRef}`,
          })),
        ),
      );
    } catch (error) {
      batch.errors.push(`xm exchange ${from}..${to}: ${String(error)}`);
    }
  }

  async system(batch: IngestBatch, metric: XmSystemMetric, from: IsoDate, to: IsoDate): Promise<void> {
    const spec = XM_SYSTEM_METRICS[metric];
    try {
      const answer = await this.metric(spec.endpoint, metric, "Sistema", from, to);
      const values = spec.endpoint === "hourly" ? dailyMeanOfFullDays(parseXmHourly(answer.body), batch.notes) : parseXmDaily(answer.body);
      batch.xmSystem.push(
        ...validateRows(
          XM_SYSTEM_DAILY,
          values.map((v) => ({
            date: v.date,
            metric,
            value: v.value,
            unit: spec.unit,
            source: "xm:servapibi",
            fetched_at: answer.fetchedAt,
            raw_ref: answer.rawRef,
          })),
        ),
      );
    } catch (error) {
      batch.errors.push(`xm ${metric} ${from}..${to}: ${String(error)}`);
    }
  }
}

/** Calendar-month windows covering `from..to`, the unit XM answers in. */
export function monthWindows(from: IsoDate, to: IsoDate): [IsoDate, IsoDate][] {
  const windows: [IsoDate, IsoDate][] = [];
  let start = from;
  while (start <= to) {
    const [y, m] = start.split("-").map(Number) as [number, number];
    const monthEnd = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
    const end = monthEnd < to ? monthEnd : to;
    windows.push([start, end]);
    start = addDays(end, 1);
  }
  return windows;
}

/** Requests one window costs: two exchange answers plus one per system metric. */
export const REQUESTS_PER_WINDOW = 2 + Object.keys(XM_SYSTEM_METRICS).length;

/**
 * Routine runs re-read the last five weeks; `--from` walks history month by month, skipping a
 * month that is already complete and settled so a budgeted backfill resumes where it stopped.
 */
export async function ingestXm(source: Xm, store: CuratedStore, batch: IngestBatch, options: Options, today = todayEc()): Promise<void> {
  if (options.date || (options.to && !options.from)) throw new Error("xm: use --from and optional --to for a historical run");
  const yesterday = addDays(today, -1);
  const from = options.from ?? addDays(today, -RECENT_DAYS);
  const to = options.to && options.to < yesterday ? options.to : yesterday;
  if (from < XM_FIRST_DATE && options.from) batch.notes.push(`xm: nothing is asked before ${XM_FIRST_DATE}`);
  const start = from < XM_FIRST_DATE ? XM_FIRST_DATE : from;
  if (start > to) throw new Error(`xm: empty range ${start}..${to}`);

  let remaining = options.maxRequests;
  for (const [windowFrom, windowTo] of monthWindows(start, to)) {
    if (options.from && isSettledAndComplete(store, windowFrom, windowTo, today)) continue;
    if (remaining < REQUESTS_PER_WINDOW) {
      batch.notes.push(`xm: request budget exhausted before ${windowFrom}; rerun to continue`);
      return;
    }
    remaining -= REQUESTS_PER_WINDOW;
    await source.exchange(batch, windowFrom, windowTo);
    for (const metric of Object.keys(XM_SYSTEM_METRICS) as XmSystemMetric[]) {
      await source.system(batch, metric, windowFrom, windowTo);
    }
  }
}

/**
 * A month is done when it is more than a fortnight old — well past every series' publication
 * lag — and every day of it already has an ECUADOR 230 row and a storage reading. The 230 kV
 * circuit carries flow one way or the other on every day the fixtures cover, so its absence is
 * a gap rather than a quiet line.
 */
function isSettledAndComplete(store: CuratedStore, from: IsoDate, to: IsoDate, today: IsoDate): boolean {
  if (to >= addDays(today, -14)) return false;
  const years = [yearOf(from)];
  const exchange = store.existingKeys(XM_EXCHANGE_DAILY, years);
  const system = store.existingKeys(XM_SYSTEM_DAILY, years);
  return eachDay(from, to).every((d) => exchange.has(`${d}\u0000${XM_LINKS[0]}`) && system.has(`${d}\u0000PorcVoluUtilDiar`));
}
