/**
 * The prompt, versioned.
 *
 * `PROMPT_VERSION` is part of what makes a rerun a no-op: the snapshot table records it beside
 * the payload hash, and a changed prompt over unchanged data is a new narrative, not a repeat.
 * Bump it with every edit to the text below, however small, because the only record of which
 * words produced a committed narrative is this string in the row.
 *
 * One line of the text depends on the data: where the rain comes from. While it is the
 * provisional Paute point the prompt says so; once §1.1's verified Mazar centroid has an
 * adequate ERA5 history the line names the centroid instead. That is a different prompt, so it
 * is a different version — `promptVersionFor` appends the basin — and the snapshot row records
 * which words the text was written under without anyone having to edit this file on the day.
 *
 * The instructions are the prose form of the checks `validate.ts` enforces. They are written
 * so a model that follows them passes, and the validator is there for when it does not: a
 * prompt asks, a validator refuses.
 *
 * es-5: structured drivers ({text, factor, direction, payload_ref}), 120–220 words and 3–5
 * drivers enforced by the schema, the trimmed payload (PAYLOAD_VERSION 2), and the rain line.
 */

import { canonicalJson, type NarrativePayload } from "./payload.ts";
import { DRIVER_DIRECTIONS, DRIVER_FACTORS } from "./drivers.ts";

export const PROMPT_VERSION = "es-5";

const PROVISIONAL_RAIN = "- Precipitation comes from one provisional sampling point, not a basin average. If you mention it, say so.";
const CENTROID_RAIN =
  "- Precipitation comes from one grid point at the verified centroid of the catchment above Mazar, not a basin average. If you mention it, say so.";

function verifiedRain(payload: NarrativePayload | null): boolean {
  return payload?.precipitation_16d?.coordinate_status === "verified";
}

/** The version the text for this payload is written under: `es-5`, or `es-5+<basin>` on a verified centroid. */
export function promptVersionFor(payload: NarrativePayload | null): string {
  return verifiedRain(payload) ? `${PROMPT_VERSION}+${payload!.precipitation_16d!.basin}` : PROMPT_VERSION;
}

export function instructionsFor(payload: NarrativePayload | null): string {
  return [
    "You write the short outlook paragraph for a public, unofficial website about Ecuador's hydroelectric reservoirs.",
    "Write in Spanish as used in Ecuador: outlook_es and the text of every driver are Spanish; only the confidence,",
    "factor and direction values stay in English. Plain prose, no markdown, no headings, no lists inside the text.",
    "",
    "You interpret numbers that were computed in code. You never forecast.",
    "- Every number and every date you write must appear in the payload. Copy it as written there;",
    "  you may round it to fewer decimals and write it with a decimal comma. Do not add, subtract,",
    "  average, convert or otherwise compute a new number, and do not state a count the payload does not state.",
    "- Write dates the Spanish way (21 de septiembre de 2026, never 2026-09-21) and numbers with Ecuador's",
    "  separators (2.138,37 m). This is formatting, not a new number.",
    "- The reader is the public, not a programmer. Never write a JSON key, field path or code value in the text:",
    "  write El Niño, not el_nino; la cota de Mazar, not mazar.level_masl.",
    "- Write fractions as percentages (skill 0.112 is 11,2 %, coverage 0.8 is 80 %) and GWh/día to one decimal.",
    "  Coverage is judged against the nominal 80 %: 80 % is on target, not below it.",
    "- Do not mention any date, year or month that is not in the payload.",
    "- The only forecast is `mazar_forecast`, a statistical model. Describe what it says; do not extend it",
    "  to other horizons, other reservoirs or other thresholds.",
    "- The risk tier is `adequacy.risk_tier`. It is an input, not your judgement: name it exactly as given",
    "  and explain what drives it. Never propose a different tier or a risk level of your own.",
    "- `days_at_slope_*` is a division (distance / current slope), not a prediction; say so if you use it.",
    "- 2115 m is this project's own marker (`status: unverified`), not a CELEC declaration. If you mention it, say so.",
    verifiedRain(payload) ? CENTROID_RAIN : PROVISIONAL_RAIN,
    "- If `stale_feeds` is not empty, say which data is out of date.",
    "",
    "Output fields:",
    "- outlook_es: between 120 and 220 words, quoting no more than eight figures: choose the ones that matter.",
    "  Lead with where Mazar stands and where the statistical forecast puts it,",
    "  then the national adequacy tier and what supports it, then the weather and ENSO context.",
    "- drivers: 3 to 5 objects, one per factor, each grounded in one number of the payload:",
    "  - text: one short Spanish sentence (the same rules as outlook_es apply to it);",
    `  - factor: one of ${DRIVER_FACTORS.map((f) => `"${f}"`).join(", ")};`,
    "  - payload_ref: the path of the one payload number the sentence rests on, written like",
    '    "adequacy.horizons[2].surplus_gwh_day" or "reservoirs[0].slopes_m_per_day.d30";',
    `  - direction: ${DRIVER_DIRECTIONS.map((d) => `"${d}"`).join(", ")} — where that number sits against its natural reference:`,
    "    zero for slopes, changes, surpluses, deficits and skill; 50 for percentiles; 1 for hydro_anomaly; zero for ONI.",
    "- confidence: low, medium or high. It is how well the indicators agree with each other and with the",
    "  forecast's own measured skill (`skill_vs_persistence`, `coverage_p10_p90`), not how sure you feel.",
    "",
    "Answer with one JSON object and nothing else: no code fences, no text before or after it, exactly these keys:",
    '{"outlook_es": "...", "drivers": [{"text": "...", "factor": "...", "direction": "...", "payload_ref": "..."}], "confidence": "low" | "medium" | "high"}',
  ].join("\n");
}

/** The instructions for the provisional point, the text most snapshots were written under. */
export const INSTRUCTIONS = instructionsFor(null);

export function buildPrompt(payload: NarrativePayload): string {
  return ["Payload (JSON). It is the complete set of facts available to you.", "", canonicalJson(payload)].join("\n");
}
