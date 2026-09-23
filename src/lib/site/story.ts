/**
 * The sentences the page builds out of numbers.
 *
 * The design sets its headlines as plain statements — "El río llega más flaco que de costumbre",
 * "Hoy sí, por poco" — and a static page rebuilt every morning cannot have a person write them.
 * So each one is a small rule over the day's numbers, kept here where a test can hold it to the
 * number it claims to describe. A headline that says the river is thin on a day it is in its
 * 80th percentile is a wrong number printed in large type, and nothing else on the page would
 * catch it.
 *
 * Nothing here reads files or knows about React.
 */

import type { RiskTier } from "./documents.ts";

export type Tone = "good" | "watch" | "tight" | "deficit";

export const TIERS: Record<RiskTier, { label: string; tone: Tone; gloss: string }> = {
  holgado: { label: "Holgado", tone: "good", gloss: "incluso el caso p90 queda cubierto" },
  vigilancia: { label: "Vigilancia", tone: "watch", gloss: "el caso p90 queda corto; el central, no" },
  ajustado: { label: "Ajustado", tone: "tight", gloss: "el caso central queda corto en menos de 5 GWh/día" },
  deficit: { label: "Déficit", tone: "deficit", gloss: "el caso central queda corto en 5 GWh/día o más" },
};

export function tierOf(tier: string | null | undefined): { label: string; tone: Tone; gloss: string } | null {
  return tier && tier in TIERS ? TIERS[tier as RiskTier] : null;
}

const RANK: Record<RiskTier, number> = { holgado: 0, vigilancia: 1, ajustado: 2, deficit: 3 };

/** A slope of less than half a centimetre a day is reported as holding, not as moving. */
export const FLAT_M_PER_DAY = 0.005;

export type Direction = "up" | "down" | "flat";

export function direction(slope: number | null | undefined): Direction {
  if (slope === null || slope === undefined || !Number.isFinite(slope) || Math.abs(slope) < FLAT_M_PER_DAY) return "flat";
  return slope > 0 ? "up" : "down";
}

export const ARROW: Record<Direction, string> = { up: "↑", down: "↓", flat: "→" };

/** Rising water is the reservoir's colour; falling water is the warning colour. */
export const DIRECTION_TONE: Record<Direction, string> = { up: "water", down: "tight", flat: "muted" };

/**
 * The page's headline: how much of the country's electricity came from water on the latest
 * closed day, in whole kWh out of a hundred. `emphasis` is the part set in the water colour;
 * `text` is the sentence as a screen reader and a share preview read it.
 */
export function heroHeadline(hydroSharePct: number | null | undefined): {
  share: number | null;
  before: string;
  emphasis: string;
  after: string;
  text: string;
} {
  if (hydroSharePct === null || hydroSharePct === undefined || !Number.isFinite(hydroSharePct)) {
    const text = "El sistema hidroeléctrico del Ecuador, día a día.";
    return { share: null, before: text, emphasis: "", after: "", text };
  }
  const share = Math.round(hydroSharePct);
  const before = "El agua encendió ";
  const emphasis = `${share} de cada 100`;
  const after = " kWh del país.";
  return { share, before, emphasis, after, text: `${before}${emphasis}${after}` };
}

/**
 * A change since yesterday in words: `+0,4 m`, `sin cambio`. `digits` is the precision the
 * number is published at; a change that rounds to zero at it is said as no change, because a
 * reader told "−0,00 m" has been told nothing and asked to notice the minus sign.
 */
