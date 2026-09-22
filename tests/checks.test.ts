import { describe, expect, it } from "vitest";
import { OBSERVATIONS_DAILY } from "../src/lib/contracts/tables.ts";
import {
  checkFreshness,
  checkObservationRanges,
  checkReference,
  checkTableShape,
  widestBands,
  worstLevel,
  type Rows,
} from "../src/lib/quality/checks.ts";

const observation = (over: Record<string, string>): Record<string, string> => ({
  date: "2026-09-20",
  site: "mazar",
  variable: "cota_masl",
  value: "2139.1",
  source: "ords:repDiaHid12m",
  mrid: "",
  fetched_at: "2026-09-22T00:00:00Z",
  raw_ref: "x",
  ...over,
});

const HEADER = [...OBSERVATIONS_DAILY.columns];

describe("table shape", () => {
  it("catches a duplicated key rather than letting two rows claim the same reading", () => {
    const rows = [observation({}), observation({})];
    const findings = checkTableShape(OBSERVATIONS_DAILY, rows, HEADER);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.level).toBe("fail");
    expect(findings[0]!.message).toMatch(/1 duplicated key\(s\)/);
    expect(findings[0]!.message).toMatch(/2026-09-20\|mazar\|cota_masl\|ords:repDiaHid12m/);
  });

  it("accepts rows that differ only in a key column", () => {
    const rows = [observation({}), observation({ source: "ords:repDiaNivQIng" })];
    expect(checkTableShape(OBSERVATIONS_DAILY, rows, HEADER)).toEqual([]);
  });

  it("catches a header that has drifted from the contract", () => {
    const findings = checkTableShape(OBSERVATIONS_DAILY, [observation({})], ["date", "site"]);
    expect(findings[0]!.level).toBe("fail");
    expect(findings[0]!.message).toMatch(/header is date,site/);
  });

  it("reports an empty table without failing: not ingested is not broken", () => {
    const findings = checkTableShape(OBSERVATIONS_DAILY, [], HEADER);
    expect(findings).toEqual([{ check: "shape:observations_daily", level: "info", message: "observations_daily is empty" }]);
  });
});

describe("bands and ranges", () => {
  // Mazar's floor is 2098 by the chart title and 2100 by both report endpoints; the widest
  // span is what a range check may use, because nothing here adjudicates between declarations.
  const thresholds: Rows = [
    { site: "mazar", cota_min_masl: "2098", cota_max_masl: "2153", source: "chart" },
    { site: "mazar", cota_min_masl: "2100", cota_max_masl: "2153", source: "ords:repDiaHid12m" },
    { site: "amaluza", cota_min_masl: "1960", cota_max_masl: "1991", source: "ords:repDiaHid12m" },
    { site: "amaluza", cota_min_masl: "1975", cota_max_masl: "1991", source: "chart" },
  ];

  it("takes the widest declared band per site", () => {
    expect(widestBands(thresholds).get("mazar")).toEqual({ min: 2098, max: 2153 });
    expect(widestBands(thresholds).get("amaluza")).toEqual({ min: 1960, max: 1991 });
  });

  it("tolerates a genuine excursion below the minimum but not an impossible level", () => {
    const bands = widestBands(thresholds);
    // Band is 2098..2153, so the slack is 27.5 m either side.
    expect(checkObservationRanges([observation({ value: "2090" })], bands)).toEqual([]);
    const findings = checkObservationRanges([observation({ value: "1200" })], bands);
    expect(findings[0]!.level).toBe("fail");
    expect(findings[0]!.message).toMatch(/outside 2098\.\.2153/);
  });

  it("rejects an inflow that is negative, which is the upstream sentinel of 2018-10-01", () => {
    const findings = checkObservationRanges(
      [observation({ site: "minas_san_francisco", variable: "caudal_m3s", value: "-4999995" })],
      widestBands(thresholds),
    );
    expect(findings[0]!.level).toBe("fail");
    expect(findings[0]!.message).toMatch(/is negative/);
  });

  it("reports a percentage just over 100 and fails one that cannot be a percentage at all", () => {
    const bands = widestBands(thresholds);
    // A reservoir above its declared maximum, which is a fact about the reservoir.
    const over = checkObservationRanges([observation({ variable: "nivel_pct_banda", value: "101.57" })], bands);
    expect(over[0]!.level).toBe("warn");
    expect(over[0]!.message).toMatch(/above its declared band/);
    // Still within the slack, so still only reported.
    expect(checkObservationRanges([observation({ variable: "factor_planta_pct", value: "140" })], bands)[0]!.level).toBe("warn");
    // A level that landed in the percentage column is not a percentage.
    expect(checkObservationRanges([observation({ variable: "nivel_pct_banda", value: "2153" })], bands)[0]!.level).toBe("fail");
    expect(checkObservationRanges([observation({ variable: "nivel_pct_banda", value: "-80" })], bands)[0]!.level).toBe("fail");
    expect(checkObservationRanges([observation({ value: "n/a" })], bands)[0]!.message).toMatch(/non-numeric/);
  });
});

