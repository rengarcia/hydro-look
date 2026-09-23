/**
 * The public data contract: the block every `public/api` document carries and the day-before
 * fields in `latest.json`. The JSON Schemas the committed documents are held to are checked in
 * `publish.test.ts`, beside the arithmetic that fills them.
 */

import { describe, expect, it } from "vitest";
import { balanceByDay, nationalSnapshot, previousOf, type BalanceRow } from "../src/lib/publish/latest.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { REPO_URL, SITE_URL, declarationCode, withContract } from "../src/lib/publish/contract.ts";
import { concatenate } from "../src/lib/publish/bulk.ts";

function balance(date: string, values: Record<string, number>): BalanceRow[] {
  return Object.entries(values).map(([concepto, gwh]) => ({ date, concepto, dia_kwh: String(gwh * 1e6) }));
}

describe("nationalSnapshot's day before", () => {
  it("carries the calendar day before and the change since, in percentage points", () => {
    const rows = [
      ...balance("2026-09-19", { generacion_hidraulica: 50, total_generacion: 100, total_importacion: 0 }),
      ...balance("2026-09-20", { generacion_hidraulica: 60, total_generacion: 100, total_importacion: 0 }),
    ];
    const snapshot = nationalSnapshot(balanceByDay(rows))!;
    expect(snapshot.previous).toMatchObject({ date: "2026-09-19", hydro_share_pct: 50 });
    expect(snapshot.delta_1d!.hydro_share_pct_points).toBe(10);
    expect(snapshot.delta_1d!.total_generation_gwh).toBe(0);
  });

  it("has no yesterday after a gap, rather than calling a week ago yesterday", () => {
    const rows = [
      ...balance("2026-09-13", { generacion_hidraulica: 50, total_generacion: 100 }),
      ...balance("2026-09-20", { generacion_hidraulica: 60, total_generacion: 100 }),
    ];
    const snapshot = nationalSnapshot(balanceByDay(rows))!;
    expect(snapshot.previous).toBeNull();
    expect(snapshot.delta_1d).toBeNull();
  });
});

describe("previousOf", () => {
  it("returns only the exact day before", () => {
    const levels: DailySeries = new Map([
      ["2026-09-18", 2140],
      ["2026-09-20", 2139],
      ["2026-09-21", 2138.5],
    ]);
    expect(previousOf(levels, "2026-09-21")).toEqual({ date: "2026-09-20", value: 2139 });
    expect(previousOf(levels, "2026-09-20")).toBeNull();
  });
});

describe("the contract block", () => {
  const bare = {
    generated_at: "2026-09-23T02:36:38Z",
    as_of: "2026-09-22",
    ok: true,
    status: "warn",
    feeds: [
      { feed: "ORDS levels and inflows (repDiaHid12m)", latest: "2026-09-21", limit_days: 3, state: "current" },
      { feed: "CENACE Información Operativa", latest: "2026-09-23", limit_days: 3, state: "current" },
      { feed: "A feed nobody has coded", latest: null, limit_days: 7, state: "not_ingested" },
    ],
    tables: {},
    findings: [],
  };

  it("puts the format version first and the provenance last", () => {
    const keys = Object.keys(withContract("status", bare));
    expect(keys[0]).toBe("schema_version");
    expect(keys.slice(-3)).toEqual(["license", "attribution", "see_also"]);
  });

  it("is idempotent, so restamping a published document changes nothing", () => {
    const once = withContract("status", bare);
    expect(withContract("status", once)).toEqual(once);
  });

  it("gives every feed an English code and a Spanish label", () => {
    const feeds = withContract("status", bare).feeds as unknown as { id: string; label_es: string }[];
    expect(feeds.map((f) => f.id)).toEqual(["ords_levels", "cenace_operativa", "a_feed_nobody_has_coded"]);
    expect(feeds[0]!.label_es).toBe("ORDS: cotas y caudales");
  });

  it("dates status.json by its readings, not by the live snapshot or the day the check ran", () => {
    // Información Operativa is a live snapshot stamped with today; the readings are yesterday's.
    expect(withContract("status", bare).data_date).toBe("2026-09-21");
  });

  it("dates a model document by the day it stands on", () => {
    expect(withContract("forecast", { origin_date: "2026-09-21" }).data_date).toBe("2026-09-21");
  });

  it("makes every see_also link absolute, including the repository's own reports", () => {
    const see = withContract("adequacy", { see_also: { report: "data/reports/adequacy.md", latest: "/api/latest.json" } }).see_also;
    for (const link of Object.values(see)) expect(link).toMatch(/^https:\/\//);
    expect(see["report"]).toBe(`${REPO_URL}/blob/main/data/reports/adequacy.md`);
    expect(see["narrative"]).toBe(`${SITE_URL}/api/narrative.json`);
    expect(see["schema"]).toBe(`${SITE_URL}/api/schema/adequacy.schema.json`);
  });

  it("names the tier the narrative is written about", () => {
    const stamped = withContract("adequacy", {
      current: { tier: "vigilancia", worst_tier: "ajustado" },
      horizons: [{ tier: "holgado" }],
    });
    expect(stamped.current).toMatchObject({ tier_code: "watch", worst_tier_code: "tight", narrative_tier_field: "worst_tier" });
    expect((stamped.horizons as unknown as { tier_code: string }[])[0]!.tier_code).toBe("comfortable");
  });

  it("maps declarations to codes both ways", () => {
    expect(declarationCode("report endpoint")).toEqual({ code: "report_endpoint", label_es: "servicio de reportes" });
    expect(declarationCode("report_endpoint").code).toBe("report_endpoint");
  });
});

describe("bulk concatenation", () => {
  it("keeps the header once and every row, byte for byte, in partition order", () => {
    const { csv, rows } = concatenate(["date,v\n2025-01-01,1\n", "date,v\n2026-01-01,2\n2026-01-02,3\n"]);
    expect(csv).toBe("date,v\n2025-01-01,1\n2026-01-01,2\n2026-01-02,3\n");
    expect(rows).toBe(3);
  });

  it("counts a quoted newline as part of its row, not as a second row", () => {
    expect(concatenate(['date,note\n2026-01-01,"two\nlines"\n']).rows).toBe(1);
  });

  it("refuses partitions whose headers disagree rather than shifting columns halfway down", () => {
    expect(() => concatenate(["date,v\n", "date,w\n"])).toThrow(/header differs/);
  });

  it("survives an empty partition", () => {
    expect(concatenate(["date,v\n", "date,v\n2026-01-01,2\n"]).rows).toBe(1);
  });
});
