/**
 * One call to a language model through the Vercel AI Gateway, and everything that decides
 * whether its answer is published.
 *
 * The call is the least interesting part. What matters is the four ways out of it, because
 * each leaves the site in a different state and the snapshot row has to say which:
 *
 * - `ok` — the answer parsed against the schema *and* passed `validateNarrative`. It becomes
 *   `narrative.json`.
 * - `rejected` — the model answered and the answer named a number or date the payload does not
 *   contain, or did not name the risk tier, or did not parse. It was paid for, so the row keeps
 *   the tokens, the cost and the text (that is how an invented figure gets looked at later),
 *   and `narrative.json` is left as it was.
 * - `skipped` — rate-limited twice (429, the free tier's per-model limit). Nothing was produced
 *   and, as far as the gateway's billing goes, nothing was spent. The site keeps the previous
 *   narrative and shows its date.
 * - `failed` — any other error: a bad key, an unknown model id, a 5xx. Recorded, and the script
 *   exits non-zero so the step is visibly red, while `continue-on-error` in the workflow keeps it
 *   from touching an ingest that has already landed.
 *
 * The AI SDK's own retries are turned off (`maxRetries: 0`) so that "retry once after a short
 * wait" is the policy stated here and not three retries with backoff stated somewhere else.
 */

import { generateText, NoObjectGeneratedError, Output, RetryError, type LanguageModel } from "ai";
import { z } from "zod";
import { INSTRUCTIONS, buildPrompt, PROMPT_VERSION } from "./prompt.ts";
import { validateNarrative } from "./validate.ts";
import type { NarrativePayload } from "./payload.ts";
import type { NarrativeSnapshotRow } from "../contracts/tables.ts";

/**
 * The model, as a gateway slug. Switching provider or model is a change to this string and
 * nothing else — that is the gateway's point.
 *
 * MiMo v2.6 Flash since 2026-09-23, because the gateway refuses `anthropic/claude-opus-5` to a
 * free-tier account ("Free tier users do not have access to this model", run 35808200400). With
 * paid gateway credits, `anthropic/claude-opus-5` is the model this module was written against.
 *
 * The `<provider>/<model>` slug format is Vercel's: verify it on the Vercel AI Gateway model
 * list (https://vercel.com/ai-gateway/models) before relying on it. A wrong slug fails the first
 * live run as `failed` with a model-not-found error; it cannot be checked from a sandbox that
 * has no route to the gateway.
 */
export const NARRATIVE_MODEL = "xiaomi/mimo-v2.6-flash";

/** How long to wait before the one retry after a 429. */
export const RATE_LIMIT_RETRY_MS = 20_000;

/** Enough for 220 words of Spanish plus five drivers with room to spare, and a cap on spend. */
export const MAX_OUTPUT_TOKENS = 2_000;

/** Decision 8's contract, as in PLAN.md §6 Phase 6b. */
export const narrativeSchema = z.object({
  outlook_es: z.string().min(1),
  drivers: z.array(z.string().min(1)).min(1).max(6),
  confidence: z.enum(["low", "medium", "high"]),
});
export type NarrativeOutput = z.infer<typeof narrativeSchema>;

export type NarrativeStatus = "ok" | "skipped" | "rejected" | "failed";

export interface CallUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  /** From `providerMetadata.gateway.cost`, in USD. Null when the gateway did not report it. */
  costUsd: number | null;
}

export interface GenerateResult {
  status: NarrativeStatus;
  modelId: string;
  output: NarrativeOutput | null;
  usage: CallUsage;
  /** Why it was not `ok`: the invented figures, the error, or the rate limit. Empty when ok. */
  reasons: string[];
}

export interface GenerateOptions {
  /** A model instance, for tests; defaults to the gateway slug above. */
  model?: LanguageModel;
  modelId?: string;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const NO_USAGE: CallUsage = { inputTokens: null, outputTokens: null, costUsd: null };

/**
 * The gateway reports what a call cost in `providerMetadata.gateway.cost`, as a number or a
 * decimal string depending on the response path. Anything else — absent, empty, not a number
 * — is null, never zero: a call whose cost is unknown did not cost nothing.
 */
export function costFromMetadata(metadata: unknown): number | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const gateway = (metadata as Record<string, unknown>)["gateway"];
  if (typeof gateway !== "object" || gateway === null) return null;
  const raw = (gateway as Record<string, unknown>)["cost"];
  if (raw === null || raw === undefined || raw === "") return null;
  const cost = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(cost) && cost >= 0 ? cost : null;
}

