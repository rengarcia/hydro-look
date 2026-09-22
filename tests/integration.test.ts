/**
 * The write path end to end, minus HTTP: Phase 0 fixtures -> parsers -> archive -> contracts
 * -> curated CSV, in a temporary directory.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRepDiaHid12m, parseRepDiaNivQIng, parseRepDiaVolAlm } from "../src/lib/parse/ords.ts";
import { parseSmecInforme1 } from "../src/lib/parse/smec.ts";
import { CuratedStore, foldBands } from "../src/lib/store/curated.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { NATIONAL_BALANCE_DAILY, OBSERVATIONS_DAILY, OPERATING_BANDS } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { emptyBatch } from "../src/lib/sources/batch.ts";
import { fixture } from "./helpers.ts";

const FETCHED_AT = "2026-09-22T00:10:00Z";

describe("ingest write path", () => {
  it("turns a day of raw responses into curated rows, bands and an archive", () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-look-e2e-"));
    const archive = new RawArchive(join(root, "raw"));
    const store = new CuratedStore(join(root, "curated"));
    const batch = emptyBatch();

    const responses = [
      { endpoint: "repDiaNivQIng", body: fixture("celec_ords", "ords_rep_repDiaNivQIng.txt"), parse: parseRepDiaNivQIng },
      { endpoint: "repDiaVolAlm", body: fixture("celec_ords", "ords_rep_repDiaVolAlm_post.txt"), parse: (b: string) => parseRepDiaVolAlm(b, "2026-09-20") },
      { endpoint: "repDiaHid12m", body: fixture("celec_ords", "ords_rep_repDiaHid12m.txt"), parse: parseRepDiaHid12m },
    ];

    for (const response of responses) {
      const rawRef = archive.add("celec_ords", response.endpoint, { year: 2026, month: "09" }, {
        key: `${response.endpoint}:2026-09-20`,
        url: `https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/${response.endpoint}`,
        method: "GET",
        status: 200,
        fetched_at: FETCHED_AT,
        body: response.body,
      });
      const parsed = response.parse(response.body);
      for (const observation of parsed.observations) {
        batch.observations.push({ ...observation, fetched_at: FETCHED_AT, raw_ref: rawRef });
      }
      if (parsed.bands) batch.bands.push(...parsed.bands);
    }

    const smecReport = parseSmecInforme1(fixture("cenace_smec", "informe1_2026-09-20.html"), "2026-09-20");
    const smecRef = archive.add("cenace_smec", "ResultadoInforme1", { year: 2026, month: "09" }, {
      key: "informe1:2026-09-20",
      url: "https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do",
      method: "GET",
      status: 200,
      fetched_at: FETCHED_AT,
      body: "<html/>",
    });
    for (const row of smecReport.rows) {
      batch.national.push({
        ...row,
        tipo_dia: smecReport.tipo_dia,
        tipo_dia_anio_anterior: smecReport.tipo_dia_anio_anterior,
        source: "smec:ResultadoInforme1",
        fetched_at: FETCHED_AT,
        raw_ref: smecRef,
      });
    }

    const observations = store.upsert(OBSERVATIONS_DAILY, batch.observations);
    const national = store.upsert(NATIONAL_BALANCE_DAILY, batch.national);
    const bands = store.upsert(OPERATING_BANDS, foldBands(batch.bands));
    archive.flush();

    // Levels land in two year partitions because repDiaHid12m carries a trailing year.
    expect(observations.files.map((f) => f.path.split("/").pop()).sort()).toEqual(["2025.csv", "2026.csv"]);
    expect(national.added).toBe(15);
    expect(bands.added).toBeGreaterThan(0);

    const rows = parseCsv(readFileSync(join(root, "curated", "observations_daily", "2026.csv"), "utf8"));
    const mazarLevelsOn = (date: string) =>
      rows.filter((r) => r["date"] === date && r["site"] === "mazar" && r["variable"] === "cota_masl");
    // Both one-day reports were fetched for 2026-09-20 and they land on different days, which is
    // the point: repDiaVolAlm describes the date it is stamped with and repDiaNivQIng does not.
    expect(mazarLevelsOn("2026-09-20").map((r) => r["source"]).sort()).toEqual(["ords:repDiaVolAlm"]);
    // 2026-09-19 also carries the trailing-year row from repDiaHid12m, which is the pair the
    // shift was measured against; what matters is that repDiaNivQIng is here and not a day later.
    expect(mazarLevelsOn("2026-09-19").map((r) => r["source"]).sort()).toEqual([
      "ords:repDiaHid12m",
      "ords:repDiaNivQIng",
    ]);
    // The row moved; the response it came from is still archived under the month it was asked for.
    const nivQIng = mazarLevelsOn("2026-09-19").find((r) => r["source"] === "ords:repDiaNivQIng")!;
    expect(nivQIng["raw_ref"]).toMatch(/^celec_ords\/2026\/09\/repDiaNivQIng.*#repDiaNivQIng:2026-09-20/);

    const balance = parseCsv(readFileSync(join(root, "curated", "national_balance_daily", "2026.csv"), "utf8"));
    expect(balance.find((r) => r["concepto"] === "generacion_hidraulica")?.["dia_kwh"]).toBe("76808654.928");
    expect(balance.every((r) => r["tipo_dia"] === "Domingo")).toBe(true);

    // Every archived response can be read back for reprocessing without the network.
    const reopened = new RawArchive(join(root, "raw"));
    const archived = reopened.get(join(root, "raw", "celec_ords", "2026", "09", "repDiaNivQIng.ndjson.gz"), "repDiaNivQIng:2026-09-20");
    expect(JSON.parse(archived!.body).items).toHaveLength(4);
  });
});
