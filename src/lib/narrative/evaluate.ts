/**
 * §5.6's offline evaluation: how every committed answer fares under today's validator, what it
 * cost and how long it was — and, with the model call injected, the same table for any model and
 * prompt replayed over the committed payloads.
 *
 * The point is a table that can justify a cheaper model than the one on the gateway, or confirm
 * the cost is right, without paying to find out twice. The recorded half needs no network: every
 * `narrative_snapshots` row keeps its text, tokens and cost, and every committed payload (the
 * `basis` of `narrative.json`, and the one today's code builds from the committed tables) can be
 * found again by its hash. The replayed half takes the call as a function, so a test drives it with
 * a mock and a person with a gateway key drives it with `generateNarrative`.
 *
 * Revalidating an old answer under today's rules is deliberate: a text that passed under prompt
 * es-3 and fails the word-count rule es-5 added is exactly what this table should show.
 */

import { payloadHash, estimateTokens, canonicalJson, type NarrativePayload } from "./payload.ts";
import { countWords, validateNarrative } from "./validate.ts";
import type { StructuredDriver } from "./drivers.ts";
import type { GenerateResult } from "./generate.ts";
import { instructionsFor } from "./prompt.ts";

export interface EvalRow {
  source: "recorded" | "replayed";
  runId: string;
  modelId: string;
  promptVersion: string;
  payloadHash: string;
  /** What the pipeline decided at the time; for a replay, what `generateNarrative` returned. */
  status: string;
  /** Today's validator on the text; null when there is no text or no payload to check it against. */
  validatorOk: boolean | null;
  problems: string[];
  words: number | null;
  drivers: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

const num = (raw: string | undefined): number | null => {
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

function parseDrivers(raw: string): (string | StructuredDriver)[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as (string | StructuredDriver)[]) : null;
  } catch {
    return null;
  }
}

/** Every committed answer, revalidated against its payload wherever that payload is still to hand. */
export function evaluateRecorded(snapshots: readonly Record<string, string>[], payloads: ReadonlyMap<string, NarrativePayload>): EvalRow[] {
  return snapshots.map((row) => {
    const text = row["outlook_es"] ?? "";
    const drivers = parseDrivers(row["drivers_json"] ?? "");
    const payload = payloads.get(row["payload_hash"] ?? "");
    const verdict = text && drivers && payload ? validateNarrative({ outlook_es: text, drivers }, payload) : null;
    return {
      source: "recorded",
      runId: row["run_id"] ?? "",
      modelId: row["model_id"] ?? "",
      promptVersion: row["prompt_version"] ?? "",
      payloadHash: row["payload_hash"] ?? "",
      status: row["status"] ?? "",
      validatorOk: verdict ? verdict.ok : null,
      problems: verdict?.problems ?? [],
      words: text ? countWords(text) : null,
      drivers: drivers ? drivers.length : null,
      inputTokens: num(row["input_tokens"]),
      outputTokens: num(row["output_tokens"]),
      costUsd: num(row["cost_usd"]),
    };
  });
}

export type ModelCall = (payload: NarrativePayload, modelId: string) => Promise<GenerateResult>;

/** Every payload through every model, with the call injected. Sequential: the gateway rate-limits. */
export async function replay(payloads: readonly NarrativePayload[], models: readonly string[], call: ModelCall, promptVersion: (p: NarrativePayload) => string): Promise<EvalRow[]> {
  const out: EvalRow[] = [];
  for (const payload of payloads) {
    for (const modelId of models) {
      const result = await call(payload, modelId);
      const text = result.output?.outlook_es ?? "";
      out.push({
        source: "replayed",
        runId: `${payload.origin_date}-${modelId}`,
        modelId,
        promptVersion: promptVersion(payload),
        payloadHash: payloadHash(payload),
        status: result.status,
        validatorOk: result.output ? result.status === "ok" : null,
        problems: result.reasons,
        words: text ? countWords(text) : null,
        drivers: result.output ? result.output.drivers.length : null,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
      });
    }
  }
  return out;
}

export interface EvalSummary {
  source: EvalRow["source"];
  modelId: string;
  promptVersion: string;
  attempts: number;
  answered: number;
  okAtTheTime: number;
  passNow: number;
  checked: number;
  meanWords: number | null;
  meanCostUsd: number | null;
  meanInputTokens: number | null;
  totalCostUsd: number;
}

const avg = (values: (number | null)[]): number | null => {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0) / known.length;
};