/**
 * A 429 from anywhere in the chain. The gateway raises its own `GatewayRateLimitError`, a
 * provider raises `APICallError`, and a wrapped retry raises `RetryError` around either; all of
 * them carry a numeric `statusCode`, which is the one thing checked, so this does not need to
 * import the gateway package directly.
 */
export function isRateLimited(error: unknown): boolean {
  if (RetryError.isInstance(error)) return isRateLimited(error.lastError);
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { statusCode?: unknown }).statusCode;
  if (status === 429) return true;
  return (error as { type?: unknown }).type === "rate_limit_exceeded";
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 300);
  return String(error).slice(0, 300);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callOnce(payload: NarrativePayload, model: LanguageModel) {
  return generateText({
    model,
    instructions: INSTRUCTIONS,
    prompt: buildPrompt(payload),
    output: Output.object({ schema: narrativeSchema }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // The model interprets a small payload; it does not need to think at length to do it, and
    // thinking is billed as output.
    reasoning: "low",
    maxRetries: 0,
  });
}

export async function generateNarrative(payload: NarrativePayload, options: GenerateOptions = {}): Promise<GenerateResult> {
  const model = options.model ?? NARRATIVE_MODEL;
  const modelId = options.modelId ?? (typeof model === "string" ? model : NARRATIVE_MODEL);
  const sleep = options.sleep ?? defaultSleep;
  const retryDelay = options.retryDelayMs ?? RATE_LIMIT_RETRY_MS;

  let result: Awaited<ReturnType<typeof callOnce>> | null = null;
  for (let attempt = 1; attempt <= 2 && result === null; attempt++) {
    try {
      result = await callOnce(payload, model);
    } catch (error) {
      if (isRateLimited(error)) {
        if (attempt === 1) {
          await sleep(retryDelay);
          continue;
        }
        return { status: "skipped", modelId, output: null, usage: NO_USAGE, reasons: [`rate limited twice: ${describe(error)}`] };
      }
      if (NoObjectGeneratedError.isInstance(error)) {
        // The model answered, in a shape the schema refused. Paid for, so it is a rejection
        // and not a failure, and the tokens are kept.
        return {
          status: "rejected",
          modelId,
          output: null,
          usage: {
            inputTokens: error.usage?.inputTokens ?? null,
            outputTokens: error.usage?.outputTokens ?? null,
            costUsd: null,
          },
          // The raw answer is the only way to tell a truncated reply from fenced JSON or prose,
          // and the row is the only place it survives the run.
          reasons: [
            `schema: ${describe(error)}`,
            `finish: ${error.finishReason ?? "unknown"}`,
            `raw: ${(error.text ?? "").slice(0, 2_000)}`,
          ],
        };
      }
      return { status: "failed", modelId, output: null, usage: NO_USAGE, reasons: [describe(error)] };
    }
  }
  if (result === null) return { status: "failed", modelId, output: null, usage: NO_USAGE, reasons: ["no result"] };

  const usage: CallUsage = {
    inputTokens: result.totalUsage?.inputTokens ?? result.usage.inputTokens ?? null,
    outputTokens: result.totalUsage?.outputTokens ?? result.usage.outputTokens ?? null,
    costUsd: costFromMetadata(result.providerMetadata),
  };
  const output = result.output;
  const verdict = validateNarrative(output, payload);
  return {
    status: verdict.ok ? "ok" : "rejected",
    modelId,
    output,
    usage,
    reasons: verdict.problems,
  };
}

/* ------------------------------------------------------------- snapshots */

export interface SnapshotRef {
  generated_at: string;
  status: string;
  prompt_version: string;
  payload_hash: string;
}

/**
 * The snapshot a rerun is compared against: the newest one that consumed a model answer.
 *
 * `skipped` and `failed` rows are passed over, because nothing was produced and nothing (as far
 * as billing goes) was spent, so trying again is the point. `rejected` rows count: the same
 * payload under the same prompt was paid for once and refused once, and asking again twice a
 * day until the model happens to comply is how a free credit disappears. New data or a new
 * `PROMPT_VERSION` is what earns another call.
 */
export function lastAnswered<T extends SnapshotRef>(rows: readonly T[]): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.status !== "ok" && row.status !== "rejected") continue;
    if (best === null || row.generated_at > best.generated_at) best = row;
  }
  return best;
}

