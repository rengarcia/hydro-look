import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { FetchResult, RequestSpec } from "../src/lib/http/client.ts";
import { parseOptions } from "../src/lib/options.ts";
import { combineExchange, dailyMeanOfFullDays, parseXmDaily, parseXmHourly } from "../src/lib/parse/xm.ts";
import { emptyBatch } from "../src/lib/sources/batch.ts";
import { REQUESTS_PER_WINDOW, Xm, ingestXm, monthWindows } from "../src/lib/sources/xm.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED } from "../src/lib/util/paths.ts";
import { fixture } from "./helpers.ts";

const xm = (name: string) => fixture("xm", `${name}.json`);
const fetchedAt = "2026-09-22T17:00:00Z";

function exchangeFor(window: string) {
  return combineExchange(parseXmHourly(xm(`ExpoEner_Enlace_${window}`)), parseXmHourly(xm(`ImpoEner_Enlace_${window}`)));
}

const gwhPerDay = (rows: { export_kwh: number }[]) => rows.reduce((a, r) => a + r.export_kwh, 0) / rows.length / 1e6;

describe("xm parsers", () => {
  it("reproduces the 2024 cutoff on the 230 kV circuit from the recorded answers", () => {
    const august = exchangeFor("2024-08").filter((r) => r.link === "ECUADOR 230");
    const october = exchangeFor("2024-10").filter((r) => r.link === "ECUADOR 230");
    expect(gwhPerDay(august)).toBeCloseTo(9.07, 1);
    expect(gwhPerDay(october)).toBeCloseTo(0.175, 2);
  });

  it("never publishes an hour in both directions, so a blank hour is flow the other way", () => {
    for (const window of ["2019-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12", "recent"]) {
      for (const row of exchangeFor(window)) {
        expect(row.export_hours + row.import_hours).toBeLessThanOrEqual(24);
        if (row.link === "ECUADOR 230" && row.export_hours > 0 && row.import_hours > 0) {
          expect(row.export_hours + row.import_hours).toBe(24);
        }
      }
    }
  });

  it("keeps a day of import-only flow instead of dropping it for missing exports", () => {
    // 2019-07-08 is in ImpoEner and absent from ExpoEner: Ecuador was the exporter all day.
    const day = exchangeFor("2019-07").find((r) => r.date === "2019-07-08" && r.link === "ECUADOR 230")!;
    expect(day.export_hours).toBe(0);
    expect(day.import_hours).toBeGreaterThan(0);
  });

  it("refuses an hour published both ways, a repeated entity and a non-number", () => {
    const hours = (values: (string | "")[]) =>
      Object.fromEntries(values.map((v, i) => [`Hour${String(i + 1).padStart(2, "0")}`, v]));
    const answer = (code: string, values: string[], repeat = 1) =>
      JSON.stringify({
        Items: Array.from({ length: repeat }, () => ({
          Date: "2026-01-01",
          HourlyEntities: [{ Id: "Enlace", Values: { code, ...hours(values) } }],
        })),
      });
    const one = ["5", ...Array(23).fill("")];
    expect(() => combineExchange(parseXmHourly(answer("ECUADOR 230", one)), parseXmHourly(answer("ECUADOR 230", one))))
      .toThrow(/both directions/);
    expect(() => parseXmHourly(answer("ECUADOR 230", one, 2))).toThrow(/twice/);
    expect(() => parseXmHourly(answer("ECUADOR 230", ["n/a", ...Array(23).fill("")]))).toThrow(/not a number/);
  });

  it("reads daily fractions as fractions and averages a price only over full days", () => {
    const storage = parseXmDaily(xm("PorcVoluUtilDiar_Sistema_2024-10"));
    expect(storage).toHaveLength(31);
    expect(storage[0]).toEqual({ date: "2024-10-01", value: 0.50353 });
    const notes: string[] = [];
    const price = dailyMeanOfFullDays(parseXmHourly(xm("PrecBolsNaci_Sistema_2024-10")), notes);
    expect(price).toHaveLength(31);
    const partial = parseXmHourly(xm("PrecBolsNaci_Sistema_2024-10")).slice(0, 1);
    partial[0]!.hours[5] = null;
    expect(dailyMeanOfFullDays(partial, notes)).toHaveLength(0);
    expect(notes.at(-1)).toMatch(/23\/24/);
  });
});

