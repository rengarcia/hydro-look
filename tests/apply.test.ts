/**
 * The CI write path: a run stages its rows and raw bundles, then `apply` merges them onto
 * whatever the branch holds. This is what replaced rebasing generated CSV, so it is tested
 * through the real CLI, including a second apply onto data another run wrote in between.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/lib/store/csv.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { parseRepDiaNivQIng } from "../src/lib/parse/ords.ts";
import { emptyBatch } from "../src/lib/sources/batch.ts";
import { fixture } from "./helpers.ts";

const repo = join(import.meta.dirname, "..");

function stage(directory: string, observations: unknown[], raw: { endpoint: string; body: string }[]): void {
  mkdirSync(directory, { recursive: true });
  const archive = new RawArchive(join(directory, "raw"));
  for (const response of raw) {
    archive.add("celec_ords", response.endpoint, "2026-09-20", {
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
    JSON.stringify({
      generated_at: "2026-09-22T00:00:00Z",
      command: "daily",
      observations,
      bands: [],
      national: [],
      operativa: [],
      notes: [],
      errors: [],
    }),
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
  it("applies covariates, preserves them through an older backfill batch, and supports dry-run", () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-covariates-apply-"));
    const directory = join(root, "batch");
    mkdirSync(directory);
    const batch = emptyBatch();
    batch.weather.push({
      date: "2026-09-22",
      basin: "paute",
      latitude: -2.6,
      longitude: -78.6,
      kind: "forecast",
      precip_mm: 0,
      temp_mean_c: 12,
      issued_at: "2026-09-22T17:00:00Z",
      source: "open_meteo:forecast",
      fetched_at: "2026-09-22T17:00:00Z",
      raw_ref: "test#forecast",
    });
    batch.enso.push({ month: "2026-07", oni: 1.8, source: "noaa_psl:oni", fetched_at: "2026-09-22T17:00:00Z", raw_ref: "test#oni" });
    writeFileSync(join(directory, "batch.json"), JSON.stringify({ ...batch, command: "covariates" }));
    execFileSync("npx", ["tsx", "scripts/ingest.ts", "apply", "--in", directory, "--dry-run"], {
      cwd: repo,
      env: { ...process.env, HYDRO_LOOK_DATA_ROOT: root },
      encoding: "utf8",
    });
    expect(existsSync(join(root, "curated"))).toBe(false);
    expect(existsSync(join(root, "latest"))).toBe(false);
    apply(root, directory);
    const weather = readFileSync(join(root, "curated/weather_daily/2026.csv"), "utf8");
    expect(parseCsv(weather)[0]?.["precip_mm"]).toBe("0");
    expect(parseCsv(readFileSync(join(root, "curated/enso_monthly/2026.csv"), "utf8"))).toHaveLength(1);
    // The user's in-flight backfill has no weather/enso fields in its staged payload.
    stage(directory, [], []);
    apply(root, directory);
    expect(readFileSync(join(root, "curated/weather_daily/2026.csv"), "utf8")).toBe(weather);
    const status = JSON.parse(readFileSync(join(root, "latest/status.json"), "utf8"));
    expect(status.tables.weather_daily.rows).toBe(1);
    expect(status.tables.enso_monthly.rows).toBe(1);
  }, 60_000);

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
      [
        {
          date: "2026-09-20",
          site: "mazar",
          variable: "nivel_pct_banda",
          value: 73.849057,
          source: "ords:repDiaVolAlm",
          mrid: "",
          fetched_at: "2026-09-22T00:00:00Z",
          raw_ref: "celec_ords/2026/09/repDiaVolAlm.ndjson.gz#repDiaVolAlm:2026-09-20",
        },
      ],
      [{ endpoint: "repDiaVolAlm", body: '{"cv_1":[]}' }],
    );
    apply(dataRoot, batchB);

    // Both runs' rows are present: applying is an upsert, not a checkout of one side.
    const merged = rows(dataRoot, "2026");
    expect(merged).toHaveLength(9);
    expect(merged.filter((r) => r["source"] === "ords:repDiaNivQIng")).toHaveLength(8);
    expect(merged.filter((r) => r["source"] === "ords:repDiaVolAlm")).toHaveLength(1);

    // And both raw files survived, each under the day of its data. The rows were staged with
    // the old bundle form of raw_ref, as a batch staged before the layout change would be, and
    // apply pointed them at the day files that hold their responses.
    const archive = new RawArchive(join(dataRoot, "raw"));
    const nivRow = merged.find((r) => r["source"] === "ords:repDiaNivQIng")!;
    expect(nivRow["raw_ref"]).toBe("celec_ords/2026/09/repDiaNivQIng.2026-09-20.ndjson#repDiaNivQIng:2026-09-20");
    expect(archive.read(nivRow["raw_ref"]!)?.body).toBe(body);

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
