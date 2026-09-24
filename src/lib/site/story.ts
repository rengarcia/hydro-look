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
import { longDate, num } from "./format.ts";

export type Tone = "good" | "watch" | "tight" | "deficit";

export const TIERS: Record<RiskTier, { label: string; tone: Tone; gloss: string }> = {
  holgado: { label: "Holgado", tone: "good", gloss: "hay margen de sobra, incluso si la demanda sube más de lo previsto" },
  vigilancia: { label: "Vigilancia", tone: "watch", gloss: "alcanza, pero con poco margen si la demanda sube más de lo previsto" },
  ajustado: { label: "Ajustado", tone: "tight", gloss: "en el escenario más probable faltaría algo de energía, menos de 5 GWh al día" },
  deficit: { label: "Déficit", tone: "deficit", gloss: "en el escenario más probable faltarían 5 GWh al día o más" },
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
 * The same percentile as a phrase a reader does not need statistics for: how today's water
 * compares with what is normal for the date. The bands are `inflowHeadline`'s, so the headline
 * and the sentences under it never disagree.
 */
export function inflowWords(percentile: number | null | undefined): string | null {
  if (percentile === null || percentile === undefined || !Number.isFinite(percentile)) return null;
  if (percentile < 20) return "mucha menos agua de lo normal para esta época";
  if (percentile < 40) return "menos agua de lo normal para esta época";
  if (percentile <= 60) return "la cantidad de agua normal para esta época";
  if (percentile <= 80) return "más agua de lo normal para esta época";
  return "mucha más agua de lo normal para esta época";
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
      return { before: `En los próximos ${lastHorizonDays} días la electricidad del país tiene un margen`, word: "holgado" };
    case "vigilancia":
      return { before: `En ${horizonDays} días la electricidad del país alcanza, pero pide`, word: "vigilancia" };
    case "ajustado":
      return { before: `En ${horizonDays} días la electricidad del país queda justa: nivel`, word: "ajustado" };
    default:
      return { before: `En ${horizonDays} días a la electricidad del país le faltaría energía: nivel de`, word: "déficit" };
  }
}

const WORDS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
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
  return WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d)).getUTCDay()]!;
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
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
  adequacy: {
    origin_date: string;
    current: { worst_tier_horizon_days: number; narrative_tier_field?: string };
    horizons: { horizon_days: number }[];
  } | null,
): string | null {
  if (adequacy === null || adequacy.origin_date !== narrative.origin_date) return null;
  if ((adequacy.current.narrative_tier_field ?? "worst_tier") === "worst_tier") {
    return `el peor momento de los próximos meses: dentro de ${adequacy.current.worst_tier_horizon_days} días`;
  }
  return `dentro de ${adequacy.horizons[0]?.horizon_days ?? 7} días`;
}

/**
 * The three named analogue years, in the page's words and colours. `tone` is a `tone-*` class:
 * the dry year is drawn in the warning colour and the wet one in the reservoir's own.
 */
