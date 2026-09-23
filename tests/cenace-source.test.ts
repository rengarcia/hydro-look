/**
 * The CENACE sources as the ingest drives them: fetch, archive, parse, and what lands on the
 * batch for each way an answer can go wrong. The parsers have their own tests in cenace.test.ts;
 * this is the error handling around them.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FetchResult, HttpClient, RequestSpec } from "../src/lib/http/client.ts";
import { emptyBatch } from "../src/lib/sources/batch.ts";
import { CelecOrds } from "../src/lib/sources/celec-ords.ts";
import { CenaceOperativa, CenaceSmec } from "../src/lib/sources/cenace.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { fixture } from "./helpers.ts";

const FETCHED_AT = "2026-09-22T16:31:05Z";

/** Answers every request with `reply`, or throws what it throws; records what was asked. */
function stub(reply: (spec: RequestSpec) => Partial<FetchResult>) {
  const asked: RequestSpec[] = [];
  const http = {
    fetch: async (spec: RequestSpec): Promise<FetchResult> => {
      asked.push(spec);
      return {
        key: spec.key,
        url: spec.url,
        method: spec.method ?? "GET",
        status: 200,
        body: "",
        fetchedAt: FETCHED_AT,
        durationMs: 1,
        attempts: 1,
        ...reply(spec),
      };
    },
  } as unknown as HttpClient;
  return { http, asked };
}

const archive = () => new RawArchive(mkdtempSync(join(tmpdir(), "hydro-cenace-")));

describe("SMEC day", () => {
  it("stores a complete report with a raw_ref that reads back", async () => {
    const raw = archive();
    const { http, asked } = stub(() => ({ body: fixture("cenace_smec", "informe1_2026-09-20.html") }));
    const batch = emptyBatch();
    expect(await new CenaceSmec(http, raw).day(batch, "2026-09-20")).toEqual({ complete: true, found: true });
    expect(batch.errors).toEqual([]);
    expect(batch.national).toHaveLength(15);
    const ref = batch.national[0]!.raw_ref;
    expect(ref).toBe("cenace_smec/2026/09/ResultadoInforme1.2026-09-20.ndjson#informe1:2026-09-20");
    expect(raw.read(ref)?.fetched_at).toBe(FETCHED_AT);
    // 404 is SMEC's "no report" and is accepted as an answer; 500 is now retried by the client.
    expect(asked[0]!.allowStatus).toEqual([404]);
  });

  it("writes nothing for the running day, which SMEC reports incomplete", async () => {
    const { http } = stub(() => ({ body: fixture("cenace_smec", "informe1_2026-09-21.html") }));
    const batch = emptyBatch();
    expect(await new CenaceSmec(http, archive()).day(batch, "2026-09-21")).toEqual({ complete: false, found: true });
    expect(batch.national).toEqual([]);
    expect(batch.errors).toEqual([]);
  });

  it("notes a 404 and records a 500 that outlived its retries as an error, archiving both bodies", async () => {
    const raw = archive();
    const batch = emptyBatch();
    const missing = stub(() => ({ status: 404, body: "no report" }));
    await new CenaceSmec(missing.http, raw).day(batch, "2009-01-01");
    expect(batch.notes).toEqual(["smec 2009-01-01: HTTP 404"]);

    const failing = stub(() => ({ status: 500, body: "Internal Server Error", attempts: 4 }));
    expect(await new CenaceSmec(failing.http, raw).day(batch, "2026-09-20")).toEqual({ complete: false, found: false });
    expect(batch.errors).toHaveLength(1);
    expect(batch.errors[0]).toMatch(/^smec 2026-09-20: HTTP 500 after 4 attempts \(archived at (.+)\)$/);
    const ref = /archived at (.+)\)$/.exec(batch.errors[0]!)![1]!;
    expect(raw.read(ref)?.body).toBe("Internal Server Error");
  });

  it("records a transport failure, including a failed pin check, and carries on", async () => {
    const http = {
      fetch: async () => Promise.reject(new Error("TLS pin check failed for smec.cenace.gob.ec:443: TLS pin mismatch")),
    } as unknown as HttpClient;
    const batch = emptyBatch();
    await new CenaceSmec(http, archive()).day(batch, "2026-09-20");
    expect(batch.errors).toEqual(["smec 2026-09-20: Error: TLS pin check failed for smec.cenace.gob.ec:443: TLS pin mismatch"]);
  });

  it("records a report whose layout changed as a parse failure pointing at the archived body", async () => {
    const doctored = fixture("cenace_smec", "informe1_2026-09-20.html").replace("Generación Turbinas a Gas", "Generación Nuclear");
    const { http } = stub(() => ({ body: doctored }));
    const batch = emptyBatch();
    await new CenaceSmec(http, archive()).day(batch, "2026-09-20");
    expect(batch.errors[0]).toMatch(
      /parse failed.*archived at cenace_smec\/2026\/09\/ResultadoInforme1\.2026-09-20\.ndjson#informe1:2026-09-20/,
    );
  });
});

