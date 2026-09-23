/**
 * §5.5's experiments on the adequacy model, rescored on every run and rendered into
 * `data/reports/adequacy.md`: the band's calibration, ONI as a covariate for the hydro anomaly,
 * and the export-availability model. Each states the rule it had to meet and whether it did;
 * the ones that did not are the report's recorded negatives.
 */

import { addDays } from "../util/dates.ts";
import { mean } from "../util/stats.ts";
import { availableAt, type OniSeries } from "../features/enso.ts";
import {
  backtestAdequacy,
  DEFAULT_BAND,
  POOLED_BAND,
  type AdequacyBacktest,
  type BacktestOptions,
  type BandMethod,
  type BacktestPoint,
  type Ceilings,
} from "./adequacy.ts";
import type { BalanceDay, RationingEpisode } from "../features/balance.ts";
import { EXPORT_FEATURES, IMPORT_WINDOWS, type ImportExperiment } from "./imports.ts";

export interface ReportSection {
  heading: string;
  body: string[];
}

const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(0)}%`);
const f2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(2));

/* ---------------------------------------------------------------- bands */

export const BAND_VARIANTS: readonly { name: string; band: BandMethod }[] = [
  { name: "pooled p10–p90 (version 1)", band: POOLED_BAND },
  { name: "last 24 origins", band: { ...POOLED_BAND, windowOrigins: 24 } },
  { name: "last 36 origins", band: { ...POOLED_BAND, windowOrigins: 36 } },
  { name: "pooled p5–p95", band: { ...POOLED_BAND, quantiles: [0.05, 0.95] } },
  { name: "pooled, adaptive stretch (shipped)", band: DEFAULT_BAND },
  { name: "last 36 origins, adaptive stretch", band: { ...DEFAULT_BAND, windowOrigins: 36 } },
];

export interface BandResult {
  name: string;
  shipped: boolean;
  requirement: { horizonDays: number; coverage: number | null; nBand: number }[];
  hydro: { horizonDays: number; coverage: number | null; nBand: number }[];
  /** Nearer the nominal than version 1 at every horizon, for both components. */
  honestEverywhere: boolean;
  /** The largest distance from the nominal 80% at any horizon, either component. */
  worstDistance: number;
}

export function bandExperiment(
  days: readonly BalanceDay[],
  episodes: readonly RationingEpisode[],
  ceilings: Ceilings,
  options: BacktestOptions,
  shippedBacktest: AdequacyBacktest,
): BandResult[] {
  const coverage = (b: AdequacyBacktest, component: "requirement" | "hydro") =>
    b.scores.find((s) => s.component === component)!.horizons.map((h) => ({ horizonDays: h.horizonDays, coverage: h.coverageP10P90, nBand: h.nBand }));
  const runs = BAND_VARIANTS.map((v) => ({
    ...v,
    backtest: v.band === DEFAULT_BAND ? shippedBacktest : backtestAdequacy(days, episodes, ceilings, { ...options, band: v.band }),
  }));
  const reference = runs[0]!.backtest;
  return runs.map((run) => {
    const requirement = coverage(run.backtest, "requirement");
    const hydro = coverage(run.backtest, "hydro");
    const nearer = (mine: { coverage: number | null }[], theirs: { coverage: number | null }[]) =>
      mine.every((m, i) => m.coverage !== null && theirs[i]?.coverage !== null && Math.abs(m.coverage - 0.8) < Math.abs(theirs[i]!.coverage! - 0.8));
    return {
      name: run.name,
      shipped: run.band === DEFAULT_BAND,
      requirement,
      hydro,
      honestEverywhere: run.backtest !== reference && nearer(requirement, coverage(reference, "requirement")) && nearer(hydro, coverage(reference, "hydro")),
      worstDistance: Math.max(...[...requirement, ...hydro].map((h) => (h.coverage === null ? 1 : Math.abs(h.coverage - 0.8)))),
    };
  });
}

export function bandSection(results: readonly BandResult[]): ReportSection {
  const horizons = results[0]?.requirement.map((r) => r.horizonDays) ?? [];
  const row = (r: BandResult, component: "requirement" | "hydro") =>
    `| ${r.name}${r.shipped ? " **(shipped)**" : ""} | ${component} | ${r[component].map((h) => pct(h.coverage)).join(" | ")} | ` +
    `${r.honestEverywhere ? "yes" : "no"} | ${Math.round(r.worstDistance * 100)} |`;
  const shipped = results.find((r) => r.shipped);
  const honest = results.filter((r) => r.honestEverywhere);
  const best = honest.reduce<BandResult | null>((a, b) => (a === null || b.worstDistance < a.worstDistance - 1e-9 ? b : a), null);
  const worst = (r: BandResult) => `${Math.round(r.worstDistance * 100)} points`;
  return {
    heading: "Band calibration: which method is honest at every horizon (§5.5)",
    body: [
      "Version 1 pooled every earlier origin's residual and covered 60–67% against a nominal 80%. Scored on the same " +
        "origins, the variants below change only how residuals become a band; the medians, and so the MAE tables above, are " +
        "untouched. A variant qualifies only if it is nearer 80% than version 1 at *every* horizon, for the requirement and " +
        "for hydro. The adaptive stretch picks its factor at each origin from the bands already issued before it, so it is " +
        "not tuned on the origins it is scored on; a fixed stretch read off this table would be.",
      [
        `| Method | Component | ${horizons.map((h) => `${h} d`).join(" | ")} | Nearer 80% everywhere | Worst distance from 80% |`,
        `|---|---|${horizons.map(() => "---:").join("|")}|---|---:|`,
        ...results.flatMap((r) => [row(r, "requirement"), row(r, "hydro")]),
      ].join("\n"),
      "Among the methods nearer 80% everywhere, the one shipped is the one whose worst horizon is nearest 80%, the " +
        "simpler on a tie.",
      shipped && best && shipped.worstDistance <= best.worstDistance + 1e-9
        ? `**Shipped: ${shipped.name}** — worst horizon ${worst(shipped)} from 80%. It is the published band from model ` +
          "version 2. The longest horizon rests on the fewest origins, and the stretch can only learn from bands already " +
          "issued, so that is the horizon to read with care."
        : `**The shipped method (${shipped?.name ?? "—"}) is no longer the most honest on today's data**` +
          (best ? `: ${best.name} is, at ${worst(best)} from 80%` : "") +
          " — revisit before trusting the band.",
      `Recorded negatives (not nearer 80% than version 1 at every horizon): ${
        results.filter((r) => !r.honestEverywhere && r !== results[0]).map((r) => r.name).join("; ") || "none"
      }.` +
        (honest.some((r) => !r.shipped)
          ? ` Nearer 80% everywhere but not shipped: ${honest.filter((r) => !r.shipped).map((r) => `${r.name} (worst ${worst(r)})`).join("; ")}.`
          : ""),
    ],
  };
}

