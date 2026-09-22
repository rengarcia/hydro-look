/**
 * The historian route: the month window it asks for, and the walk that pages it back.
 *
 * The bodies here are **synthetic**, not captured responses. Every `pointValuesMesH24` fixture
 * in this repository was recorded inside the blank window of §2.1 and is null from end to end,
 * so a test that needed a real month of values could not be written from them. What is asserted
 * against real evidence is the shape (`items` / `loctimestamp` / `valueedit`, local midnight at
 * 05:00Z), which the fixtures do establish, and which `parsePointValues` is tested against
 * separately in ords.test.ts.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HttpClient } from "../src/lib/http/client.ts";
import { emptyBatch } from "../src/lib/sources/batch.ts";
import { CelecOrds } from "../src/lib/sources/celec-ords.ts";
import { walkHistorian, type FetchHistorianMonth } from "../src/lib/sources/historian.ts";
import type { HistorianSeries } from "../src/lib/registry.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { eachMonth, monthEnd, monthStart, type YearMonth } from "../src/lib/util/dates.ts";

const TODAY = "2026-09-22";

/** A month of local-midnight rows in the shape the fixtures establish, with values we choose. */
function syntheticMonth(ym: YearMonth, value: number | null): string {
  const days: string[] = [];
  for (let day = monthStart(ym); day <= monthEnd(ym); day = `${day.slice(0, 8)}${String(Number(day.slice(8)) + 1).padStart(2, "0")}`) {
    days.push(`{"loctimestamp":"${day}T05:00:00Z","valueedit":${value === null ? "null" : value}}`);
  }
  return `{"items":[${days.reverse().join(",")}]}`;
}

/** Records what was asked for and replies with whatever the test supplies. */
function stubHttp(body: (params: Record<string, string>) => string) {
  const calls: Record<string, string>[] = [];
  const http = {
    fetch: async (spec: { key: string; url: string; params?: Record<string, string> }) => {
      const params = spec.params ?? {};
      calls.push(params);
      return { key: spec.key, url: spec.url, status: 200, body: body(params), fetched_at: "2026-09-22T08:00:00Z", method: "GET" };
    },
  } as unknown as HttpClient;
  return { http, calls };
}

function ordsWithStub(body: (params: Record<string, string>) => string) {
  const { http, calls } = stubHttp(body);
  const archive = new RawArchive(join(mkdtempSync(join(tmpdir(), "hydro-look-hist-")), "raw"));
  return { ords: new CelecOrds(http, archive), calls };
}

describe("pointValuesMesH24 window", () => {
  it("reaches past the month boundary so the last local day is not truncated", async () => {
    const { ords, calls } = ordsWithStub(() => syntheticMonth({ year: 2026, month: 8 }, null));
    await ords.pointValuesMesH24(emptyBatch(), "mazar", "cota_masl", 30031, { year: 2026, month: 8 });

    // 2026-08-31 does not end until 2026-09-01T05:00Z, so a window stopping at 2026-09-01T00:00Z
    // leaves it incomplete — which is what the control probe saw as 30 values for 31 days.
    expect(calls[0]).toMatchObject({
      mrid: "30031",
      fechaInicio: "2026-08-01T00:00:00.000Z",
      fechaFin: "2026-09-02T00:00:00.000Z",
      fecha: "01/08/2026 00:00:00",
    });
  });

  it("rolls the window over a year boundary", async () => {
    const { ords, calls } = ordsWithStub(() => syntheticMonth({ year: 2025, month: 12 }, null));
    await ords.pointValuesMesH24(emptyBatch(), "mazar", "cota_masl", 30031, { year: 2025, month: 12 });
    expect(calls[0]).toMatchObject({ fechaInicio: "2025-12-01T00:00:00.000Z", fechaFin: "2026-01-02T00:00:00.000Z" });
  });

  it("keeps the month's own last day, which is the day the overlap exists for", async () => {
    const { ords } = ordsWithStub(() => syntheticMonth({ year: 2026, month: 8 }, 2139.1));
    const batch = emptyBatch();
    await ords.pointValuesMesH24(batch, "mazar", "cota_masl", 30031, { year: 2026, month: 8 });

    // The endpoint answers newest first, as every fixture shows, and the parser keeps that order.
    expect(batch.observations).toHaveLength(31);
    expect(batch.observations[0]).toMatchObject({ date: "2026-08-31", site: "mazar", variable: "cota_masl", mrid: "30031" });
    expect(batch.observations.at(-1)).toMatchObject({ date: "2026-08-01" });
  });

  it("records an all-null month as a note rather than as an error", async () => {
    const { ords } = ordsWithStub(() => syntheticMonth({ year: 2026, month: 8 }, null));
    const batch = emptyBatch();
    await ords.pointValuesMesH24(batch, "mazar", "cota_masl", 30031, { year: 2026, month: 8 });

    expect(batch.observations).toHaveLength(0);
    expect(batch.errors).toEqual([]);
    expect(batch.notes.join(" ")).toMatch(/all 31 points are null/);
  });
});

