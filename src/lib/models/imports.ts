/**
 * §5.5: the adequacy model's fragile term, the interconnection, measured three ways.
 *
 * The tier at the live origin rests almost entirely on what is assumed about imports from
 * Colombia. This module does two things with that.
 *
 * **Sensitivity (published).** The deficit and the tier at every horizon under each import
 * assumption a reader might hold — the demonstrated ceiling, the 2024 stressed value, and the
 * current regime (what has actually arrived over the regime window) — so the page can show how
 * much of the tier is the assumption. Pure arithmetic on the published requirement.
 *
 * **An export-availability model (an experiment).** XM publishes Colombia's side of the border:
 * useful storage, inflow energy against its historical mean, the spot price against the scarcity
 * price, and demand. Imports as a function of those plus Ecuador's own load — least squares on
 * the matched days, refitted at each origin on outcomes already observed — would replace both
 * fixed ceilings and the cutoff heuristic *if* it forecast what actually arrived better than the
 * rule does over the two episodes where the interconnection mattered: the 2024 Colombian cut
 * and the September 2026 stop. It is scored there, daily, against the shipped rule, with ONI as
 * an optional extra covariate (the other half of §5.5's ONI experiment). Those are the two
 * windows in which Ecuador wanted every GWh it could get, so what arrived is what was available;
 * outside them a low import is as often "not needed" as "not offered", and scoring there would
 * reward a model for predicting Ecuador's demand rather than Colombia's supply.
 */

import { addDays, type IsoDate } from "../util/dates.ts";
import { mean } from "../util/stats.ts";
import { roundOrNull, roundTo } from "../util/numbers.ts";
import type { BalanceDay } from "../features/balance.ts";
import type { DailySeries } from "../features/series.ts";
import { availableAt, type OniSeries } from "../features/enso.ts";
import { importRegime, tierFor, type AdequacyForecast, type AdequacyRules, type Ceilings, type RiskTier } from "./adequacy.ts";

/* ------------------------------------------------------------ sensitivity */

export type ImportCase = "demonstrated" | "stressed" | "current_regime";

export interface SensitivityCase {
  case: ImportCase;
  importGwhDay: number;
  horizons: { horizonDays: number; deficitGwhDay: number; deficitP90: number | null; tier: RiskTier }[];
  worstTier: RiskTier;
  worstTierHorizonDays: number;
}

const TIER_ORDER: readonly RiskTier[] = ["holgado", "vigilancia", "ajustado", "deficit"];

/**
 * The deficit and tier under each import assumption, from the forecast's own requirement and
 * band. `current_regime` is the trailing mean over the regime window whether or not the rule
 * calls it a cutoff; it is absent when too few days were usable to read it.
 */
export function importSensitivity(forecast: AdequacyForecast): SensitivityCase[] {
  const cases: [ImportCase, number | null][] = [
    ["demonstrated", forecast.ceilings.importGwhDay],
    ["stressed", forecast.ceilings.stressedImportGwhDay],
    ["current_regime", forecast.imports.trailingGwhDay],
  ];
  const floor = forecast.ceilings.thermalGwhDay + forecast.ceilings.otherGwhDay;
  return cases.flatMap(([name, imports]) => {
    if (imports === null) return [];
    const horizons = forecast.horizons.map((h) => {
      const supply = floor + imports;
      const deficit = h.requirementGwhDay - supply;
      const p90 = h.requirementP90 === null ? null : h.requirementP90 - supply;
      return { horizonDays: h.horizonDays, deficitGwhDay: deficit, deficitP90: p90, tier: tierFor(deficit, p90, forecast.rules.tightGwhDay) };
    });
    const worst = horizons.reduce((a, b) => (TIER_ORDER.indexOf(b.tier) > TIER_ORDER.indexOf(a.tier) ? b : a));
    return [{ case: name, importGwhDay: imports, horizons, worstTier: worst.tier, worstTierHorizonDays: worst.horizonDays }];
  });
}

/** `adequacy.json`'s `import_sensitivity` block. Additive: the central case is unchanged. */
export function sensitivityBlock(forecast: AdequacyForecast, cases: readonly SensitivityCase[]): Record<string, unknown> {
  return {
    note:
      "El déficit y el nivel de riesgo bajo cada supuesto de importación desde Colombia: el máximo demostrado, " +
      "el valor de estrés de 2024 y el régimen actual (lo que efectivamente llegó en la ventana del régimen). " +
      "El caso central publicado usa uno de ellos; esta tabla muestra cuánto depende el nivel de ese supuesto.",
    central_case: forecast.imports.state === "cutoff" ? "current_regime" : "demonstrated",
    cases: cases.map((c) => ({
      case: c.case,
      import_gwh_day: roundTo(c.importGwhDay, 3),
      worst_tier: c.worstTier,
      worst_tier_horizon_days: c.worstTierHorizonDays,
      horizons: c.horizons.map((h) => ({
        horizon_days: h.horizonDays,
        deficit_gwh_day: roundTo(h.deficitGwhDay, 3),
        deficit_p90: roundOrNull(h.deficitP90, 3),
        tier: h.tier,
      })),
    })),
  };
}