describe("Información Operativa snapshot", () => {
  it("files each snapshot as its own run file", async () => {
    const raw = archive();
    const { http } = stub(() => ({ body: fixture("cenace_operativa", "InformacionOperativa_2026-09-21T1859.html") }));
    const batch = emptyBatch();
    await new CenaceOperativa(http, raw).snapshot(batch);
    expect(batch.errors).toEqual([]);
    expect(batch.operativa.length).toBeGreaterThan(10);
    const ref = batch.operativa[0]!.raw_ref;
    expect(ref).toBe(`cenace_operativa/2026/09/InformacionOperativa.2026-09-22T163105Z.ndjson#InformacionOperativa:${FETCHED_AT}`);
    expect(raw.read(ref)?.body.length).toBeGreaterThan(1000);
  });

  it("archives a non-200 and records it", async () => {
    const raw = archive();
    const { http } = stub(() => ({ status: 503, body: "maintenance" }));
    const batch = emptyBatch();
    await new CenaceOperativa(http, raw).snapshot(batch);
    expect(batch.operativa).toEqual([]);
    const ref = /archived at (.+)\)$/.exec(batch.errors[0]!)![1]!;
    expect(raw.read(ref)?.body).toBe("maintenance");
  });

  it("treats a page with no figures on it as an error, not as a quiet snapshot", async () => {
    const { http } = stub(() => ({ body: "<html><body>Sitio en mantenimiento</body></html>" }));
    const batch = emptyBatch();
    await new CenaceOperativa(http, archive()).snapshot(batch);
    expect(batch.operativa).toEqual([]);
    expect(batch.errors).toHaveLength(1);
  });
});

describe("ORDS row floors", () => {
  const empty = () => stub(() => ({ body: '{"items":[]}' }));

  it("records a settled per-day report that parses to no rows as an error", async () => {
    const { http } = empty();
    const batch = emptyBatch();
    await new CelecOrds(http, archive(), () => "2026-09-23").repDiaPotQTurb(batch, "2026-09-20");
    expect(batch.errors).toHaveLength(1);
    expect(batch.errors[0]).toMatch(
      /^repDiaPotQTurb:2026-09-20: HTTP 200 but 0 rows, expected at least 1 \(archived at celec_ords\/2026\/09\/repDiaPotQTurb\.2026-09-20\.ndjson/,
    );
  });

  it("accepts an empty answer for a day that has not been published yet", async () => {
    const { http } = empty();
    const batch = emptyBatch();
    await new CelecOrds(http, archive(), () => "2026-09-23").repDiaPotQTurb(batch, "2026-09-23");
    expect(batch.errors).toEqual([]);
  });

  it("accepts an empty window from before a report's history begins, and an empty plant-day", async () => {
    const { http } = empty();
    const batch = emptyBatch();
    const ords = new CelecOrds(http, archive(), () => "2026-09-23");
    await ords.repDiaHid12m(batch, "2012-09-20");
    // The EnerDia parser notes an incomplete day itself; before commissioning, empty is the truth.
    await ords.enerDia(batch, "ago", "2016-05-01");
    expect(batch.errors).toEqual([]);
    await ords.repDiaHid12m(batch, "2026-09-23");
    expect(batch.errors).toHaveLength(1);
  });

  it("holds the historian to no floor: a blank month is its known behaviour", async () => {
    const { http } = empty();
    const batch = emptyBatch();
    await new CelecOrds(http, archive(), () => "2026-09-23").pointValuesMesH24(batch, "agoyan", "cota_masl", 140031, {
      year: 2020,
      month: 1,
    });
    expect(batch.errors).toEqual([]);
  });

  it("archives and records a non-200 from the ORDS", async () => {
    const raw = archive();
    const { http } = stub(() => ({ status: 502, body: "Bad Gateway" }));
    const batch = emptyBatch();
    await new CelecOrds(http, raw, () => "2026-09-23").repDiaHid12m(batch, "2026-09-23");
    const ref = /archived at (.+)\)$/.exec(batch.errors[0]!)![1]!;
    expect(ref).toContain("~http502@");
    expect(raw.read(ref)?.body).toBe("Bad Gateway");
  });
});
