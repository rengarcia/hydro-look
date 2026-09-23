/**
 * What the site reads: `lib/site/data.ts` against a small fixture tree, the day records behind
 * the permalinks, the Atom feed, the documentation page's schema reader, and the promise that
 * every field the pages render is one the published schemas require.
 *
 * `tests/fixtures/site/` has the layout of the repository — `public/api/` and `data/curated/` —
 * cut down to Mazar's 2026 readings, a month of the national balance and every model run, and
 * `HYDRO_LOOK_SITE_ROOT` points the readers at it before the module loads.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { daysFrom, worstTierOf, type DayTables } from "../src/lib/site/days.ts";
import { atomFeed, escapeXml } from "../src/lib/site/feed.ts";
import { cronTimes, fieldRows, unitOf, utcToEc } from "../src/lib/site/schema-doc.ts";
import { SITE_READS } from "../src/lib/site/documents.ts";
import type { Schema } from "../src/lib/publish/schema.ts";
import type * as SiteData from "../src/lib/site/data.ts";

const FIXTURE = join(process.cwd(), "tests", "fixtures", "site");
let data: typeof SiteData;

beforeAll(async () => {
  process.env["HYDRO_LOOK_SITE_ROOT"] = FIXTURE;
  data = await import("../src/lib/site/data.ts");
});

afterAll(() => {
  delete process.env["HYDRO_LOOK_SITE_ROOT"];
});

describe("site/data against the fixture", () => {
  it("reads a document under public/api, and null for one that is not there", () => {
    expect(data.latest()?.schema_version).toBe(1);
    expect(data.apiDocument("missing.json")).toBeNull();
  });

  it("dates the page by the newest reading, which latest.json now states itself", () => {
    const now = data.latest()!;
    expect(data.dataDate(now)).toBe(now.data_date);
    // A document from before the contract is dated the same way from its readings.
    const old = { ...now, data_date: null } as typeof now;
    expect(data.dataDate(old)).toBe(now.data_date);
    expect(data.dataDate(null)).toBeNull();
  });

  it("takes the last N calendar days of a series and leaves its gaps as gaps", () => {
    const levels: Map<string, number> = new Map([
      ["2026-09-01", 1],
      ["2026-09-03", 3],
      ["2026-09-04", 4],
    ]);
    expect(data.window(levels, 3).map((p) => p.date)).toEqual(["2026-09-03", "2026-09-04"]);
    expect(data.window(levels, 4).map((p) => p.date)).toEqual(["2026-09-01", "2026-09-03", "2026-09-04"]);
    expect(data.window(new Map(), 7)).toEqual([]);
  });

  it("builds Mazar's series from the fixture's observations", () => {
    const level = data.series().get("mazar", "cota_masl");
    expect(level.size).toBeGreaterThan(200);
    expect([...level.keys()].at(-1)).toBe(data.latest()!.reservoirs[0]!.level!.date);
  });

  it("has no climatology ribbon from under a year of readings, rather than a ribbon from one season", () => {
    const inflow = data.series().get("mazar", "caudal_m3s");
    expect(data.ribbon(inflow, ["2026-09-01"])).toEqual([]);
  });

  it("returns the national mix oldest first, in GWh", () => {
    const days = data.mix(10);
    expect(days.length).toBeGreaterThan(1);
    expect(days.length).toBeLessThanOrEqual(10);
    expect(days[0]!.date < days.at(-1)!.date).toBe(true);
    expect(days.at(-1)!.values["generacion_hidraulica"]).toBeGreaterThan(10);
  });

  it("finds one day record per origin, newest first", () => {
    const days = data.days();
    expect(days.length).toBeGreaterThan(0);
    expect([...days.map((d) => d.date)].sort().reverse()).toEqual(days.map((d) => d.date));
  });

  it("puts every reservoir's page under /embalses/", () => {
    expect(data.reservoirHref("agoyan")).toBe("/embalses/agoyan/");
  });
});

describe("daysFrom", () => {
  const tables: DayTables = {
    forecastRuns: [
      { run_id: "a", origin_date: "2026-09-21", generated_at: "2026-09-22T19:00:00Z", site: "mazar", model_id: "M3", origin_level_masl: "2138.37" },
      { run_id: "b", origin_date: "2026-09-21", generated_at: "2026-09-23T02:00:00Z", site: "mazar", model_id: "M3", origin_level_masl: "2138.37" },
    ],
    forecastValues: [
      { run_id: "b", horizon_days: "90", target_date: "2026-12-20", p10: "2106", p50: "2126.47", p90: "2133", model_id: "" },
      { run_id: "b", horizon_days: "7", target_date: "2026-09-28", p10: "2131", p50: "2135", p90: "2138", model_id: "M4" },
      { run_id: "a", horizon_days: "7", target_date: "2026-09-28", p10: "1", p50: "1", p90: "1", model_id: "" },
    ],
    adequacyRuns: [{ run_id: "c", origin_date: "2026-09-20", generated_at: "2026-09-22T17:00:00Z", model_id: "adequacy-v1" }],
    adequacyValues: [
      { run_id: "c", horizon_days: "7", target_date: "2026-09-27", deficit_gwh_day: "-1.8", margin_pct: "1.66", tier: "vigilancia" },
      { run_id: "c", horizon_days: "60", target_date: "2026-11-19", deficit_gwh_day: "0.8", margin_pct: "-0.7", tier: "ajustado" },
    ],
    narrativeSnapshots: [
      { run_id: "n1", origin_date: "2026-09-21", generated_at: "2026-09-23T01:00:00Z", status: "rejected", outlook_es: "" },
      { run_id: "n2", origin_date: "2026-09-21", generated_at: "2026-09-23T02:30:00Z", status: "ok", model_id: "m", risk_tier: "ajustado", confidence: "medium", outlook_es: "Texto.", drivers_json: '["uno","dos"]' },
    ],
  };

  it("shows the last run of a day and counts the ones it superseded", () => {
    const [day] = daysFrom(tables);
    expect(day!.date).toBe("2026-09-21");
    expect(day!.forecast!.run_id).toBe("b");
    expect(day!.runs).toEqual({ forecast: 2, adequacy: 0, narrative: 2 });
  });

  it("orders horizons and fills a blank model with the run's own", () => {
    const [day] = daysFrom(tables);
    expect(day!.forecast!.horizons.map((h) => h.horizon_days)).toEqual([7, 90]);
    expect(day!.forecast!.horizons.map((h) => h.model_id)).toEqual(["M4", "M3"]);
  });

  it("keeps only a narrative the validator passed, with its drivers parsed", () => {
    const [day] = daysFrom(tables);
    expect(day!.narrative!.run_id).toBe("n2");
    expect(day!.narrative!.drivers).toEqual(["uno", "dos"]);
  });

  it("lists a day that only one model stood on", () => {
    const days = daysFrom(tables);
    expect(days.map((d) => d.date)).toEqual(["2026-09-21", "2026-09-20"]);
    expect(days[1]!.forecast).toBeNull();
    expect(worstTierOf(days[1]!.adequacy!.horizons)).toBe("ajustado");
  });

  it("survives a drivers column that is not JSON", () => {
    const broken = { ...tables, narrativeSnapshots: [{ ...tables.narrativeSnapshots[1]!, drivers_json: "{nope" }] };
    expect(daysFrom(broken)[0]!.narrative!.drivers).toEqual([]);
  });
});

describe("atomFeed", () => {
  const day = {
    date: "2026-09-21",
    forecast: null,
    adequacy: null,
    narrative: {
      run_id: "n",
      generated_at: "2026-09-23T02:37:18Z",
      model_id: "m",
      risk_tier: "ajustado",
      confidence: "medium",
      outlook_es: "Mazar <baja> & sube",
      drivers: ["uno"],
    },
    runs: { forecast: 0, adequacy: 0, narrative: 1 },
  };

  it("carries the elements Atom requires, with absolute links to the day's page", () => {
    const xml = atomFeed([day], "https://example.org");
    for (const tag of ["<feed", "<id>https://example.org/</id>", "<updated>2026-09-23T02:37:18Z</updated>", "<author>", "<entry>"]) {
      expect(xml).toContain(tag);
    }
    expect(xml).toContain('href="https://example.org/dia/2026-09-21/"');
    expect(xml).toContain("La lectura del 21 de septiembre de 2026");
  });

  it("escapes the model's text: it is text, never markup", () => {
    const xml = atomFeed([day], "https://example.org");
    expect(xml).toContain("Mazar &lt;baja&gt; &amp; sube");
    expect(xml).not.toContain("<baja>");
    expect(escapeXml(`"'`)).toBe("&quot;&apos;");
  });

  it("leaves out days with no published reading", () => {
    expect(atomFeed([{ ...day, narrative: null }], "https://example.org")).not.toContain("<entry>");
  });
});

describe("the documentation page's readers", () => {
  it("reads a unit off a field's name", () => {
    expect(unitOf("masl")).toBe("m s. n. m.");
    expect(unitOf("delta_1d_m")).toBe("m");
    expect(unitOf("delta_1d_m3s")).toBe("m³/s");
    expect(unitOf("worst_deficit_gwh_day")).toBe("GWh/día");
    expect(unitOf("hydro_share_pct_points")).toBe("puntos porcentuales");
    expect(unitOf("slopes_m_per_day")).toBe("m/día");
    expect(unitOf("label")).toBeNull();
  });

  it("finds the daily slots in a workflow and says them in Ecuador's time", () => {
    const yml = 'on:\n  schedule:\n    - cron: "15 12 * * *"\n    - cron: "30 16 * * *"\n';
    expect(cronTimes(yml)).toEqual(["12:15", "16:30"]);
    expect(utcToEc("12:15")).toBe("07:15");
    expect(utcToEc("02:05")).toBe("21:05");
  });

  it("flattens a schema into one row per field, marking what is required and deprecated", () => {
    const schema = JSON.parse(readFileSync(join(process.cwd(), "public", "api", "schema", "latest.schema.json"), "utf8")) as Schema;
    const rows = fieldRows(schema);
    const byPath = new Map(rows.map((r) => [r.path, r]));
    expect(byPath.get("reservoirs[].level.masl")).toMatchObject({ required: true, unit: "m s. n. m." });
    expect(byPath.get("as_of")!.deprecated).toBe(true);
    expect(byPath.get("license.code")!.type).toContain("string");
  });
});

/**
 * Every field a page renders must be one the published schema requires at every level of its
 * path. The schemas are what third parties are promised; if the site depended on a field the
 * schema calls optional, the site would be relying on something the contract does not keep.
 */
describe("SITE_READS", () => {
  for (const [name, paths] of Object.entries(SITE_READS)) {
    it(`${name}: every field the site renders is required by ${name}.schema.json`, () => {
      const schema = JSON.parse(readFileSync(join(process.cwd(), "public", "api", "schema", `${name}.schema.json`), "utf8")) as Schema;
      const rows = new Map(fieldRows(schema, 8).map((r) => [r.path, r]));
      for (const path of paths) {
        const parts = path.split(".");
        for (let i = 1; i <= parts.length; i++) {
          const prefix = parts.slice(0, i).join(".").replace(/\[\]$/, "");
          const row = rows.get(prefix);
          expect(row, `${name}: ${prefix} is not in the schema`).toBeDefined();
          expect(row!.required, `${name}: ${prefix} is optional in the schema`).toBe(true);
        }
      }
    });
  }
});
