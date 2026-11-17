/**
 * The backtest report, rendered. It is committed next to the forecast because a forecast whose
 * error is not published is a number with no scale on it, and because section 7 asks for skill
 * against persistence rather than skill in the abstract.
 *
 * The report is written to be read by someone deciding whether to believe the forecast, so it
 * leads with the comparison that decides it and states the rungs that lost by name.
 */

import type { CrisisCall, ModelScore, OriginCadence } from "./backtest.ts";
import type { OriginCrossing } from "./forecast.ts";
import type { WaterBalanceFit } from "./water-balance.ts";
import { storageHm3 } from "../features/hydrology.ts";
import { m4Decisions, type M4Decision, type M4Snapshot } from "./m4-scoring.ts";
import { M4_SNAPSHOT_MAX_LAG_DAYS, snapshotCoverage, type SnapshotCoverage } from "./m4-live.ts";
import { M4_BLEND } from "./boosted.ts";

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
  /** How the ladder's origins are spaced; absent means monthly, as before 2026-11-17. */
  cadence?: OriginCadence;
  ladder: readonly ModelScore[];
  shippedModelId: string;
  variant: { scores: readonly ModelScore[]; sharedOrigins: number } | null;
  crisis: CrisisReport;
  fit: WaterBalanceFit;
  crestM: number;
  levelRange: { first: string; last: string; days: number };
  /**
   * The committed M4 run (`npm run backtest:m4`), if there is one, and the origins the ladder
   * above was scored on. M4's rows join the ladder's tables only when the two origin sets are
   * identical; otherwise its section stands alone and says which run it came from.
   */
  m4?: { snapshot: M4Snapshot; ladderOrigins: readonly string[] } | null;
  /**
   * What `forecast.json` publishes at the horizon M4 earned: the switch made, or the reason this
   * run fell back to the shipped model. Absent means every horizon publishes the shipped model.
   */
  published?: PublishedSwitch | null;
  /**
   * Experiments scored on the ladder's own origins in this run — each a variant of the shipped
   * model that did not ship, or has not yet — with the verdict written by the caller from the
   * numbers. Rendered after the ENSO comparison, before the crisis check.
   */
  experiments?: readonly ExperimentSection[];
}

export interface ExperimentSection {
  heading: string;
  /** Paragraphs and tables, already rendered; `scoreTable` below renders a table. */
  body: readonly string[];
}

export interface PublishedSwitch {
  /** The design the daily run may publish in place of the shipped model. */
  modelId: string;
  /** Each horizon at which it is a candidate: published there, or the reason this run did not. */
  horizons: readonly { horizonDays: number; published: boolean; reason: string | null }[];
}

const publishedAt = (p: PublishedSwitch | null | undefined): number[] =>
  (p?.horizons ?? []).filter((h) => h.published).map((h) => h.horizonDays);

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join(
    "\n",
  );
}