/* ------------------------------------------------------ export availability */

/** The XM system metrics the model reads, by date. */
export interface XmSeries {
  storage: DailySeries;
  inflowEnergy: DailySeries;
  inflowEnergyMean: DailySeries;
  spot: DailySeries;
  scarcity: DailySeries;
}

export function xmSeries(rows: readonly Record<string, string>[]): XmSeries {
  const out: XmSeries = { storage: new Map(), inflowEnergy: new Map(), inflowEnergyMean: new Map(), spot: new Map(), scarcity: new Map() };
  const target: Record<string, keyof XmSeries> = {
    PorcVoluUtilDiar: "storage",
    AporEner: "inflowEnergy",
    AporEnerMediHist: "inflowEnergyMean",
    PrecBolsNaci: "spot",
    PrecEscaAct: "scarcity",
  };
  for (const row of rows) {
    const key = target[row["metric"] ?? ""];
    const value = Number(row["value"]);
    if (key === undefined || row["value"] === "" || !Number.isFinite(value)) continue;
    out[key].set(row["date"]!, value);
  }
  return out;
}

export const EXPORT_FEATURES = [
  "colombia_useful_storage_fraction",
  "colombia_inflow_energy_over_historical_mean",
  "log_spot_over_scarcity_price",
  "ecuador_load_gwh_day",
] as const;

export interface ExportModelOptions {
  /** Trailing days every feature is averaged over at the origin. */
  featureDays: number;
  /** Keep one training day in this many. */
  strideDays: number;
  /** Fewest training rows before a fit is attempted. */
  minRows: number;
  /** Ridge penalty on the standardised coefficients; small, to keep a collinear fit finite. */
  ridge: number;
  withOni: boolean;
}

export const DEFAULT_EXPORT_MODEL: ExportModelOptions = { featureDays: 7, strideDays: 3, minRows: 200, ridge: 1, withOni: false };

function trailing(series: DailySeries, end: IsoDate, days: number): number | null {
  const values: number[] = [];
  for (let back = 0; back < days; back++) {
    const value = series.get(addDays(end, -back));
    if (value !== undefined) values.push(value);
  }
  return values.length >= Math.ceil(days / 2) ? mean(values) : null;
}

/** The feature row at `date`, every value read at or before it; null if any is missing. */
export function exportFeatures(
  xm: XmSeries,
  load: DailySeries,
  date: IsoDate,
  options: ExportModelOptions,
  oni: OniSeries | null,
): number[] | null {
  const storage = trailing(xm.storage, date, options.featureDays);
  const inflow = trailing(xm.inflowEnergy, date, options.featureDays);
  const inflowMean = trailing(xm.inflowEnergyMean, date, options.featureDays);
  const spot = trailing(xm.spot, date, options.featureDays);
  const scarcity = trailing(xm.scarcity, date, options.featureDays);
  const ecuador = trailing(load, date, options.featureDays);
  if (storage === null || inflow === null || !inflowMean || !spot || !scarcity || ecuador === null) return null;
  const row = [storage, inflow / inflowMean, Math.log(spot / scarcity), ecuador];
  if (options.withOni) {
    const reading = oni ? availableAt(oni, date) : null;
    if (reading === null) return null;
    row.push(reading.oni);
  }
  return row;
}

/** Ridge least squares on standardised features; returns a predictor. */
export function fitLinear(rows: readonly number[][], targets: readonly number[], ridge: number): ((row: number[]) => number) | null {
  const n = rows.length;
  if (n === 0) return null;
  const k = rows[0]!.length;
  const means = Array.from({ length: k }, (_, j) => rows.reduce((a, r) => a + r[j]!, 0) / n);
  const sds = Array.from({ length: k }, (_, j) => Math.sqrt(rows.reduce((a, r) => a + (r[j]! - means[j]!) ** 2, 0) / n) || 1);
  const x = rows.map((r) => r.map((v, j) => (v - means[j]!) / sds[j]!));
  const yMean = targets.reduce((a, b) => a + b, 0) / n;
  // Normal equations (XᵀX + λI) β = Xᵀy, solved by Gaussian elimination: k is four or five.
  const a = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => x.reduce((s, r) => s + r[i]! * r[j]!, 0) + (i === j ? ridge : 0)));
  const b = Array.from({ length: k }, (_, i) => x.reduce((s, r, m) => s + r[i]! * (targets[m]! - yMean), 0));
  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let row = col + 1; row < k; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    for (let row = 0; row < k; row++) {
      if (row === col) continue;
      const factor = a[row]![col]! / a[col]![col]!;
      for (let j = col; j < k; j++) a[row]![j]! -= factor * a[col]![j]!;
      b[row]! -= factor * b[col]!;
    }
  }
  const beta = b.map((v, i) => v / a[i]![i]!);
  return (row) => yMean + row.reduce((s, v, j) => s + beta[j]! * ((v - means[j]!) / sds[j]!), 0);
}

