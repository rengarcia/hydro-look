/**
 * §5.6: the trimmed payload, structured drivers in narrative.json, the tier the text was given,
 * the prompt version that follows the rain basin, and the offline evaluation harness — the model
 * call injected, never the network.
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { buildPayload, loadPayloadInputs, payloadHash, type NarrativePayload } from "../src/lib/narrative/payload.ts";
import { generateNarrative, narrativeDocument } from "../src/lib/narrative/generate.ts";
import { instructionsFor, PROMPT_VERSION, promptVersionFor } from "../src/lib/narrative/prompt.ts";
import { evaluateRecorded, payloadSize, renderNarrativeReport, replay, summariseEval } from "../src/lib/narrative/evaluate.ts";
import { FIXTURES } from "./helpers.ts";

const DAY = join(FIXTURES, "narrative", "2026-09-21");

function fixturePayload(): NarrativePayload {
  const inputs = loadPayloadInputs({ curated: join(DAY, "curated"), api: join(DAY, "api"), basins: join(DAY, "basins.csv") });
  if (inputs === null) throw new Error("fixture has no latest.json");
  return buildPayload(inputs);
}

const payload = fixturePayload();
const MAZAR = payload.reservoirs.findIndex((r) => r.site === "mazar");
const PAD = " El texto describe la situación general de los embalses sin añadir cifras nuevas.".repeat(9);

const DRIVERS = [
  {
    text: "La pendiente de 30 días es de -0,3313 m/día.",
    factor: "mazar_level",
    direction: "down",
    payload_ref: `reservoirs[${MAZAR}].slopes_m_per_day.d30`,
  },
  {
    text: "Cobertura de la banda: 74 % a 7 días.",
    factor: "mazar_forecast",
    direction: "steady",
    payload_ref: "mazar_forecast.horizons[0].coverage_p10_p90",
  },
  { text: "El ONI de 2026-07 fue 1,8.", factor: "enso", direction: "up", payload_ref: "enso.oni" },
] as const;

const answer = {
  outlook_es:
    "Mazar está en 2138,37 m y el pronóstico estadístico pone su mediana en 2133,28 m a 30 días. " +
    "El nivel de suficiencia es holgado: el caso p90 sigue cubierto." +
    PAD,
  drivers: [...DRIVERS],
  confidence: "medium" as const,
};

function answering(cost: number) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1700, noCache: 1700, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 400, text: 400, reasoning: undefined },
      },
      warnings: [],
      providerMetadata: { gateway: { cost } },
    }),
  });
}

describe("the trimmed payload (PAYLOAD_VERSION 2)", () => {
  it("keeps Mazar whole and every other reservoir to what the text may say about it", () => {
    const others = payload.reservoirs.filter((r) => r.site !== "mazar");
    expect(others.length).toBeGreaterThan(0);
    for (const r of others) {
      expect(Object.keys(r).sort()).toEqual(["floors", "inflow", "label", "level_masl", "observed_on", "site", "slopes_m_per_day"]);
      expect(r.floors.length).toBeLessThanOrEqual(1);
    }
    expect(payload.reservoirs[MAZAR]!.bands!.length).toBeGreaterThan(0);
    expect(payload.payload_version).toBe(2);
  });
});

describe("narrative.json", () => {
  it("says which tier the text was given and from where, and carries the structured drivers beside the sentences", async () => {
    const result = await generateNarrative(payload, { model: answering(0.02), modelId: "mock/model" });
    expect(result.status).toBe("ok");
    const document = narrativeDocument({
      generatedAt: "2026-09-22T12:40:05Z",
      result: { ...result, output: result.output! },
      payload,
      payloadHash: payloadHash(payload),
    });
    expect(document.risk_tier_given).toMatchObject({ tier: "holgado", horizon_days: 60, tier_at_7d: "holgado" });
    expect(document.drivers).toEqual(DRIVERS.map((d) => d.text));
    expect(document.drivers_structured).toEqual(DRIVERS);
    expect(document.prompt_version).toBe(PROMPT_VERSION);
  });

  it("is refused by the schema below 120 words or with fewer than three drivers", async () => {
    const short = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: JSON.stringify({ ...answer, outlook_es: "Mazar está en 2138,37 m; nivel holgado." }) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    const result = await generateNarrative(payload, { model: short });
    expect(result.status).toBe("rejected");
    expect(result.reasons[0]).toMatch(/^schema:/);
  });
});

describe("the prompt version follows the rain basin (§1.1)", () => {
  it("writes the rain line, and the version, for the basin the rain came from", () => {
    const verified = {
      ...payload,
      precipitation_16d: { ...payload.precipitation_16d!, basin: "paute_mazar", coordinate_status: "verified" },
    };
    expect(promptVersionFor(payload)).toBe(PROMPT_VERSION);
    expect(promptVersionFor(verified)).toBe(`${PROMPT_VERSION}+paute_mazar`);
    expect(instructionsFor(payload)).toContain("provisional sampling point");
    expect(instructionsFor(verified)).toContain("verified centroid");
  });
});

describe("the offline evaluation", () => {
  const hash = payloadHash(payload);
  const recorded = (outlook: string, drivers: unknown[], payloadHashValue = hash) => ({
    run_id: "r",
    status: "ok",
    model_id: "a/model",
    prompt_version: "es-5",
    payload_hash: payloadHashValue,
    outlook_es: outlook,
    drivers_json: JSON.stringify(drivers),
    input_tokens: "2000",
    output_tokens: "500",
    cost_usd: "0.03",
  });

  it("revalidates each committed answer under today's rules, against its own payload", () => {
    const rows = evaluateRecorded(
      [
        recorded(answer.outlook_es, [...DRIVERS]),
        recorded("Muy corto, nivel holgado.", ["uno"]),
        recorded(answer.outlook_es, [...DRIVERS], "0".repeat(64)),
      ],
      new Map([[hash, payload]]),
    );
    expect(rows.map((r) => r.validatorOk)).toEqual([true, false, null]);
    const [summary] = summariseEval(rows);
    expect(summary).toMatchObject({ attempts: 3, okAtTheTime: 3, passNow: 1, checked: 2 });
    expect(summary!.totalCostUsd).toBeCloseTo(0.09, 9);
  });

  it("replays payloads through an injected model call and reports cost and pass rate", async () => {
    const calls: string[] = [];
    const rows = await replay(
      [payload],
      ["cheap/model", "dear/model"],
      async (p, modelId) => {
        calls.push(modelId);
        return generateNarrative(p, { model: answering(modelId === "cheap/model" ? 0.001 : 0.04), modelId });
      },
      promptVersionFor,
    );
    expect(calls).toEqual(["cheap/model", "dear/model"]);
    expect(rows.every((r) => r.status === "ok" && r.validatorOk)).toBe(true);
    expect(rows.map((r) => r.costUsd)).toEqual([0.001, 0.04]);
    const report = renderNarrativeReport({
      generatedAt: "2026-09-23T00:00:00Z",
      rows,
      sizes: [payloadSize("fixture", payload)],
      replayed: true,
    });
    expect(report).toContain("`cheap/model`");
  });
});
