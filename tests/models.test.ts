import { describe, expect, it } from "vitest";
import { buildSeries, type DailySeries } from "../src/lib/features/series.ts";
import { volumeAt, levelAt, type Hypsometry } from "../src/lib/features/hydrology.ts";
import { climatologicalDrift, persistence, seasonalLevelTable } from "../src/lib/models/baselines.ts";
import {
  analogPaths,
  crossingDistribution,
  DEFAULT_WATER_BALANCE,
  firstCrossing,
  releaseAt,
  simulatePath,
  type ReleaseRule,
  type WaterBalanceFit,
} from "../src/lib/models/water-balance.ts";
import { addDays } from "../src/lib/util/dates.ts";

const CURVE: Hypsometry = {
  areaCoefficient: 1277,
  areaExponent: 1.9,
  datumM: 2060,
  turbineM3sPerMw: 0.65,
  rmseDeltaLevelM: 0.5,
  days: 1000,
  fitCeilingM: 2150,
};

const RULE: ReleaseRule = {
  points: [
    { level: 2110, releaseM3s: 12 },
    { level: 2130, releaseM3s: 55 },
    { level: 2150, releaseM3s: 63 },
  ],
  zeroAtM: 2060,
  days: 1000,
};

describe("release rule", () => {
  it("interpolates between the fitted bands", () => {
    expect(releaseAt(RULE, 2120)).toBeCloseTo(33.5, 6);
    expect(releaseAt(RULE, 2110)).toBeCloseTo(12, 6);
  });

  it("holds flat above the highest band, where the crest cap takes over", () => {
    expect(releaseAt(RULE, 2160)).toBeCloseTo(63, 6);
  });

  it("tapers to nothing at the datum, so a draining reservoir stops releasing", () => {
    expect(releaseAt(RULE, 2060)).toBe(0);
    expect(releaseAt(RULE, 2050)).toBe(0);
    expect(releaseAt(RULE, 2085)).toBeCloseTo(6, 6);
  });
});

describe("analogue paths", () => {
  const inflow: DailySeries = new Map();
  for (let year = 2020; year <= 2024; year++) {
    for (let day = 0; day < 365; day++) inflow.set(addDays(`${year}-01-01`, day), 50 + year - 2020);
  }

  it("takes the same calendar window from each earlier year", () => {
    const paths = analogPaths(inflow, "2024-03-01", 10);
    expect(paths.map((p) => p.year)).toEqual([2020, 2021, 2022, 2023]);
    expect(paths[0]!.inflowM3s).toHaveLength(10);
  });

  it("never reaches into the origin's own future", () => {
    expect(analogPaths(inflow, "2024-03-01", 10).every((p) => p.startDate < "2024-03-01")).toBe(true);
  });

  it("drops a year with a gap rather than patching it", () => {
    const holed = new Map(inflow);
    holed.delete("2022-03-05");
    expect(analogPaths(holed, "2024-03-01", 10).map((p) => p.year)).toEqual([2020, 2021, 2023]);
  });

  it("skips 29 February in years that do not have one", () => {
    const leap: DailySeries = new Map();
    for (let day = 0; day < 366 * 5; day++) leap.set(addDays("2020-01-01", day), 50);
    // 2021-02-29 does not exist; the only usable analogue for a 29 February origin is 2020.
    expect(analogPaths(leap, "2024-02-29", 5).map((p) => p.year)).toEqual([2020]);
  });

  it("honours a variant that narrows the pool", () => {
    const paths = analogPaths(inflow, "2024-03-01", 10, (start) => start.startsWith("2021") || start.startsWith("2023"));
    expect(paths.map((p) => p.year)).toEqual([2021, 2023]);
  });
});

describe("simulation", () => {
  it("caps at the crest and records the spill instead of storing water above it", () => {
    const steps = simulatePath(CURVE, RULE, 2152, "2024-01-01", [900, 900, 900], 0, 2153);
    expect(steps.every((s) => s.level <= 2153 + 1e-9)).toBe(true);
    expect(steps.some((s) => s.spilled)).toBe(true);
  });

  it("reads the release back off the level every day, so it settles instead of running away", () => {
    // Inflow well below the rule's release at 2150: the level must fall, then stop falling as
    // the rule eases off. An open-loop run would keep draining at the starting release.
    const steps = simulatePath(CURVE, RULE, 2150, "2024-01-01", Array(200).fill(20), 0, 2153);
    const last = steps.at(-1)!;
    expect(last.level).toBeLessThan(2150);
    expect(last.releaseM3s).toBeLessThan(releaseAt(RULE, 2150));
    expect(last.level).toBeGreaterThan(CURVE.datumM);
  });

  it("carries the operator's current stance and lets it decay", () => {
    const flat = simulatePath(CURVE, RULE, 2140, "2024-01-01", Array(60).fill(55), 0, 2153);
    const releasing = simulatePath(CURVE, RULE, 2140, "2024-01-01", Array(60).fill(55), 40, 2153);
    expect(releasing.at(-1)!.level).toBeLessThan(flat.at(-1)!.level);
    // Decayed away by the end: the extra release is near zero after sixty days.
    const extra = releasing.at(-1)!.releaseM3s - releaseAt(RULE, releasing.at(-1)!.level);
    expect(Math.abs(extra)).toBeLessThan(8);
  });

  it("conserves water on a day with no release and no spill", () => {
    const quiet: ReleaseRule = {
      points: [
        { level: 2100, releaseM3s: 0 },
        { level: 2150, releaseM3s: 0 },
      ],
      zeroAtM: 2060,
      days: 10,
    };
    const [step] = simulatePath(CURVE, quiet, 2130, "2024-01-01", [100], 0, 2153);
    expect(volumeAt(CURVE, step!.level) - volumeAt(CURVE, 2130)).toBeCloseTo(100 * 86_400, 0);
  });
});

