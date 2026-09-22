/**
 * Walking the ORDS historian back through time, with the one safeguard it needs.
 *
 * `pointValuesMesH24` returns a month of daily values per request, which makes paging cheap.
 * What makes it dangerous is that an empty answer is ambiguous. Every Phase 0 run got the
 * timestamp skeleton with every value null, and the 2026-09-22 probe got values from the same
 * mrids for the same months (§2.1), so an empty month means either "the endpoint is blank at
 * this hour" or "this plant did not exist yet" — and the two call for opposite responses.
 *
 * Mazar settles it. `repDiaHid12m` publishes its level and inflow for every month this project
 * covers, so a blank Mazar month is the endpoint talking about itself, not about the data. That
 * matters more here than anywhere else in the pipeline: Coca Codo Sinclair, Agoyán and
 * Manduriacu have no second source, so a false "no data" recorded against them is not something
 * a later cross-check could catch.
 *
 * The walk therefore spends its first request on the control and stops the whole run if it
 * comes back empty. Everything after that is ordinary paging.
 *
 * Being checkable is not a reason to skip collecting a series, though, and that distinction
 * cost Phase 3 its last open question. Mazar's inflow mrid is carried for exactly the same
 * reason as its level mrid — the reports publish both, so both can be checked — but only the
 * first was ever fetched, because the walk used the control list as a gate and then moved on
 * to the targets. With no history for mrid 30538 there was nothing to compare against
 * `repDiaHid12m`, and whether `mridCaud` means inflow or turbined flow stayed a guess for the
 * three plants that have no second source to guess with. Only the *gate* is now skipped; every
 * other control is walked like a target, and first, because it is the shortest walk of the run
 * and the one a spent budget must not be the reason to drop.
 */

import { HISTORIAN_CONTROLS, HISTORIAN_TARGETS, type HistorianSeries } from "../registry.ts";
import { monthEnd, monthLabel, type IsoDate, type YearMonth } from "../util/dates.ts";

/**
 * How many consecutive months with no value end a series' walk backwards.
 *
 * A plant commissioned mid-history has a hard start date, and the walk needs some rule for
 * finding it without paging every series back to 2010. Twelve months is a year of silence:
 * longer than any gap seen inside a live series, and only twelve requests to establish. It is
 * a stopping rule for one run, not a verdict about the data — the note records where the walk
 * stopped, and a later dispatch resumes from there.
 */
export const HISTORIAN_EMPTY_MONTH_LIMIT = 12;

/**
 * Fetches one month of one series. Returns how many non-null local days it added, or `null`
 * when the caller's request or time budget is spent — which ends the walk without pretending
 * the months it never asked about were empty.
 */
export type FetchHistorianMonth = (series: HistorianSeries, ym: YearMonth) => Promise<number | null>;

export interface HistorianWalkOptions {
  /** Months to cover, ascending. The walk reverses them: newest first. */
  months: YearMonth[];
  /** Today in Ecuador, so a running month is never mistaken for a closed one. */
  today: IsoDate;
  /** Whether a month is already stored for this mrid and can be skipped. */
  isDone: (ym: YearMonth, mrid: number) => boolean;
  fetchMonth: FetchHistorianMonth;
  controls?: readonly HistorianSeries[];
  targets?: readonly HistorianSeries[];
  emptyMonthLimit?: number;
}

export interface HistorianWalkResult {
  /** Findings worth keeping in status.json and the run log. */
  notes: string[];
  /** Progress lines, in the order they happened. */
  logs: string[];
  outcome: "complete" | "budget-spent" | "control-blank" | "nothing-to-do";
  /** `site/variable` -> the span of months that returned values, for the run summary. */
  ranges: Record<string, string>;
}

function label(series: HistorianSeries): string {
  return `${series.site}/${series.variable}`;
}

export async function walkHistorian(opts: HistorianWalkOptions): Promise<HistorianWalkResult> {
  const controls = opts.controls ?? HISTORIAN_CONTROLS;
  const targets = opts.targets ?? HISTORIAN_TARGETS;
  const limit = opts.emptyMonthLimit ?? HISTORIAN_EMPTY_MONTH_LIMIT;
  const result: HistorianWalkResult = { notes: [], logs: [], outcome: "complete", ranges: {} };

  const months = [...opts.months].reverse();
  if (months.length === 0) {
    result.outcome = "nothing-to-do";
    return result;
  }

  // The gate goes first, and on a closed month: the running month is partly unpublished by
  // definition, so its blankness would prove nothing.
  const gate = controls[0];
  const controlMonth = months.find((ym) => monthEnd(ym) < opts.today) ?? months[0]!;
  if (gate) {
    const added = await opts.fetchMonth(gate, controlMonth);
    if (added === null) {
      result.outcome = "budget-spent";
      return result;
    }
    if (added === 0) {
      result.outcome = "control-blank";
      result.notes.push(
        `ords-historian: the ${gate.site} control (mrid ${gate.mrid}) returned no values for ` +
          `${monthLabel(controlMonth)}, a month repDiaHid12m covers in full, so the historian is blank at this ` +
          `hour; the other series were skipped rather than record a false "no data" for plants with no second source`,
      );
      result.logs.push(
        `ords-historian: control blank for ${monthLabel(controlMonth)} — skipped, dispatch again at another hour`,
      );
      return result;
    }
    result.logs.push(`ords-historian: control ${label(gate)} answered for ${monthLabel(controlMonth)} (${added} days)`);
  }

  // The remaining controls lead: they are the series a cross-check needs history for, and a
  // budget spent on the long target walks first would keep postponing them a run at a time.
  for (const series of [...controls.slice(1), ...targets]) {
    let empty = 0;
    let newest = "";
    let oldest = "";
    for (const ym of months) {
      if (opts.isDone(ym, series.mrid)) continue;
      const added = await opts.fetchMonth(series, ym);
      if (added === null) {
        result.outcome = "budget-spent";
        return result;
      }
      if (added > 0) {
        empty = 0;
        oldest = monthLabel(ym);
        newest ||= monthLabel(ym);
      } else if (++empty >= limit) {
        result.notes.push(
          `ords-historian ${label(series)} (mrid ${series.mrid}): walk stopped at ${monthLabel(ym)} after ` +
            `${empty} months with no values; dispatch with an earlier --from to look further back`,
        );
        break;
      }
    }
    const range = newest ? `${oldest} .. ${newest}` : "no values in this range";
    result.ranges[label(series)] = range;
    result.notes.push(`ords-historian ${label(series)} (mrid ${series.mrid}): ${range}`);
    result.logs.push(`ords-historian ${label(series)}: ${range}`);
  }

  return result;
}