/* ------------------------------------------------------------ ONI and hydro */

export interface OniHydroResult {
  horizonDays: number;
  n: number;
  maeWithout: number;
  maeWith: number;
}

/**
 * ONI as a covariate for the hydro term, not as an analogue filter (which was worse): at each
 * origin, a straight line from the ONI a forecaster could read that day to the hydro error the
 * shipped model then made, fitted on earlier origins whose outcome was already in, is added to
 * the forecast. Scored on the same points as the shipped model.
 */
export function oniHydroExperiment(points: readonly BacktestPoint[], oni: OniSeries, horizons: readonly number[], minPrior = 12): OniHydroResult[] {
  return horizons.flatMap((h) => {
    const list = points.filter((p) => p.horizonDays === h).sort((a, b) => (a.origin < b.origin ? -1 : 1));
    let without = 0;
    let withOni = 0;
    let n = 0;
    list.forEach((point, i) => {
      const here = availableAt(oni, point.origin)?.oni;
      if (here === undefined) return;
      const prior = list
        .slice(0, i)
        .filter((p) => addDays(p.origin, h) <= point.origin)
        .flatMap((p) => {
          const x = availableAt(oni, p.origin)?.oni;
          return x === undefined ? [] : [{ x, y: -p.error }];
        });
      if (prior.length < minPrior) return;
      const mx = mean(prior.map((p) => p.x))!;
      const my = mean(prior.map((p) => p.y))!;
      const sxx = prior.reduce((a, p) => a + (p.x - mx) ** 2, 0);
      const slope = sxx > 0 ? prior.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx : 0;
      without += Math.abs(point.error);
      withOni += Math.abs(point.error + my + slope * (here - mx));
      n++;
    });
    return n === 0 ? [] : [{ horizonDays: h, n, maeWithout: without / n, maeWith: withOni / n }];
  });
}

