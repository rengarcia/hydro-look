/**
 * The run's own record: status.json (table summaries, narrative spend, the no-op rule), the
 * quarantine the ingest writes instead of failing a table, and the step summary.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBSERVATIONS_DAILY } from "../src/lib/contracts/tables.ts";
import { checkQuarantine, checkRawRefs } from "../src/lib/quality/checks.ts";
import { toCsv } from "../src/lib/store/csv.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { writeJsonUnlessOnlyStamped } from "../src/lib/store/files.ts";
import { summariseNarrativeSpend, summariseTable, writeStatus } from "../src/lib/store/status.ts";
import { narrativeSummary, runSummary } from "../src/lib/store/summary.ts";

const temp = () => mkdtempSync(join(tmpdir(), "hydro-status-"));

const NARRATIVE_COLUMNS = [
  "run_id",
  "generated_at",
  "origin_date",
  "status",
  "model_id",
  "prompt_version",
  "input_tokens",
  "output_tokens",
  "cost_usd",
  "reason",
];

function curatedWithNarrative(rows: Record<string, string | number>[]): string {
  const root = temp();
  mkdirSync(join(root, "narrative_snapshots"));
  writeFileSync(join(root, "narrative_snapshots", "2026.csv"), toCsv(NARRATIVE_COLUMNS, rows));
  return root;
}

describe("summariseTable", () => {
  it("counts rows and spans dates over every year partition", () => {
    const root = temp();
    mkdirSync(join(root, "observations_daily"));
    writeFileSync(join(root, "observations_daily", "2025.csv"), "date,value\n2025-12-31,1\n");
    writeFileSync(join(root, "observations_daily", "2026.csv"), "date,value\n2026-01-01,1\n2026-09-20,2\n");
    expect(summariseTable("observations_daily", "date", root)).toEqual({
      rows: 3,
      first_date: "2025-12-31",
      last_date: "2026-09-20",
      files: 2,
    });
    expect(summariseTable("absent", "date", root)).toEqual({ rows: 0, first_date: null, last_date: null, files: 0 });
  });
});

describe("narrative spend", () => {
  it("sums cost by month and counts billed calls with no reported cost", () => {
    const root = curatedWithNarrative([
      {
        run_id: "a",
        generated_at: "2026-08-31T23:00:00Z",
        origin_date: "2026-08-30",
        status: "ok",
        model_id: "m",
        prompt_version: "es-1",
        input_tokens: 6000,
        output_tokens: 400,
        cost_usd: 0.039,
        reason: "",
      },
      {
        run_id: "b",
        generated_at: "2026-09-23T02:15:31Z",
        origin_date: "2026-09-21",
        status: "rejected",
        model_id: "m",
        prompt_version: "es-1",
        input_tokens: 4746,
        output_tokens: 1769,
        cost_usd: "",
        reason: "schema",
      },
      {
        run_id: "c",
        generated_at: "2026-09-23T12:00:00Z",
        origin_date: "2026-09-22",
        status: "ok",
        model_id: "m",
        prompt_version: "es-1",
        input_tokens: 6400,
        output_tokens: 500,
        cost_usd: 0.0412,
        reason: "",
      },
      {
        run_id: "d",
        generated_at: "2026-09-23T13:00:00Z",
        origin_date: "2026-09-22",
        status: "failed",
        model_id: "m",
        prompt_version: "es-1",
        input_tokens: "",
        output_tokens: "",
        cost_usd: "",
        reason: "no access",
      },
    ]);
    expect(summariseNarrativeSpend(root)).toEqual({
      calls: 4,
      by_status: { ok: 2, rejected: 1, failed: 1 },
      spend_usd: 0.0802,
      calls_without_cost: 1,
      by_month: { "2026-08": 0.039, "2026-09": 0.0412 },
      last_call_at: "2026-09-23T13:00:00Z",
    });
    expect(summariseNarrativeSpend(temp())).toBeNull();
  });

  it("reads the committed spend log", () => {
    const spend = summariseNarrativeSpend();
    expect(spend).not.toBeNull();
    expect(spend!.calls).toBeGreaterThanOrEqual(5);
    expect(spend!.spend_usd).toBeGreaterThanOrEqual(0);
  });

  it("puts a call's cost, latency and the spend to date in the step summary", () => {
    const root = curatedWithNarrative([
      {
        run_id: "c",
        generated_at: "2026-09-23T12:00:00Z",
        origin_date: "2026-09-22",
        status: "ok",
        model_id: "anthropic/claude-opus-5.5",
        prompt_version: "es-1",
        input_tokens: 6400,
        output_tokens: 500,
        cost_usd: 0.0412,
        reason: "",
      },
    ]);
    const text = narrativeSummary({
      latest: {
        generated_at: "2026-09-23T12:00:00Z",
        status: "ok",
        model_id: "anthropic/claude-opus-5.5",
        prompt_version: "es-1",
        origin_date: "2026-09-22",
        cost_usd: "0.0412",
        input_tokens: "6400",
        output_tokens: "500",
        reason: "",
      },
      spend: summariseNarrativeSpend(root),
      latencyMs: 8400,
    });
    expect(text).toMatch(/\*\*ok\*\* with `anthropic\/claude-opus-5\.5`/);
    expect(text).toMatch(/Cost \$0\.0412; tokens 6400 in \/ 500 out; step took 8\.4 s/);
    expect(text).toMatch(/Spend to date: \$0\.0412 over 1 calls \(\$0\.0412 in 2026-09\)/);
    expect(narrativeSummary({ latest: null, spend: null })).toMatch(/No snapshot was written/);
  });
});

describe("status.json", () => {
  it("is not rewritten when only generated_at would change", () => {
    const directory = temp();
    const payload = { generated_at: "2026-09-23T12:47:00Z", command: "daily", errors: [], requests: undefined, tables: { a: { rows: 1 } } };
    expect(writeStatus(payload, directory)).toBe(join(directory, "status.json"));
    expect(writeStatus({ ...payload, generated_at: "2026-09-23T16:53:00Z" }, directory)).toBeNull();
    expect(JSON.parse(readFileSync(join(directory, "status.json"), "utf8")).generated_at).toBe("2026-09-23T12:47:00Z");
    // Anything else changing is a real change.
    expect(writeStatus({ ...payload, generated_at: "2026-09-23T16:53:00Z", tables: { a: { rows: 2 } } }, directory)).not.toBeNull();
    expect(JSON.parse(readFileSync(join(directory, "status.json"), "utf8")).generated_at).toBe("2026-09-23T16:53:00Z");
  });

  it("replaces an unreadable previous document instead of comparing against it", () => {
    const path = join(temp(), "doc.json");
    writeFileSync(path, "{ half a docu");
    expect(writeJsonUnlessOnlyStamped(path, { generated_at: "x", a: 1 })).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ generated_at: "x", a: 1 });
  });
});

describe("quarantine", () => {
  const good = {
    date: "2026-09-20",
    site: "mazar",
    variable: "cota_masl",
    value: 2139.1,
    source: "ords:repDiaNivQIng",
    mrid: "",
    fetched_at: "2026-09-22T00:00:00Z",
    raw_ref: "r#k",
  };

  it("writes the good rows and sets the bad ones aside with their reason", () => {
    const root = temp();
    const store = new CuratedStore(join(root, "curated"));
    const bad = { ...good, site: "atlantis" };
    const report = store.upsert(OBSERVATIONS_DAILY, [good, bad], { quarantine: { root: join(root, "quarantine"), run: "123-1" } });
    expect(report).toMatchObject({ added: 1, quarantined: 1, bySource: { "ords:repDiaNivQIng": { added: 1, updated: 0 } } });
    const quarantined = readFileSync(join(root, "quarantine", "observations_daily", "123-1.csv"), "utf8");
    expect(quarantined.split("\n")[0]).toBe("date,site,variable,value,source,mrid,fetched_at,raw_ref,reason");
    expect(quarantined).toMatch(/atlantis.*site Invalid/);
  });

  it("still refuses the whole table without it, which is what the models rely on", () => {
    const store = new CuratedStore(join(temp(), "curated"));
    expect(() => store.upsert(OBSERVATIONS_DAILY, [good, { ...good, value: "high" }])).toThrow(/1\/2 rows failed the contract/);
  });

  it("writes nothing in a dry run", () => {
    const root = temp();
    const store = new CuratedStore(join(root, "curated"), true);
    store.upsert(OBSERVATIONS_DAILY, [{ ...good, date: "someday" }], { quarantine: { root: join(root, "quarantine"), run: "r" } });
    expect(existsSync(join(root, "quarantine"))).toBe(false);
  });
});

describe("quality gates for the archive and the quarantine", () => {
  it("fails a raw_ref that resolves to nothing, warns on the old bundle form, and checks each ref once", () => {
    const asked: string[] = [];
    const findings = checkRawRefs(
      [{ name: "xm_exchange_daily", rows: [{ raw_ref: "a#1 b#2" }, { raw_ref: "a#1 old.ndjson.gz#3" }, { raw_ref: "" }] }],
      (ref) => {
        asked.push(ref);
        return ref === "b#2" ? null : ref.includes(".gz") ? "legacy" : "current";
      },
    );
    expect(asked).toEqual(["a#1", "b#2", "old.ndjson.gz#3"]);
    expect(findings.filter((f) => f.level === "fail").map((f) => f.message)).toEqual([
      "xm_exchange_daily: 2 raw_refs resolve to no archived response; first: b#2",
    ]);
    expect(findings.some((f) => f.level === "warn" && /1 raw_refs still name a pre-2026-09 gzip bundle/.test(f.message))).toBe(true);
  });

  it("fails while anything sits in the quarantine", () => {
    expect(checkQuarantine([])[0]!.level).toBe("info");
    expect(checkQuarantine(["quarantine/observations_daily/123-1.csv"])[0]).toMatchObject({ level: "fail" });
  });
});

describe("run summary", () => {
  it("lists rows by table and source, requests with retries, and errors", () => {
    const text = runSummary({
      command: "daily",
      reports: [
        {
          table: "observations_daily",
          files: [],
          added: 3,
          updated: 1,
          unchanged: 90,
          bySource: { "ords:repDiaHid12m": { added: 2, updated: 1 }, "ords:repDiaVolAlm": { added: 1, updated: 0 } },
          quarantined: 0,
        },
        { table: "operating_bands", files: [], added: 0, updated: 0, unchanged: 7, bySource: {}, quarantined: 0 },
      ],
      requests: { total: 61, byHost: { "generacioncsr.celec.gob.ec": 52, "smec.cenace.gob.ec": 8, "www.cenace.gob.ec": 1 } },
      errors: ["repDiaVolAlm:2026-09-21: HTTP 200 but 0 rows | expected 1"],
      notes: ["a note"],
    });
    expect(text).toContain("| observations_daily | ords:repDiaHid12m | 2 | 1 |");
    expect(text).toContain("| operating_bands |  | 0 | 0 |");
    expect(text).toContain(
      "**Requests:** 61, retries included (generacioncsr.celec.gob.ec 52, smec.cenace.gob.ec 8, www.cenace.gob.ec 1).",
    );
    expect(text).toContain("**Errors:** 1");
    // A pipe in an error would break the table it is not in, but escape it anyway.
    expect(text).toContain("0 rows \\| expected 1");
  });
});