export function changeWord(delta: number | null | undefined, digits: number, unit: string): string | null {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  const rounded = Number(delta.toFixed(digits));
  if (rounded === 0) return "sin cambio";
  const text = Math.abs(rounded).toLocaleString("es-EC", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${rounded > 0 ? "+" : "−"}${text}${unit ? ` ${unit}` : ""}`;
}

/**
 * The inflow headline, from today's percentile against the same days of every year on record.
 * The middle fifth of the distribution is "as usual"; the words either side are deliberately
 * plain, because the number is printed right beside them.
 */
export function inflowHeadline(percentile: number | null | undefined): string {
  if (percentile === null || percentile === undefined) return "El caudal de hoy, frente a su propia historia.";
  if (percentile < 20) return "El río llega mucho más flaco que de costumbre.";
  if (percentile < 40) return "El río llega más flaco que de costumbre.";
  if (percentile <= 60) return "El río llega como de costumbre.";
  if (percentile <= 80) return "El río llega más crecido que de costumbre.";
  return "El río llega mucho más crecido que de costumbre.";
}

/**
 * The adequacy headline: the first horizon's answer, then the worst one's if it is worse.
 *
 * "Por poco" is said when the first horizon is covered but only just — watch rather than
 * comfortable — because a "sí" on its own would read as the comfortable case.
 */
export function adequacyHeadline(horizons: readonly { horizon_days: number; tier: RiskTier }[]): string {
  const first = horizons[0];
  if (first === undefined) return "¿Alcanza la energía?";
  const worst = horizons.reduce((a, b) => (RANK[b.tier] > RANK[a.tier] ? b : a), first);
  const now =
    first.tier === "holgado"
      ? "Hoy sí."
      : first.tier === "vigilancia"
        ? "Hoy sí, por poco."
        : first.tier === "ajustado"
          ? "Hoy no del todo."
          : "Hoy no.";
  if (RANK[worst.tier] <= RANK[first.tier]) {
    const last = horizons.at(-1)!;
    return `¿Alcanza la energía? ${now} Y así sigue hasta los ${last.horizon_days} días.`;
  }
  const later = worst.tier === "vigilancia" ? "con poco margen" : worst.tier === "ajustado" ? "no del todo" : "no";
  return `¿Alcanza la energía? ${now} A ${worst.horizon_days} días, ${later}.`;
}

/** The closing clause of the hero sentence, by the worst tier across the horizons. */
export function marginClause(tier: RiskTier, horizonDays: number, lastHorizonDays: number): { before: string; word: string } {
  switch (tier) {
    case "holgado":
      return { before: `Hasta los ${lastHorizonDays} días el margen nacional queda`, word: "holgado" };
    case "vigilancia":
      return { before: `A ${horizonDays} días el margen nacional pide`, word: "vigilancia" };
    case "ajustado":
      return { before: `A ${horizonDays} días el margen nacional queda corto:`, word: "ajustado" };
    default:
      return { before: `A ${horizonDays} días el margen nacional queda en`, word: "déficit" };
  }
}

const WORDS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
];

/** Small counts in words, as Spanish prose writes them; anything larger stays a numeral. */
export function countWord(n: number, capitalise = false): string {
  const word = Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n]! : String(n);
  return capitalise ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Whole years between two ISO dates, counting only years that have fully elapsed. */
export function wholeYears(from: string, to: string): number {
  const years = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  return to.slice(5, 10) >= from.slice(5, 10) ? years : years - 1;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** `2026-09-21` -> `lunes`. Computed in UTC from the date's parts, so no clock or zone enters. */
export function weekday(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** `2026-07` or `2026-07-01` -> `julio`. */
export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso;
}

/** `2023-10-27`, `2023-12-31` -> `oct–dic 2023`; across a year boundary both years are named. */
export function monthSpan(start: string, end: string): string {
  const a = monthName(start).slice(0, 3);
  const b = monthName(end).slice(0, 3);
  const ya = start.slice(0, 4);
  const yb = end.slice(0, 4);
  if (ya !== yb) return `${a} ${ya}–${b} ${yb}`;
  return a === b ? `${a} ${ya}` : `${a}–${b} ${ya}`;
}

/** `2014-09-20` -> `sep 2014`. */
export function monthYear(iso: string): string {
  return `${monthName(iso).slice(0, 3)} ${iso.slice(0, 4)}`;
}

/**
 * How the backtest scores against persistence, in words, per horizon. Within five percent either
 * way is a tie: the published skill scores carry more noise than that over a hundred origins.
 */
export const SKILL_TIE = 0.05;

export function skillTone(skill: number | null | undefined): "water" | "muted" | "tight" {
  if (skill === null || skill === undefined) return "muted";
  if (skill >= SKILL_TIE) return "water";
  return skill <= -SKILL_TIE ? "tight" : "muted";
}

/** `[14, 30]` -> `14 y 30`; `[7, 14, 30]` -> `7, 14 y 30`. */
export function joinDays(days: readonly number[]): string {
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} y ${days.at(-1)}`;
}

/** The short name of a model id: `M4-gbm-m3-residual` -> `M4`. */
export function modelShort(id: string): string {
  return id.split("-")[0] ?? id;
}

/**
 * The first sentence of a paragraph, and the rest. A sentence ends at a full stop followed by a
 * space and a capital; `2.138,37` has no space after its point, so a number never ends one. A
 * paragraph shorter than a long sentence is not split at all.
 */
export function splitLead(text: string): [string, string] {
  const match = /[.!?]\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/.exec(text);
  if (match === null || text.length < 220) return [text, ""];
  const cut = match.index + 1;
  return [text.slice(0, cut), text.slice(cut).trim()];
}

/**
 * Which of the adequacy document's two tiers the narrative was written about, in words. The
 * document names it (`current.narrative_tier_field`, since schema version 1); an older one is
 * read as the worst tier, which is what the payload builder has always handed the text.
 */
export function narrativeTierNote(
  narrative: { origin_date: string },
  adequacy: { origin_date: string; current: { worst_tier_horizon_days: number; narrative_tier_field?: string }; horizons: { horizon_days: number }[] } | null,
): string | null {
  if (adequacy === null || adequacy.origin_date !== narrative.origin_date) return null;
  if ((adequacy.current.narrative_tier_field ?? "worst_tier") === "worst_tier") {
    return `el peor de los horizontes, a ${adequacy.current.worst_tier_horizon_days} días`;
  }
  return `a ${adequacy.horizons[0]?.horizon_days ?? 7} días`;
}

/**
 * The three named analogue years, in the page's words and colours. `tone` is a `tone-*` class:
 * the dry year is drawn in the warning colour and the wet one in the reservoir's own.
 */
export const SCENARIOS: Record<string, { name: string; tone: string }> = {
  dry: { name: "Seco", tone: "tight" },
  median: { name: "Mediano", tone: "water-2" },
  wet: { name: "Húmedo", tone: "water" },
};

export function scenarioOf(scenario: string): { name: string; tone: string } {
  return SCENARIOS[scenario] ?? { name: scenario, tone: "muted" };
}

/**
 * The threshold the scenarios are read against: this project's own unverified marker when the
 * forecast carries one — it is the one that is crossed first and the one PLAN.md §7 asks about —
 * and otherwise the first declared floor.
 */
export function criticalThreshold<T extends { status: string }>(thresholds: readonly T[]): T | undefined {
  return thresholds.find((t) => t.status === "unverified") ?? thresholds[0];
}

/**
 * A declared floor's label as the charts print it. `where` names the declaration that set it —
 * the dashboard's chart title or the report endpoints — because the two disagree and the page
 * never picks between them.
 */
export function thresholdSource(name: string): "tablero" | "reportes" {
  return /dashboard/.test(name) ? "tablero" : "reportes";
}
