/**
 * The published document's arithmetic, checked against inputs whose answer is known.
 *
 * The assertions here are deliberately about the *decisions* `latest.ts` documents — the
 * circular climatology window, the evidence ordering of the bands, shares taken over supply
 * rather than generation, a slope that refuses to stretch over a gap. Asserting the numbers
 * the real tables happen to produce today would pass whether those decisions held or not, and
 * would have to be rewritten every time a day of data lands.
 */

import { describe, expect, it } from "vitest";
import {
  bandsFor,
  balanceByDay,
  climatologyFor,
  nationalSnapshot,
  percentileOf,
  slopeOver,
  type BalanceRow,
  type ThresholdRow,
} from "../src/lib/publish/latest.ts";
import type { DailySeries } from "../src/lib/features/series.ts";

function seriesOf(entries: [string, number][]): DailySeries {
  return new Map(entries.sort(([a], [b]) => (a < b ? -1 : 1)));
}

function threshold(partial: Partial<ThresholdRow>): ThresholdRow {
  return {
    site: "mazar",
    cota_min_masl: "2100",
    cota_max_masl: "2153",
    declaration: "report endpoint",
    source: "ords:repDiaHid12m",
    observed_from: "2014-09-20",
    observed_to: "2026-09-20",
    ...partial,
  };
}

describe("slopeOver", () => {
  const levels = seriesOf([
    ["2026-09-14", 2140],
    ["2026-09-21", 2133],
  ]);

  it("is the mean metres per day across the window", () => {
    expect(slopeOver(levels, "2026-09-21", 7)).toBeCloseTo(-1, 10);
  });

  it("refuses to stretch over a missing endpoint rather than reaching for the nearest day", () => {
    // 2026-09-07 is absent; a 14-day slope measured over the 7 days that exist is not a
    // 14-day slope, and quietly returning -0.5 would be the kind of wrong that never shows.
    expect(slopeOver(levels, "2026-09-21", 14)).toBeNull();
  });
});

describe("percentileOf", () => {
  it("counts ties as at-or-below, so a day on the median does not read zero", () => {
    expect(percentileOf([1, 2, 3, 4], 2)).toBe(50);
  });

  it("has no percentile for an empty sample", () => {
    expect(percentileOf([], 5)).toBeNull();
  });
});

describe("climatologyFor", () => {
  /**
   * Six years in which the last week of December runs at 200 m3/s and the first week of
   * January at 100. Nothing else is in the window, so the pooled sample has exactly two values
   * and the quantiles are forced.
   */
  function turnOfYear(years: number[]): DailySeries {
    const entries: [string, number][] = [];
    for (const year of years) {
      for (let day = 25; day <= 31; day++) entries.push([`${year}-12-${day}`, 200]);
      for (let day = 1; day <= 8; day++) entries.push([`${year}-01-0${day}`, 100]);
    }
    return seriesOf(entries);
  }

  it("pools across the year boundary, so 1 January sees the previous December", () => {
    const band = climatologyFor(turnOfYear([2018, 2019, 2020, 2021, 2022, 2023]), "2023-01-01", 150);
    expect(band).not.toBeNull();
    // A window that broke at 31 December would see only the January days and report 100/100/100.
    expect(band!.p10).toBe(100);
    expect(band!.p90).toBe(200);
    expect(band!.years).toBe(6);
  });

  it("puts today where it belongs in that sample", () => {
    const band = climatologyFor(turnOfYear([2018, 2019, 2020, 2021, 2022, 2023]), "2023-01-01", 100);
    // 48 January readings of 100 and 42 December readings of 200: a day at 100 is at or below
    // 48 of the 90.
    expect(band!.percentile_today).toBeCloseTo((48 / 90) * 100, 1);
  });

  it("publishes nothing when too few years back the band", () => {
    // Four years of a fortnight-wide window will produce a p10 and a p90 quite happily; with an
    // El Nino and a La Nina among them it would mean nothing, so the answer is null.
    expect(climatologyFor(turnOfYear([2020, 2021, 2022, 2023]), "2023-01-01", 150)).toBeNull();
  });
});

describe("bandsFor", () => {
  const rows = [
    threshold({ declaration: "dashboard chart title", cota_min_masl: "2098", observed_from: "2026-09-21", observed_to: "2026-09-21" }),
    threshold({ declaration: "report endpoint", cota_min_masl: "2100", observed_from: "2014-09-20", observed_to: "2026-09-20" }),
  ];

  it("puts the longest-observed declaration first without dropping the other", () => {
    const bands = bandsFor(rows, "mazar", 2138.37);
    expect(bands.map((b) => b.min_masl)).toEqual([2100, 2098]);
  });

  it("recomputes the band position from the level rather than copying volutilalm", () => {
    const [primary] = bandsFor(rows, "mazar", 2126.5);
    expect(primary!.band_pct).toBeCloseTo(((2126.5 - 2100) / (2153 - 2100)) * 100, 6);
    expect(primary!.metres_above_min).toBeCloseTo(26.5, 6);
  });

  it("reports a level above the declared crest as above it, rather than clamping to 100", () => {
    // 27 of these exist in the committed data; the band is operational, not physical.
    const [primary] = bandsFor(rows, "mazar", 2155);
    expect(primary!.band_pct).toBeGreaterThan(100);
  });

  it("drops a row whose band is inverted or unparseable", () => {
    const broken = [threshold({ cota_min_masl: "2153", cota_max_masl: "2100" }), threshold({ cota_max_masl: "" })];
    expect(bandsFor(broken, "mazar", 2138)).toEqual([]);
  });

  it("returns nothing for a reservoir no source declares a band for", () => {
    expect(bandsFor(rows, "coca_codo_sinclair", 1219)).toEqual([]);
  });
});

describe("nationalSnapshot", () => {
  function balance(date: string, values: Record<string, number>): BalanceRow[] {
    return Object.entries(values).map(([concepto, gwh]) => ({ date, concepto, dia_kwh: String(gwh * 1e6) }));
  }

  const rows = [
    ...balance("2026-09-19", { generacion_hidraulica: 1, total_generacion: 1, total_importacion: 0 }),
    ...balance("2026-09-20", {
      generacion_hidraulica: 60,
      generacion_turbinas_gas: 20,
      total_generacion: 80,
      total_importacion: 20,
      total_exportacion: 1,
      demanda_distribucion: 90,
    }),
  ];

  it("describes the latest closed day", () => {
    expect(nationalSnapshot(balanceByDay(rows))!.date).toBe("2026-09-20");
  });

  it("takes shares over generation plus imports, because an imported kWh is as real as a generated one", () => {
    const snapshot = nationalSnapshot(balanceByDay(rows))!;
    // Over generation alone hydro would read 75%. The denominator is 100 GWh of supply, not 80.
    expect(snapshot.hydro_share_pct).toBe(60);
    expect(snapshot.thermal_share_pct).toBe(20);
    expect(snapshot.import_share_pct).toBe(20);
  });

  it("orders the mix largest first and keeps imports in it", () => {
    const snapshot = nationalSnapshot(balanceByDay(rows))!;
    expect(snapshot.supply_gwh.map((p) => p.concept)).toEqual([
      "generacion_hidraulica",
      "generacion_turbinas_gas",
      "total_importacion",
    ]);
  });

  it("has no snapshot at all when the table is empty", () => {
    expect(nationalSnapshot(balanceByDay([]))).toBeNull();
  });
});