/** A model × horizon table of one statistic, as every table in this report is drawn. */
export function scoreTable(
  scores: readonly ModelScore[],
  horizons: readonly number[],
  pick: (h: ModelScore["horizons"][number]) => string,
): string {
  return table(["model", ...horizons.map((h) => `h=${h}`)], scoreRows(scores, horizons, pick));
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

  // M4 is run by its own command and committed as a snapshot. Its rows sit in the ladder's
  // tables only while it still stands for the ladder (`snapshotCoverage`): scored on the ladder's
  // own origins, up to one no more than a month behind. A snapshot further behind, or scored on
  // another origin set altogether, keeps to its own section.
  const m4 = inputs.m4?.snapshot ?? null;
  const coverage = m4 ? snapshotCoverage(m4.origins, inputs.m4!.ladderOrigins) : null;
  const m4Aligned = coverage?.covers ?? false;
  const m4Rows = m4Aligned ? m4!.scores.filter((s) => s.modelId.startsWith("M4")) : [];
  const weekly = inputs.cadence === "weekly";
  const warmUp = n - nBand;
  const tableScores = [...inputs.ladder, ...m4Rows];
  const decisions = m4 ? m4Decisions(m4) : [];

  const lines: string[] = [];
  lines.push(`# Backtest — ${inputs.site} level forecast`);
  lines.push("");
  lines.push(
    `Generated ${inputs.generatedAt} from the committed tables; no network. Origins are ` +
      `${weekly ? "every Monday (weekly since 2026-11-17; the first of each month before that)" : "the first of each month"}, ` +
      `each one refitting every model on the data before it. ${n} origins scored per horizon, ` +
      `${nBand} of them with a calibrated band (the first ${warmUp} are the calibration's warm-up).`,
  );
  lines.push("");
  lines.push(`Level history: ${inputs.levelRange.days} days, ${inputs.levelRange.first} → ${inputs.levelRange.last}.`);
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
      `than persistence; at ${shortest} days it is ${pct(short?.skillVsPersistence)}, ` +
      (Math.abs(short?.skillVsPersistence ?? 0) < 0.05
        ? "which is to say indistinguishable from doing nothing, and the forecast document says so rather than implying a " +
          "precision the measurement does not support."
        : "a gain small enough that a week out the band, not the median, is the forecast."),
  );
  lines.push("");
  if (rivals.length === 0) {
    lines.push("No other rung beats persistence at any horizon.");
  } else {
    // Where a rival that is not dominated is the closer one, said by name: "at least as good at
    // every horizon" is only written when it is true of every rival.
    const closer = rivals
      .filter((rival) => !dominated.includes(rival))
      .map((rival) => {
        const at = H.filter((horizon) => {
          const mine = shipped?.horizons.find((h) => h.horizonDays === horizon)?.maeM;
          const theirs = rival.horizons.find((h) => h.horizonDays === horizon)?.maeM;
          return mine !== undefined && theirs !== undefined && theirs < mine;
        });
        return `${rival.modelId} is closer at ${at.join(", ")} d`;
      });
    lines.push(
      `It is not the only rung that beats persistence — ${rivals.map((r) => r.modelId).join(", ")} ` +
        `${rivals.length === 1 ? "does" : "do"} too at the long horizons — but it is chosen because ` +
        (closer.length === 0
          ? "it is at least as good as all of them at *every* horizon, and because "
          : `none of them is as good across the horizons (${closer.join("; ")}, and further off everywhere else), and because `) +
        "its state is interpretable: a storage curve, a release rule and " +
        "a set of named analogue years, each of which can be inspected and argued with.",
    );
  }
  lines.push("");
  if (inputs.published) {
    lines.push(publishedLine(inputs.published, m4, inputs.shippedModelId, decisions));
    lines.push("");
  }
  if (m4) {
    lines.push(m4VerdictLine(m4, decisions, inputs.published ?? null));
    lines.push("");
  }

  lines.push("## Mean absolute error, metres");
  lines.push("");
  lines.push(
    table(
      headers,
      scoreRows(tableScores, H, (h) => f(h.maeM)),
    ),
  );
  lines.push("");
  if (m4Rows.length > 0) {
    lines.push(
      `The M4 rows come from \`${m4!.command}\` (run ${m4!.generatedAt}), which refits them at ` +
        (coverage!.missing === 0
          ? `the same ${m4!.origins.length} origins`
          : `the first ${m4!.origins.length} of these origins (the newest ${coverage!.missing} are not in its rows yet; ` +
            `it is rerun once it is more than ${M4_SNAPSHOT_MAX_LAG_DAYS} days behind)`) +
        " through the same harness; they are rendered from its committed " +
        `snapshot because refitting about ${fitCount(m4!)} boosted models does not belong in the daily run. See ` +
        "[M4](#m4--gradient-boosted-quantile-trees) below.",
    );
    lines.push("");
  }

  lines.push("## Skill against persistence (1 − MAE/MAE₀)");
  lines.push("");
  lines.push(
    table(
      headers,
      scoreRows(tableScores, H, (h) => pct(h.skillVsPersistence)),
    ),
  );
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
  lines.push(
    table(
      headers,
      scoreRows(tableScores, H, (h) => pct(h.coverageP10P90)),
    ),
  );
  lines.push("");
  lines.push("Against the model's own ensemble, uncalibrated:");
  lines.push("");
  lines.push(
    table(
      headers,
      scoreRows(tableScores, H, (h) => pct(h.ensembleCoverage)),
    ),
  );
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
  lines.push(
    table(
      headers,
      scoreRows(tableScores, H, (h) => f(h.pinballMeanM)),
    ),
  );
  lines.push("");
  lines.push("## Bias, metres (mean actual − forecast; positive means the model forecasts too low)");
  lines.push("");
  lines.push(
    table(
      headers,
      scoreRows(tableScores, H, (h) => f(h.biasM)),
    ),
  );
  lines.push("");

  if (m4) lines.push(...renderM4Section(m4, decisions, coverage!, inputs.m4!.ladderOrigins.length, inputs.published ?? null));

  if (inputs.variant) {
    lines.push("## Does conditioning the analogue years on ENSO phase help?");
    lines.push("");
    lines.push(
      `No. Scored over the ${inputs.variant.sharedOrigins} origins where both variants could forecast — ` +
        "the matched variant declines the rest, because narrowing an analogue pool of barely a dozen " +
        "members by ENSO phase often leaves too few to form an ensemble at all:",
    );
    lines.push("");
    lines.push(
      table(
        headers,
        scoreRows(inputs.variant.scores, H, (h) => f(h.maeM)),
      ),
    );
    lines.push("");
    lines.push(
      "The phase used is the one a forecaster could actually have read at each origin: ONI is a " +
        "three-month mean centred on its label, so the newest value available on any day is about two " +
        "months old, and the backtest never looks through that lag. Basin precipitation is the other " +
        "conditioner, and its upper bound is the next section.",
    );
    lines.push("");
  }

  for (const experiment of inputs.experiments ?? []) {
    lines.push(`## ${experiment.heading}`);
    lines.push("");
    for (const paragraph of experiment.body) {
      lines.push(paragraph);
      lines.push("");
    }
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
        ["storage, lowest declared minimum → crest", `${f(storageHm3(curve, 2098, inputs.crestM), 1)} hm³`, "integral of the fitted curve"],
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

const signed = (value: number, digits = 2): string => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;

function m4Summary(decisions: readonly M4Decision[]) {
  const byModel = new Map<string, M4Decision[]>();
  for (const d of decisions) (byModel.get(d.modelId) ?? byModel.set(d.modelId, []).get(d.modelId)!).push(d);
  const everywhere = [...byModel].filter(([, list]) => list.length > 0 && list.every((d) => d.wins)).map(([id]) => id);
  const clearly = [...byModel]
    .filter(([, list]) => list.length > 0 && list.every((d) => d.wins && d.intervalExcludesZero))
    .map(([id]) => id);
  const anyWins = decisions.filter((d) => d.wins);
  return { byModel, everywhere, clearly, anyWins };
}

/**
 * The per-horizon switch, stated where the verdict is: which horizon publishes M4 and why, or
 * why this run did not. A reader of the verdict should not have to reach the M4 section to learn
 * that one row of `forecast.json` comes from another model.
 */
/** A reason as a sentence: the switch's reasons are written as clauses, without a full stop. */
function sentence(text: string): string {
  return text === "" || /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Boosted models behind a snapshot: every fitted design, at every origin, horizon and quantile. */
function fitCount(snapshot: M4Snapshot): string {
  const fitted = snapshot.scores.filter((s) => s.modelId.startsWith("M4-gbm")).length;
  const fits = fitted * snapshot.origins.length * snapshot.horizonDays.length * snapshot.settings.quantiles.length;
  return (Math.round(fits / 100) * 100).toLocaleString("en-US");
}

function publishedLine(
  published: PublishedSwitch,
  snapshot: M4Snapshot | null,
  shippedId: string,
  decisions: readonly M4Decision[],
): string {
  const made = published.horizons.filter((h) => h.published);
  const refused = published.horizons.filter((h) => !h.published);
  const candidates = published.horizons.map((h) => h.horizonDays).join(", ");
  const sameReason = refused.length > 0 && refused.every((h) => h.reason === refused[0]!.reason);
  const refusal = sameReason
    ? sentence(refused[0]!.reason ?? "no reason recorded")
    : refused.map((h) => `${h.horizonDays} d: ${sentence(h.reason ?? "no reason recorded")}`).join(" ");
  if (made.length === 0) {
    return (
      `**${candidates} days would publish ${published.modelId}, but this run falls back to ${shippedId}:** ` +
      `${refusal} Every horizon of \`forecast.json\` is ${shippedId} until the ` +
      "M4 backtest covers the ladder and shows the win again, and the document says so in `horizon_switch`."
    );
  }
  const numbers = made
    .map((h) => {
      const score = snapshot?.scores.find((s) => s.modelId === published.modelId)?.horizons.find((x) => x.horizonDays === h.horizonDays);
      const reference = snapshot?.scores
        .find((s) => s.modelId === snapshot.referenceId)
        ?.horizons.find((x) => x.horizonDays === h.horizonDays);
      const paired = snapshot?.paired.find((p) => p.modelId === published.modelId)?.horizons.find((x) => x.horizonDays === h.horizonDays);
      if (!score || !reference) return "";
      return (
        `at ${h.horizonDays} days, MAE ${f(score.maeM, 2)} m against ${f(reference.maeM, 2)} m, ${pct(score.skillVsPersistence)} better than ` +
        `persistence, band coverage ${pct(score.coverageP10P90)} against ${pct(reference.coverageP10P90)}` +
        (paired
          ? `, paired difference ${signed(paired.maeDifferenceM)} m with a 90% interval of [${signed(paired.low90)}, ${signed(paired.high90)}]`
          : "")
      );
    })
    .filter((text) => text !== "");
  const madeDays = made.map((h) => h.horizonDays).join(" and ");
  const unwired = decisions
    .filter((d) => d.modelId === published.modelId && d.wins && !published.horizons.some((h) => h.horizonDays === d.horizonDays))
    .map((d) => d.horizonDays);
  return (
    `**${madeDays} days ${made.length === 1 ? "publishes" : "publish"} ${published.modelId}; every other horizon publishes ${shippedId}.** ` +
    "The ladder's rule ships a rung where it beats the one before it — a lower MAE and a band no worse calibrated — and the M4 " +
    `backtest below shows ${published.modelId} doing that there${numbers.length > 0 ? `: ${numbers.join("; ")}` : ""}. ` +
    (refused.length > 0
      ? `It is a candidate at ${refused.map((h) => h.horizonDays).join(" and ")} days too, and does not publish there: ${refusal} `
      : "") +
    (unwired.length > 0 ? `(It also meets the rule at ${unwired.join(", ")} d, which is not a candidate horizon.) ` : "") +
    `So \`forecast.json\` publishes its median at ${madeDays} days, banded by its own out-of-sample residuals from that same run, ` +
    `and names the model on the row; the other horizons, the three named scenarios and days-to-threshold stay ${shippedId}, which ` +
    "alone simulates a daily path. If the M4 snapshot stops covering the ladder's origins, the daily run falls back to " +
    `${shippedId} everywhere and says so.`
  );
}

function m4VerdictLine(snapshot: M4Snapshot, decisions: readonly M4Decision[], published: PublishedSwitch | null): string {
  const { everywhere, clearly, anyWins } = m4Summary(decisions);
  const lead = `**M4 (gradient-boosted quantile trees) was run on the same backtest** (\`${snapshot.command}\`, ${snapshot.origins.length} origins).`;
  if (clearly.length > 0) {
    return (
      `${lead} ${clearly.join(", ")} beats ${snapshot.referenceId} at every horizon with a band no worse ` +
      "calibrated and a paired interval that excludes zero; see the M4 section for how the forecast would use it. " +
      "`forecast.json` still publishes M3 until that change is made deliberately."
    );
  }
  if (everywhere.length > 0) {
    return (
      `${lead} ${everywhere.join(", ")} has a lower MAE than ${snapshot.referenceId} at every horizon without a worse ` +
      "band, but not by a margin the paired interval can tell from noise at all of them, so M3 still ships."
    );
  }
  if (anyWins.length > 0) {
    const cells = anyWins.map((d) => `${d.modelId} at ${d.horizonDays} d`).join(", ");
    const tail =
      publishedAt(published).length > 0
        ? `so M3 ships everywhere except ${publishedAt(published).join(" and ")} days, where ${published!.modelId} does (above).`
        : "so M3 still ships.";
    return `${lead} It beats ${snapshot.referenceId} only in places — ${cells} — and nowhere across all horizons, ${tail}`;
  }
  return `${lead} It does not beat ${snapshot.referenceId} at any horizon in any of its forms, and is recorded as a measured negative.`;
}

function renderM4Section(
  snapshot: M4Snapshot,
  decisions: readonly M4Decision[],
  coverage: SnapshotCoverage,
  ladderOrigins: number,
  published: PublishedSwitch | null,
): string[] {
  const H = snapshot.horizonDays;
  const headers = ["model", ...H.map((h) => `h=${h}`)];
  const g = snapshot.settings.gbm;
  const reference = snapshot.scores.find((s) => s.modelId === snapshot.referenceId);
  const cellOf = (score: ModelScore | undefined, horizon: number) => score?.horizons.find((h) => h.horizonDays === horizon);
  const out: string[] = [];

  out.push("## M4 — gradient-boosted quantile trees");
  out.push("");
  out.push(
    "Section 7's last rung, deferred in Phase 5 because no gradient-boosting library exists in a " +
      "TypeScript-only stack (decision 6). `src/lib/models/gbm.ts` is a dependency-free one: histogram " +
      "splits, depth-limited trees, shrinkage, row subsampling, and the pinball loss with each leaf " +
      "re-estimated as the quantile of its residuals; seeded, so a rerun reproduces every tree. One model " +
      `per horizon and per quantile (p10, p50, p90), refitted from scratch at each of the ${snapshot.origins.length} ` +
      `origins on training days whose outcome had been observed by the origin — about ${fitCount(snapshot)} fits in all. ` +
      `Settings, fixed before the full run and not tuned against it: ${g.trees} trees, learning rate ` +
      `${g.learningRate}, depth ${g.maxDepth}, at least ${g.minLeaf} rows a leaf, ${Math.round(g.subsample * 100)}% ` +
      `of rows a tree, ${g.maxBins} bins, one training day in ${snapshot.settings.strideDays}.`,
  );
  out.push("");
  if (!coverage.covers) {
    out.push(
      `**This snapshot is from ${snapshot.generatedAt} and was scored on ${snapshot.origins.length} origins; ` +
        `the ladder above now has ${ladderOrigins}` +
        (coverage.prefix
          ? `, the newest ${coverage.lagDays} days past the snapshot's last — more than the ${M4_SNAPSHOT_MAX_LAG_DAYS} it may trail by.** `
          : `, and the snapshot's (${snapshot.cadence ?? "monthly"}) are not the first of them.** `) +
        `The tables below are internally consistent — M0 and M3 are rescored on the snapshot's own origins — but rerun ` +
        `\`${snapshot.command}\` to bring M4 back into the ladder's tables.`,
    );
    out.push("");
  }
  out.push(
    "Features, every one read at or before the training day: level and its 1–60-day changes and its " +
      "departure from its own trailing year; inflow and its 3–90-day means; production and its 7- and " +
      "30-day means; day of year as sine and cosine; ONI as a forecaster could have read it (two months " +
      "stale, the same `availableAt` the ENSO variant uses) and its three-month change; and **ERA5 " +
      "precipitation at the Paute's single provisional sampling point** (-2.6, -78.6), summed over 7, 30 " +
      "and 90 days ending five days before the day, because ERA5 is published about five days late. That " +
      "last group is one reanalysis grid cell chosen in Phase 0, not a basin average, and today's reanalysis " +
      "rather than the preliminary values a 2018 forecaster would have read.",
  );
  out.push("");
  out.push(
    "Three designs, because whether M3 should be a feature, a target or neither is a measurement: " +
      "`M4-gbm-direct` predicts the h-day level change from the features alone; `M4-gbm-direct-m3` " +
      "predicts the same change with M3's forecast (its predicted change, its ensemble width and the " +
      "operator's stance) among the features; `M4-gbm-m3-residual` predicts M3's error and adds it back, so " +
      "trees that learn nothing leave M3 as it was. M3 at a training day is M3 as it would have been made " +
      "that day — the fit from the first of the month, the stance over the thirty days before, earlier " +
      "years' inflow — and at every scored origin that is the first of a month it reproduces the shipped M3's median " +
      (snapshot.m3AnchorMaxAbsDifferenceM === null
        ? "(none of this run's origins is one, so the check had nothing to compare)."
        : snapshot.m3AnchorMaxAbsDifferenceM === 0
          ? "exactly."
          : `to within ${f(snapshot.m3AnchorMaxAbsDifferenceM, 6)} m.`),
  );
  out.push("");
  if (snapshot.scores.some((sc) => sc.modelId === M4_BLEND.id)) {
    out.push(
      `A fourth row is not fitted at all: \`${M4_BLEND.id}\` is the mean of the shipped M3's median and \`${M4_BLEND.of}\`'s, ` +
        "half each, at every origin both reached, banded like every other rung by its own out-of-sample residuals. The " +
        "per-horizon switch picks a winner; where two forecasts' errors are only partly shared, the mean of the two can " +
        "beat the better of them, and it cannot flip from one model to the other between one day's run and the next. The " +
        "weight is a half because a half needs no fitting.",
    );
    out.push("");
  }

  out.push("### Mean absolute error, metres, on the same origins");
  out.push("");
  out.push(
    table(
      headers,
      scoreRows(snapshot.scores, H, (h) => f(h.maeM)),
    ),
  );
  out.push("");
  out.push("Skill against persistence, and against M3 (1 − MAE/MAE_M3):");
  out.push("");
  out.push(
    table(
      headers,
      snapshot.scores
        .filter((s) => s.modelId !== "M0-persistence")
        .map((score) => [
          score.modelId,
          ...H.map((horizon) => {
            const mine = cellOf(score, horizon);
            const ref = cellOf(reference, horizon);
            if (!mine || !ref) return "—";
            return `${pct(mine.skillVsPersistence)} / ${pct(1 - mine.maeM / ref.maeM)}`;
          }),
        ]),
    ),
  );
  out.push("");

  out.push(`### Paired against ${snapshot.referenceId}: mean of |error| − |error of M3|, metres, with a 90% interval`);
  out.push("");
  out.push(
    "Negative means M4 was closer. The interval is a circular block bootstrap over origins in blocks of " +
      `${snapshot.bootstrapBlockOrigins ?? 6}, because ${snapshot.cadence ?? "monthly"} origins with horizons out to ninety days ` +
      "overlap and are not independent; the percentage is the share of origins at which M4 was the closer of the two.",
  );
  out.push("");
  out.push(
    table(
      headers,
      snapshot.paired.map((p) => [
        p.modelId,
        ...H.map((horizon) => {
          const c = p.horizons.find((x) => x.horizonDays === horizon);
          return c ? `${signed(c.maeDifferenceM)} [${signed(c.low90)}, ${signed(c.high90)}], ${pct(c.winShare)}` : "—";
        }),
      ]),
    ),
  );
  out.push("");

  out.push("### The band");
  out.push("");
  out.push(
    "Coverage of the p10–p90 band as the harness publishes every rung's — the median widened by its own " +
      "out-of-sample residuals — and then of M4's own quantile regressions before any widening (for M3, its " +
      "analogue ensemble):",
  );
  out.push("");
  out.push(
    table(
      headers,
      scoreRows(
        snapshot.scores.filter((s) => s.modelId !== "M0-persistence"),
        H,
        (h) => pct(h.coverageP10P90),
      ),
    ),
  );
  out.push("");
  out.push(
    table(
      headers,
      snapshot.native.map((n) => [n.modelId, ...H.map((horizon) => pct(n.horizons.find((x) => x.horizonDays === horizon)?.coverage))]),
    ),
  );
  out.push("");
  out.push("Pinball loss, metres, calibrated band and then own quantiles, on the same banded origins:");
  out.push("");
  out.push(
    table(
      headers,
      scoreRows(
        snapshot.scores.filter((s) => s.modelId !== "M0-persistence"),
        H,
        (h) => f(h.pinballMeanM),
      ),
    ),
  );
  out.push("");
  out.push(
    table(
      headers,
      snapshot.native.map((n) => [n.modelId, ...H.map((horizon) => f(n.horizons.find((x) => x.horizonDays === horizon)?.pinballMeanM))]),
    ),
  );
  out.push("");

  out.push("### Decision");
  out.push("");
  out.push(
    `The ladder's rule: a horizon is won when the MAE is below ${snapshot.referenceId}'s *and* the published ` +
      "band's coverage is no further from its nominal 80% than M3's. † marks a win whose paired interval " +
      "lies wholly below zero.",
  );
  out.push("");
  const { byModel, everywhere, clearly, anyWins } = m4Summary(decisions);
  out.push(
    table(
      headers,
      [...byModel].map(([id, list]) => [
        id,
        ...H.map((horizon) => {
          const d = list.find((x) => x.horizonDays === horizon);
          if (!d) return "—";
          if (d.wins) return `wins${d.intervalExcludesZero ? " †" : ""}`;
          return d.beatsReferenceOnMae ? "loses (band)" : "loses (MAE)";
        }),
      ]),
    ),
  );
  out.push("");
  if (clearly.length > 0) {
    out.push(
      `**${clearly.join(", ")} beats M3 at every horizon, and clearly.** \`forecast.json\` is not changed by ` +
        "this run; switching the published median is a deliberate change of its own.",
    );
  } else if (everywhere.length > 0) {
    out.push(
      `**${everywhere.join(", ")} beats M3 on MAE at every horizon without a worse band, but not clearly at all ` +
        "of them.** That is not the margin the ladder rule was written to reward, and `forecast.json` keeps M3.",
    );
  } else if (anyWins.length > 0) {
    const cells = anyWins.map((d) => `${d.modelId} at ${d.horizonDays} d${d.intervalExcludesZero ? " †" : ""}`).join(", ");
    if (publishedAt(published).length > 0) {
      out.push(
        `**M4 wins only in places** (${cells}) and no design wins everywhere, so \`forecast.json\` switches by ` +
          `horizon rather than wholesale: **${publishedAt(published).join(" and ")} days publish ${published!.modelId}**, and every other ` +
          "horizon, the scenarios and days-to-threshold publish M3.",
      );
    } else if (published) {
      out.push(
        `**M4 wins only in places** (${cells}) and no design wins everywhere. \`forecast.json\` would publish ` +
          `${published.modelId} at ${published.horizons.map((h) => h.horizonDays).join(", ")} days, but this run fell back to M3: ` +
          sentence(published.horizons.find((h) => !h.published)?.reason ?? ""),
      );
    } else {
      out.push(`**M4 wins only in places** (${cells}) and no variant wins everywhere, so \`forecast.json\` keeps M3.`);
    }
  } else {
    out.push("**M4 does not beat M3 at any horizon in any of its designs.** Recorded as a measured negative.");
  }
  out.push("");

  out.push("### The crisis check at M4's resolution");
  out.push("");
  out.push(
    `M4 forecasts five horizons, not a daily path, so its call on ${snapshot.crisis.thresholdM} m is the first ` +
      "horizon at which the quantile is at or below it — a crossing within 90 days or none. M3 is read the " +
      "same way here (its median and its ensemble's p10 on the same grid), so the two are compared at one " +
      "resolution; the day-by-day, 365-day version in the crisis section below is M3's own. The same strict rule applies: a call " +
      "counts only if sustained to the crossing, and lands no more than a week after it.",
  );
  out.push("");
  out.push(
    table(
      ["level first at or below", "model", "P50 called it from", "P50 lead", "P10 called it from", "P10 lead"],
      snapshot.crisis.episodes.flatMap((e) =>
        e.models.map((m) => [
          e.crossedOn,
          m.modelId,
          m.p50CalledFrom ?? "**never**",
          m.p50LeadDays === null ? "—" : `${m.p50LeadDays} d`,
          m.p10CalledFrom ?? "**never**",
          m.p10LeadDays === null ? "—" : `${m.p10LeadDays} d`,
        ]),
      ),
    ),
  );
  out.push("");
  for (const e of snapshot.crisis.episodes) {
    out.push(`Run-up to ${e.crossedOn}, where each model's P50 / P10 put the crossing (— : not within 90 days):`);
    out.push("");
    const origins = e.models[0]?.runUp.map((r) => r.origin) ?? [];
    out.push(
      table(
        ["origin", ...e.models.map((m) => m.modelId)],
        origins.map((origin) => [
          origin,
          ...e.models.map((m) => {
            const r = m.runUp.find((x) => x.origin === origin);
            return r ? `${r.p50 ?? "—"} / ${r.p10 ?? "—"}` : "—";
          }),
        ]),
      ),
    );
    out.push("");
  }
  out.push(
    "False alarms (P50 named a crossing within thirty days that did not come within sixty days of it), " +
      `over ${snapshot.crisis.originsConsidered} origins: ` +
      snapshot.crisis.falseAlarms.map((a) => `${a.modelId} ${a.count}`).join(", ") +
      ".",
  );
  out.push("");

  out.push("### What the run says");
  out.push("");
  for (const paragraph of M4_FINDINGS) {
    out.push(paragraph);
    out.push("");
  }
  out.push(
    `Runtime: ${snapshot.runtimeSeconds} s of wall clock, one process per fitted design, for the whole run on the machine that produced this snapshot, which ` +
      "is why it is its own command and not part of the CI dry-run or the daily forecast. To refresh it: " +
      `\`${snapshot.command}\`, then \`npm run forecast\` to render it here.`,
  );
  out.push("");
  return out;
}

/**
 * What the M4 run found, in words. Written once the numbers were in and kept beside the code that
 * renders them, so a rerun that changes the verdict above will visibly contradict this paragraph
 * rather than silently keep it — which is the signal to rewrite it.
 *
 * Rewritten 2026-11-17 for the first run on weekly origins (462 of them, snapshot of that date).
 * The paragraphs it replaced were written on 107 first-of-month origins, where under a month
 * every paired interval crossed zero; they are in this file's history.
 */
const M4_FINDINGS: readonly string[] = [
  "**One week out the trees are clearly closer, and the rule still says no.** On 462 weekly origins M3 is 3.5% *worse* " +
    "than persistence at seven days (2.08 m against 2.01 m); the 6% edge it showed on first-of-month origins does not " +
    "survive the denser sample. Every boosted design is closer than M3 there — 1.78 to 1.82 m, a paired gain of 0.26–0.30 m " +
    "with the interval wholly below zero, 9–12% better than persistence — because a week out the level is mostly what the " +
    "operator is doing this week, and the last few days' level change and production say that more directly than a rule " +
    "curve averaged over years. Their bands are also the sharper ones (pinball loss 0.63–0.64 m against M3's 0.72 m, about " +
    "a metre narrower). But the rule's second clause asks for coverage no further from 80% than M3's, M3's happens to sit " +
    "at 79.8%, and the designs' sit at 76.8–79.5%: every one of them loses seven days on the band, by between a third of a " +
    "point and three points of coverage on about 410 banded origins. That is the rule as written, applied as written; " +
    "whether a band that scores better and covers two points less should lose is a question about the rule, and it is the " +
    "owner's.",
  "**The blend is the first rung to beat M3 beyond a week by more than noise.** `M4-blend-m3-direct` is half M3's median " +
    "and half `M4-gbm-direct`'s. At fourteen days it is 0.29 m closer than M3 (3.08 m against 3.37 m; interval " +
    "[−0.40, −0.19]) with a band at 80.0%, and at thirty days 0.25 m closer (5.14 m against 5.39 m; [−0.46, −0.04]) with " +
    "a band at 75.9% against M3's 74.7%. At both it also beats the fitted design it is half of. The two models are wrong " +
    "in different ways — the trees extrapolate the last fortnight, the water balance pulls back toward the rule curve — and " +
    "where they disagree the outcome is more often between them than beyond either. No fitted design does this on its " +
    "own: `M4-gbm-direct`'s fourteen-day gain is 0.16 m with an interval that reaches zero, and at thirty days all three " +
    "are within a few centimetres of M3.",
  "**Past a month the water balance still wins, and the blend only softens the loss.** At sixty days every fitted design " +
    "is worse than M3 by 0.7–0.8 m and at ninety by 1.0–1.6 m, with the paired interval above zero — a measured negative " +
    "in the same sense as M1's. Two months out the level is decided by inflow that has not fallen yet and by how the " +
    "operator responds to the level on the way; the water balance has both built in, and the trees have to learn them from " +
    "a decade of overlapping windows that contains only a handful of drawdowns. Their own quantiles are badly " +
    "overconfident there (35–44% inside a nominal 80%). The blend gives back half of that loss (+0.16 m at sixty days, " +
    "+0.50 m at ninety, both intervals across zero), which is not a reason to publish it there.",
  "**M3 as a feature or as the target is not what helps; averaging with M3 is.** Predicting M3's residual was the design " +
    "most likely to keep M3's long-range skill, since trees that learn nothing leave M3 untouched. It does not, and giving " +
    "the trees M3's forecast as a feature is no better: the three fitted designs are within ten centimetres of each " +
    "other at every horizon to thirty days. What M3 knows reaches the forecast when it is averaged in after the fact, not " +
    "when it is offered to the trees to use or ignore.",
  "**Crisis check.** On this five-horizon grid, read weekly, no model's P50 called the April 2024 crossing; every " +
    "boosted P10 called it ten days out, from 1.7 m above the line, and M3's ensemble P10 three days out. That is " +
    "short-range extrapolation, not early warning. October 2024 was called by M3's P50 twenty-two days out and by its P10 " +
    "twenty-nine; `M4-gbm-m3-residual` matched the P50, while the direct designs and the blend held their P50 above the " +
    "line until the day before and called it on the P10 at twenty-two days. M3 pays for its earlier calls with four false " +
    "alarms in 462 origins against one for each fitted design and two for the blend. Crossings are M3's to call, on its " +
    "daily path, and the blend is not published as a crossing forecast.",
  "**What `forecast.json` does with it (first adopted 2026-09-22; this design and these horizons, 2026-11-17).** It " +
    "switches by horizon, not wholesale: the blend's median at each of seven, fourteen and thirty days where the snapshot " +
    "says it meets the ladder's rule — fourteen and thirty today, not seven — and M3 at every other horizon, for the three " +
    "named scenarios and for the days-to-threshold distribution, which need a daily simulated path nothing boosted " +
    "produces. Earlier designs published at seven days only: `M4-gbm-m3-residual` from 2026-09-22 (it won on the " +
    "provisional rain point), `M4-gbm-direct` from 2026-10-03 (the owner's choice on the verified centroid; from the " +
    "2026-10-03 and -04 origins its median put Mazar above where it started and the reservoir finished 4.7 and 6.9 m " +
    "below it), and M3 again from 2026-10-13. The daily run makes the blend at the live origin exactly as this snapshot " +
    "scored it — the direct design fitted with these settings and features, averaged with that day's M3 — and bands it " +
    "with the residual quantiles recorded here. A run never switches to another design by itself, and a horizon stops " +
    "publishing the blend the first run after a rerun stops showing the win.",
];