export const SCENARIOS: Record<string, { name: string; tone: string }> = {
  dry: { name: "Año seco", tone: "tight" },
  median: { name: "Año normal", tone: "water-2" },
  wet: { name: "Año lluvioso", tone: "water" },
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

/* ---------------------------------------------------------------- scorecard */

/** `1` -> `fila`, `2` -> `filas`: the noun beside a count. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Parts joined as sentences, each capitalised and closed with a full stop. */
function sentences(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}.`)
    .join(" ");
}

/**
 * What the `scorecard` block says, in two sentences: a headline and its detail.
 *
 * The honest case the block exists for is also its first one: every published row still waiting
 * for its date. A table of zero rows would say nothing, and "sin datos" would say the wrong
 * thing; the sentence says that nothing has reached its date yet and when the first one will.
 * `nextDue` is that date, read from the published rows themselves (`firstPendingTarget` in
 * `days.ts`); the block carries only the count.
 */
export function scorecardSummary(
  card: { rows_scored: number; rows_pending: number; rows_excluded: number; runs_considered: number; observed_through: string | null },
  nextDue: string | null,
): { headline: string; detail: string } {
  const excluded =
    card.rows_excluded > 0
      ? `${card.rows_excluded} ${plural(card.rows_excluded, "pronóstico no se puede comprobar", "pronósticos no se pueden comprobar")}: llegó su fecha y no hubo dato publicado`
      : "";

  if (card.rows_scored === 0) {
    if (card.runs_considered === 0) return { headline: "Todavía no hay pronósticos publicados que comprobar.", detail: "" };
    if (card.rows_pending > 0) {
      const waiting =
        `${card.rows_pending} ${plural(card.rows_pending, "pronóstico", "pronósticos")} de ${card.runs_considered} ` +
        `${plural(card.runs_considered, "publicación", "publicaciones")} ${plural(card.rows_pending, "sigue esperando", "siguen esperando")} su fecha`;
      return {
        headline: `Aún no ha llegado la fecha de ningún pronóstico publicado${nextDue ? `; el primero se comprueba el ${longDate(nextDue)}` : ""}.`,
        detail: sentences(waiting, excluded, "mientras tanto, la única medida de su acierto son las pruebas con datos de años anteriores"),
      };
    }
    return { headline: "Todavía no se ha podido comprobar ningún pronóstico publicado.", detail: sentences(excluded) };
  }
  const pending =
    card.rows_pending > 0
      ? `${card.rows_pending} ${plural(card.rows_pending, "pronóstico más espera", "pronósticos más esperan")} su fecha` +
        (nextDue ? `; el próximo se comprueba el ${longDate(nextDue)}` : "")
      : "";
  return {
    headline:
      `${card.rows_scored} ${plural(card.rows_scored, "pronóstico publicado ya comprobado", "pronósticos publicados ya comprobados")}` +
      (card.observed_through ? ` con los datos reales hasta el ${longDate(card.observed_through)}.` : "."),
    detail: sentences(pending, excluded),
  };
}

/**
 * One day's run against the scorecard: how many of its horizons have passed their date, and when
 * the next one falls due. `observedThrough` is the scorecard's own last observed day, so this
 * says exactly what the scorecard could have scored.
 */
export function dayScoreNote(
  horizons: readonly { horizon_days: number; target_date: string }[],
  observedThrough: string | null,
): string | null {
  if (horizons.length === 0) return null;
  const waiting = horizons
    .filter((h) => observedThrough === null || h.target_date > observedThrough)
    .sort((a, b) => (a.target_date < b.target_date ? -1 : a.target_date > b.target_date ? 1 : 0));
  const next = waiting[0];
  if (next === undefined) return `Ya llegó la fecha de todos sus plazos (datos reales hasta el ${longDate(observedThrough)}).`;
  if (waiting.length === horizons.length) {
    return `Todavía no llega la fecha de ninguno de sus plazos; el primero, a ${next.horizon_days} días, se comprueba el ${longDate(next.target_date)}.`;
  }
  const done = horizons.length - waiting.length;
  return (
    `Ya llegó la fecha de ${countWord(done)} de sus ${horizons.length} plazos; ` +
    `el siguiente, a ${next.horizon_days} días, se comprueba el ${longDate(next.target_date)}.`
  );
}

/* ------------------------------------------------------------------- inflow */

/**
 * Why an inflow horizon is or is not published, in the page's words and from the backtest's own
 * numbers — the document's `reason` is written in English, for the report. A horizon ships only
 * when the analogue years beat both persistence and climatology; one that does not is named by
 * what it lost to.
 */
export function inflowVerdict(h: {
  published: boolean;
  reason: string;
  backtest: { n: number; mae_m3s: number | null; persistence_mae_m3s: number | null; climatology_mae_m3s: number | null };
}): string {
  const b = h.backtest;
  const mae = b.mae_m3s;
  const vs = (name: string, value: number) => `${name} (${num(value, 1)} m³/s)`;
  if (h.published) {
    const beaten = [
      b.persistence_mae_m3s !== null ? vs("suponer que el caudal no cambia", b.persistence_mae_m3s) : null,
      b.climatology_mae_m3s !== null ? vs("usar el promedio de la época", b.climatology_mae_m3s) : null,
    ].filter((x): x is string => x !== null);
    return beaten.length > 0 ? `Se publica: acierta más que ${beaten.join(" y que ")}.` : "Se publica.";
  }
  if (mae === null || b.n === 0) return "No se publica: todavía no hay suficientes pruebas con datos pasados.";
  const lost = [
    b.persistence_mae_m3s !== null && b.persistence_mae_m3s <= mae ? vs("suponer que el caudal no cambia", b.persistence_mae_m3s) : null,
    b.climatology_mae_m3s !== null && b.climatology_mae_m3s <= mae ? vs("usar el promedio de la época", b.climatology_mae_m3s) : null,
  ].filter((x): x is string => x !== null);
  if (lost.length === 2) return `No se publica: no acierta más que ${lost[0]} ni que ${lost[1]}.`;
  if (lost.length === 1) return `No se publica: no acierta más que ${lost[0]}.`;
  return `No se publica (${h.reason}).`;
}

/* ------------------------------------------------------------------ imports */

export const IMPORT_CASES: Record<string, { label: string; gloss: string }> = {
  demonstrated: { label: "El máximo visto", gloss: "lo más que ha llegado desde Colombia en tres años" },
  stressed: { label: "Como en 2024", gloss: "lo que llegó en 2024, cuando la sequía golpeó a los dos países" },
  current_regime: { label: "Lo que llega hoy", gloss: "lo que está llegando en las últimas semanas" },
};

export function importCaseLabel(name: string): string {
  return IMPORT_CASES[name]?.label ?? name;
}

/**
 * How much the tier rests on the import assumption, in one sentence: the best and the worst of
 * the cases' worst tiers, or that they agree.
 */
export function importDependence(sensitivity: {
  cases: readonly { case: string; import_gwh_day: number; worst_tier: string; worst_tier_horizon_days: number }[];
}): string | null {
  const cases = sensitivity.cases.filter((c): c is typeof c & { worst_tier: RiskTier } => c.worst_tier in RANK);
  if (cases.length === 0) return null;
  const best = cases.reduce((a, b) => (RANK[b.worst_tier] < RANK[a.worst_tier] ? b : a));
  const worst = cases.reduce((a, b) => (RANK[b.worst_tier] > RANK[a.worst_tier] ? b : a));
  const describe = (c: (typeof cases)[number]) => `«${importCaseLabel(c.case).toLowerCase()}» (${num(c.import_gwh_day, 2)} GWh/día)`;
  const word = (tier: RiskTier) => TIERS[tier].label.toLowerCase();
  if (RANK[best.worst_tier] === RANK[worst.worst_tier]) {
    return `Con ${cases.length === 1 ? "este supuesto" : `cualquiera de los ${countWord(cases.length)} supuestos`} el peor nivel es ${word(best.worst_tier)}: lo que llegue de Colombia no cambia el resultado.`;
  }
  return (
    `Con ${describe(best)} el peor nivel sería ${word(best.worst_tier)}; con ${describe(worst)}, ${word(worst.worst_tier)} ` +
    `dentro de ${worst.worst_tier_horizon_days} días. El resultado depende de cuánta energía llegue desde Colombia.`
  );
}
