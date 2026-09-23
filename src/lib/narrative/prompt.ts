/**
 * The prompt, versioned.
 *
 * `PROMPT_VERSION` is part of what makes a rerun a no-op: the snapshot table records it beside
 * the payload hash, and a changed prompt over unchanged data is a new narrative, not a repeat.
 * Bump it with every edit to the text below, however small, because the only record of which
 * words produced a committed narrative is this string in the row.
 *
 * The instructions are the prose form of the checks `validate.ts` enforces. They are written
 * so a model that follows them passes, and the validator is there for when it does not: a
 * prompt asks, a validator refuses.
 */

import { canonicalJson, type NarrativePayload } from "./payload.ts";

export const PROMPT_VERSION = "es-2";

export const INSTRUCTIONS = [
  "You write the short outlook paragraph for a public, unofficial website about Ecuador's hydroelectric reservoirs.",
  "Write in Spanish as used in Ecuador: outlook_es and every entry of drivers are Spanish; only the confidence",
  "value stays in English. Plain prose, no markdown, no headings, no lists inside the text.",
  "",
  "You interpret numbers that were computed in code. You never forecast.",
  "- Every number and every date you write must appear in the payload. Copy it as written there;",
  "  you may round it to fewer decimals and write it with a decimal comma. Do not add, subtract,",
  "  average, convert or otherwise compute a new number, and do not state a count the payload does not state.",
  "- Do not mention any date, year or month that is not in the payload.",
  "- The only forecast is `mazar_forecast`, a statistical model. Describe what it says; do not extend it",
  "  to other horizons, other reservoirs or other thresholds.",
  "- The risk tier is `adequacy.risk_tier`. It is an input, not your judgement: name it exactly as given",
  "  and explain what drives it. Never propose a different tier or a risk level of your own.",
  "- `days_at_slope_*` is a division (distance / current slope), not a prediction; say so if you use it.",
  "- 2115 m is this project's own marker (`status: unverified`), not a CELEC declaration. If you mention it, say so.",
  "- Precipitation comes from one provisional sampling point, not a basin average. If you mention it, say so.",
  "- If `stale_feeds` is not empty, say which data is out of date.",
  "",
  "Output fields:",
  "- outlook_es: 120 to 220 words. Lead with where Mazar stands and where the statistical forecast puts it,",
  "  then the national adequacy tier and what supports it, then the weather and ENSO context.",
  "- drivers: 3 to 5 short sentences, one per factor, each grounded in a named field of the payload.",
  "- confidence: low, medium or high. It is how well the indicators agree with each other and with the",
  "  forecast's own measured skill (`skill_vs_persistence`, `coverage_p10_p90`), not how sure you feel.",
  "",
  "Answer with one JSON object and nothing else: no code fences, no text before or after it, exactly these keys:",
  '{"outlook_es": "...", "drivers": ["...", "..."], "confidence": "low" | "medium" | "high"}',
].join("\n");

export function buildPrompt(payload: NarrativePayload): string {
  return [
    "Payload (JSON). It is the complete set of facts available to you.",
    "",
    canonicalJson(payload),
  ].join("\n");
}
