/**
 * Phase 6b: the payload, the validator, the no-op, the keyless run and the call itself.
 *
 * The payload is asserted against a known day — 2026-09-21, cut from the committed tables into
 * `tests/fixtures/narrative/2026-09-21/` (the four public documents as they stood, plus only the
 * rows the payload reads: two level readings a year, the Paute point's ERA5 for the forecast's
 * sixteen days of the year, and the ONI tail). Unlike `publish.test.ts`, which deliberately
 * avoids the real numbers, these assertions *are* the real numbers: the acceptance criterion is
 * "the payload builder against a known day", and a fixture frozen on disk cannot drift the way
 * the live tables do.
 *
 * The model is never called. `MockLanguageModelV4` from `ai/test` stands in for the gateway, so
 * the schema, the validator, the 429 retry and the cost read are exercised through the real
 * `generateText` path with a canned answer.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import {
  analogYears,
  buildPayload,
  canonicalJson,
  daysAtSlope,
  loadPayloadInputs,
  payloadHash,
  precipitationOutlook,
  type NarrativePayload,
} from "../src/lib/narrative/payload.ts";
import { allowedSet, inventedFigures, numberAllowed, readNumber, validateNarrative } from "../src/lib/narrative/validate.ts";
import {
  costFromMetadata,
  generateNarrative,
  isNoOp,
  narrativeDocument,
  snapshotRow,
  type SnapshotRef,
} from "../src/lib/narrative/generate.ts";
import { PROMPT_VERSION } from "../src/lib/narrative/prompt.ts";
import { narrativeSnapshotRow } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { FIXTURES } from "./helpers.ts";

const repo = join(import.meta.dirname, "..");
const DAY = join(FIXTURES, "narrative", "2026-09-21");

function fixturePayload(): NarrativePayload {
  const inputs = loadPayloadInputs({ curated: join(DAY, "curated"), api: join(DAY, "api"), basins: join(DAY, "basins.csv") });
  if (inputs === null) throw new Error("fixture has no latest.json");
  return buildPayload(inputs);
}

const payload = fixturePayload();
const mazar = payload.reservoirs.find((r) => r.site === "mazar")!;

describe("the payload for 2026-09-21", () => {
  it("copies Mazar's level, bands and slopes from latest.json", () => {
    expect(mazar.level_masl).toBe(2138.37);
    expect(mazar.observed_on).toBe("2026-09-21");
    expect(mazar.slopes_m_per_day).toEqual({ d7: -0.2129, d14: -0.47, d30: -0.3313 });
    // 2100–2153 is published by two report endpoints and folded into one band that names both.
    expect(mazar.bands[0]).toEqual({
      floor_masl: 2100,
      ceiling_masl: 2153,
      band_pct: 72.4,
      metres_below_ceiling: 14.63,
      declared_by: ["ords:repDiaHid12m", "ords:repDiaVolAlm"],
    });
    expect(mazar.bands[1]!.floor_masl).toBe(2098);
  });

  it("carries 2115 as unverified, with days to it at the 7- and 30-day slopes", () => {
    expect(mazar.floors.map((f) => [f.floor_masl, f.status])).toEqual([
      [2115, "unverified"],
      [2100, "published"],
      [2098, "published"],
    ]);
    // 23.37 m at 0.2129 m/day is 109.8 days; at 0.3313 m/day, 70.5.
    expect(mazar.floors[0]).toMatchObject({ metres_above: 23.37, days_at_slope_7d: 110, days_at_slope_30d: 71 });
  });

  it("follows the same calendar day through every earlier year of Mazar's record", () => {
    expect(mazar.analog_years!.map((y) => y.year)).toEqual([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(mazar.analog_years!.find((y) => y.year === 2023)).toEqual({ year: 2023, level_masl: 2146.85, change_30d_m: -24.82 });
    expect(mazar.analog_years!.find((y) => y.year === 2024)!.level_masl).toBe(2116.46);
    expect(mazar.analog_30d).toEqual({ years: 12, change_30d_p10_m: -7.32, change_30d_p50_m: 1.07, change_30d_p90_m: 3.45, years_falling: 5 });
    // Year-by-year detail is for the forecast reservoir only; the rest get the summary.
    expect(payload.reservoirs.find((r) => r.site === "amaluza")!.analog_years).toBeUndefined();
  });

  it("copies the statistical forecast at 7, 14 and 30 days, and nothing further out", () => {
    const forecast = payload.mazar_forecast!;
    expect(forecast.run_id).toBe("2026-09-21-mazar-1-1c43d784");
    expect(forecast.horizons.map((h) => [h.horizon_days, h.target_date, h.p10, h.p50, h.p90])).toEqual([
      [7, "2026-09-28", 2130.9, 2135.2, 2137.55],
      [14, "2026-10-05", 2123.11, 2130.95, 2134.25],
      [30, "2026-10-21", 2120.44, 2133.28, 2137.96],
    ]);
    const critical = forecast.crossings.find((c) => c.threshold_masl === 2115)!;
    expect(critical).toMatchObject({ status: "unverified", analogue_years: 14, years_that_cross: 5, p10_days: 42 });
    expect(critical.crossing_scenarios).toEqual([{ scenario: "dry", crosses_on: "2027-01-05", days: 106 }]);
  });

  it("hands over the adequacy tier as an input, with its definition", () => {
    expect(payload.adequacy).toMatchObject({
      run_id: "2026-09-21-adequacy-1-3a236765",
      risk_tier: "holgado",
      risk_tier_horizon_days: 60,
      risk_tier_definition: "el caso p90 sigue cubierto",
      tier_at_7d: "holgado",
    });
    expect(payload.adequacy!.horizons.map((h) => h.horizon_days)).toEqual([7, 30, 60]);
  });

  it("totals the 16-day rain forecast against ERA5 for the same window, labelled provisional", () => {
    expect(payload.precipitation_16d).toMatchObject({
      basin: "paute",
      coordinate_status: "provisional",
      from: "2026-09-21",
      to: "2026-10-06",
      days: 16,
      forecast_total_mm: 80.2,
      climatology_years: 36,
      climatology_p50_mm: 55.8,
      percentile_vs_climatology: 83,
    });
  });

  it("reads the ONI a forecaster could have on the origin date", () => {
    expect(payload.enso).toMatchObject({ month: "2026-07", oni: 1.8, phase: "el_nino" });
    expect(payload.enso!.previous).toEqual([
      { month: "2026-06", oni: 1.39 },
      { month: "2026-05", oni: 0.95 },
    ]);
  });

  it("has a stable hash that does not depend on key order", () => {
    expect(payloadHash(fixturePayload())).toBe(payloadHash(payload));
    const reverse = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverse)
        : value !== null && typeof value === "object"
          ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)]))
          : value;
    const reordered = reverse(payload) as NarrativePayload;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(payload));
    expect(canonicalJson(reordered)).toBe(canonicalJson(payload));
    expect(payloadHash(payload)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stays within the size the plan budgets for", () => {
    // Roughly 1–2 k tokens is the plan's figure; ten thousand characters of JSON is a ceiling
    // with some room, and a payload that outgrows it has started sending series, not numbers.
    expect(canonicalJson(payload).length).toBeLessThan(10_000);
  });
});

describe("the computed pieces", () => {
  it("days at slope is a division, null when not falling, and never negative", () => {
    expect(daysAtSlope(10, -0.5)).toBe(20);
    expect(daysAtSlope(10, 0)).toBeNull();
    expect(daysAtSlope(10, 0.3)).toBeNull();
    expect(daysAtSlope(-1, -0.5)).toBe(0);
    expect(daysAtSlope(null, -0.5)).toBeNull();
  });

  it("skips an analogue year whose calendar day does not exist", () => {
    const levels = new Map([
      ["2023-02-28", 100],
      ["2024-02-29", 101],
      ["2024-03-30", 99],
    ]);
    // 2023-02-29 does not exist; it must not become 1 March.
    expect(analogYears(levels, "2028-02-29")).toEqual([{ year: 2024, level_masl: 101, change_30d_m: -2 }]);
  });

  it("drops an ERA5 year with a missing day rather than totalling fewer days", () => {
    const weather = [
      { date: "2026-01-01", basin: "b", kind: "forecast", precip_mm: "5", issued_at: "2026-01-01T00:00:00Z" },
      { date: "2026-01-02", basin: "b", kind: "forecast", precip_mm: "5", issued_at: "2026-01-01T00:00:00Z" },
      { date: "2024-01-01", basin: "b", kind: "era5", precip_mm: "1", issued_at: "" },
      { date: "2024-01-02", basin: "b", kind: "era5", precip_mm: "1", issued_at: "" },
      { date: "2025-01-01", basin: "b", kind: "era5", precip_mm: "3", issued_at: "" },
    ];
    const outlook = precipitationOutlook(weather, "b", undefined)!;
    expect(outlook.forecast_total_mm).toBe(10);
    expect(outlook.climatology_years).toBe(1);
    expect(outlook.climatology_p50_mm).toBe(2);
  });
});

describe("the validator", () => {
  const allowed = allowedSet(payload);

  const good = {
    outlook_es:
      "Mazar estaba el 21 de septiembre de 2026 en 2.138,37 m, 23,37 m por encima de los 2115 m que este proyecto usa " +
      "como marcador propio, no verificado. Baja 0,21 m al día en la última semana. El pronóstico estadístico sitúa la " +
      "mediana en 2.135,2 m el 28 de septiembre y en 2133,28 m a 30 días, con una banda p10–p90 de 2120,44 a 2137,96 m. " +
      "La suficiencia nacional está en nivel holgado. La lluvia prevista, 80,2 mm, supera la mediana de 55,8 mm " +
      "(percentil 83) en un punto provisional. El ONI de 2026-07 fue 1,8, fase El Niño. En 2023 la cota cayó 24,82 m en 30 días.",
    drivers: [
      "Las pendientes de 7 y 30 días son negativas (-0,2129 y -0,3313 m/día).",
      "Cobertura de la banda: 74 % en el respaldo a 7 días.",
    ],
  };

  it("accepts a text that only quotes the payload, in Spanish typography", () => {
    expect(validateNarrative(good, payload)).toEqual({ ok: true, problems: [] });
  });

  it("rejects an invented level", () => {
    const result = validateNarrative({ ...good, outlook_es: `${good.outlook_es} Llegará a 2.112 m.` }, payload);
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("outlook_es: number 2.112");
  });

  it("rejects an invented date, in every way a date can be written", () => {
    for (const text of ["el 3 de noviembre de 2026", "el 3 de noviembre", "2026-11-03", "03/11/2026", "noviembre de 2026"]) {
      expect(inventedFigures(`Mazar cruzaría los 2115 m ${text}.`, allowed), text).toHaveLength(1);
    }
    // ...and accepts the same forms for a date the payload does name.
    for (const text of ["el 5 de enero de 2027", "el 5 de enero", "2027-01-05", "05/01/2027", "enero de 2027"]) {
      expect(inventedFigures(`El año seco cruza los 2115 m ${text}.`, allowed), text).toEqual([]);
    }
  });

  it("rejects a year the payload never mentions, and a count it never states", () => {
    expect(inventedFigures("Como en 2009.", allowed)).toEqual(["number 2009"]);
    expect(inventedFigures("Tres de cada 7 años.", allowed)).toEqual([]);
    expect(inventedFigures("En 19 de los años.", allowed)).toEqual(["number 19"]);
  });

  it("does not round its way to a small count", () => {
    const only = { numbers: [2.6, 14.63], dates: new Set<string>(), monthDays: new Set<string>(), yearMonths: new Set<string>() };
    expect(numberAllowed(readNumber("3"), only, false)).toBe(false);
    expect(numberAllowed(readNumber("15"), only, false)).toBe(true);
    expect(numberAllowed(readNumber("2,6"), only, false)).toBe(true);
  });

  it("allows rounding to the precision written, and nothing looser", () => {
    expect(inventedFigures("unos 38 m sobre el mínimo", allowed)).toEqual([]);
    expect(inventedFigures("38,4 m sobre el mínimo", allowed)).toEqual([]);
    expect(inventedFigures("38,5 m sobre el mínimo", allowed)).toEqual(["number 38,5"]);
  });

  it("reads both meanings of a lone separator before three digits", () => {
    expect(readNumber("2.115")).toEqual([
      { value: 2115, decimals: 0 },
      { value: 2.115, decimals: 3 },
    ]);
    expect(readNumber("2.138,37")).toEqual([{ value: 2138.37, decimals: 2 }]);
    expect(readNumber("2,138.37")).toEqual([{ value: 2138.37, decimals: 2 }]);
    expect(readNumber("0,21")).toEqual([{ value: 0.21, decimals: 2 }]);
    expect(readNumber("1.2.3")).toEqual([]);
  });

  it("does not read identifiers as numbers", () => {
    expect(inventedFigures("la banda p10–p90 y la pendiente d7", allowed)).toEqual([]);
  });

  it("allows a fraction as a percentage only when it is written as one", () => {
    expect(inventedFigures("cobertura del 77 %", allowed)).toEqual([]);
    expect(inventedFigures("cobertura del 77", allowed)).toEqual(["number 77"]);
  });

  it("requires the outlook to name the risk tier it was given", () => {
    const result = validateNarrative({ ...good, outlook_es: good.outlook_es.replace("holgado", "tranquilo") }, payload);
    expect(result.problems).toEqual(['outlook_es: does not name the risk tier "holgado"']);
  });
});

describe("the no-op", () => {
  const hash = payloadHash(payload);
  const row = (status: string, generated_at: string, payload_hash = hash, prompt_version = PROMPT_VERSION): SnapshotRef => ({
    status,
    generated_at,
    payload_hash,
    prompt_version,
  });

  it("is a no-op when the last answered snapshot has the same payload and prompt", () => {
    expect(isNoOp([row("ok", "2026-09-22T12:40:00Z")], hash)).toBe(true);
    expect(isNoOp([row("rejected", "2026-09-22T12:40:00Z")], hash)).toBe(true);
  });

  it("calls again for new data, a new prompt, or when the last attempt produced nothing", () => {
    expect(isNoOp([], hash)).toBe(false);
    expect(isNoOp([row("ok", "2026-09-22T12:40:00Z", "0".repeat(64))], hash)).toBe(false);
    expect(isNoOp([row("ok", "2026-09-22T12:40:00Z", hash, "es-0")], hash)).toBe(false);
    expect(isNoOp([row("skipped", "2026-09-22T12:40:00Z")], hash)).toBe(false);
    expect(isNoOp([row("failed", "2026-09-22T12:40:00Z")], hash)).toBe(false);
  });

  it("compares against the newest answered snapshot, not the first", () => {
    const rows = [row("ok", "2026-09-22T12:40:00Z"), row("ok", "2026-09-23T12:40:00Z", "1".repeat(64))];
    expect(isNoOp(rows, hash)).toBe(false);
  });
});

describe("without a key", () => {
  it("exits 0, says so, and writes nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "hydro-look-narrative-"));
    const env: NodeJS.ProcessEnv = { ...process.env, HYDRO_LOOK_DATA_ROOT: root };
    delete env["AI_GATEWAY_API_KEY"];
    const output = execFileSync("npx", ["tsx", "scripts/narrative.ts", "--api-dir", join(root, "api")], {
      cwd: repo,
      env,
      encoding: "utf8",
    });
    expect(output).toContain("AI_GATEWAY_API_KEY is not set");
    expect(readdirSync(root)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ the call */

