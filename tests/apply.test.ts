/**
 * The CI write path: a run stages its rows and raw bundles, then `apply` merges them onto
 * whatever the branch holds. This is what replaced rebasing generated CSV, so it is tested
 * through the real CLI, including a second apply onto data another run wrote in between.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/lib/store/csv.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { parseRepDiaNivQIng } from "../src/lib/parse/ords.ts";
import { fixture } from "./helpers.ts";

const repo = join(import.meta.dirname, "..");

function stage(directory: string, observations: unknown[], raw: { endpoint: string; body: string }[]): void {
  mkdirSync(directory, { recursive: true });
  const archive = new RawArchive(join(directory, "raw"));
  for (const response of raw) {
    archive.add("celec_ords", response.endpoint, { year: 2026, month: "09" }, {
      key: `${response.endpoint}:2026-09-20`,
      url: `https://example/${response.endpoint}`,
      method: "GET",
      status: 200,
      fetched_at: "2026-09-22T00:00:00Z",
      body: response.body,
    });
  }
  archive.flush();
  writeFileSync(
    join(directory, "batch.json"),
    JSON.stringify({ generated_at: "2026-09-22T00:00:00Z", command: "daily", observations, bands: [], national: [], operativa: [], notes: [], errors: [] }),
  );
}

function apply(dataRoot: string, batchDir: string): string {
  return execFileSync("npx", ["tsx", "scripts/ingest.ts", "apply", "--in", batchDir], {
    cwd: repo,
    env: { ...process.env, HYDRO_LOOK_DATA_ROOT: dataRoot },
    encoding: "utf8",
  });
}

const rows = (dataRoot: string, year: string) =>
  parseCsv(readFileSync(join(dataRoot, "curated", "observations_daily", `${year}.csv`), "utf8"));

describe("staged apply", () => {
  it("merges two independently staged runs without either losing rows", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "hydro-look-apply-"));
    const body = fixture("celec_ords", "ords_rep_repDiaNivQIng.txt");
    const observations = parseRepDiaNivQIng(body).observations.map((o) => ({
      ...o,
      fetched_at: "2026-09-22T00:00:00Z",
      raw_ref: "celec_ords/2026/09/repDiaNivQIng.ndjson.gz#repDiaNivQIng:2026-09-20",
    }));

    // Run A: the day's levels.
    const batchA = join(dataRoot, "batchA");
    stage(batchA, observations, [{ endpoint: "repDiaNivQIng", body }]);
    const outputA = apply(dataRoot, batchA);
    expect(outputA).toMatch(/observations_daily: \+8 new/);
    expect(rows(dataRoot, "2026")).toHaveLength(8);

    // Run B: a different endpoint for the same day, staged before A was applied.
    const batchB = join(dataRoot, "batchB");
    stage(
      batchB,
      [{ date: "2026-09-20", site: "mazar", variable: "nivel_pct_banda", value: 73.849057, source: "ords:repDiaVolAlm", mrid: "", fetched_at: "2026-09-22T00:00:00Z", raw_ref: "celec_ords/2026/09/repDiaVolAlm.ndjson.gz#repDiaVolAlm:2026-09-20" }],
      [{ endpoint: "repDiaVolAlm", body: '{"cv_1":[]}' }],
    );
    apply(dataRoot, batchB);

    // Both runs' rows are present: applying is an upsert, not a checkout of one side.
    const merged = rows(dataRoot, "2026");
    expect(merged).toHaveLength(9);
    expect(merged.filter((r) => r["source"] === "ords:repDiaNivQIng")).toHaveLength(8);
    expect(merged.filter((r) => r["source"] === "ords:repDiaVolAlm")).toHaveLength(1);

    // And both raw bundles survived, each under the month of its data.
    const archive = new RawArchive(join(dataRoot, "raw"));
    const bundle = join(dataRoot, "raw", "celec_ords", "2026", "09", "repDiaNivQIng.ndjson.gz");
    expect(archive.get(bundle, "repDiaNivQIng:2026-09-20")?.body).toBe(body);

    // Re-applying the same batch changes nothing, which is what makes the push retry safe.
    const again = apply(dataRoot, batchA);
    expect(again).toMatch(/\+0 new, ~0 updated, 8 unchanged/);
    expect(rows(dataRoot, "2026")).toHaveLength(9);

    const status = JSON.parse(readFileSync(join(dataRoot, "latest", "status.json"), "utf8")) as {
      tables: { observations_daily: { rows: number; last_date: string } };
    };
    expect(status.tables.observations_daily).toMatchObject({ rows: 9, last_date: "2026-09-20" });
  }, 60_000);
});
