/**
 * The national balance as daily series the adequacy model can stand on, with the days that
 * cannot be whole taken out rather than averaged over.
 *
 * Two things here are decisions, not plumbing.
 *
 * **What "demand" means.** `demanda_distribucion` is the distribution companies' metering and
 * nothing else: across 3,780 days it is 89–97% of what the generators plus the interconnections
 * actually delivered, the gap being transmission losses and the consumers who buy outside the
 * distribution utilities. Sized against a fleet, that gap is 3 to 11 GWh a day — larger than the
 * whole import capacity — so an adequacy calculation that asks whether supply covers
 * `demanda_distribucion` is asking the wrong question by about one Colombia. What must be
 * covered is `total_generacion + total_importacion − total_exportacion`: the energy the domestic
 * system actually consumed, losses and unregulated consumers included, measured rather than
 * apportioned. That is `loadGwh` below, and it is the quantity every forecast in `adequacy.ts`
 * is about.
 *
 * **Which days are whole.** `parse/smec.ts` already rejects pages served before their metering
 * arrived, by requiring distribution demand to be at least 20% of generation. That gate is
 * one-sided: it catches a page whose *demand* has not landed and passes one whose *generation*
 * has not. 2018-01-05 is the proof — 4.19 GWh of national generation against 62.72 GWh of
 * demand the same day, a 94% collapse that is exactly the shape of the crisis this project
 * exists to detect, sitting in the committed table because 62.72/4.19 sails past a 0.2 floor.
 *
 * The symmetric test is arithmetic rather than statistical. Served load is distribution demand
 * plus transmission losses plus unregulated demand, and the last two are positive, so a day
 * whose reported generation plus net imports falls *below* its own reported distribution demand
 * is not a day — it is a page caught mid-render. That is 55 of 3,780 days (1.46%), 46 of them in
 * 2016 and 2019–2020, and the ratio's own distribution backs the cut: the first percentile is
 * 1.019 and the four years 2021–2024 never once dip below 1.044.
 *
 * The same ratio catches the opposite fault at the top. On 2025-07-17 and -18 CENACE published
 * `generacion de otros tipos` at 153.62 and 113.19 GWh against a fortnight's median of 2.2 —
 * flagged in its own `pct_dia` column as +6,284% — which lifts national generation to 247 GWh
 * on a 91 GWh day. Those are the only two days in the record above twice distribution demand,
 * and the 2016 opening month, which runs to 1.76, is left in: an early-record metering scope is
 * not the same claim as a single concept contradicting its own neighbours by seventy times.
 */

import { addDays, type IsoDate } from "../util/dates.ts";

/** SMEC's thermal concepts. `motores_diesel` appears on 29 days only and is summed all the same. */
export const THERMAL_CONCEPTS = [
  "generacion_turbinas_gas",
  "generacion_motores_bunker",
  "generacion_vapor_bunker",
  "generacion_turbinas_diesel",
  "generacion_turbinas_nafta",
  "generacion_motores_diesel",
] as const;

/**
 * A day is usable when served load divided by distribution demand lands in this half-open
 * interval. The floor is arithmetic and the ceiling is empirical; see the module note.
 */
export const USABLE_LOAD_RATIO = { min: 1, max: 2 } as const;

export interface BalanceDay {
  date: IsoDate;
  /** `total_generacion + total_importacion − total_exportacion`, GWh. What had to be supplied. */
  loadGwh: number;
  hydroGwh: number;
  thermalGwh: number;
  /** Solar, wind, biomass and whatever else SMEC files under "otros tipos". */
  otherGwh: number;
  importGwh: number;
  exportGwh: number;
  generationGwh: number;
  distributionDemandGwh: number;
}

export interface RejectedDay {
  date: IsoDate;
  ratio: number;
  reason: "load below distribution demand" | "load above twice distribution demand";
}

export interface BalanceRead {
  days: BalanceDay[];
  rejected: RejectedDay[];
  /** Days present in the table that carried too few concepts to judge at all. */
  incomplete: IsoDate[];
}

export interface BalanceCsvRow {
  date: string;
  concepto: string;
  dia_kwh: string;
}

/** `date -> concept -> GWh`, from the long table. A non-numeric `dia_kwh` is a missing concept. */
export function balanceByDate(rows: readonly BalanceCsvRow[]): Map<IsoDate, Map<string, number>> {
  const out = new Map<IsoDate, Map<string, number>>();
  for (const row of rows) {
    const kwh = Number(row.dia_kwh);
    if (!row.date || !row.concepto || !Number.isFinite(kwh)) continue;
    const day = out.get(row.date) ?? out.set(row.date, new Map()).get(row.date)!;
    day.set(row.concepto, kwh / 1e6);
  }
  return out;
}