const USAGE = {
  inputTokens: { total: 2400, noCache: 2400, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 380, text: 380, reasoning: undefined },
};

function answering(answer: unknown, metadata?: Record<string, Record<string, string | number>>) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: USAGE,
      warnings: [],
      ...(metadata ? { providerMetadata: metadata } : {}),
    }),
  });
}

const goodAnswer = {
  outlook_es:
    "Mazar está en 2138,37 m y el pronóstico estadístico pone su mediana en 2133,28 m a 30 días. " +
    "El nivel de suficiencia es holgado: el caso p90 sigue cubierto.",
  drivers: ["La pendiente de 30 días es de -0,3313 m/día.", "El ONI de 2026-07 fue 1,8."],
  confidence: "medium",
};

describe("generateNarrative, against a mock model", () => {
  it("returns ok with tokens and the gateway's cost", async () => {
    const result = await generateNarrative(payload, {
      model: answering(goodAnswer, { gateway: { cost: "0.0213" } }),
      modelId: "mock/model",
    });
    expect(result.status).toBe("ok");
    expect(result.output).toEqual(goodAnswer);
    expect(result.usage).toEqual({ inputTokens: 2400, outputTokens: 380, costUsd: 0.0213 });

    const row = snapshotRow({ generatedAt: "2026-09-22T12:40:05Z", result, payload, payloadHash: payloadHash(payload) });
    expect(narrativeSnapshotRow.safeParse(row).success).toBe(true);
    expect(row).toMatchObject({
      status: "ok",
      model_id: "mock/model",
      risk_tier: "holgado",
      forecast_run_id: "2026-09-21-mazar-1-1c43d784",
      cost_usd: 0.0213,
      drivers_json: JSON.stringify(goodAnswer.drivers),
    });
    expect(row.run_id).toMatch(/^2026-09-21-narrative-es-1-[0-9a-f]{8}-124005$/);
  });

  it("tolerates a gateway that reports no cost", async () => {
    const result = await generateNarrative(payload, { model: answering(goodAnswer) });
    expect(result.status).toBe("ok");
    expect(result.usage.costUsd).toBeNull();
    expect(costFromMetadata({ gateway: {} })).toBeNull();
    expect(costFromMetadata({ gateway: { cost: 0.5 } })).toBe(0.5);
    expect(costFromMetadata(undefined)).toBeNull();
  });

  it("rejects an answer that invents a level, and keeps what it cost", async () => {
    const invented = { ...goodAnswer, outlook_es: `${goodAnswer.outlook_es} Bajará a 2.110 m el 3 de noviembre.` };
    const result = await generateNarrative(payload, { model: answering(invented, { gateway: { cost: 0.02 } }) });
    expect(result.status).toBe("rejected");
    expect(result.reasons).toEqual(['outlook_es: date "3 de noviembre"', "outlook_es: number 2.110"]);
    expect(result.usage.costUsd).toBe(0.02);
    const row = snapshotRow({ generatedAt: "2026-09-22T12:40:05Z", result, payload, payloadHash: payloadHash(payload) });
    expect(narrativeSnapshotRow.safeParse(row).success).toBe(true);
    expect(row.outlook_es).toContain("2.110");
  });

  it("rejects an answer the schema refuses", async () => {
    const result = await generateNarrative(payload, { model: answering({ ...goodAnswer, confidence: "certain" }) });
    expect(result.status).toBe("rejected");
    expect(result.reasons[0]).toMatch(/^schema:/);
  });

  const rateLimited = () =>
    new APICallError({ message: "rate limited", url: "https://gateway", requestBodyValues: {}, statusCode: 429, isRetryable: true });

  it("retries once after a 429, then succeeds", async () => {
    let calls = 0;
    const waits: number[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls++;
        if (calls === 1) throw rateLimited();
        return { content: [{ type: "text", text: JSON.stringify(goodAnswer) }], finishReason: { unified: "stop", raw: undefined }, usage: USAGE, warnings: [] };
      },
    });
    const result = await generateNarrative(payload, { model, retryDelayMs: 1234, sleep: async (ms) => void waits.push(ms) });
    expect(result.status).toBe("ok");
    expect(calls).toBe(2);
    expect(waits).toEqual([1234]);
  });

  it("marks the attempt skipped after a second 429", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls++;
        throw rateLimited();
      },
    });
    const result = await generateNarrative(payload, { model, sleep: async () => {} });
    expect(result.status).toBe("skipped");
    expect(calls).toBe(2);
    const row = snapshotRow({ generatedAt: "2026-09-22T12:40:05Z", result, payload, payloadHash: payloadHash(payload) });
    expect(narrativeSnapshotRow.safeParse(row).success).toBe(true);
    expect(row).toMatchObject({ status: "skipped", input_tokens: null, cost_usd: null, outlook_es: "" });
  });

  it("stages once and applies through the CLI, and the committed row makes a rerun a no-op", async () => {
    const result = await generateNarrative(payload, { model: answering(goodAnswer, { gateway: { cost: 0.0213 } }) });
    const hash = payloadHash(payload);
    const generatedAt = "2026-09-22T12:40:05Z";
    const root = mkdtempSync(join(tmpdir(), "hydro-look-narrative-apply-"));
    const stage = join(root, "stage");
    mkdirSync(stage);
    writeFileSync(join(stage, "snapshot.json"), JSON.stringify(snapshotRow({ generatedAt, result, payload, payloadHash: hash })));
    writeFileSync(
      join(stage, "narrative.json"),
      JSON.stringify(narrativeDocument({ generatedAt, result: { ...result, output: result.output! }, payload, payloadHash: hash })),
    );

    execFileSync("npx", ["tsx", "scripts/narrative.ts", "apply", "--in", stage, "--api-dir", join(root, "api")], {
      cwd: repo,
      env: { ...process.env, HYDRO_LOOK_DATA_ROOT: root },
      encoding: "utf8",
    });

    const rows = parseCsv(readFileSync(join(root, "curated", "narrative_snapshots", "2026.csv"), "utf8"));
    expect(rows).toHaveLength(1);
    // The outlook has commas and accents; it has to survive the CSV round trip intact.
    expect(rows[0]!["outlook_es"]).toBe(goodAnswer.outlook_es);
    expect(JSON.parse(rows[0]!["drivers_json"]!)).toEqual(goodAnswer.drivers);
    expect(rows[0]!["cost_usd"]).toBe("0.0213");
    expect(existsSync(join(root, "api", "narrative.json"))).toBe(true);
    expect(isNoOp(rows as unknown as SnapshotRef[], hash)).toBe(true);
  });

  it("fails, without retrying, on any other error", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls++;
        throw new APICallError({ message: "no such model", url: "https://gateway", requestBodyValues: {}, statusCode: 404 });
      },
    });
    const result = await generateNarrative(payload, { model, sleep: async () => {} });
    expect(result.status).toBe("failed");
    expect(calls).toBe(1);
  });
});