describe("threshold crossings", () => {
  it("reports the first day at or below the level, not the lowest one", () => {
    const steps = [2130, 2120, 2110, 2105, 2112].map((level, i) => ({
      date: addDays("2024-01-01", i + 1),
      level,
      inflowM3s: 0,
      releaseM3s: 0,
      spilled: false,
    }));
    expect(firstCrossing(steps, 2115)).toEqual({ date: "2024-01-04", days: 3 });
    expect(firstCrossing(steps, 2000)).toBeNull();
  });

  it("censors the distribution: a quantile past the crossing share has no date", () => {
    const inflow: DailySeries = new Map();
    // Ten analogue years, all wet enough that the reservoir never falls.
    for (let year = 2014; year <= 2024; year++) {
      for (let day = 0; day < 365; day++) inflow.set(addDays(`${year}-01-01`, day), 200);
    }
    const fit: WaterBalanceFit = { curve: CURVE, rule: RULE, stance: 0, startLevel: 2140 };
    const spread = crossingDistribution(fit, inflow, "2024-06-01", 120, 2115, 2153, DEFAULT_WATER_BALANCE)!;
    expect(spread.crossed).toBe(0);
    expect(spread.p10Days).toBeNull();
    expect(spread.p50Days).toBeNull();
  });

  it("gives a median only when at least half the analogue years cross", () => {
    const inflow: DailySeries = new Map();
    // Alternate wet and bone-dry years, so about half the ensemble drains past the threshold.
    for (let year = 2014; year <= 2024; year++) {
      for (let day = 0; day < 365; day++) inflow.set(addDays(`${year}-01-01`, day), year % 2 === 0 ? 0 : 200);
    }
    const fit: WaterBalanceFit = { curve: CURVE, rule: RULE, stance: 0, startLevel: 2130 };
    const spread = crossingDistribution(fit, inflow, "2024-06-01", 200, 2115, 2153, DEFAULT_WATER_BALANCE)!;
    expect(spread.crossed).toBeGreaterThan(0);
    expect(spread.crossed).toBeLessThan(spread.paths);
    expect(spread.p10Days).not.toBeNull();
    expect(spread.p90Days).toBeNull();
  });
});

describe("baselines", () => {
  const levels: DailySeries = new Map();
  for (let day = 0; day < 1200; day++) {
    levels.set(addDays("2020-01-01", day), 2130 + 10 * Math.sin((day / 365) * 2 * Math.PI));
  }
  const context = {
    origin: "2023-01-01",
    horizonDays: [7, 30],
    levels: new Map([...levels].filter(([d]) => d <= "2023-01-01")),
    inflow: new Map() as DailySeries,
    production: new Map() as DailySeries,
    crestM: 2153,
  };

  it("persistence holds today's level at every horizon", () => {
    const out = persistence.forecast(context);
    expect(out.map((f) => f.p50)).toEqual([levels.get("2023-01-01"), levels.get("2023-01-01")]);
    expect(out[0]!.targetDate).toBe("2023-01-08");
  });

  it("climatological drift follows the seasonal shape and carries its own spread", () => {
    const out = climatologicalDrift.forecast(context);
    // Early January is on the rising limb of this synthetic year.
    expect(out[1]!.p50).toBeGreaterThan(context.levels.get("2023-01-01")!);
    expect(out[1]!.ensemble.length).toBeGreaterThan(1);
  });

  it("the seasonal table covers every day of the year", () => {
    const table = seasonalLevelTable(levels);
    expect(table.size).toBe(365);
    expect(table.get(1)).toBeTypeOf("number");
  });
});

describe("series assembly", () => {
  const row = (over: Record<string, string>) => ({
    date: "2026-09-20",
    site: "mazar",
    variable: "cota_masl",
    value: "2139.14",
    source: "ords:pointValues",
    mrid: "",
    fetched_at: "2026-09-22T00:00:00Z",
    raw_ref: "x",
    ...over,
  });

  it("prefers the per-day report over the historian for the same site-day", () => {
    const series = buildSeries([row({}), row({ value: "2139.99", source: "ords:repDiaNivQIng" })]);
    expect(series.get("mazar", "cota_masl").get("2026-09-20")).toBe(2139.99);
  });

  it("keeps the order stable whichever way the rows arrive", () => {
    const a = buildSeries([row({}), row({ value: "2139.99", source: "ords:repDiaNivQIng" })]);
    const b = buildSeries([row({ value: "2139.99", source: "ords:repDiaNivQIng" }), row({})]);
    expect([...a.get("mazar", "cota_masl")]).toEqual([...b.get("mazar", "cota_masl")]);
  });

  it("returns days in ascending date order", () => {
    const series = buildSeries([row({ date: "2026-09-21" }), row({ date: "2026-09-19" }), row({})]);
    expect([...series.get("mazar", "cota_masl").keys()]).toEqual(["2026-09-19", "2026-09-20", "2026-09-21"]);
  });

  it("skips a row with no readable value instead of writing NaN into the series", () => {
    const series = buildSeries([row({ value: "" }), row({ date: "2026-09-21", value: "n/a" })]);
    expect(series.get("mazar", "cota_masl").size).toBe(0);
  });
});

describe("level round trip used by the simulation", () => {
  it("is exact enough that a hundred steps do not drift", () => {
    let level = 2130;
    for (let i = 0; i < 100; i++) level = levelAt(CURVE, volumeAt(CURVE, level));
    expect(level).toBeCloseTo(2130, 6);
  });
});
