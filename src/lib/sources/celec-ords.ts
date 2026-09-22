/**
 * CELEC ORDS client: `https://generacioncsr.celec.gob.ec:8443/ords/csr/`.
 *
 * No authentication, a valid certificate since 2026-09-17, and — the part that matters — the
 * report endpoints return long windows per request: one `repDiaHid12m` call is a year of daily
 * levels and inflows, one `repDiaEner12m` call is six months of daily energy. The historian
 * endpoints (`pointValues*`) that the dashboards themselves use have returned nothing but
 * nulls since Phase 0, so they are a fallback here, not the backbone.
 */

import type { HttpClient } from "../http/client.ts";
import type { RawArchive } from "../store/archive.ts";
import {
  parseCaudCuenAniosAvg,
  parseEnerDia,
  parseEstUnidades,
  parsePointValues,
  parseProdLineaLast2h,
  parseRepDiaEner12m,
  parseRepDiaEnerAyerHoy,
  parseRepDiaHid12m,
  parseRepDiaNivQIng,
  parseRepDiaPotQTurb,
  parseRepDiaRegAyer,
  parseRepDiaVolAlm,
} from "../parse/ords.ts";
import type { ParseResult } from "../parse/types.ts";
import { ENERGY_MODULES, type EnergyPlantCode } from "../registry.ts";
import { monthOf, ordsFecha, ordsMidnightZ, yearOf, type IsoDate } from "../util/dates.ts";
import type { IngestBatch } from "./batch.ts";

export const ORDS_BASE = "https://generacioncsr.celec.gob.ec:8443/ords/csr";
export const ORDS_MODULE_CSR = `${ORDS_BASE}/sardomcsr`;
export const SOURCE = "celec_ords";

export class CelecOrds {
  constructor(
    private readonly http: HttpClient,
    private readonly archive: RawArchive,
  ) {}

  /**
   * Fetch, archive verbatim, parse, and stamp every row with where it came from. A non-200 is
   * recorded as an error on the batch and writes nothing: one failing endpoint must not stop
   * the rest of the run, and must not silently produce an empty table either.
   */
  private async collect(
    batch: IngestBatch,
    opts: {
      endpoint: string;
      key: string;
      url: string;
      method?: "GET" | "POST";
      params?: Record<string, string>;
      jsonBody?: unknown;
      dataDate: IsoDate | null;
      parse: (body: string) => ParseResult;
    },
  ): Promise<void> {
    let result;
    try {
      result = await this.http.fetch({
        key: opts.key,
        url: opts.url,
        method: opts.method,
        params: opts.params,
        jsonBody: opts.jsonBody,
      });
    } catch (error) {
      batch.errors.push(`${opts.key}: ${String(error)}`);
      return;
    }
    if (result.status !== 200) {
      batch.errors.push(`${opts.key}: HTTP ${result.status}`);
      return;
    }

    const period = opts.dataDate ? { year: yearOf(opts.dataDate), month: monthOf(opts.dataDate) } : null;
    const rawRef = this.archive.add(SOURCE, opts.endpoint, period, {
      key: result.key,
      url: result.url,
      method: result.method,
      status: result.status,
      fetched_at: result.fetchedAt,
      body: result.body,
    });

    let parsed: ParseResult;
    try {
      parsed = opts.parse(result.body);
    } catch (error) {
      // The response is archived, so a parser fix can reprocess it without re-fetching.
      batch.errors.push(`${opts.key}: parse failed: ${String(error)} (archived at ${rawRef})`);
      return;
    }

    for (const observation of parsed.observations) {
      batch.observations.push({ ...observation, fetched_at: result.fetchedAt, raw_ref: rawRef });
    }
    if (parsed.bands) batch.bands.push(...parsed.bands);
    if (parsed.notes) batch.notes.push(...parsed.notes);
  }

