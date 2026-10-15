/**
 * The cascade block (PAYLOAD_VERSION 4): each statistic on series small enough to check by hand,
 * then the block on the real 2026-10-14 tables as frozen in `payload-v4.json`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  amaluzaBlock,
  cascadeBlock,
  combine,
  gwhPerHm3,
  lastEpisodeBelow,
  productivityMwPerM3s,
  turbinedFromEnergy,
  windowMean,
  type CascadeSeries,
} from "../src/lib/narrative/cascade.ts";
import { REGULATED_INFLOW, type NarrativePayload } from "../src/lib/narrative/payload.ts";
import { storedHm3 } from "../src/lib/site/shape.ts";
import { addDays, eachDay, type IsoDate } from "../src/lib/util/dates.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import { FIXTURES } from "./helpers.ts";

const series = (entries: [IsoDate, number][]): DailySeries => new Map(entries);
/** One value on every day from `from` for `days` days. */
const flat = (from: IsoDate, days: number, value: number | ((d: IsoDate, i: number) => number)): DailySeries =>
  new Map(eachDay(from, addDays(from, days - 1)).map((d, i) => [d, typeof value === "number" ? value : value(d, i)]));

describe("the statistics", () => {
  it("averages a window only when most of its days published", () => {
    const week = eachDay("2026-10-08", "2026-10-14");
    expect(windowMean(flat("2026-10-08", 7, 10), week)).toBe(10);
    expect(windowMean(flat("2026-10-10", 5, 20), week)).toBe(20);
    expect(windowMean(flat("2026-10-11", 4, 20), week)).toBeNull();
  });

  it("turns daily energy into turbined flow with the fitted m³/s per MW", () => {
    // 2,400 MWh over 24 h is 100 MW; at 0.668469 m³/s per MW that is 66.85 m³/s.
    expect(turbinedFromEnergy(series([["2026-10-14", 2400]]), 0.668469).get("2026-10-14")).toBeCloseTo(66.8469, 6);
    expect(
      combine(
        series([
          ["2026-10-14", 5],
          ["2026-10-15", 1],
        ]),
        series([["2026-10-14", 2]]),
        (a, b) => a - b,
      ),
    ).toEqual(series([["2026-10-14", 3]]));
  });

  it("reads MW per m³/s as a ratio of sums, skipping stopped units and short records", () => {
    const days = 30;
    // 100 m³/s for a day is 2,400 m³/s·h; 13,680 MWh on it is 5.7 MW per m³/s.
    const energy = flat("2026-09-01", days, 13680);
    const flow = flat("2026-09-01", days, 100);
    expect(productivityMwPerM3s(energy, flow)).toBeCloseTo(5.7, 9);
    // A midnight snapshot of a stopped unit, or a day with no energy, does not dilute the ratio.
    const withGaps = new Map(flow).set("2026-09-02", 0).set("2026-10-01", 100);
    expect(productivityMwPerM3s(new Map(energy).set("2026-10-01", 0), withGaps)).toBeNull();
    expect(productivityMwPerM3s(energy, flat("2026-09-01", days - 1, 100))).toBeNull();
  });

  it("adds the plants' MW per m³/s into GWh per hm³", () => {
    // 10 MW per m³/s: 10⁶ m³ is 277.8 m³/s for an hour, 2,778 MWh.
    expect(gwhPerHm3([1.5, 5.7, 2.8])).toBeCloseTo(2.7778, 4);
  });

  it("finds the latest episode below a floor, bridging short spells above it", () => {
    const level = new Map<IsoDate, number>([
      ["2024-04-15", 2110],
      ["2024-04-16", 2109],
      ["2024-10-08", 2114],
      ["2024-10-10", 2120], // above, inside the gap
      ["2024-10-20", 2113], // 11 days after the 8th: same episode
      ["2024-11-20", 2112], // 30 days later: a new episode
      ["2024-11-30", 2111],
      ["2024-12-10", 2114.9],
      ["2026-10-14", 2124.46],
    ]);
    expect(lastEpisodeBelow(level, 2115, "2026-10-14")).toEqual({ from: "2024-11-20", to: "2024-12-10", daysBelow: 3 });
    expect(lastEpisodeBelow(level, 2115, "2024-10-31")).toEqual({ from: "2024-10-08", to: "2024-10-20", daysBelow: 2 });
    expect(lastEpisodeBelow(level, 2115, "2024-04-14")).toBeNull();
    // Exactly the floor is not below it.
    expect(lastEpisodeBelow(series([["2024-01-01", 2115]]), 2115, "2026-01-01")).toBeNull();
  });

  it("places Amaluza's week in its own record, and passes every declared floor with its source", () => {
    const level = new Map<IsoDate, number>([
      ["2014-09-20", 1985],
      ["2024-04-15", 1971.65],
      ["2026-10-08", 1980.91],
      ["2026-10-13", 1971.893921],
      ["2026-10-14", 1972.894165],
    ]);
    const floors = [
      { floor_masl: 1975, declared_by: ["celec dashboard bundle"] },
      { floor_masl: 1960, declared_by: ["ords:repDiaHid12m"] },
    ];
    expect(amaluzaBlock(level, eachDay("2026-10-08", "2026-10-14"), floors)).toEqual({
      level_masl: 1972.89,
      observed_on: "2026-10-14",
      low_7d_masl: 1971.89,
      low_7d_on: "2026-10-13",
      days_lower_in_record: 1,
      last_lower_on: "2024-04-15",
      record_from: "2014-09-20",
      declared_floors: [
        { floor_masl: 1960, declared_by: ["ords:repDiaHid12m"] },
        { floor_masl: 1975, declared_by: ["celec dashboard bundle"] },
      ],
    });
    expect(amaluzaBlock(level, eachDay("2026-11-01", "2026-11-07"), floors)).toBeNull();
  });
});