describe("reference integrity", () => {
  const ok = {
    plants: [{ site_id: "mazar", plant: "Mazar", capacity_mw: "170", capacity_status: "unverified", verified_on: "" }],
    thresholds: [{ site: "mazar", cota_min_masl: "2100", cota_max_masl: "2153", source: "x" }],
    rationing: [{ start: "2024-09-23", end: "2024-12-20", end_status: "exact", status: "unverified" }],
  };

  it("passes a reference set whose unverified rows are honestly marked", () => {
    const findings = checkReference(ok);
    expect(findings.filter((f) => f.level === "fail")).toEqual([]);
    expect(findings.map((f) => f.message).join(" ")).toMatch(/1\/1 rationing episodes are still unverified/);
  });

  it("catches a site the registry does not have", () => {
    const findings = checkReference({ ...ok, plants: [{ site_id: "el_dorado", plant: "El Dorado" }] });
    expect(findings.some((f) => f.level === "fail" && /el_dorado/.test(f.message))).toBe(true);
  });

  it("catches a claim of verification with no date behind it", () => {
    const plants = [{ site_id: "mazar", plant: "Mazar", capacity_mw: "170", capacity_status: "verified", verified_on: "" }];
    expect(checkReference({ ...ok, plants }).some((f) => f.level === "fail" && /verified with no verified_on/.test(f.message))).toBe(true);
  });

  it("catches an inverted band and an episode that ends before it starts", () => {
    expect(
      checkReference({ ...ok, thresholds: [{ site: "mazar", cota_min_masl: "2153", cota_max_masl: "2100", source: "x" }] })
        .some((f) => f.level === "fail" && /min 2153 >= max 2100/.test(f.message)),
    ).toBe(true);
    expect(
      checkReference({ ...ok, rationing: [{ start: "2024-12-20", end: "2024-09-23", end_status: "exact", status: "unverified" }] })
        .some((f) => f.level === "fail"),
    ).toBe(true);
  });

  it("catches an open-ended episode that nonetheless carries an end date", () => {
    const rationing = [{ start: "2025-01-01", end: "2025-02-01", end_status: "open", status: "unverified" }];
    expect(checkReference({ ...ok, rationing }).some((f) => f.level === "fail" && /marked open but carries an end date/.test(f.message))).toBe(true);
  });
});

describe("freshness", () => {
  it("separates 'never ingested' from 'stopped arriving'", () => {
    const findings = checkFreshness(
      [
        { label: "historian", latest: null, maxAgeDays: 3 },
        { label: "levels", latest: "2026-09-20", maxAgeDays: 3 },
        { label: "smec", latest: "2026-09-01", maxAgeDays: 4 },
      ],
      "2026-09-22",
    );
    expect(findings[0]).toMatchObject({ level: "info", message: "historian has no rows yet" });
    expect(findings[1]!.level).toBe("info");
    expect(findings[2]).toMatchObject({ level: "fail" });
    expect(findings[2]!.message).toMatch(/smec is 21 days old \(limit 4\)/);
  });

  it("lets ONI's two-month publication lag pass under its own limit", () => {
    // The label is the centre of a three-month mean, so the newest available value is always
    // about two months back even when NOAA is publishing on time.
    const [finding] = checkFreshness([{ label: "NOAA ONI", latest: "2026-07-01", maxAgeDays: 110 }], "2026-09-22");
    expect(finding!.level).toBe("info");
    expect(finding!.message).toMatch(/83 days old/);
  });
});

describe("worstLevel", () => {
  it("reports the most severe finding present", () => {
    expect(worstLevel([{ check: "a", level: "info", message: "" }])).toBe("info");
    expect(worstLevel([{ check: "a", level: "info", message: "" }, { check: "b", level: "warn", message: "" }])).toBe("warn");
    expect(worstLevel([{ check: "a", level: "warn", message: "" }, { check: "b", level: "fail", message: "" }])).toBe("fail");
    expect(worstLevel([])).toBe("info");
  });
});