const MAZAR: HistorianSeries = { site: "mazar", variable: "cota_masl", mrid: 30031, control: true };
const MAZAR_CAUDAL: HistorianSeries = { site: "mazar", variable: "caudal_m3s", mrid: 30538, control: true };
const CCS: HistorianSeries = { site: "coca_codo_sinclair", variable: "cota_masl", mrid: 100540 };
const AGOYAN: HistorianSeries = { site: "agoyan", variable: "cota_masl", mrid: 140031 };

/** Answers each month from `answers`; `null` stands for a spent budget. Records what was asked. */
function fetcher(answers: (series: HistorianSeries, ym: YearMonth) => number | null) {
  const asked: string[] = [];
  const fetchMonth: FetchHistorianMonth = async (series, ym) => {
    const added = answers(series, ym);
    if (added !== null) asked.push(`${series.mrid}:${ym.year}-${String(ym.month).padStart(2, "0")}`);
    return added;
  };
  return { fetchMonth, asked };
}

describe("historian walk", () => {
  const months = eachMonth("2026-01-01", "2026-09-22");
  const never = () => false;

  it("spends its first request on the control and stops the run when it comes back blank", async () => {
    const { fetchMonth, asked } = fetcher(() => 0);
    const walk = await walkHistorian({
      months,
      today: TODAY,
      isDone: never,
      fetchMonth,
      controls: [MAZAR],
      targets: [CCS, AGOYAN],
    });

    expect(walk.outcome).toBe("control-blank");
    // The control is asked about a *closed* month: September is still being published, so its
    // blankness would prove nothing.
    expect(asked).toEqual(["30031:2026-08"]);
    expect(walk.notes.join(" ")).toMatch(/historian is blank at this hour/);
    // Nothing was recorded about the plants that have no second source.
    expect(walk.ranges).toEqual({});
  });

  it("reports the span of months that answered, newest last", async () => {
    const { fetchMonth } = fetcher((series, ym) => (series.mrid === CCS.mrid && ym.month < 4 ? 0 : 30));
    const walk = await walkHistorian({ months, today: TODAY, isDone: never, fetchMonth, controls: [MAZAR], targets: [CCS] });

    expect(walk.outcome).toBe("complete");
    expect(walk.ranges["coca_codo_sinclair/cota_masl"]).toBe("2026-04 .. 2026-09");
  });

  it("stops a series after a run of empty months and says where, without calling it 'no data'", async () => {
    const { fetchMonth, asked } = fetcher((series, ym) => (series.mrid === CCS.mrid && ym.month <= 7 ? 0 : 30));
    const walk = await walkHistorian({
      months,
      today: TODAY,
      isDone: never,
      fetchMonth,
      controls: [MAZAR],
      targets: [CCS],
      emptyMonthLimit: 3,
    });

    // September and August answered; July, June and May were empty, which hits the limit.
    expect(asked.filter((a) => a.startsWith("100540"))).toEqual([
      "100540:2026-09",
      "100540:2026-08",
      "100540:2026-07",
      "100540:2026-06",
      "100540:2026-05",
    ]);
    expect(walk.notes.join(" ")).toMatch(/walk stopped at 2026-05 after 3 months with no values/);
    expect(walk.notes.join(" ")).not.toMatch(/no data/);
  });

  it("skips months already stored for that mrid, and only for that mrid", async () => {
    const { fetchMonth, asked } = fetcher(() => 30);
    await walkHistorian({
      months,
      today: TODAY,
      // Everything Coca Codo Sinclair before September is already in the store.
      isDone: (ym, mrid) => mrid === CCS.mrid && ym.month < 9,
      fetchMonth,
      controls: [MAZAR],
      targets: [CCS, AGOYAN],
    });

    expect(asked.filter((a) => a.startsWith("100540"))).toEqual(["100540:2026-09"]);
    expect(asked.filter((a) => a.startsWith("140031"))).toHaveLength(9);
  });

  it("ends on a spent budget without recording the months it never asked about", async () => {
    let left = 3;
    const { fetchMonth } = fetcher(() => (left-- > 0 ? 30 : null));
    const walk = await walkHistorian({ months, today: TODAY, isDone: never, fetchMonth, controls: [MAZAR], targets: [CCS, AGOYAN] });

    expect(walk.outcome).toBe("budget-spent");
    // Two months of Coca Codo Sinclair answered before the budget ran out; the walk says
    // nothing about Agoyán, and nothing about the months it never reached.
    expect(walk.ranges).toEqual({});
    expect(walk.notes).toEqual([]);
  });

  it("walks the controls that are not the gate, and walks them before the targets", async () => {
    const { fetchMonth, asked } = fetcher(() => 30);
    const walk = await walkHistorian({
      months: eachMonth("2026-07-01", "2026-09-22"),
      today: TODAY,
      isDone: never,
      fetchMonth,
      controls: [MAZAR, MAZAR_CAUDAL],
      targets: [CCS],
    });

    // One request for the gate, on the closed month; then the second control's own walk,
    // which is what gives the caudal mrids a history to be checked against repDiaHid12m.
    expect(asked).toEqual([
      "30031:2026-08",
      "30538:2026-09",
      "30538:2026-08",
      "30538:2026-07",
      "100540:2026-09",
      "100540:2026-08",
      "100540:2026-07",
    ]);
    expect(walk.ranges["mazar/caudal_m3s"]).toBe("2026-07 .. 2026-09");
  });

  it("does not walk the gate itself beyond its one control month", async () => {
    const { fetchMonth, asked } = fetcher(() => 30);
    await walkHistorian({
      months: eachMonth("2026-07-01", "2026-09-22"),
      today: TODAY,
      isDone: never,
      fetchMonth,
      controls: [MAZAR],
      targets: [CCS],
    });

    // The reports publish Mazar's level for every month here and it already matches to the
    // digit, so paging it back would buy nothing the store does not hold twice over.
    expect(asked.filter((a) => a.startsWith("30031"))).toEqual(["30031:2026-08"]);
  });

  it("does nothing when the range holds no months", async () => {
    const { fetchMonth, asked } = fetcher(() => 30);
    const walk = await walkHistorian({ months: [], today: TODAY, isDone: never, fetchMonth });
    expect(walk.outcome).toBe("nothing-to-do");
    expect(asked).toEqual([]);
  });
});

describe("month arithmetic the walk depends on", () => {
  it("treats the running month as open and the previous one as closed", () => {
    expect(monthEnd({ year: 2026, month: 9 }) < TODAY).toBe(false);
    expect(monthEnd({ year: 2026, month: 8 }) < TODAY).toBe(true);
  });
});