export function isNoOp(rows: readonly SnapshotRef[], payloadHash: string, promptVersion = PROMPT_VERSION): boolean {
  const last = lastAnswered(rows);
  return last !== null && last.payload_hash === payloadHash && last.prompt_version === promptVersion;
}

/** `2026-09-21-narrative-es-1-1a2b3c4d-121503`: origin, prompt, payload, and the attempt's time. */
export function narrativeRunId(origin: string, promptVersion: string, payloadHash: string, generatedAt: string): string {
  return `${origin}-narrative-${promptVersion}-${payloadHash.slice(0, 8)}-${generatedAt.slice(11, 19).replaceAll(":", "")}`;
}

/** The `narrative_snapshots` row for one attempt. Validated by the table contract on upsert. */
export function snapshotRow(input: {
  generatedAt: string;
  result: GenerateResult;
  payload: NarrativePayload;
  payloadHash: string;
}): NarrativeSnapshotRow {
  const { result, payload } = input;
  return {
    run_id: narrativeRunId(payload.origin_date, PROMPT_VERSION, input.payloadHash, input.generatedAt),
    generated_at: input.generatedAt,
    origin_date: payload.origin_date,
    status: result.status,
    model_id: result.modelId,
    prompt_version: PROMPT_VERSION,
    payload_hash: input.payloadHash,
    forecast_run_id: payload.mazar_forecast?.run_id ?? "",
    adequacy_run_id: payload.adequacy?.run_id ?? "",
    risk_tier: (payload.adequacy?.risk_tier ?? "") as NarrativeSnapshotRow["risk_tier"],
    confidence: result.output?.confidence ?? "",
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    cost_usd: result.usage.costUsd,
    outlook_es: result.output?.outlook_es ?? "",
    drivers_json: result.output ? JSON.stringify(result.output.drivers) : "",
    reason: result.reasons.join("; ").slice(0, 2000),
  };
}

export const NARRATIVE_DISCLAIMER_ES =
  "Texto redactado por un modelo de lenguaje a partir de los números que lo acompañan. No es un pronóstico: " +
  "el pronóstico es el estadístico de la sección de Mazar, y el nivel de riesgo lo calcula el modelo de " +
  "suficiencia, no el de lenguaje.";

export interface NarrativeDocument {
  generated_at: string;
  status: "ok";
  model: string;
  prompt_version: string;
  payload_hash: string;
  origin_date: string;
  risk_tier: string | null;
  outlook_es: string;
  drivers: string[];
  confidence: NarrativeOutput["confidence"];
  usage: { input_tokens: number | null; output_tokens: number | null; cost_usd: number | null };
  disclaimer: string;
  /** The payload the text was written from, verbatim, so the page can show it beside the text. */
  basis: NarrativePayload;
}

export function narrativeDocument(input: {
  generatedAt: string;
  result: GenerateResult & { output: NarrativeOutput };
  payload: NarrativePayload;
  payloadHash: string;
}): NarrativeDocument {
  const { result, payload } = input;
  return {
    generated_at: input.generatedAt,
    status: "ok",
    model: result.modelId,
    prompt_version: PROMPT_VERSION,
    payload_hash: input.payloadHash,
    origin_date: payload.origin_date,
    risk_tier: payload.adequacy?.risk_tier ?? null,
    outlook_es: result.output.outlook_es,
    drivers: result.output.drivers,
    confidence: result.output.confidence,
    usage: { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, cost_usd: result.usage.costUsd },
    disclaimer: NARRATIVE_DISCLAIMER_ES,
    basis: payload,
  };
}
