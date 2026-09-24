/**
 * `data/reports/adequacy.md` — what the adequacy model was measured at, negatives included.
 *
 * Written in English like the rest of the code and unlike the site, for the same reason the
 * backtest report is: this is the working record, and its readers are the people arguing with
 * the method rather than the people reading the number.
 */

import type { AdequacyBacktest, AdequacyForecast, Ceilings, ComponentScores, CrisisCheck, HorizonScore } from "./adequacy.ts";
import type { RejectedDay } from "../features/balance.ts";
import type { SensitivityCase } from "./imports.ts";
import type { ReportSection } from "./adequacy-experiments.ts";
import type { IsoDate } from "../util/dates.ts";

export interface ReportInputs {
  generatedAt: string;
  forecast: AdequacyForecast;
  backtest: AdequacyBacktest;
  crisis: CrisisCheck;
  ceilings: Ceilings;
  usableDays: number;
  rejected: readonly RejectedDay[];
  range: { first: IsoDate; last: IsoDate };
  /** The deficit and tier under each import assumption (§5.5); omitted, the section is too. */
  sensitivity?: readonly SensitivityCase[];
  /** §5.5's experiments, rendered before the known limits. */
  experiments?: readonly ReportSection[];
}

function fixed(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function pct(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function scoreTable(scores: ComponentScores): string {
  const header = "| Horizon | n | MAE GWh/day | Bias | Persistence MAE | Skill vs persistence |\n" + "|---|---:|---:|---:|---:|---:|\n";
  const rows = scores.horizons
    .map(
      (h: HorizonScore) =>
        `| ${h.horizonDays} d | ${h.n} | ${fixed(h.maeGwhDay)} | ${h.biasGwhDay >= 0 ? "+" : ""}${fixed(h.biasGwhDay)} ` +
        `| ${fixed(h.baselineMaeGwhDay)} | ${pct(h.skillVsPersistence)} |`,
    )
    .join("\n");
  return header + rows;
}

/** §5.5's first step: how much of the tier is the import assumption. */
function sensitivityLines(cases: readonly SensitivityCase[]): string[] {
  if (cases.length === 0) return [];
  const horizons = cases[0]!.horizons.map((h) => h.horizonDays);
  const label: Record<SensitivityCase["case"], string> = {
    demonstrated: "demonstrated ceiling",
    stressed: "stressed (2024)",
    current_regime: "current regime (trailing)",
  };
  return [
    "### How much of the tier is the import assumption",
    "",
    "The central deficit under each import assumption a reader might hold, with the tier it gives at each horizon.",
    "Published in `adequacy.json` as `import_sensitivity`; the central case above is one of these rows.",
    "",
    `| Imports | GWh/day | ${horizons.map((h) => `${h} d`).join(" | ")} | Worst tier |`,
    `|---|---:|${horizons.map(() => "---").join("|")}|---|`,
    ...cases.map(
      (c) =>
        `| ${label[c.case]} | ${fixed(c.importGwhDay)} | ` +
        c.horizons.map((h) => `${h.deficitGwhDay >= 0 ? "+" : ""}${fixed(h.deficitGwhDay)} \`${h.tier}\``).join(" | ") +
        ` | \`${c.worstTier}\` (${c.worstTierHorizonDays} d) |`,
    ),
    "",
    "Deficit in GWh/day, positive meaning short. The spread between the rows is the part of the tier that rests on",
    "Colombia rather than on water.",
    "",
  ];
}

export function renderAdequacyReport(inputs: ReportInputs): string {
  const { forecast, backtest, crisis, ceilings } = inputs;
  const rules = forecast.rules;
  const demand = backtest.scores.find((s) => s.component === "demand")!;
  const hydro = backtest.scores.find((s) => s.component === "hydro")!;
  const requirement = backtest.scores.find((s) => s.component === "requirement")!;

  const belowDemand = inputs.rejected.filter((r) => r.reason === "load below distribution demand");
  const aboveTwice = inputs.rejected.filter((r) => r.reason === "load above twice distribution demand");

  const hydro90 = hydro.horizons.find((h) => h.horizonDays === 90);
  const hydro7 = hydro.horizons.find((h) => h.horizonDays === 7);

  const lines: string[] = [];

  lines.push(
    "# Energy adequacy — what the model is, and what it was measured at",
    "",
    `Generated ${inputs.generatedAt} from ${inputs.usableDays} usable national-balance days, ` +
      `${inputs.range.first} → ${inputs.range.last}. Origin ${forecast.origin}.`,
    "",
    "This is section 7's target 3: expected deficit in GWh per day over the horizon, and the risk",
    "tiers read off it. It is the number the site's adequacy tile shows, and the `risk_tier` the",
    "narrative panel of Phase 6b is meant to be handed rather than allowed to choose.",
    "",
    "## The identity",
    "",
    "```",
    "deficit(h) = unsuppressed demand(h) − hydro(h) − thermal − imports − other",
    "```",
    "",
    "Every term is either forecast with a backtest below it or an explicit input in",
    "`data/reference/adequacy_assumptions.csv`. Three of the four are not the obvious quantity,",
    "and in each case the obvious quantity is wrong:",
    "",
    "- **Demand is served load, not `demanda_distribucion`.** The distribution utilities' metering",
    "  misses transmission losses and every consumer buying outside them: across the record it is",
    "  89–97% of what generators plus interconnections actually delivered, a gap of 3 to 11 GWh a",
    "  day. That is larger than the entire Colombian interconnection, so asking whether supply",
    "  covers `demanda_distribucion` is asking the wrong question by about one Colombia. The",
    "  quantity used is `total_generacion + total_importacion − total_exportacion`.",
    "- **Demand is unsuppressed, not measured.** Measured load fell from 78 GWh/day in September",
    "  2024 to 55 in late October. A model fitted through that learns that Ecuador needs less",
    "  electricity during a drought.",
    "- **Hydro is normalised by the fitted demand trend, not by measured load.** Raw hydro GWh is",
    "  not stationary — the fleet and the demand it serves have both grown — and a day-of-year",
    "  climatology of it comes out 6 to 12 GWh/day low. Normalising by *measured* load fixes the",
    "  trend and breaks the crisis: during rationing hydro and load fall together, the ratio holds",
    "  up, and projecting it against unsuppressed demand claims 48 GWh of hydro for November 2024",
    "  against the 34 that was generated. Normalising by the fitted unsuppressed trend — a smooth",
    "  curve that knows nothing about the drought — removes the growth and leaves the drought in.",
    "",
    "## Which days the model is allowed to see",
    "",
    `${inputs.usableDays} of ${inputs.usableDays + inputs.rejected.length} balance days are usable ` +
      `(${((100 * inputs.usableDays) / (inputs.usableDays + inputs.rejected.length)).toFixed(2)}%).`,
    "",
    "`parse/smec.ts` already rejects pages served before their metering arrived, by requiring",
    "distribution demand to be at least 20% of generation. That gate is one-sided: it catches a",
    "page whose *demand* has not landed and passes one whose *generation* has not. 2018-01-05 is",
    "the proof — 4.19 GWh of national generation against 62.72 GWh of demand the same day, a 94%",
    "collapse of exactly the shape this project exists to detect, sitting in the committed table",
    "because 62.72/4.19 sails past a 0.2 floor.",
    "",
    "The symmetric test is arithmetic rather than statistical. Served load is distribution demand",
    "plus transmission losses plus unregulated demand, and the last two are positive, so a day",
    "whose generation plus net imports falls below its own distribution demand is not a day — it",
    `is a page caught mid-render. That is ${belowDemand.length} days. The ratio's own distribution`,
    "backs the cut: its first percentile is 1.019 and the four years 2021–2024 never dip below",
    "1.044.",
    "",
    `The same ratio catches the opposite fault: ${aboveTwice.length} days above twice distribution demand ` +
      `(${aboveTwice.map((r) => r.date).join(", ") || "none"}). On 2025-07-17 and -18 CENACE published`,
    "`generación de otros tipos` at 153.62 and 113.19 GWh against a fortnight's median of 2.2 —",
    "flagged in its own `pct_dia` column at +6,284% — lifting national generation to 247 GWh on a",
    "91 GWh day. The opening month of the record, which runs to 1.76, is deliberately left in: an",
    "early metering scope is not the same claim as one concept contradicting its neighbours",
    "seventy-fold.",
    "",
    "An earlier attempt used reported transmission losses as the detector, on the reasoning that a",
    "partial page shows them strongly negative. It was dropped: `total_perdidas_transporte` is",
    "independently metered rather than a residual, and the November 2024 rationing days carry",
    "losses at −11% of load while being entirely real.",
    "",
    "## What is not in the model, and why",
    "",
    "Section 7 specifies fleet hydro energy *from levels, inflows and plant limits*. That link is",
    "not here because the data does not carry it. National hydro energy against the sum of this",
    "repository's measured inflows:",
    "",
    "| | Correlation with national hydro GWh/day |",
    "|---|---:|",
    "| Mazar inflow, same day | r = 0.18 |",
    "| Mazar inflow, 30-day means | r = 0.36 |",
    "| Mazar + Coca Codo + Agoyán, same day | r = 0.27 |",
    "| Mazar + Coca Codo + Agoyán, 30-day means | r = 0.47 |",
    "",
    "and the implied conversion drifts from 0.090 GWh per m³/s in 2016 to 0.165 in 2026 — an 83%",
    "drift, which is fleet growth rather than hydrology. The measured basins are all Amazon slope;",
    "Daule-Peripa, Pucará, San Francisco, Toachi-Pilatón and the private fleet are not measured",
    "here at all, and the Pacific slope runs in the opposite phase, which is the reason the",
    "interconnected system works. Wiring a 0.47 correlation into an adequacy number would be",
    "inventing precision. This is a recorded negative, not a to-do.",
    "",
    "## Backtest",
    "",
    `Rolling monthly origins from ${backtest.origins[0] ?? "—"} to ${backtest.origins.at(-1) ?? "—"}, ` +
      `${backtest.origins.length} of them, on the same three rules the level forecast uses: every model`,
    "sees only its own past, the band is calibrated from residuals at strictly earlier origins, and",
    "the components are scored on the origins they all reached. Targets falling inside a rationing",
    "episode are dropped rather than scored — on a day of rationing the realised load is the load",
    "that was *allowed*, so a demand model that predicted it correctly would be a model of the",
    "cuts.",
    "",
    "### Unsuppressed demand",
    "",
    scoreTable(demand),
    "",
    `Growth fitted at the live origin: ${fixed(forecast.demand.growthPctPerYear)}% a year, over ` +
      `${forecast.demand.days} unsuppressed days, anchored on the last ${forecast.demand.anchorDays} of them ` +
      `at a factor of ${fixed(forecast.demand.anchor, 4)}.`,
    "",
    "**This rung does not beat the baseline, and the comparison is not the point.** Over a window",
    "mean a trailing 28-day mean is a very strong predictor of load — load is that persistent at",
    "the monthly scale — and the fitted model ties it or loses by a few per cent. What the",
    "baseline cannot do is answer the question at all during an episode: a trailing mean of",
    'measured load *is* the suppressed load, so used as "unsuppressed demand" it would have',
    "reported that Ecuador wanted 55 GWh/day in late October 2024 and that there was therefore no",
    "shortfall, at the precise moment there were fourteen hours a day of cuts. The crisis check",
    "below is where this rung earns its place; the MAE table is here to show it costs nothing",
    "outside an episode to keep it.",
    "",
    "The anchor is what makes that true. Fitted without one — a four-year trend evaluated at a",
    "date — the model lost to the trailing mean by 70% at seven days and 15% at ninety, because a",
    "trend fitted over four years can sit two or three GWh from where demand actually is today.",
    "",
    "### Hydro energy",
    "",
    scoreTable(hydro),
    "",
    "This is the weak term and the report says so rather than burying it. Against a trailing",
    `28-day mean the model is ${pct(hydro7?.skillVsPersistence)} better at 7 days and ` +
      `${pct(hydro90?.skillVsPersistence)} at 90, with a flat spot at 30 — which is to say that the`,
    "gain over assuming the last month repeats is real but small, and the adequacy number leans on",
    "the demand model and the ceilings at least as much as on any skill in forecasting water. An",
    "earlier iteration of this rung was scored with the *realised* load handed to it rather than",
    "the forecast one and read 28% at 7 days and 24% at 90. That number was borrowed from knowing",
    "the future demand; it is recorded here because the gap between it and the 9% above is exactly",
    "the trap that component-wise evaluation sets.",
    "",
    "This term at seven days is also §7's target 4, national hydro generation a week out, so it",
    "carries a band of its own, calibrated the same way as the requirement's: residual quantiles",
    "from strictly earlier origins, clamped to contain their centre. Coverage of that p10–p90:",
    "",
    "| Horizon | Origins with a band | Coverage |",
    "|---|---:|---:|",
    hydro.horizons.map((h) => `| ${h.horizonDays} d | ${h.nBand} | ${pct(h.coverageP10P90, 0)} |`).join("\n"),
    "",
    "Rungs that lost, scored on the same origins, the same window-mean target and the same",
    "exclusion of suppressed days as the shipped one:",
    "",
    "| Rung | 7 d | 30 d | 90 d | Bias at 90 d |",
    "|---|---:|---:|---:|---:|",
    "| Shipped (normalised by the demand trend) | +9% | +0% | +8% | −1.0 |",
    "| Share of *measured* load, persisted | +1% | −2% | −3% | −0.7 |",
    "| Analogue years scaled by a 3-year capability maximum | −117% | −97% | −65% | −9.3 |",
    "| Analogue years matched on Mazar's level tercile | −108% | −90% | +4% | −6.0 |",
    "| Day-of-year climatology of raw hydro GWh | −153% | −154% | −95% | −11.6 |",
    "| Analogue years unscaled | −158% | −148% | −132% | −13.4 |",
    "",
    "Skill is against a trailing 28-day mean; bias is GWh/day, negative meaning the rung",
    "under-forecasts. The three analogue rungs decline origins where too few years carry a",
    "complete path, so they are scored on fewer of them — 59, 59 and 21 of 85 at seven days — and",
    "the level-matched rung's +4% at ninety days rests on three origins and should be read as",
    "nothing at all.",
    "",
    "What sinks every analogue rung is the same thing: a bias of 5 to 13 GWh/day, low, which is",
    "fleet growth that a capability ratio does not keep up with. Matching analogue years on Mazar's",
    "level — the one rung that would have tied this model to Phase 5's reservoir state, and the",
    "reason it was tried — is among them.",
    "",
    "### Net requirement (demand − hydro)",
    "",
    scoreTable(requirement),
    "",
    "This is the quantity the band is calibrated on, because it is the one the deficit is a fixed",
    "shift of, and because it is observable on every unsuppressed day — unlike the deficit itself.",
    "Coverage of the published p10–p90:",
    "",
    "| Horizon | Origins with a band | Coverage |",
    "|---|---:|---:|",
    requirement.horizons.map((h) => `| ${h.horizonDays} d | ${h.nBand} | ${pct(h.coverageP10P90, 0)} |`).join("\n"),
    "",
    "Against a nominal 80%. Version 1 took the 10th and 90th percentile of every earlier residual",
    "and covered 60–67%, falling with the horizon, because the residual distribution is not",
    "stationary — the fleet that produced the errors of 2019 is not the fleet of 2026. Since version",
    "2 those quantiles are stretched, per horizon, by the smallest factor at which the bands already",
    "issued at earlier origins would have covered 80%; at the live origin the stretch is " +
      [...backtest.calibration].map(([h, c]) => `×${fixed(c.stretch ?? 1)} at ${h} d`).join(", ") +
      ".",
    `The longest horizon is calibrated from the fewest origins (${requirement.horizons.at(-1)?.nBand ?? 0} at ninety days) and`,
    "is the one to read with care. Every method tried is compared under §5.5 below.",
    "",
    "## The ceilings",
    "",
    "| Quantity | GWh/day |",
    "|---|---:|",
    `| Thermal | ${fixed(ceilings.thermalGwhDay)} |`,
    `| Imports, normal | ${fixed(ceilings.importGwhDay)} |`,
    `| Imports, stressed | ${fixed(ceilings.stressedImportGwhDay)} |`,
    `| Other (solar, wind, biomass) | ${fixed(ceilings.otherGwhDay)} |`,
    "",
    `Basis: ${ceilings.basis}`,
    "",
    "The import ceiling is the single most dangerous number here, and it is dangerous in a way",
    "that is already documented rather than hypothetical. Between 2024-10-01 and 2024-11-10, with",
    "Ecuador rationing fourteen hours a day, imports from Colombia ran at 0.11 to 0.14 GWh/day",
    "against the 10.7 they had reached that August — because Colombia was short of water at the",
    "same time, which is what a shared drought does to a shared interconnection. Every horizon",
    "therefore publishes a stressed deficit beside the central one, and a reader who believes the",
    "interconnection is firm is invited to look at the stressed column before believing it.",
    "",
    "### When the central case stops assuming the interconnection",
    "",
    `At this origin the interconnection is treated as **${forecast.imports.state === "cutoff" ? "cut" : "available"}**: ` +
      `imports averaged ${fixed(forecast.imports.trailingGwhDay ?? Number.NaN)} GWh/day over the last ` +
      `${forecast.imports.days} usable days while thermal ran at ${fixed(forecast.imports.trailingThermalGwhDay ?? Number.NaN)}, ` +
      `so the central case assumes ${fixed(forecast.imports.centralGwhDay)} GWh/day of imports.`,
    "",
    `The rule: ${rules.importRegimeWindowDays} days of imports below ${rules.importCutoffGwhDay} GWh/day *while* thermal runs at ` +
      `${Math.round(rules.importCutoffThermalShare * 100)}% or more of its ceiling means the imports are not arriving rather than`,
    "not wanted, and the central case then uses what is arriving, held for the horizon. Low imports",
    "alone would not do: they preceded 68 of the 99 monthly origins since 2018, mostly in wet months",
    "when Ecuador had no use for them. With the thermal condition the rule picks out four — 2024-05,",
    "2024-11 inside the Colombian cutoff, 2026-04 and 2026-05 — and the same four at any share from",
    "60% to 75%. It leaves the tier record above untouched: no new false alarm, no new call.",
    "",
    "The rule was added on 2026-09-22, when imports had been stopped since 2026-09-07. Colombia's own",
    "figures (XM) say that stop was not Colombian scarcity — storage at 79% and a spot price well under",
    "the scarcity threshold — so the cause is something this data cannot see: a line out, a contract,",
    "a dispatch decision. Holding the cut for ninety days is the honest default rather than a",
    "forecast: the 2019 stretch lasted 398 days and the 2024 one about seven weeks.",
    "",
    ...sensitivityLines(inputs.sensitivity ?? []),
    "## Crisis check",
    "",
    "A deficit is a counterfactual: it is the energy that would have been short had nobody",
    "rationed, and no meter records it. During an episode it has an observable shadow — the gap",
    "between the demand the model says the country wanted and the load the meters recorded. If the",
    "identity is right, that gap and the computed deficit should be about the same size.",
    "",
    "| Episode | Days | Modelled demand | Measured load | Suppression | Hydro | Imports | Implied deficit | Deficit at demonstrated imports |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    crisis.episodes
      .map(
        (e) =>
          `| ${e.start} → ${e.end} | ${e.days} | ${fixed(e.modelledDemandGwhDay)} | ${fixed(e.measuredLoadGwhDay)} ` +
          `| ${fixed(e.measuredSuppressionGwhDay)} | ${fixed(e.measuredHydroGwhDay)} | ${fixed(e.measuredImportGwhDay, 3)} ` +
          `| ${fixed(e.impliedDeficitGwhDay)} | ${fixed(e.deficitAtDemonstratedImportsGwhDay)} |`,
      )
      .join("\n"),
    "",
    "All figures GWh/day. **Suppression** and **implied deficit** are the two columns to compare:",
    "they are computed from different sides of the identity and agreeing is the whole test.",
    "",
    "## Tiers",
    "",
    "Cuts on the deficit distribution rather than on its median alone, because the median is the",
    "statistic that missed both 2024 crossings in the level forecast and there is no reason to",
    "expect better here.",
    "",
    "| Tier | Condition |",
    "|---|---|",
    "| `holgado` | the p90 case is still covered |",
    "| `vigilancia` | the p90 is short, the central case is not |",
    `| \`ajustado\` | the central case is short by less than ${rules.tightGwhDay} GWh/day |`,
    `| \`deficit\` | the central case is short by ${rules.tightGwhDay} GWh/day or more |`,
    "",
    `${rules.tightGwhDay} GWh/day is about 5% of 2026 demand and roughly an hour of national`,
    "consumption. The 2024 episode ran at a measured suppression four to five times that, so the",
    "cut is not drawn where the crisis was; it is drawn where a shortfall stops being absorbable by",
    "dispatch and starts being visible to consumers.",
    "",
    "### What the tiers said, month by month",
    "",
    "| Tier at a 30-day horizon | Origins | Rationing began or ran within 30 days |",
    "|---|---:|---:|",
  );

  const thirty = crisis.calls.filter((c) => c.horizonDays === 30);
  for (const tier of ["holgado", "vigilancia", "ajustado", "deficit"] as const) {
    const bucket = thirty.filter((c) => c.tier === tier);
    lines.push(`| \`${tier}\` | ${bucket.length} | ${bucket.filter((c) => c.rationedWithin).length} |`);
  }

  const flagged = thirty.filter((c) => c.tier === "ajustado" || c.tier === "deficit");
  const hits = flagged.filter((c) => c.rationedWithin);
  const followed = thirty.filter((c) => c.rationedWithin);

  lines.push(
    "",
    `Over ${thirty.length} monthly origins, ${followed.length} were followed by rationing inside thirty days and ` +
      `${flagged.length} were flagged \`ajustado\` or \`deficit\`. ${hits.length} of those ${flagged.length} were ` +
      "followed by rationing —",
    `so of the origins this model flagged, ${flagged.length > 0 ? pct(hits.length / flagged.length, 0) : "—"} preceded ` +
      `cuts, and of the origins that preceded cuts it flagged ` +
      `${followed.length > 0 ? pct(hits.length / followed.length, 0) : "—"}. It does not cry wolf and it misses most`,
    "of the wolves, which is the shape you would expect from a model whose weakest term is the",
    "one that decides how much water there is.",
    "",
    "Read the table for what it is. Three episodes is not a sample you can fit a threshold to, and",
    "no threshold here was fitted to them.",
    "",
    ...(inputs.experiments ?? []).flatMap((section) => [`## ${section.heading}`, "", ...section.body.flatMap((p) => [p, ""])]),
    "## Known limits",
    "",
    "1. **Hydro beyond a month is barely better than persistence.** Stated above, and the reason",
    "   the 60- and 90-day bands are as wide as they are.",
    "2. **The hydro term assumes water scales with demand.** It is normalised by the demand trend,",
    "   so a fleet that is water-limited rather than demand-limited will be over-stated, which",
    "   biases the deficit *down* — the unsafe direction. The crisis check is the guard against",
    "   this and the 2024 episode is where to look.",
    "3. **Three episodes.** Every rationing label in `rationing_episodes.csv` comes from ministry",
    "   and press reporting, checked against SMEC demand on 2026-09-24; the 2023 end date is known",
    "   to within a few days. A different end date moves the suppression figures.",
    "4. **Thermal availability is a demonstrated maximum, not an availability declaration.** No",
    "   source this project reaches publishes planned outages, so a thermal fleet with half its",
    "   units out for maintenance looks exactly like one that is available.",
    "5. **Nothing here models the network.** A deficit in GWh/day says the energy is not there. It",
    "   says nothing about whether it could be delivered where it was needed, which is a different",
    "   failure and the one that caused the June 2024 blackout.",
    "",
  );

  return `${lines.join("\n")}\n`;
}