export interface ImportPoint {
  window: string;
  origin: IsoDate;
  horizonDays: number;
  realised: number;
  rule: number;
  model: number | null;
}

export interface ImportExperiment {
  withOni: boolean;
  points: ImportPoint[];
  /** Per window and horizon: MAE of the rule and of the model over the origins both reached. */
  summary: { window: string; horizonDays: number; n: number; ruleMae: number; modelMae: number }[];
  /** True only if the model is better in every window at every horizon. */
  better: boolean;
}

export const IMPORT_WINDOWS: readonly { name: string; from: IsoDate; to: IsoDate }[] = [
  { name: "2024 Colombian cut", from: "2024-09-01", to: "2024-11-30" },
  { name: "2026-09 stop", from: "2026-09-01", to: "2026-09-30" },
];

/**
 * Daily origins through each window: what the shipped rule's central case assumed, what the
 * export model predicted from data before the origin, and the mean import that then arrived.
 */
export function importExperiment(
  days: readonly BalanceDay[],
  xm: XmSeries,
  ceilings: Ceilings,
  rules: AdequacyRules,
  horizons: readonly number[],
  options: ExportModelOptions = DEFAULT_EXPORT_MODEL,
  oni: OniSeries | null = null,
): ImportExperiment {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const load: DailySeries = new Map(days.map((d) => [d.date, d.loadGwh]));
  const imports: DailySeries = new Map(days.map((d) => [d.date, d.importGwh]));
  const featureCache = new Map<IsoDate, number[] | null>();
  const features = (date: IsoDate) => {
    if (!featureCache.has(date)) featureCache.set(date, exportFeatures(xm, load, date, options, oni));
    return featureCache.get(date)!;
  };
  const realisedCache = new Map<string, number | null>();
  const realisedOver = (origin: IsoDate, h: number): number | null => {
    const key = `${origin}|${h}`;
    if (realisedCache.has(key)) return realisedCache.get(key)!;
    let total: number | null = 0;
    for (let d = 1; d <= h && total !== null; d++) {
      const value = imports.get(addDays(origin, d));
      total = value === undefined ? null : total + value;
    }
    const out = total === null ? null : total / h;
    realisedCache.set(key, out);
    return out;
  };

  const points: ImportPoint[] = [];
  const last = days.at(-1)?.date ?? "";
  for (const window of IMPORT_WINDOWS) {
    for (let origin = window.from; origin <= window.to && origin <= last; origin = addDays(origin, 1)) {
      if (!byDate.has(origin)) continue;
      const history = days.filter((d) => d.date <= origin);
      const rule = importRegime(history, origin, ceilings, rules).centralGwhDay;
      for (const h of horizons) {
        const realised = realisedOver(origin, h);
        if (realised === null) continue;
        // Training rows: every stride-th day whose outcome had been observed by the origin.
        const rows: number[][] = [];
        const targets: number[] = [];
        for (const day of history) {
          if (day.date < "2018-01-01" || addDays(day.date, h) > origin) continue;
          if ((Date.parse(day.date) / 86_400_000) % options.strideDays !== 0) continue;
          const row = features(day.date);
          const target = realisedOver(day.date, h);
          if (row === null || target === null) continue;
          rows.push(row);
          targets.push(target);
        }
        const here = features(origin);
        const fit = rows.length >= options.minRows ? fitLinear(rows, targets, options.ridge) : null;
        const model = fit && here ? Math.min(ceilings.importGwhDay, Math.max(0, fit(here))) : null;
        points.push({ window: window.name, origin, horizonDays: h, realised, rule, model });
      }
    }
  }

  const summary: ImportExperiment["summary"] = [];
  for (const window of IMPORT_WINDOWS) {
    for (const h of horizons) {
      const both = points.filter((p) => p.window === window.name && p.horizonDays === h && p.model !== null);
      if (both.length === 0) continue;
      summary.push({
        window: window.name,
        horizonDays: h,
        n: both.length,
        ruleMae: mean(both.map((p) => Math.abs(p.rule - p.realised)))!,
        modelMae: mean(both.map((p) => Math.abs(p.model! - p.realised)))!,
      });
    }
  }
  const windowsCovered = new Set(summary.map((s) => s.window));
  const better = windowsCovered.size === IMPORT_WINDOWS.length && summary.every((s) => s.modelMae < s.ruleMae);
  return { withOni: options.withOni, points, summary, better };
}