describe("the block", () => {
  const origin: IsoDate = "2026-10-14";
  const years = 6;
  const start: IsoDate = `${2026 - years}-01-01`;
  const days = eachDay(start, origin).length;
  const curve = { coefficient: 48.188407, exponent: 2.5, datum_m: 2036.66 };

  // Six years of a cascade that is always the same, then a week in which Mazar turbines 60 m³/s
  // (2,154.2 MWh a day at 0.668469 m³/s per MW) and receives 25.
  const mwhFor = (m3s: number) => (m3s / 0.668469) * 24;
  const inWeek = (d: IsoDate) => d >= "2026-10-08";
  const s: CascadeSeries = {
    mazarLevel: flat(start, days, (d) => (d >= "2024-10-01" && d <= "2024-10-20" ? 2112 : 2130)),
    mazarInflow: flat(start, days, (d) => (inWeek(d) ? 25 : 50)),
    mazarEnergyMwh: flat(start, days, (d) => mwhFor(inWeek(d) ? 60 : 50)),
    amaluzaLevel: flat(start, days, 1985),
    amaluzaInflow: flat(start, days, (d) => (inWeek(d) ? 100 : 90)),
    molinoEnergyMwh: flat(start, days, (d) => (d >= "2024-10-01" && d <= "2024-10-20" ? 3000 : 15000)),
    molinoTurbinedM3s: flat(start, days, 100),
    sopladoraEnergyMwh: flat(start, days, 8000),
    sopladoraTurbinedM3s: flat(start, days, 100),
  };
  const block = cascadeBlock({
    origin,
    series: s,
    turbineM3sPerMw: 0.668469,
    areaCurve: curve,
    operationalMinMasl: 2115,
    amaluzaFloors: [],
  })!;

  it("splits Amaluza's inflow into Mazar's turbined flow and the river between the dams", () => {
    expect(block).toMatchObject({ window_from: "2026-10-08", window_to: origin, mazar_inflow_m3s: 25, mazar_turbined_m3s: 60 });
    expect(block.local_inflow_m3s).toBe(40);
    // Every year the local river is 90 − 50 = 40 on the same days; the week's 40 is in the pool.
    expect(block.local_inflow_normal_m3s).toBe(40);
  });

  it("puts this week's downstream output beside the record's for the date", () => {
    expect(block.downstream_gwh_day).toBe(23);
    expect(block.downstream_normal_gwh_day).toBe(23);
  });

  it("values the water above the operational minimum through all three plants", () => {
    // Mazar 1/0.668469; Molino a ratio of sums, 15,000 MWh a day except the episode's 20 days at
    // 3,000, over 2,400 m³/s·h a day; Sopladora 8,000 / 2,400 MW per m³/s.
    const molino = (20 * 3000 + (days - 20) * 15000) / (days * 2400);
    const perHm3 = gwhPerHm3([1 / 0.668469, molino, 8000 / 2400]);
    expect(block.energy_per_hm3_gwh).toBe(Math.round(perHm3 * 100) / 100);
    const stored = storedHm3(curve, 2115, 2130);
    expect(block.storage_above_operational_min_hm3).toBe(Math.round(stored * 10) / 10);
    expect(block.storage_above_operational_min_gwh).toBe(Math.round(stored * perHm3));
  });

  it("describes the last episode below the minimum by what Molino and Sopladora made across it", () => {
    expect(block.last_episode_below_operational_min).toMatchObject({ from: "2024-10-01", to: "2024-10-20", days_below: 20 });
    // 3 + 8 GWh a day during it; normal for those dates pools six years of 23 and one of 11.
    expect(block.last_episode_below_operational_min!.downstream_gwh_day).toBe(11);
    expect(block.last_episode_below_operational_min!.downstream_normal_gwh_day).toBe(23);
  });

  it("is null when none of it can be computed, and leaves out what cannot", () => {
    const empty = new Map<IsoDate, number>();
    const none: CascadeSeries = Object.fromEntries(Object.keys(s).map((k) => [k, empty])) as unknown as CascadeSeries;
    expect(
      cascadeBlock({ origin, series: none, turbineM3sPerMw: null, areaCurve: null, operationalMinMasl: null, amaluzaFloors: [] }),
    ).toBeNull();
    const noFit = cascadeBlock({ origin, series: s, turbineM3sPerMw: null, areaCurve: null, operationalMinMasl: null, amaluzaFloors: [] })!;
    expect(noFit).toMatchObject({
      mazar_turbined_m3s: null,
      local_inflow_m3s: null,
      energy_per_hm3_gwh: null,
      storage_above_operational_min_gwh: null,
      last_episode_below_operational_min: null,
    });
    expect(noFit.downstream_gwh_day).toBe(23);
  });
});