export function oniSection(results: readonly OniHydroResult[]): ReportSection {
  const better = results.length > 0 && results.every((r) => r.maeWith < r.maeWithout);
  return {
    heading: "ONI as a covariate for the hydro term (§5.5)",
    body: [
      "ONI had only been tried as an analogue filter, where it was worse. Here it is a covariate: a line from the ONI " +
        "readable at the origin (two months stale) to the hydro error, fitted on earlier origins only and added to the forecast.",
      [
        "| Horizon | Origins | Hydro MAE, shipped | With ONI |",
        "|---|---:|---:|---:|",
        ...results.map((r) => `| ${r.horizonDays} d | ${r.n} | ${f2(r.maeWithout)} | ${f2(r.maeWith)} |`),
      ].join("\n"),
      better
        ? "**Better at every horizon scored.** Not yet wired: it would enter the hydro term and needs its own version bump."
        : "**Negative: not better at every horizon.** ENSO's grip on the national hydro anomaly, read two months stale, is " +
          "too loose to beat the fitted anomaly and its decay; it stays out. The same covariate was offered to the " +
          "export-availability model below, for Colombian storage.",
    ],
  };
}

/* ------------------------------------------------------------- export model */

export function importSection(plain: ImportExperiment, withOni: ImportExperiment): ReportSection {
  const rows = (e: ImportExperiment) =>
    e.summary.map((s) => `| ${e.withOni ? "export model + ONI" : "export model"} | ${s.window} | ${s.horizonDays} d | ${s.n} | ${f2(s.ruleMae)} | ${f2(s.modelMae)} |`);
  const ships = plain.better || withOni.better;
  const where = (e: ImportExperiment, wins: boolean) =>
    e.summary.filter((s) => (s.modelMae < s.ruleMae) === wins).map((s) => `${s.window} at ${s.horizonDays} d`);
  return {
    heading: "An export-availability model from XM's side of the border (§5.5)",
    body: [
      `Imports from Colombia as a least-squares function of ${EXPORT_FEATURES.map((f) => `\`${f}\``).join(", ")} ` +
        "(trailing seven-day means at the origin), refitted at every origin on the days whose outcome was already " +
        "observed, clamped to the demonstrated ceiling. It would replace both fixed ceilings and the cutoff heuristic only " +
        `if it forecast the import that actually arrived better than the shipped rule over daily origins in *both* windows — ` +
        `${IMPORT_WINDOWS.map((w) => `${w.name} (${w.from} → ${w.to})`).join(" and ")} — at every horizon. Those are the ` +
        "windows in which Ecuador wanted every GWh it could get, so what arrived is what was offered.",
      [
        "| Model | Window | Horizon | Origins | Rule MAE GWh/day | Model MAE |",
        "|---|---|---:|---:|---:|---:|",
        ...rows(plain),
        ...rows(withOni),
      ].join("\n"),
      ships
        ? "**The model beats the rule everywhere it was scored** and should replace the ceilings; it is not wired in this run."
        : `**Negative.** The model (without ONI) is better in ${where(plain, true).join(", ") || "no window"} and worse in ` +
          `${where(plain, false).join(", ") || "none"}; with ONI, worse in ${where(withOni, false).join(", ") || "none"}. ` +
          "Where it wins it is because the rule keeps assuming the demonstrated ceiling until a full regime window of " +
          "near-zero imports has passed; where it loses, the rule's trailing read of what is arriving is the better " +
          "nowcast. Neither wins everywhere, so the ceilings and the cutoff rule stay, and the sensitivity table is what a " +
          "reader should use to weigh the import assumption.",
    ],
  };
}
