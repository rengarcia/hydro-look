/**
 * §5.8: `energy_hourly` rows from archived `{code}EnerDia` bodies, through an abstract reader.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { energyHourlyFromRaw, parseEnerDiaHours, type RawRecord } from "../src/lib/features/energy-hourly.ts";
import { parseEnerDia } from "../src/lib/parse/ords.ts";
import { ENERGY_HOURLY, validateRows } from "../src/lib/contracts/tables.ts";
import { FIXTURES } from "./helpers.ts";

const body = readFileSync(join(FIXTURES, "celec_ords", "ords_hist_molEnerDia_15-10-2024.txt"), "utf8");

function record(key: string, fetchedAt: string, text: string, status = 200): RawRecord {
  return { key, status, fetched_at: fetchedAt, body: text, ref: `celec_ords/2024/10/molEnerDia#${key}@${fetchedAt}` };
}

describe("parseEnerDiaHours", () => {
  const rows = parseEnerDiaHours(body, "mol", { fetched_at: "2026-09-22T00:00:00Z", ref: "x" });

  it("reads 24 local hours for the plant-day, hour 24 ending at local midnight", () => {
    expect(rows).toHaveLength(24);
    expect(new Set(rows.map((r) => r.date))).toEqual(new Set(["2024-10-15"]));
    expect(rows.map((r) => r.hour_ending).sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(rows.every((r) => r.site === "molino" && r.source === "ords:molEnerDia")).toBe(true);
  });

  it("sums to the daily total the curated table already holds", () => {
    const daily = parseEnerDia(body, "molino", "mol", "2024-10-15").observations[0]!.value;
    expect(rows.reduce((a, r) => a + r.energy_mwh, 0)).toBeCloseTo(daily, 4);
  });

  it("satisfies the table contract", () => {
    expect(validateRows(ENERGY_HOURLY, rows)).toHaveLength(24);
  });

  it("leaves an hour published as null out, rather than writing zero", () => {
    const partial = JSON.stringify({ items: [{ loctimestamp: "2024-10-15T06:00:00Z", valueedit: null }, { loctimestamp: "2024-10-15T07:00:00Z", valueedit: 5 }] });
    expect(parseEnerDiaHours(partial, "mol", { fetched_at: "2026-09-22T00:00:00Z", ref: "x" }).map((r) => r.hour_ending)).toEqual([2]);
  });
});

describe("energyHourlyFromRaw", () => {
  it("backfills through any reader, keeping the latest fetch of each plant-hour and skipping failures", () => {
    const later = body.replace(/"valueedit":([\d.]+)/, '"valueedit":1');
    const archive = new Map<string, RawRecord[]>([
      ["molEnerDia", [record("molEnerDia:2024-10-15", "2026-09-21T00:00:00Z", body), record("molEnerDia:2024-10-15", "2026-09-22T00:00:00Z", later), record("molEnerDia:2024-10-16", "2026-09-22T00:00:00Z", "", 500)]],
    ]);
    const requested: string[] = [];
    const rows = energyHourlyFromRaw((endpoint) => {
      requested.push(endpoint);
      return archive.get(endpoint) ?? [];
    }, ["mol", "maz"]);
    expect(requested).toEqual(["molEnerDia", "mazEnerDia"]);
    expect(rows).toHaveLength(24);
    expect(rows.filter((r) => r.fetched_at === "2026-09-22T00:00:00Z")).toHaveLength(24);
  });
});
