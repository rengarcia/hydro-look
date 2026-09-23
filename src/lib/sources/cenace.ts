/**
 * CENACE clients: the SMEC daily balance and the Información Operativa page.
 *
 * SMEC is the national backbone — closed days in absolute kWh, date-parameterised, deep
 * history. Información Operativa is a cross-check and a live tile; its "real time" figures are
 * cumulative for the running day and its own footer calls them preliminary SCADA data.
 */

import type { HttpClient } from "../http/client.ts";
import type { RawArchive } from "../store/archive.ts";
import { parseSmecInforme1 } from "../parse/smec.ts";
import { parseInformacionOperativa } from "../parse/operativa.ts";
import { rowFloor } from "../registry.ts";
import { smecFecha, type IsoDate } from "../util/dates.ts";
import type { IngestBatch } from "./batch.ts";

export const SMEC_INFORME1 = "https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do";
export const OPERATIVA_URL = "https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm";
export const SMEC_SOURCE = "cenace_smec";
export const OPERATIVA_SOURCE = "cenace_operativa";

export class CenaceSmec {
  constructor(
    private readonly http: HttpClient,
    private readonly archive: RawArchive,
  ) {}

  /**
   * Returns whether the day produced a usable, complete report.
   *
   * A 404 is SMEC saying it has no report for the day, which is an answer (the earliest-date
   * search depends on it) and only a note. A 500 used to be treated the same way, so a server
   * error was neither retried nor reported; the client now retries it like any 5xx, and one
   * that survives the retries is an error on the batch. Either way the body is archived.
   */
  async day(batch: IngestBatch, date: IsoDate): Promise<{ complete: boolean; found: boolean }> {
    let result;
    try {
      result = await this.http.fetch({
        key: `informe1:${date}`,
        url: SMEC_INFORME1,
        params: { fecha: smecFecha(date) },
        allowStatus: [404],
      });
    } catch (error) {
      batch.errors.push(`smec ${date}: ${String(error)}`);
      return { complete: false, found: false };
    }

    const rawRef = this.archive.add(SMEC_SOURCE, "ResultadoInforme1", date, {
      key: result.key,
      url: result.url,
      method: result.method,
      status: result.status,
      fetched_at: result.fetchedAt,
      body: result.body,
    });
    if (result.status === 404) {
      batch.notes.push(`smec ${date}: HTTP 404`);
      return { complete: false, found: false };
    }
    if (result.status !== 200) {
      batch.errors.push(`smec ${date}: HTTP ${result.status} after ${result.attempts} attempts (archived at ${rawRef})`);
      return { complete: false, found: false };
    }

    let report;
    try {
      report = parseSmecInforme1(result.body, date);
    } catch (error) {
      batch.errors.push(`smec ${date}: parse failed: ${String(error)} (archived at ${rawRef})`);
      return { complete: false, found: false };
    }

    batch.notes.push(...report.notes);
    if (!report.complete) return { complete: false, found: true };

    for (const row of report.rows) {
      batch.national.push({
        ...row,
        tipo_dia: report.tipo_dia,
        tipo_dia_anio_anterior: report.tipo_dia_anio_anterior,
        source: "smec:ResultadoInforme1",
        fetched_at: result.fetchedAt,
        raw_ref: rawRef,
      });
    }
    return { complete: true, found: true };
  }

  /**
   * Binary search for the earliest date SMEC still serves. Phase 0 got a full report for
   * 2016-05-01, so the search starts below that and costs about a dozen requests.
   */
  async earliestAvailable(batch: IngestBatch, known: { good: IsoDate; bad: IsoDate }): Promise<IsoDate> {
    const dayMs = 86_400_000;
    let good = Date.parse(`${known.good}T00:00:00Z`);
    let bad = Date.parse(`${known.bad}T00:00:00Z`);
    while (good - bad > dayMs) {
      const midpoint = new Date(bad + Math.floor((good - bad) / 2 / dayMs) * dayMs).toISOString().slice(0, 10);
      const probe = await this.day(batch, midpoint);
      if (probe.complete) good = Date.parse(`${midpoint}T00:00:00Z`);
      else bad = Date.parse(`${midpoint}T00:00:00Z`);
    }
    return new Date(good).toISOString().slice(0, 10);
  }
}

export class CenaceOperativa {
  constructor(
    private readonly http: HttpClient,
    private readonly archive: RawArchive,
  ) {}

  async snapshot(batch: IngestBatch): Promise<void> {
    let result;
    try {
      result = await this.http.fetch({ key: "InformacionOperativa", url: OPERATIVA_URL });
    } catch (error) {
      batch.errors.push(`operativa: ${String(error)}`);
      return;
    }

    // A file per run: the page is snapshotted twice a day, and one file per day would be
    // rewritten by the second run.
    const rawRef = this.archive.add(OPERATIVA_SOURCE, "InformacionOperativa", "run", {
      key: `InformacionOperativa:${result.fetchedAt}`,
      url: result.url,
      method: result.method,
      status: result.status,
      fetched_at: result.fetchedAt,
      body: result.body,
    });
    if (result.status !== 200) {
      batch.errors.push(`operativa: HTTP ${result.status} (archived at ${rawRef})`);
      return;
    }

    let snapshot;
    try {
      snapshot = parseInformacionOperativa(result.body);
    } catch (error) {
      batch.errors.push(`operativa: parse failed: ${String(error)} (archived at ${rawRef})`);
      return;
    }

    const floor = rowFloor("InformacionOperativa", null, result.fetchedAt.slice(0, 10));
    if (floor && snapshot.metrics.length < floor.rows) {
      batch.errors.push(
        `operativa: HTTP 200 but ${snapshot.metrics.length} metrics, expected at least ${floor.rows} (archived at ${rawRef})`,
      );
    }

    batch.notes.push(...snapshot.notes);
    for (const metric of snapshot.metrics) {
      batch.operativa.push({
        fetched_at: result.fetchedAt,
        block: metric.block,
        period_label: metric.period_label,
        period_date: metric.period_date ?? "",
        metric: metric.metric,
        value: metric.value,
        unit: metric.unit,
        source: "cenace:InformacionOperativa",
        raw_ref: rawRef,
      });
    }
  }
}
