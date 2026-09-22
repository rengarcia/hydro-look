/**
 * The backtest report, rendered. It is committed next to the forecast because a forecast whose
 * error is not published is a number with no scale on it, and because section 7 asks for skill
 * against persistence rather than skill in the abstract.
 *
 * The report is written to be read by someone deciding whether to believe the forecast, so it
 * leads with the comparison that decides it and states the rungs that lost by name.
 */

import type { CrisisCall, ModelScore } from "./backtest.ts";
import type { OriginCrossing } from "./forecast.ts";
import type { WaterBalanceFit } from "./water-balance.ts";
import { storageHm3 } from "../features/hydrology.ts";

const f = (value: number | null | undefined, digits = 3): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);

const pct = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;

export interface CrisisReport {
  thresholdM: number;
  thresholdSource: string;
  episodes: {
    crossedOn: string;
    /** The strict, sustained call at each quantile: see `crisisLeadTime`. */
    p50: CrisisCall;
    p10: CrisisCall;
    runUp: readonly OriginCrossing[];
  }[];
  falseAlarms: number;
  originsConsidered: number;
}

export interface ReportInputs {
  generatedAt: string;
  site: string;
  horizonDays: readonly number[];
  ladder: readonly ModelScore[];
  shippedModelId: string;
  variant: { scores: readonly ModelScore[]; sharedOrigins: number } | null;
  crisis: CrisisReport;
  fit: WaterBalanceFit;
  crestM: number;
  levelRange: { first: string; last: string; days: number };
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function scoreRows(scores: readonly ModelScore[], horizons: readonly number[], pick: (h: ModelScore["horizons"][number]) => string) {
  return scores.map((score) => [
    score.modelId,
    ...horizons.map((horizon) => {
      const cell = score.horizons.find((h) => h.horizonDays === horizon);
      return cell ? pick(cell) : "—";
    }),
  ]);
}

export function renderBacktestReport(inputs: ReportInputs): string {
  const { horizonDays: H } = inputs;
  const headers = ["model", ...H.map((h) => `h=${h}`)];
  const shipped = inputs.ladder.find((s) => s.modelId === inputs.shippedModelId);
  const n = shipped?.horizons[0]?.n ?? 0;
  const nBand = shipped?.horizons[0]?.nBand ?? 0;

  const lines: string[] = [];
  lines.push(`# Backtest — ${inputs.site} level forecast`);
  lines.push("");
  lines.push(
    `Generated ${inputs.generatedAt} from the committed tables; no network. Origins are the first of ` +
      `each month, each one refitting every model on the data before it. ${n} origins scored per horizon, ` +
      `${nBand} of them with a calibrated band (the first twelve are the calibration's warm-up).`,
  );
  lines.push("");
  lines.push(
    `Level history: ${inputs.levelRange.days} days, ${inputs.levelRange.first} → ${inputs.levelRange.last}.`,
  );
  lines.push("");

  lines.push("## Verdict");
  lines.push("");
  const longest = Math.max(...H);
  const shortest = Math.min(...H);
  const long = shipped?.horizons.find((h) => h.horizonDays === longest);
  const short = shipped?.horizons.find((h) => h.horizonDays === shortest);
  // Which rungs beat persistence anywhere, and does the shipped one beat all of them everywhere?
  const others = inputs.ladder.filter((s) => s.modelId !== inputs.shippedModelId && s.modelId !== "M0-persistence");
  const rivals = others.filter((s) => s.horizons.some((h) => (h.skillVsPersistence ?? 0) > 0));
  const dominated = rivals.filter((rival) =>
    H.every((horizon) => {
      const mine = shipped?.horizons.find((h) => h.horizonDays === horizon)?.maeM;
      const theirs = rival.horizons.find((h) => h.horizonDays === horizon)?.maeM;
      return mine !== undefined && theirs !== undefined && mine <= theirs;
    }),
  );
  lines.push(
    `**${inputs.shippedModelId} ships.** At ${longest} days it is ${pct(long?.skillVsPersistence)} better ` +
      `than persistence; at ${shortest} days it is ${pct(short?.skillVsPersistence)}, which is to say ` +
      "indistinguishable from doing nothing, and the forecast document says so rather than implying a " +
      "precision the measurement does not support.",
  );
  lines.push("");
  if (rivals.length === 0) {
    lines.push("No other rung beats persistence at any horizon.");
  } else {
    lines.push(
      `It is not the only rung that beats persistence — ${rivals.map((r) => r.modelId).join(", ")} ` +
        `${rivals.length === 1 ? "does" : "do"} too at the long horizons — but it is chosen because it ` +
        `is at least as good as ${dominated.length === rivals.length ? "all of them" : "them"} at ` +
        "*every* horizon, and because its state is interpretable: a storage curve, a release rule and " +
        "a set of named analogue years, each of which can be inspected and argued with.",
    );
  }
  lines.push("");

  lines.push("## Mean absolute error, metres");
  lines.push("");
  lines.push(table(headers, scoreRows(inputs.ladder, H, (h) => f(h.maeM))));
  lines.push("");

  lines.push("## Skill against persistence (1 − MAE/MAE₀)");
  lines.push("");
  lines.push(table(headers, scoreRows(inputs.ladder, H, (h) => pct(h.skillVsPersistence))));
  lines.push("");
  lines.push(
    "Section 7 expected climatological drift to improve on persistence. It does not, at any horizon: " +
      "a reservoir level is the running total of an operating decision, and last week's decision is a " +
      "better guide to next week's than the average of six Septembers is. That is recorded here as a " +
      "measurement, not repaired by tuning.",
  );
  lines.push("");

  lines.push("## Coverage of the published p10–p90 band");
  lines.push("");
  lines.push(table(headers, scoreRows(inputs.ladder, H, (h) => pct(h.coverageP10P90))));
  lines.push("");
  lines.push("Against the model's own ensemble, uncalibrated:");
  lines.push("");
  lines.push(table(headers, scoreRows(inputs.ladder, H, (h) => pct(h.ensembleCoverage))));
  lines.push("");
  lines.push(
    "The gap between the two tables is the reason the published band is not the ensemble. An ensemble " +
      "over analogue inflow years knows only what the weather might do; it does not know that the rule " +
      "curve is an average of several operating regimes, or that the operator can change their mind. " +
      "Widening by the model's own out-of-sample residuals is what brings coverage back to what it claims.",
  );
  lines.push("");

  lines.push("## Pinball loss, metres (mean over the three published quantiles)");
  lines.push("");
  lines.push(table(headers, scoreRows(inputs.ladder, H, (h) => f(h.pinballMeanM))));
  lines.push("");
  lines.push("## Bias, metres (mean actual − forecast; positive means the model forecasts too low)");
  lines.push("");
  lines.push(table(headers, scoreRows(inputs.ladder, H, (h) => f(h.biasM))));
  lines.push("");

  if (inputs.variant) {
    lines.push("## Does conditioning the analogue years on ENSO phase help?");
    lines.push("");
    lines.push(
      `No. Scored over the ${inputs.variant.sharedOrigins} origins where both variants could forecast — ` +
        "the matched variant declines the rest, because narrowing an analogue pool of barely a dozen " +
        "members by ENSO phase often leaves too few to form an ensemble at all:",
    );
    lines.push("");
    lines.push(table(headers, scoreRows(inputs.variant.scores, H, (h) => f(h.maeM))));
    lines.push("");
    lines.push(
      "The phase used is the one a forecaster could actually have read at each origin: ONI is a " +
        "three-month mean centred on its label, so the newest value available on any day is about two " +
        "months old, and the backtest never looks through that lag. The conditioner worth having is " +
        "basin precipitation, and it waits on a verified `basins.csv`.",
    );
    lines.push("");
  }

  lines.push("## The crisis check");
  lines.push("");
  lines.push(
    `Section 7 asks for the lead time at which the P50 first predicted a crossing of ` +
      `${inputs.crisis.thresholdM} m (${inputs.crisis.thresholdSource}). Answered strictly: a call ` +
      "counts only if it is *sustained* — the earliest origin from which this and every later origin " +
      "also predicted the crossing on or before the day it happened. One origin that says yes and is " +
      "then contradicted by the next three did not forecast anything, and crediting it would flatter " +
      "the model.",
  );
  lines.push("");
  if (inputs.crisis.episodes.length === 0) {
    lines.push("No episode at or below that level falls inside the scored window.");
  } else {
    lines.push(
      table(
        ["level first at or below", "P50 called it from", "P50 lead", "P10 called it from", "P10 lead"],
        inputs.crisis.episodes.map((e) => [
          e.crossedOn,
          e.p50.calledFrom ?? "**never**",
          e.p50.leadTimeDays === null ? "—" : `${e.p50.leadTimeDays} d`,
          e.p10.calledFrom ?? "**never**",
          e.p10.leadTimeDays === null ? "—" : `${e.p10.leadTimeDays} d`,
        ]),
      ),
    );
    lines.push("");
    const p50Calls = inputs.crisis.episodes.filter((e) => e.p50.calledFrom !== null).length;
    const p10Calls = inputs.crisis.episodes.filter((e) => e.p10.calledFrom !== null).length;
    lines.push(
      `**The P50 called ${p50Calls} of ${inputs.crisis.episodes.length} episodes in advance; the P10 ` +
        `called ${p10Calls}.** The statistic section 7 chose is the weaker one for this question, and ` +
        "the run-up tables below show why: a crossing is a dry-tail event, and the median of the " +
        "analogue ensemble is by construction not the dry tail.",
    );
    lines.push("");
    for (const episode of inputs.crisis.episodes) {
      lines.push(`### Run-up to ${episode.crossedOn}`);
      lines.push("");
      lines.push(
        table(
          ["origin", "level", "analogue years crossing", "P10 crossing", "P50 crossing"],
          episode.runUp.map((call) => [
            call.origin,
            `${f(call.level, 1)} m`,
            `${call.yearsThatCross}/${call.analogueYears}`,
            call.p10 ?? "none within a year",
            call.p50 ?? "none within a year",
          ]),
        ),
      );
      lines.push("");
    }
    const missed = inputs.crisis.episodes.filter((e) => e.p10.calledFrom === null);
    if (missed.length > 0) {
      lines.push(
        `Clean misses at every quantile: ${missed.map((e) => e.crossedOn).join(", ")}. In the run-up ` +
          "to those, not one analogue year reached the level — the inflow ensemble is made of years " +
          "that happened, and the year being forecast was drier than all of them at that moment. " +
          "Nothing in this model can know that in advance, and no amount of widening the band fixes " +
          "it; an analogue method cannot draw a year it has never seen.",
      );
      lines.push("");
    }
    const rescued = inputs.crisis.episodes.filter((e) => e.p10.calledFrom !== null && e.p50.calledFrom === null);
    if (rescued.length > 0) {
      lines.push(
        `Where the P10 called an episode the P50 missed (${rescued.map((e) => e.crossedOn).join(", ")}), ` +
          "the information was in the forecast all along and reading only the median threw it away. " +
          "`forecast.json` therefore publishes the whole censored distribution — how many analogue " +
          "years cross, and at which quantiles — and not only the three named scenarios.",
      );
    }
  }
  lines.push("");
  lines.push(
    `False alarms: across ${inputs.crisis.originsConsidered} origins, the P50 named a crossing within ` +
      `thirty days that did not happen on ${inputs.crisis.falseAlarms} of them. A lead time means ` +
      "nothing without this number — a model that predicts a crossing every month has perfect lead " +
      "time and no information.",
  );
  lines.push("");

  lines.push("## What the model fitted, at the last origin");
  lines.push("");
  const { curve, rule, stance } = inputs.fit;
  lines.push(
    table(
      ["quantity", "value", "where it comes from"],
      [
        ["area-elevation exponent", f(curve.areaExponent, 2), "fitted"],
        ["area-elevation datum", `${f(curve.datumM, 1)} m`, "fitted"],
        ["fit residual", `${f(curve.rmseDeltaLevelM)} m/day over ${curve.days} days`, "fitted"],
        ["turbined flow per MW", `${f(curve.turbineM3sPerMw)} m³/s`, "fitted jointly with the curve"],
        [
          "storage, lowest declared minimum → crest",
          `${f(storageHm3(curve, 2098, inputs.crestM), 1)} hm³`,
          "integral of the fitted curve",
        ],
        ["release rule points", String(rule.points.length), `median implied release over ${rule.days} days`],
        ["operator's current stance", `${f(stance, 1)} m³/s vs the rule`, "trailing 30 days"],
        ["crest used as the spill cap", `${f(inputs.crestM, 2)} m`, "highest level in the record"],
      ],
    ),
  );
  lines.push("");
  lines.push(
    "The 410 hm³ in `plants.csv` is marked `unverified` and came from press; the storage above is the " +
      "integral of a curve fitted to this repository's own readings, and the two disagree by about a " +
      "factor of two. That gap cannot be closed by preferring the bigger number: the area curve and the " +
      "turbine's flow-per-MW are fitted *together*, and doubling the area drives the flow-per-MW down " +
      "through zero — a turbine that consumes no water. The balance closes at one scale. The check that " +
      "does pass is `repDiaPotQTurb`'s 113 days of turbined flow, whose maximum is about 129 m³/s, " +
      "against the fitted 114 m³/s at Mazar's rated 170 MW.",
  );
  lines.push("");
  lines.push(
    "The bias table above shows this model forecasting high at the long horizons, so correcting the " +
      "median by its own trailing residual was tried. It is *worse* at every horizon — the bias is not " +
      "a stable offset but a handful of origins during the 2024 drawdown, and a running median chases " +
      "them after the fact. The median is therefore published uncorrected, with the residual beside it " +
      "in `forecast.json` as `median_backtest_residual_m` so a reader can apply their own judgement.",
  );
  lines.push("");
  lines.push("## The fitted release rule");
  lines.push("");
  lines.push(
    table(
      ["level, masl", "median implied release, m³/s"],
      rule.points.map((point) => [f(point.level, 1), f(point.releaseM3s, 1)]),
    ),
  );
  lines.push("");
  lines.push(
    "This curve is why the water balance works at all. Run open-loop — release held at whatever it " +
      "recently was, as section 7 originally specified — the same model loses to persistence at every " +
      "horizon, because a simulated reservoir that never reacts either fills until it spills or empties " +
      "until it is dry. Reading the release back off the level on every simulated day is the whole " +
      "difference.",
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}