export function summariseEval(rows: readonly EvalRow[]): EvalSummary[] {
  const groups = new Map<string, EvalRow[]>();
  for (const row of rows) {
    const key = `${row.source}\u0000${row.modelId}\u0000${row.promptVersion}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }
  return [...groups.values()].map((list) => ({
    source: list[0]!.source,
    modelId: list[0]!.modelId,
    promptVersion: list[0]!.promptVersion,
    attempts: list.length,
    answered: list.filter((r) => r.words !== null).length,
    okAtTheTime: list.filter((r) => r.status === "ok").length,
    passNow: list.filter((r) => r.validatorOk === true).length,
    checked: list.filter((r) => r.validatorOk !== null).length,
    meanWords: avg(list.map((r) => r.words)),
    meanCostUsd: avg(list.map((r) => r.costUsd)),
    meanInputTokens: avg(list.map((r) => r.inputTokens)),
    totalCostUsd: list.reduce((a, r) => a + (r.costUsd ?? 0), 0),
  }));
}

export interface PayloadSize {
  label: string;
  payloadVersion: number;
  hash: string;
  characters: number;
  estimatedTokens: number;
}

export function payloadSize(label: string, payload: NarrativePayload): PayloadSize {
  return {
    label,
    payloadVersion: payload.payload_version,
    hash: payloadHash(payload),
    characters: canonicalJson(payload).length,
    estimatedTokens: estimateTokens(payload),
  };
}

const f = (v: number | null, digits: number) => (v === null ? "—" : v.toFixed(digits));

export function renderNarrativeReport(input: {
  generatedAt: string;
  rows: readonly EvalRow[];
  sizes: readonly PayloadSize[];
  replayed: boolean;
}): string {
  const summary = summariseEval(input.rows);
  const lines: string[] = [];
  lines.push("# Narrative — offline evaluation");
  lines.push("");
  lines.push(
    `Generated ${input.generatedAt} by \`npm run narrative:eval\` from the committed snapshots and payloads; ` +
      (input.replayed ? "including a replay through the gateway." : "no network. Replaying through the gateway is `npm run narrative:eval -- --replay --models <slug,slug>` with a key."),
  );
  lines.push("");
  lines.push(
    "Every committed answer is revalidated against its own payload under **today's** validator, which since prompt es-5 also " +
      "enforces 120–220 words, 3–5 drivers and, for structured drivers, that each driver's payload number exists, sits in the " +
      "block its factor names and lies on the side of its reference the direction claims. 'OK then' is what the pipeline " +
      "decided at the time; 'passes now' is the same text under the rules a new answer faces.",
  );
  lines.push("");
  lines.push("| Source | Model | Prompt | Attempts | Answered | OK then | Passes now (checked) | Mean words | Mean input tokens | Mean cost USD | Total USD |");
  lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const s of summary) {
    lines.push(
      `| ${s.source} | \`${s.modelId}\` | ${s.promptVersion} | ${s.attempts} | ${s.answered} | ${s.okAtTheTime} | ${s.passNow} (${s.checked}) | ` +
        `${f(s.meanWords, 0)} | ${f(s.meanInputTokens, 0)} | ${f(s.meanCostUsd, 4)} | ${s.totalCostUsd.toFixed(4)} |`,
    );
  }
  lines.push("");
  lines.push("## Why each answer fails today's rules");
  lines.push("");
  const failing = input.rows.filter((r) => r.validatorOk === false);
  if (failing.length === 0) lines.push("None.");
  for (const r of failing) lines.push(`- \`${r.runId}\` (${r.modelId}, ${r.promptVersion}): ${r.problems.slice(0, 6).join("; ")}`);
  lines.push("");
  lines.push("## The payload, before and after the trim");
  lines.push("");
  lines.push("| Payload | Version | Hash | Characters | ≈ tokens |");
  lines.push("|---|---:|---|---:|---:|");
  for (const s of input.sizes) lines.push(`| ${s.label} | ${s.payloadVersion} | \`${s.hash.slice(0, 12)}\` | ${s.characters} | ${s.estimatedTokens} |`);
  lines.push("");
  lines.push(
    `The instructions add about ${Math.ceil(instructionsFor(null).length / 4)} tokens. At two calls a day, caching the fixed ` +
      "part would save cents a month and add a moving part; it is not done. Tokens here are estimated at four characters " +
      "each; the gateway's own count is what the snapshot rows record.",
  );
  lines.push("");
  lines.push(
    "What would justify a cheaper model: a replay row with the same pass rate over these payloads at a lower mean cost. " +
      "The one cheaper model tried so far (`xiaomi/mimo-v2.6-flash`, free tier) is in the table: it answered and was rejected every time.",
  );
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
}