describe("xm against SMEC", () => {
  // CENACE meters the same interconnection from the Ecuadorian side. XM reports one net
  // direction per hour while SMEC appears to count both, so on low-flow days their gross
  // figures differ by ~100 MWh; net against net is the comparison that means something.
  it("agrees with SMEC's net Colombian imports at offset zero and at no other", () => {
    const smec = new Map<string, number>();
    for (const row of parseCsv(readFileSync(join(DATA_CURATED, "national_balance_daily", "2024.csv"), "utf8"))) {
      const sign = row["concepto"] === "importacion_colombia" ? 1 : row["concepto"] === "exportacion_colombia" ? -1 : 0;
      if (sign) smec.set(row["date"]!, (smec.get(row["date"]!) ?? 0) + sign * Number(row["dia_kwh"]));
    }
    const xmNet = new Map<string, number>();
    for (const window of ["2024-08", "2024-09", "2024-10", "2024-11", "2024-12"]) {
      for (const row of exchangeFor(window)) {
        xmNet.set(row.date, (xmNet.get(row.date) ?? 0) + row.export_kwh - row.import_kwh);
      }
    }
    const correlationAt = (offset: number) => {
      const pairs: [number, number][] = [];
      for (const [date, value] of xmNet) {
        const shifted = new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
        const other = smec.get(shifted);
        if (other !== undefined) pairs.push([value, other]);
      }
      const n = pairs.length;
      const mx = pairs.reduce((a, [x]) => a + x, 0) / n;
      const my = pairs.reduce((a, [, y]) => a + y, 0) / n;
      const cov = pairs.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0);
      const vx = pairs.reduce((a, [x]) => a + (x - mx) ** 2, 0);
      const vy = pairs.reduce((a, [, y]) => a + (y - my) ** 2, 0);
      return { n, r: cov / Math.sqrt(vx * vy) };
    };
    const aligned = correlationAt(0);
    expect(aligned.n).toBeGreaterThan(140);
    expect(aligned.r).toBeGreaterThan(0.999);
    expect(correlationAt(1).r).toBeLessThan(0.95);
    expect(correlationAt(-1).r).toBeLessThan(0.95);
  });
});

describe("xm ingest", () => {
  function fakeXm() {
    const calls: RequestSpec[] = [];
    const fetch = vi.fn(async (spec: RequestSpec): Promise<FetchResult> => {
      calls.push(spec);
      const body = spec.jsonBody as { MetricId: string; Entity: string; StartDate: string };
      const month = body.StartDate.slice(0, 7);
      const name = `${body.MetricId}_${body.Entity}_${month}`;
      return {
        key: spec.key,
        url: spec.url,
        method: "POST",
        status: 200,
        body: xm(name),
        fetchedAt,
        durationMs: 0,
        attempts: 1,
      };
    });
    return { calls, fetch };
  }

  it("splits a range into calendar months, the unit XM answers in", () => {
    expect(monthWindows("2024-08-20", "2024-10-03")).toEqual([
      ["2024-08-20", "2024-08-31"],
      ["2024-09-01", "2024-09-30"],
      ["2024-10-01", "2024-10-03"],
    ]);
  });

  it("writes both tables from recorded answers, archives every request and resumes a settled month", async () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-xm-"));
    const archive = new RawArchive(join(root, "raw"));
    const store = new CuratedStore(join(root, "curated"));
    const { calls, fetch } = fakeXm();
    const batch = emptyBatch();
    const options = parseOptions(["xm", "--from", "2024-10-01", "--to", "2024-10-31"]);
    await ingestXm(new Xm({ fetch }, archive), store, batch, options, "2026-09-22");
    expect(batch.errors).toEqual([]);
    expect(calls).toHaveLength(REQUESTS_PER_WINDOW);
    expect(calls.every((c) => c.method === "POST")).toBe(true);
    expect(batch.xmExchange.filter((r) => r.link === "ECUADOR 230")).toHaveLength(31);
    expect(new Set(batch.xmSystem.map((r) => r.metric)).size).toBe(9);
    expect(batch.xmExchange[0]!.raw_ref).toMatch(/ExpoEner.* .*ImpoEner/);
    expect(archive.flush().length).toBeGreaterThan(0);

    // Written through the store, the same month is skipped on the next historical run.
    store.upsert((await import("../src/lib/contracts/tables.ts")).XM_EXCHANGE_DAILY, batch.xmExchange);
    store.upsert((await import("../src/lib/contracts/tables.ts")).XM_SYSTEM_DAILY, batch.xmSystem);
    const again = fakeXm();
    await ingestXm(new Xm({ fetch: again.fetch }, archive), store, emptyBatch(), options, "2026-09-22");
    expect(again.calls).toHaveLength(0);
  });

  it("records a 400 as an error for that window instead of writing anything", async () => {
    const archive = new RawArchive(mkdtempSync(join(tmpdir(), "hydro-xm-400-")));
    const fetch = vi.fn(async (spec: RequestSpec): Promise<FetchResult> => ({
      key: spec.key, url: spec.url, method: "POST", status: 400,
      body: "Id de Métrica no encontrada.", fetchedAt, durationMs: 0, attempts: 1,
    }));
    const batch = emptyBatch();
    await new Xm({ fetch }, archive).exchange(batch, "2024-10-01", "2024-10-31");
    expect(batch.xmExchange).toHaveLength(0);
    expect(batch.errors[0]).toMatch(/400.*no encontrada/);
  });
});
