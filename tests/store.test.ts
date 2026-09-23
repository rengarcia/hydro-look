import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../src/lib/store/csv.ts";
import { CuratedStore, foldBands } from "../src/lib/store/curated.ts";
import { RawArchive, archiveFile, isLegacyRef, legacyTarget, listArchiveFiles, splitRawRef } from "../src/lib/store/archive.ts";
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
    const folded = foldBands(readings);
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
  it("files a day of responses as one plain NDJSON file, deduped by key, and reads them back", () => {
    const root = temp();
    const archive = new RawArchive(root);
    const record = (key: string, body: string) => ({ key, url: "https://example/x", method: "GET", status: 200, fetched_at: "2026-09-22T00:00:00Z", body });

    const ref = archive.add("celec_ords", "repDiaNivQIng", "2024-10-15", record("repDiaNivQIng:2024-10-15", '{"items":[]}'));
    archive.add("celec_ords", "repDiaNivQIng", "2024-10-16", record("repDiaNivQIng:2024-10-16", '{"items":[1]}'));
    // Re-fetching a key replaces its record rather than appending a second copy.
    archive.add("celec_ords", "repDiaNivQIng", "2024-10-15", record("repDiaNivQIng:2024-10-15", '{"items":[2]}'));

    expect(ref).toBe("celec_ords/2024/10/repDiaNivQIng.2024-10-15.ndjson#repDiaNivQIng:2024-10-15");
    const written = archive.flush();
    expect(written).toHaveLength(2);
    // Uncompressed, so git can delta it; one line per response.
    expect(readFileSync(written[0]!, "utf8").trim().split("\n")).toHaveLength(1);

    const reopened = new RawArchive(root);
    expect(reopened.read(ref)?.body).toBe('{"items":[2]}');
    expect(reopened.read("celec_ords/2024/10/repDiaNivQIng.2024-10-16.ndjson#repDiaNivQIng:2024-10-16")?.body).toBe('{"items":[1]}');
    // A second flush of unchanged content writes nothing.
    reopened.add("celec_ords", "repDiaNivQIng", "2024-10-15", record("repDiaNivQIng:2024-10-15", '{"items":[2]}'));
    expect(reopened.flush()).toEqual([]);
  });

  it("files a response under the day of the data, not the fetch; live ones by fetch day or per run", () => {
    expect(archiveFile("celec_ords", "repDiaHid12m", "2016-09-20", "2026-09-22T00:00:00Z")).toBe("celec_ords/2016/09/repDiaHid12m.2016-09-20.ndjson");
    expect(archiveFile("noaa", "oni", null, "2026-09-22T04:41:56Z")).toBe("noaa/2026/09/oni.2026-09-22.ndjson");
    expect(archiveFile("cenace_operativa", "InformacionOperativa", "run", "2026-09-22T14:36:42Z")).toBe(
      "cenace_operativa/2026/09/InformacionOperativa.2026-09-22T143642Z.ndjson",
    );
  });

  it("keeps a failed answer beside the good one instead of replacing it", () => {
    const archive = new RawArchive(temp());
    const good = archive.add("celec_ords", "repDiaHid12m", "2026-09-20", { key: "repDiaHid12m:2026-09-20", url: "u", method: "GET", status: 200, fetched_at: "2026-09-22T00:00:00Z", body: "good" });
    const bad = archive.add("celec_ords", "repDiaHid12m", "2026-09-20", { key: "repDiaHid12m:2026-09-20", url: "u", method: "GET", status: 503, fetched_at: "2026-09-23T00:00:00Z", body: "down" });
    expect(bad).toBe("celec_ords/2026/09/repDiaHid12m.2026-09-20.ndjson#repDiaHid12m:2026-09-20~http503@2026-09-23T00:00:00Z");
    expect(archive.read(good)?.body).toBe("good");
    expect(archive.read(bad)?.body).toBe("down");
  });

  it("reads refs in both the bundle form and the day-file form, before and after migration", () => {
    const root = temp();
    const records = [
      { key: "repDiaHid12m:2019-09-20", url: "u", method: "GET", status: 200, fetched_at: "2026-09-22T01:28:16Z", body: "levels" },
      { key: "informe1:2019-09-03", url: "u", method: "GET", status: 200, fetched_at: "2026-09-22T01:30:00Z", body: "smec" },
    ];
    // A pre-2026-09 bundle, exactly as the old archive wrote it.
    mkdirSync(join(root, "celec_ords", "2019", "09"), { recursive: true });
    writeFileSync(join(root, "celec_ords", "2019", "09", "repDiaHid12m.ndjson.gz"), gzipSync(`${JSON.stringify(records[0])}\n`));
    const legacy = "celec_ords/2019/09/repDiaHid12m.ndjson.gz#repDiaHid12m:2019-09-20";

    const before = new RawArchive(root);
    expect(isLegacyRef(legacy)).toBe(true);
    expect(before.read(legacy)?.body).toBe("levels");
    expect(before.has(legacy)).toBe(true);

    // Migrate: refile into day files, then remove the bundle.
    for (const bundle of listArchiveFiles(root, { legacyOnly: true })) {
      for (const record of [records[0]!]) before.put(legacyTarget(bundle, record), record);
    }
    before.flush();
    rmSync(join(root, "celec_ords", "2019", "09", "repDiaHid12m.ndjson.gz"));

    const after = new RawArchive(root);
    const current = "celec_ords/2019/09/repDiaHid12m.2019-09-20.ndjson#repDiaHid12m:2019-09-20";
    expect(after.read(current)?.body).toBe("levels");
    // The old form still resolves, to the day file that now holds its record.
    expect(after.read(legacy)?.body).toBe("levels");
    expect(after.resolvesTo(legacy)).toBe(current);
    expect(after.has("celec_ords/2019/09/repDiaHid12m.ndjson.gz#repDiaHid12m:2019-09-21")).toBe(false);
    expect(after.has("celec_ords/2019/09/nothing.2019-09-20.ndjson#x")).toBe(false);
    // Two refs in one cell, as XM writes them.
    expect(splitRawRef(`${current} ${legacy}`)).toEqual([current, legacy]);
  });

  it("refiles a legacy record by the date in its key, or by fetch time for live endpoints", () => {
    const at = (key: string, fetched_at: string) => ({ key, url: "u", method: "GET", status: 200, fetched_at, body: "" });
    expect(legacyTarget("celec_ords/2027/01/csrCaudCuenAniosAvg.ndjson.gz", at("csrCaudCuenAniosAvg:2010-01-01:2027-01-01", "2026-09-23T02:36:13Z"))).toBe(
      "celec_ords/2027/01/csrCaudCuenAniosAvg.2027-01-01.ndjson",
    );
    expect(legacyTarget("open_meteo/2026/09/forecast.ndjson.gz", at("forecast:paute:-2.6:-78.6:2026-09-21:2026-10-06:2026-09-22T04:41:56Z", "2026-09-22T04:41:56Z"))).toBe(
      "open_meteo/2026/09/forecast.2026-09-22.ndjson",
    );
    expect(legacyTarget("cenace_operativa/2026/09/InformacionOperativa.ndjson.gz", at("InformacionOperativa:2026-09-22T01:19:06Z", "2026-09-22T01:19:06Z"))).toBe(
      "cenace_operativa/2026/09/InformacionOperativa.2026-09-22T011906Z.ndjson",
    );
    expect(legacyTarget("xm/2016/05/ExpoEner_Enlace.ndjson.gz", at("ExpoEner:Enlace:2016-05-01:2016-05-31", "2026-09-22T18:59:13Z"))).toBe(
      "xm/2016/05/ExpoEner_Enlace.2016-05-01.ndjson",
    );
  });
});