describe("the block on 2026-10-14", () => {
  const p = JSON.parse(readFileSync(join(FIXTURES, "narrative", "2026-10-14", "payload-v4.json"), "utf8")) as NarrativePayload;

  it("records the cascade running on Mazar's storage, and the 2024 episode below the minimum", () => {
    expect(p.payload_version).toBe(4);
    expect(p.cascade).toMatchObject({
      mazar_inflow_m3s: 25.7,
      mazar_turbined_m3s: 56.9,
      local_inflow_m3s: 43.7,
      local_inflow_normal_m3s: 54.1,
      downstream_gwh_day: 24,
      downstream_normal_gwh_day: 17,
      energy_per_hm3_gwh: 2.9,
      // Above 2115 m, not forecast.json's storage above the lowest threshold (2098 m, 62.44 hm³).
      storage_above_operational_min_hm3: 28.7,
      storage_above_operational_min_gwh: 83,
      last_episode_below_operational_min: {
        from: "2024-10-08",
        to: "2024-12-10",
        days_below: 51,
        downstream_gwh_day: 7.1,
        downstream_normal_gwh_day: 16.9,
      },
    });
    expect(p.cascade!.amaluza).toMatchObject({ low_7d_masl: 1971.89, days_lower_in_record: 1, last_lower_on: "2024-04-15" });
    expect(p.cascade!.amaluza!.declared_floors.map((f) => f.floor_masl)).toEqual([1960, 1970, 1975]);
  });

  it("gives no inflow percentile to a reservoir fed by an upstream plant", () => {
    for (const r of p.reservoirs.filter((r) => REGULATED_INFLOW.has(r.site))) expect(r.inflow?.percentile_today).toBeNull();
    expect(p.reservoirs.find((r) => r.site === "mazar")!.inflow!.percentile_today).toBe(10.5);
  });
});
