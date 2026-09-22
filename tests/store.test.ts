import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../src/lib/store/csv.ts";
import { CuratedStore, foldBands } from "../src/lib/store/curated.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { OBSERVATIONS_DAILY, OPERATING_BANDS, validateRows } from "../src/lib/contracts/tables.ts";

const temp = () => mkdtempSync(join(tmpdir(), "hydro-look-"));

const observation = (over: Partial<Record<string, unknown>> = {}) => ({
  date: "2026-09-20",
  site: "mazar",
  variable: "cota_masl",
  value: 2139.1,
  source: "ords:repDiaNivQIng",
  mrid: "",
  fetched_at: "2026-09-22T00:00:00Z",
  raw_ref: "celec_ords/2026/09/repDiaNivQIng.ndjson.gz#repDiaNivQIng:2026-09-20",
  ...over,
});

describe("CSV", () => {
  it("round-trips quotes, commas and empty cells", () => {
    const rows = [{ a: 'say "hi", twice', b: "", c: 1.5 }];
    expect(parseCsv(toCsv(["a", "b", "c"], rows))).toEqual([{ a: 'say "hi", twice', b: "", c: "1.5" }]);
  });

  it("never writes scientific notation", () => {
    expect(toCsv(["v"], [{ v: 0.0000001 }]).trim().split("\n")[1]).toBe("0.0000001");
  });
});

describe("curated store", () => {
  it("partitions by year and reports adds, updates and no-ops", () => {
    const store = new CuratedStore(temp());
    const first = store.upsert(OBSERVATIONS_DAILY, [observation(), observation({ date: "2025-09-20" })]);
    expect(first.added).toBe(2);
    expect(first.files.map((f) => f.path.split("/").pop())).toEqual(["2025.csv", "2026.csv"]);

    const again = store.upsert(OBSERVATIONS_DAILY, [observation()]);
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 1 });

    const corrected = store.upsert(OBSERVATIONS_DAILY, [observation({ value: 2139.2 })]);
    expect(corrected).toMatchObject({ added: 0, updated: 1 });
  });

  it("keeps the same reading from two endpoints side by side", () => {
    const root = temp();
    const store = new CuratedStore(root);
    store.upsert(OBSERVATIONS_DAILY, [observation(), observation({ source: "ords:repDiaVolAlm", value: 2139.14 })]);
    const rows = parseCsv(readFileSync(join(root, "observations_daily", "2026.csv"), "utf8"));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r["source"]).sort()).toEqual(["ords:repDiaNivQIng", "ords:repDiaVolAlm"]);
  });

  it("writes nothing in dry-run mode", () => {
    const root = temp();
    const report = new CuratedStore(root, true).upsert(OBSERVATIONS_DAILY, [observation()]);
    expect(report.added).toBe(1);
    expect(existsSync(join(root, "observations_daily", "2026.csv"))).toBe(false);
  });

  it("lists the keys a resumable backfill should skip", () => {
    const root = temp();
    const store = new CuratedStore(root);
    store.upsert(OBSERVATIONS_DAILY, [observation()]);
    expect(store.existingKeys(OBSERVATIONS_DAILY, [2026]).size).toBe(1);
    expect(store.existingKeys(OBSERVATIONS_DAILY, [2024]).size).toBe(0);
  });
});

describe("contracts", () => {
  it("rejects a row whose site or variable is not in the registry", () => {
    expect(() => validateRows(OBSERVATIONS_DAILY, [observation({ site: "chalpi" })])).toThrow(/failed the contract/);
    expect(() => validateRows(OBSERVATIONS_DAILY, [observation({ variable: "cota" })])).toThrow(/failed the contract/);
  });

  it("rejects a malformed date or timestamp", () => {
    expect(() => validateRows(OBSERVATIONS_DAILY, [observation({ date: "20/09/2026" })])).toThrow(/YYYY-MM-DD/);
    expect(() => validateRows(OBSERVATIONS_DAILY, [observation({ fetched_at: "2026-09-22" })])).toThrow(/ISO UTC/);
  });

  it("reports how many rows failed, not just the first", () => {
    expect(() => validateRows(OBSERVATIONS_DAILY, [observation({ site: "x" }), observation({ site: "y" })])).toThrow(/2\/2 rows/);
  });
});

describe("operating bands", () => {
  it("folds repeated daily readings into one row per distinct band", () => {
    const readings = [
      { date: "2025-01-01", site: "mazar", cota_min: 2100, cota_max: 2153, qmax_m3s: 800, source: "ords:repDiaHid12m" },
      { date: "2025-06-01", site: "mazar", cota_min: 2100, cota_max: 2153, qmax_m3s: 800, source: "ords:repDiaHid12m" },
      { date: "2026-01-01", site: "mazar", cota_min: 2098, cota_max: 2153, qmax_m3s: 800, source: "ords:repDiaHid12m" },
    ];
    const folded = foldBands(readings) as Record<string, unknown>[];
    expect(folded).toHaveLength(2);
    expect(folded[0]).toMatchObject({ cota_min: 2100, first_date: "2025-01-01", last_date: "2025-06-01" });
    expect(validateRows(OPERATING_BANDS, folded)).toHaveLength(2);
  });

  it("extends an existing row's span rather than duplicating it", () => {
    const existing = [
      { site: "mazar", cota_min: "2100", cota_max: "2153", qmax_m3s: "800", source: "ords:repDiaHid12m", first_date: "2024-01-01", last_date: "2025-01-01" },
    ];
    const folded = foldBands(
      [{ date: "2025-06-01", site: "mazar", cota_min: 2100, cota_max: 2153, qmax_m3s: 800, source: "ords:repDiaHid12m" }],
      existing,
    );
    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({ first_date: "2024-01-01", last_date: "2025-06-01" });
  });
});

describe("raw archive", () => {
  it("bundles a month of responses into one deduped gzip and reads them back", () => {
    const root = temp();
    const archive = new RawArchive(root);
    const record = (key: string, body: string) => ({ key, url: "https://example/x", method: "GET", status: 200, fetched_at: "2026-09-22T00:00:00Z", body });

    const ref = archive.add("celec_ords", "repDiaNivQIng", { year: 2024, month: "10" }, record("repDiaNivQIng:2024-10-15", '{"items":[]}'));
    archive.add("celec_ords", "repDiaNivQIng", { year: 2024, month: "10" }, record("repDiaNivQIng:2024-10-16", '{"items":[1]}'));
    // Re-fetching a key replaces its record rather than appending a second copy.
    archive.add("celec_ords", "repDiaNivQIng", { year: 2024, month: "10" }, record("repDiaNivQIng:2024-10-15", '{"items":[2]}'));

    expect(ref).toBe("celec_ords/2024/10/repDiaNivQIng.ndjson.gz#repDiaNivQIng:2024-10-15");
    const written = archive.flush();
    expect(written).toHaveLength(1);

    const reopened = new RawArchive(root);
    expect(reopened.get(written[0]!, "repDiaNivQIng:2024-10-15")?.body).toBe('{"items":[2]}');
    expect(reopened.get(written[0]!, "repDiaNivQIng:2024-10-16")?.body).toBe('{"items":[1]}');
  });

  it("files a response under the month of the data, not the fetch", () => {
    const archive = new RawArchive(temp());
    const path = archive.path("celec_ords", "repDiaHid12m", { year: 2016, month: "09" }, "2026-09-22T00:00:00Z");
    expect(path.endsWith("celec_ords/2016/09/repDiaHid12m.ndjson.gz")).toBe(true);
  });
});