  /** A year of daily levels, inflows and bands ending the day before `fecha`. */
  async repDiaHid12m(batch: IngestBatch, fecha: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaHid12m",
      key: `repDiaHid12m:${fecha}`,
      url: `${ORDS_MODULE_CSR}/repDiaHid12m`,
      params: { fecha: ordsFecha(fecha) },
      dataDate: fecha,
      parse: parseRepDiaHid12m,
    });
  }

  /** Roughly six months of daily energy per CELEC Sur plant, ending the day before `fecha`. */
  async repDiaEner12m(batch: IngestBatch, fecha: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaEner12m",
      key: `repDiaEner12m:${fecha}`,
      url: `${ORDS_MODULE_CSR}/repDiaEner12m`,
      params: { fecha: ordsFecha(fecha) },
      dataDate: fecha,
      parse: parseRepDiaEner12m,
    });
  }

  async repDiaNivQIng(batch: IngestBatch, fecha: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaNivQIng",
      key: `repDiaNivQIng:${fecha}`,
      url: `${ORDS_MODULE_CSR}/repDiaNivQIng`,
      params: { fecha: ordsFecha(fecha) },
      dataDate: fecha,
      parse: parseRepDiaNivQIng,
    });
  }

  async repDiaPotQTurb(batch: IngestBatch, fecha: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaPotQTurb",
      key: `repDiaPotQTurb:${fecha}`,
      url: `${ORDS_MODULE_CSR}/repDiaPotQTurb`,
      params: { fecha: ordsFecha(fecha) },
      dataDate: fecha,
      parse: parseRepDiaPotQTurb,
    });
  }

  async repDiaEnerAyerHoy(batch: IngestBatch, fecha: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaEnerAyerHoy",
      key: `repDiaEnerAyerHoy:${fecha}`,
      url: `${ORDS_MODULE_CSR}/repDiaEnerAyerHoy`,
      params: { fecha: ordsFecha(fecha) },
      dataDate: fecha,
      parse: (body) => parseRepDiaEnerAyerHoy(body, fecha),
    });
  }

  async repDiaRegAyer(batch: IngestBatch, fecha: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaRegAyer",
      key: `repDiaRegAyer:${fecha}`,
      url: `${ORDS_MODULE_CSR}/repDiaRegAyer`,
      params: { fecha: ordsFecha(fecha) },
      dataDate: fecha,
      parse: parseRepDiaRegAyer,
    });
  }

  /** The only POST in the API; the date goes in the body as a local-midnight instant. */
  async repDiaVolAlm(batch: IngestBatch, date: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "repDiaVolAlm",
      key: `repDiaVolAlm:${date}`,
      url: `${ORDS_MODULE_CSR}/repDiaVolAlm`,
      method: "POST",
      jsonBody: { v_loctimestamp: ordsMidnightZ(date) },
      dataDate: date,
      parse: (body) => parseRepDiaVolAlm(body, date),
    });
  }

  /** 24 hour-ending energy values for one plant-day; the parser writes only complete days. */
  async enerDia(batch: IngestBatch, code: EnergyPlantCode, date: IsoDate): Promise<void> {
    const { module, site } = ENERGY_MODULES[code];
    await this.collect(batch, {
      endpoint: `${code}EnerDia`,
      key: `${code}EnerDia:${date}`,
      url: `${ORDS_BASE}/${module}/${code}EnerDia`,
      params: { fecha: ordsFecha(date) },
      dataDate: date,
      parse: (body) => parseEnerDia(body, site, code, date),
    });
  }

  /** Mean Paute basin flow per year; one request covers 2010 to now. */
  async caudCuenAniosAvg(batch: IngestBatch, from: IsoDate, to: IsoDate): Promise<void> {
    await this.collect(batch, {
      endpoint: "csrCaudCuenAniosAvg",
      key: `csrCaudCuenAniosAvg:${from}:${to}`,
      url: `${ORDS_MODULE_CSR}/csrCaudCuenAniosAvg`,
      params: { fechaInicio: `${from}T00:00:00.000Z`, fechaFin: `${to}T00:00:00.000Z` },
      dataDate: to,
      parse: parseCaudCuenAniosAvg,
    });
  }

  /**
   * The historian series. Kept because it is the only route to Coca Codo Sinclair, Agoyán and
   * Manduriacu levels, and written to tolerate the all-null responses seen in every Phase 0 run.
   */
  async pointValuesMesH24(
    batch: IngestBatch,
    site: Parameters<typeof parsePointValues>[1],
    variable: Parameters<typeof parsePointValues>[2],
    mrid: number,
    year: number,
    month: number,
  ): Promise<void> {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    await this.collect(batch, {
      endpoint: "pointValuesMesH24",
      key: `pointValuesMesH24:${mrid}:${start}`,
      url: `${ORDS_MODULE_CSR}/pointValuesMesH24`,
      params: {
        mrid: String(mrid),
        fechaInicio: `${start}T00:00:00.000Z`,
        fechaFin: `${nextMonth}T00:00:00.000Z`,
        fecha: ordsFecha(start),
      },
      dataDate: start,
      parse: (body) => parsePointValues(body, site, variable, mrid),
    });
  }

  /** Live endpoints: a snapshot for the "now" tile, never a series. */
  async latest(): Promise<{ units: ReturnType<typeof parseEstUnidades>; live: ReturnType<typeof parseProdLineaLast2h>; fetchedAt: string }> {
    const [unitsResponse, liveResponse] = [
      await this.http.fetch({ key: "csrEstUnidades", url: `${ORDS_MODULE_CSR}/csrEstUnidades` }),
      await this.http.fetch({ key: "csrProdLineaLast2h", url: `${ORDS_MODULE_CSR}/csrProdLineaLast2h` }),
    ];
    for (const response of [unitsResponse, liveResponse]) {
      this.archive.add(SOURCE, response.key, null, {
        key: `${response.key}:${response.fetchedAt}`,
        url: response.url,
        method: response.method,
        status: response.status,
        fetched_at: response.fetchedAt,
        body: response.body,
      });
    }
    return {
      units: parseEstUnidades(unitsResponse.body),
      live: parseProdLineaLast2h(liveResponse.body),
      fetchedAt: liveResponse.fetchedAt,
    };
  }
}