/**
 * Every day the balance table can support, oldest first, with the rejects reported rather than
 * silently dropped: a count that moves is a change upstream, and this is the only place that
 * would notice.
 */
export function readBalance(rows: readonly BalanceCsvRow[]): BalanceRead {
  const byDate = balanceByDate(rows);
  const days: BalanceDay[] = [];
  const rejected: RejectedDay[] = [];
  const incomplete: IsoDate[] = [];

  for (const date of [...byDate.keys()].sort()) {
    const concepts = byDate.get(date)!;
    const generation = concepts.get("total_generacion");
    const demand = concepts.get("demanda_distribucion");
    const hydro = concepts.get("generacion_hidraulica");
    if (generation === undefined || demand === undefined || hydro === undefined || demand <= 0) {
      incomplete.push(date);
      continue;
    }
    const imports = concepts.get("total_importacion") ?? 0;
    const exports = concepts.get("total_exportacion") ?? 0;
    const load = generation + imports - exports;
    const ratio = load / demand;

    if (ratio < USABLE_LOAD_RATIO.min) {
      rejected.push({ date, ratio, reason: "load below distribution demand" });
      continue;
    }
    if (ratio >= USABLE_LOAD_RATIO.max) {
      rejected.push({ date, ratio, reason: "load above twice distribution demand" });
      continue;
    }

    let thermal = 0;
    for (const concept of THERMAL_CONCEPTS) thermal += concepts.get(concept) ?? 0;

    days.push({
      date,
      loadGwh: load,
      hydroGwh: hydro,
      thermalGwh: thermal,
      otherGwh: concepts.get("generacion_otros_tipos") ?? 0,
      importGwh: imports,
      exportGwh: exports,
      generationGwh: generation,
      distributionDemandGwh: demand,
    });
  }

  return { days, rejected, incomplete };
}

/** `date -> value` over the usable days, for the pieces that want a plain series. */
export function seriesOf(days: readonly BalanceDay[], pick: (day: BalanceDay) => number): Map<IsoDate, number> {
  const out = new Map<IsoDate, number>();
  for (const day of days) out.set(day.date, pick(day));
  return out;
}

export interface RationingEpisode {
  start: IsoDate;
  /** Empty for an open episode, which `coversDate` then treats as running to the end of time. */
  end: IsoDate;
  kind: string;
  hydroRelated: boolean;
}

export interface RationingCsvRow {
  start: string;
  end: string;
  kind: string;
  hydro_related: string;
}

/**
 * The episodes during which measured load is suppressed load.
 *
 * Only `kind = rationing` and `hydro_related = yes` count. The June 2024 blackout and the
 * September 2024 scheduled outage are in the same table and are explicitly not droughts — the
 * seed row for each says so — and the 2025 row is a lifting, not an episode. Including them
 * would teach the demand model that a transmission failure is a season.
 */
export function rationingEpisodes(rows: readonly RationingCsvRow[]): RationingEpisode[] {
  return rows
    .filter((row) => row.kind === "rationing" && row.hydro_related === "yes" && /^\d{4}-\d{2}-\d{2}$/.test(row.start))
    .map((row) => ({
      start: row.start,
      end: /^\d{4}-\d{2}-\d{2}$/.test(row.end) ? row.end : "",
      kind: row.kind,
      hydroRelated: true,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function coversDate(episodes: readonly RationingEpisode[], date: IsoDate): boolean {
  return episodes.some((e) => date >= e.start && (e.end === "" || date <= e.end));
}

/**
 * Days inside a rationing episode plus a recovery tail.
 *
 * The tail is there because rationing does not end the way it starts. The December 2024 cuts
 * stopped on the 20th and load came back over about a fortnight — 74.5 GWh in the week of the
 * 12th, 75.5 in the week of the 19th, 78.4 in the first week of January and 84.6 in the second —
 * so the fortnight after an episode is neither suppressed nor normal, and fitting an
 * unsuppressed demand model through it drags the trend down at exactly the wrong moment.
 */
export const RECOVERY_TAIL_DAYS = 14;

export function suppressed(
  episodes: readonly RationingEpisode[],
  date: IsoDate,
  tailDays = RECOVERY_TAIL_DAYS,
): boolean {
  return episodes.some((e) => date >= e.start && (e.end === "" || date <= addDays(e.end, tailDays)));
}
