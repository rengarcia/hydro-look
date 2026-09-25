/**
 * `scripts/redate.ts` moves a source's stored rows after its date offset changes. It rewrites
 * committed data, so it is tested through the real CLI against a scratch data root: rows move
 * and only their dates change, a row can cross into the previous year's partition, a second
 * run is a no-op, and a rebuild that would change anything but a date writes nothing.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBSERVATIONS_DAILY } from "../src/lib/contracts/tables.ts";
import { parseRepDiaPotQTurb } from "../src/lib/parse/ords.ts";
import { RawArchive } from "../src/lib/store/archive.ts";
import { parseCsv, toCsv } from "../src/lib/store/csv.ts";
import { addDays, type IsoDate } from "../src/lib/util/dates.ts";
import { fixture } from "./helpers.ts";

const repo = join(import.meta.dirname, "..");
const body = fixture("celec_ords", "ords_rep_repDiaPotQTurb.txt");
const FETCHED_AT = "2026-09-22T00:00:00Z";

/** A data root holding two archived responses and the rows the parser stored before the offset. */
function seed(): string {
  const root = mkdtempSync(join(tmpdir(), "hydro-redate-"));
  const archive = new RawArchive(join(root, "raw"));
  const stored: Record<string, unknown>[] = [];
  for (const stamp of ["2026-09-20", "2026-01-01"] as IsoDate[]) {
    const response = body.replaceAll("2026-09-20T05:00:00Z", `${stamp}T05:00:00Z`);
    const rawRef = archive.add("celec_ords", "repDiaPotQTurb", stamp, {
      key: `repDiaPotQTurb:${stamp}`,
      url: "https://example/repDiaPotQTurb",
      method: "GET",
      status: 200,
      fetched_at: FETCHED_AT,
      body: response,
    });
    // Dated as published, which is what the parser did before the offset existed.
    for (const row of parseRepDiaPotQTurb(response).observations) {
      stored.push({ ...row, date: addDays(row.date, 1), fetched_at: FETCHED_AT, raw_ref: rawRef });
    }
  }
  archive.flush();
  stored.push({
    date: "2026-01-01",
    site: "mazar",
    variable: "cota_masl",
    value: 2150,
    source: "ords:repDiaHid12m",
    mrid: "",
    fetched_at: FETCHED_AT,
    raw_ref: "untouched#row",
  });
  const directory = join(root, "curated", "observations_daily");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "2026.csv"), toCsv(OBSERVATIONS_DAILY.columns, stored));
  return root;
}

function redate(root: string): string {
  return execFileSync("npx", ["tsx", "scripts/redate.ts", "ords:repDiaPotQTurb"], {
    cwd: repo,
    env: { ...process.env, HYDRO_LOOK_DATA_ROOT: root },
    encoding: "utf8",
    stdio: "pipe",
  });
}

const partition = (root: string, year: string) => join(root, "curated", "observations_daily", `${year}.csv`);
const rows = (root: string, year: string) =>
  existsSync(partition(root, year)) ? parseCsv(readFileSync(partition(root, year), "utf8")) : [];

describe("redate", () => {
  it("moves every row of the source back a day, across a year boundary, and nothing else", () => {
    const root = seed();
    const before = rows(root, "2026");
    expect(redate(root)).toMatch(/18 rows from 2 responses, moved -1 days/);

    const moved = [...rows(root, "2025"), ...rows(root, "2026")];
    expect(moved).toHaveLength(before.length);
    expect(rows(root, "2025").every((r) => r["date"] === "2025-12-31" && r["source"] === "ords:repDiaPotQTurb")).toBe(true);
    expect(rows(root, "2025")).toHaveLength(9);
    expect(
      moved.find((r) => r["date"] === "2026-09-19" && r["site"] === "minas_san_francisco" && r["variable"] === "potencia_mw"),
    ).toMatchObject({
      value: "202.28",
      fetched_at: FETCHED_AT,
    });
    expect(moved.some((r) => r["source"] === "ords:repDiaPotQTurb" && (r["date"] === "2026-09-21" || r["date"] === "2026-01-02"))).toBe(
      false,
    );
    expect(rows(root, "2026").find((r) => r["raw_ref"] === "untouched#row")?.["date"]).toBe("2026-01-01");

    const settled = readFileSync(partition(root, "2026"), "utf8");
    expect(redate(root)).toMatch(/moved 0 days\nnothing to move/);
    expect(readFileSync(partition(root, "2026"), "utf8")).toBe(settled);
  });

  it("refuses to write when the rebuild would change a value, not just a date", () => {
    const root = seed();
    const text = readFileSync(partition(root, "2026"), "utf8");
    writeFileSync(partition(root, "2026"), text.replace(",202.28,", ",202.29,"));
    const tampered = readFileSync(partition(root, "2026"), "utf8");
    expect(() => redate(root)).toThrow(/value changed from 202.29 to 202.28/);
    expect(readFileSync(partition(root, "2026"), "utf8")).toBe(tampered);
    expect(existsSync(partition(root, "2025"))).toBe(false);
  });
});
