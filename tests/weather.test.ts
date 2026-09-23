/**
 * §1.1's switch, decided by data rather than by an edit: the Mazar models and the narrative read
 * rain at the verified catchment centroid once its ERA5 history is adequate, and at the
 * provisional point until then. And the 2115 marker, which moved from two scripts into
 * `thresholds.csv` without changing what the forecast says about it.
 */

import { describe, expect, it } from "vitest";
import {
  era5Coverage,
  ERA5_ADEQUATE,
  inadequacy,
  MAZAR_PRECIP_BASIN,
  PROVISIONAL_PRECIP_BASIN,
  selectPrecipBasin,
} from "../src/lib/features/weather.ts";
import { criticalMarker, readThresholdRows, thresholdsFor } from "../src/lib/models/thresholds.ts";
import { addDays, daysBetween } from "../src/lib/util/dates.ts";
import type { DailySeries } from "../src/lib/features/series.ts";

function daily(from: string, to: string, skipEvery = 0): DailySeries {
  const out: DailySeries = new Map();
  const n = daysBetween(from, to) + 1;
  for (let i = 0; i < n; i++) {
    if (skipEvery > 0 && i % skipEvery === 0) continue;
    out.set(addDays(from, i), 1);
  }
  return out;
}

const provisional = daily("1990-01-01", "2026-09-16");

describe("selectPrecipBasin", () => {
  it("stays on the provisional point while the centroid has only the daily samples", () => {
    const choice = selectPrecipBasin(
      new Map([
        [PROVISIONAL_PRECIP_BASIN, provisional],
        [MAZAR_PRECIP_BASIN, daily("2026-09-10", "2026-09-16")],
      ]),
    );
    expect(choice.basin).toBe(PROVISIONAL_PRECIP_BASIN);
    expect(choice.preferred).toBe(false);
    expect(choice.fallbackReason).toMatch(/starts 2026-09-10/);
  });

  it("moves to the centroid once its climatology reaches back to 1990 with enough days", () => {
    const choice = selectPrecipBasin(
      new Map([
        [PROVISIONAL_PRECIP_BASIN, provisional],
        [MAZAR_PRECIP_BASIN, daily("1990-01-01", "2026-09-16", 50)],
      ]),
    );
    expect(choice.basin).toBe(MAZAR_PRECIP_BASIN);
    expect(choice.fallbackReason).toBeNull();
    expect(choice.coverage.share).toBeGreaterThanOrEqual(ERA5_ADEQUATE.minShare);
  });

  it("refuses a backfill with holes, however far back it starts", () => {
    const holey = daily("1990-01-01", "2026-09-16", 10);
    expect(inadequacy(era5Coverage(holey))).toMatch(/90\.0% of days/);
    expect(
      selectPrecipBasin(
        new Map([
          [PROVISIONAL_PRECIP_BASIN, provisional],
          [MAZAR_PRECIP_BASIN, holey],
        ]),
      ).basin,
    ).toBe(PROVISIONAL_PRECIP_BASIN);
  });

  it("refuses a centroid that was backfilled once and then stopped being sampled", () => {
    const stale = daily("1990-01-01", "2026-06-30");
    const choice = selectPrecipBasin(
      new Map([
        [PROVISIONAL_PRECIP_BASIN, provisional],
        [MAZAR_PRECIP_BASIN, stale],
      ]),
    );
    expect(choice.basin).toBe(PROVISIONAL_PRECIP_BASIN);
    expect(choice.fallbackReason).toMatch(/more than 30 days behind/);
  });

  it("falls back cleanly when neither basin has a row", () => {
    const choice = selectPrecipBasin(new Map());
    expect(choice.basin).toBe(PROVISIONAL_PRECIP_BASIN);
    expect(choice.series.size).toBe(0);
  });
});

describe("thresholds.csv", () => {
  it("carries 2115 as an unverified marker with no ceiling, so no page draws it as a band", () => {
    const row = readThresholdRows().find((r) => r["site"] === "mazar" && r["cota_min_masl"] === "2115");
    expect(row).toBeDefined();
    expect(row!["cota_max_masl"]).toBe("");
    expect(row!["declaration"]).toMatch(/unverified/);
  });

  it("gives the forecast the thresholds it had when 2115 was a literal", () => {
    const thresholds = thresholdsFor("mazar");
    expect(thresholds.map((t) => [t.levelMasl, t.status])).toEqual([
      [2115, "unverified"],
      [2100, "published"],
      [2098, "published"],
    ]);
    expect(criticalMarker("mazar")).toMatchObject({ name: "critical (plan)", levelMasl: 2115, source: "PLAN.md section 7" });
    expect(criticalMarker("amaluza")).toBeNull();
  });
});
