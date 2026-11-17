/**
 * The seven-day switch: M4's median is published only while the committed backtest still covers
 * the ladder and was scored with the configuration this code fits, and the live fit is the same
 * model, on the same information, as the one the backtest scored.
 */

import { describe, expect, it } from "vitest";
import { addDays } from "../src/lib/util/dates.ts";
import { levelAt, volumeAt, type Hypsometry } from "../src/lib/features/hydrology.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import type { OniSeries } from "../src/lib/features/enso.ts";
import type { ModelScore, Prediction } from "../src/lib/models/backtest.ts";
import { blendPredictions, truncate } from "../src/lib/models/backtest.ts";
import { quantile } from "../src/lib/util/stats.ts";
import {
  BASE_FEATURES,
  baseFeatures,
  boostedModel,
  createM4Cache,
  DEFAULT_M4,
  M3_FEATURES,
  M4_BLEND,
  M4_VARIANTS,
  type Covariates,
  type M4Settings,
} from "../src/lib/models/boosted.ts";
import type { M4Snapshot } from "../src/lib/models/m4-scoring.ts";
import {
  bandFromResiduals,
  fitM4Live,
  m4HorizonSwitch,
  m4SwitchCheck,
  M4_SNAPSHOT_MAX_LAG_DAYS,
  PUBLISHED_M4_HORIZON,
  PUBLISHED_M4_HORIZONS,
  PUBLISHED_M4_ID,
  snapshotCoverage,
} from "../src/lib/models/m4-live.ts";
import { DEFAULT_WATER_BALANCE, waterBalanceModel } from "../src/lib/models/water-balance.ts";

const ORIGINS = ["2018-01-01", "2018-02-01", "2018-03-01"];

function score(modelId: string, mae: number, coverage: number): ModelScore {
  return {
    modelId,
    label: modelId,
    horizons: [7, 90].map((horizonDays) => ({
      horizonDays,
      n: 3,
      maeM: horizonDays === 7 ? mae : 9,
      rmseM: mae,
      biasM: 0,
      skillVsPersistence: 1 - mae / 10,
      nBand: 3,
      pinballMeanM: mae / 3,
      coverageP10P90: coverage,
      ensembleCoverage: 0.6,
      meanBandWidthM: null,
    })),
  };
}

function snapshot(overrides: Partial<M4Snapshot> = {}): M4Snapshot {
  return {
    generatedAt: "2026-09-22T00:00:00Z",
    runtimeSeconds: 1,
    command: "npm run backtest:m4",
    origins: ORIGINS,
    horizonDays: [7, 90],
    settings: DEFAULT_M4,
    features: { base: [...BASE_FEATURES], m3: [...M3_FEATURES] },
    referenceId: "M3-water-balance",
    scores: [score("M0-persistence", 10, 0.8), score("M3-water-balance", 2.3, 0.74), score(PUBLISHED_M4_ID, 2.0, 0.76)],
    native: [],
    paired: [
      { modelId: PUBLISHED_M4_ID, horizons: [{ horizonDays: 7, n: 3, maeDifferenceM: -0.26, low90: -0.45, high90: -0.07, winShare: 0.6 }] },
    ],
    crisis: { thresholdM: 2115, episodes: [], falseAlarms: [], originsConsidered: 3 },
    m3AnchorMaxAbsDifferenceM: 0,
    calibration: [{ modelId: PUBLISHED_M4_ID, horizons: [{ horizonDays: 7, q10: -3.1, q50: 0.2, q90: 2.4, n: 3 }] }],
    ...overrides,
  };
}

describe("m4SwitchCheck", () => {
  it("earns the switch from a current snapshot, with the evidence and the band's residuals", () => {
    const check = m4SwitchCheck(snapshot(), ORIGINS);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.evidence.maeM).toBe(2.0);
    expect(check.evidence.referenceMaeM).toBe(2.3);
    expect(check.evidence.calibration).toEqual({ q10: -3.1, q50: 0.2, q90: 2.4, n: 3 });
    expect(check.evidence.paired?.high90).toBeLessThan(0);
  });

  it("still stands while the ladder is no more than the allowed lag ahead of it", () => {
    // 2018-03-01 to 2018-04-01 is 31 days: a month of slack, as a monthly ladder always allowed.
    expect(m4SwitchCheck(snapshot(), [...ORIGINS, "2018-04-01"]).ok).toBe(true);
    const weekly = ["2018-01-01", "2018-01-08", "2018-01-15"];
    const ahead = [...weekly, "2018-01-22", "2018-01-29", "2018-02-05", "2018-02-12", "2018-02-19"];
    expect(snapshotCoverage(weekly, ahead)).toEqual({ prefix: true, missing: 5, lagDays: 35, covers: true });
    expect(m4SwitchCheck(snapshot({ origins: weekly }), ahead).ok).toBe(true);
  });

  it("falls back once the ladder has run further ahead than that, in words the workflow reruns on", () => {
    const check = m4SwitchCheck(snapshot(), [...ORIGINS, "2018-04-01", "2018-05-01"]);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toContain("scored on 3 origins");
    expect(check.reason).toContain("the ladder now has 5");
    expect(check.reason).toContain("npm run backtest:m4");
    expect(check.reason).toMatch(/no longer covers the ladder/);
    expect(snapshotCoverage(ORIGINS, [...ORIGINS, "2018-04-01", "2018-05-01"])).toMatchObject({ prefix: true, lagDays: 61, covers: false });
    expect(M4_SNAPSHOT_MAX_LAG_DAYS).toBe(35);
  });

  it("falls back when the snapshot was scored on other origins than the ladder's first ones", () => {
    // A monthly snapshot against a weekly ladder: not a prefix, however recent.
    const weekly = ["2018-01-01", "2018-01-08", "2018-01-15", "2018-01-22"];
    expect(snapshotCoverage(ORIGINS, weekly)).toMatchObject({ prefix: false, covers: false });
    expect(m4SwitchCheck(snapshot(), weekly).ok).toBe(false);
    expect(snapshotCoverage([], weekly).covers).toBe(false);
  });

  it("falls back when the origins differ even at the same count", () => {
    expect(m4SwitchCheck(snapshot(), ["2018-01-01", "2018-02-01", "2018-04-01"]).ok).toBe(false);
  });

  it("refuses to publish a configuration the snapshot did not score", () => {
    const other: M4Settings = { ...DEFAULT_M4, gbm: { ...DEFAULT_M4.gbm, trees: 50 } };
    const check = m4SwitchCheck(snapshot({ settings: other }), ORIGINS);
    expect(check.ok).toBe(false);
    expect(m4SwitchCheck(snapshot({ features: { base: ["level_m"], m3: [] } }), ORIGINS).ok).toBe(false);
  });

  it("refuses a snapshot scored on another precipitation basin, in words the workflow reruns on", () => {
    // §1.1: once paute_mazar's ERA5 is adequate the forecast reads it, and a snapshot scored on the
    // provisional point no longer describes the model; `model-and-push.sh` reruns the M4 backtest
    // when the reason says the backtest "no longer covers the ladder".
    const check = m4SwitchCheck(snapshot(), ORIGINS, DEFAULT_M4, PUBLISHED_M4_ID, PUBLISHED_M4_HORIZON, "paute_mazar");
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toMatch(/no longer covers the ladder/);
    expect(check.reason).toContain("`paute`");
    expect(check.reason).toContain("`paute_mazar`");
    // A snapshot scored on the centroid earns the switch there, and only there.
    const onCentroid = snapshot({ precipBasin: "paute_mazar", features: { base: baseFeatures("paute_mazar"), m3: [...M3_FEATURES] } });
    expect(m4SwitchCheck(onCentroid, ORIGINS, DEFAULT_M4, PUBLISHED_M4_ID, PUBLISHED_M4_HORIZON, "paute_mazar").ok).toBe(true);
    expect(m4SwitchCheck(onCentroid, ORIGINS).ok).toBe(false);
    expect(baseFeatures("paute_mazar")).toContain("era5_precip_paute_mazar_7d_mm");
    expect(baseFeatures()).toEqual([...BASE_FEATURES]);
  });

  it("falls back when the snapshot recorded no band for the model, or none at all", () => {
    expect(m4SwitchCheck(snapshot({ calibration: undefined }), ORIGINS).ok).toBe(false);
    expect(m4SwitchCheck(snapshot({ calibration: [{ modelId: PUBLISHED_M4_ID, horizons: [] }] }), ORIGINS).ok).toBe(false);
  });

  it("falls back when a rerun no longer shows the win under the ladder rule", () => {
    const losing = snapshot({
      scores: [score("M0-persistence", 10, 0.8), score("M3-water-balance", 2.3, 0.8), score(PUBLISHED_M4_ID, 2.4, 0.8)],
    });
    expect(m4SwitchCheck(losing, ORIGINS).ok).toBe(false);
    // A lower MAE bought with a worse band is not a win either.
    const worseBand = snapshot({
      scores: [score("M0-persistence", 10, 0.8), score("M3-water-balance", 2.3, 0.79), score(PUBLISHED_M4_ID, 2.0, 0.6)],
    });
    const refused = m4SwitchCheck(worseBand, ORIGINS);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toContain("does not beat M3-water-balance at 7 d under the ladder rule");
    expect(refused.reason).toContain("its MAE is lower, 2.00 m against 2.30 m, but its band covers 60.0% against 79.0%");
  });

  it("has nothing to switch on without a snapshot", () => {
    expect(m4SwitchCheck(null, ORIGINS)).toEqual({ ok: false, reason: "no committed M4 backtest snapshot" });
  });
});

describe("bandFromResiduals", () => {
  it("widens the median by the residual quantiles", () => {
    expect(bandFromResiduals(2130, { q10: -3, q90: 2 })).toEqual({ p10: 2127, p90: 2132 });
  });

  it("always contains the median, even when every residual fell one side", () => {
    const band = bandFromResiduals(2130, { q10: 0.5, q90: 3 });
    expect(band.p10).toBeLessThanOrEqual(2130);
    expect(band.p90).toBeGreaterThanOrEqual(2130);
    const low = bandFromResiduals(2130, { q10: -4, q90: -1 });
    expect(low.p10).toBeLessThanOrEqual(2130);
    expect(low.p90).toBeGreaterThanOrEqual(2130);
  });
});

describe("m4HorizonSwitch", () => {
  const live = { horizonDays: 7, p50: 2133.4, ownP10: 2132, ownP90: 2134.5, anchorP50: 2134.9 };

  it("overrides the horizon that earned it, banded from the snapshot's residuals, and names the evidence", () => {
    const check = m4SwitchCheck(snapshot(), ORIGINS);
    if (!check.ok) throw new Error("expected the switch");
    const out = m4HorizonSwitch([{ horizonDays: 7, evidence: check.evidence, live, fallback: null }], "M3-water-balance");
    expect(out.overrides).toHaveLength(1);
    const o = out.overrides[0]!;
    expect(o.horizonDays).toBe(PUBLISHED_M4_HORIZON);
    expect(o.modelId).toBe(PUBLISHED_M4_ID);
    expect(o.p50).toBe(2133.4);
    expect(o.p10).toBeCloseTo(2133.4 - 3.1, 9);
    expect(o.p90).toBeCloseTo(2133.4 + 2.4, 9);
    expect(o.p10).toBeLessThanOrEqual(o.p50);
    expect(o.p50).toBeLessThanOrEqual(o.p90);
    expect(o.bandSource).toContain("m4-backtest.json");
    expect(o.backtest.mae_m).toBe(2.0);
    expect(out.summary["status"]).toBe("published");
    expect(out.summary["published_model"]).toBe(PUBLISHED_M4_ID);
    expect(out.summary["published_horizons"]).toEqual([7]);
  });

  it("makes no override and says why when every candidate falls back", () => {
    const stale = (horizonDays: number) => ({ horizonDays, evidence: null, live: null, fallback: "the snapshot is stale" });
    const out = m4HorizonSwitch(PUBLISHED_M4_HORIZONS.map(stale), "M3-water-balance");
    expect(out.overrides).toEqual([]);
    expect(out.summary["status"]).toBe("fallback");
    expect(out.summary["published_model"]).toBe("M3-water-balance");
    // One reason shared by every horizon is said once: the workflow greps it.
    expect(out.summary["reason"]).toBe("the snapshot is stale");
    expect(out.summary["horizon_days"]).toBe(PUBLISHED_M4_HORIZON);
    expect(out.summary["published_horizons"]).toEqual([]);
  });

  it("publishes where it won and names each horizon it did not, with its own reason", () => {
    const check = m4SwitchCheck(snapshot(), ORIGINS);
    if (!check.ok) throw new Error("expected the switch");
    const out = m4HorizonSwitch(
      [
        { horizonDays: 7, evidence: null, live: null, fallback: "band further from 80%" },
        { horizonDays: 14, evidence: check.evidence, live: { ...live, horizonDays: 14 }, fallback: null },
        { horizonDays: 30, evidence: check.evidence, live: null, fallback: null },
      ],
      "M3-water-balance",
    );
    expect(out.overrides.map((o) => o.horizonDays)).toEqual([14]);
    expect(out.summary["status"]).toBe("published");
    expect(out.summary["candidate_horizons"]).toEqual([7, 14, 30]);
    expect(out.summary["published_horizons"]).toEqual([14]);
    expect(out.summary["horizons"]).toEqual([
      { horizon_days: 7, published_model: "M3-water-balance", status: "fallback", reason: "band further from 80%" },
      { horizon_days: 14, published_model: PUBLISHED_M4_ID, status: "published", reason: null },
      {
        horizon_days: 30,
        published_model: "M3-water-balance",
        status: "fallback",
        reason: `${PUBLISHED_M4_ID} could not be fitted at the live origin`,
      },
    ]);
    expect(String(out.summary["reason"])).toContain("at 14 d under the ladder's rule");
    expect(String(out.summary["reason"])).toContain("7 d: band further from 80%");
  });
});

// ------------------------------------------------------------------------------------------
// The live fit, on a synthetic reservoir. Fewer trees than the published configuration, because
// what is tested is the plumbing — the same model on the same information — not the skill.

const TRUTH: Hypsometry = {
  areaCoefficient: 1277,
  areaExponent: 1.9,
  datumM: 2060,
  turbineM3sPerMw: 0.65,
  rmseDeltaLevelM: 0,
  days: 0,
  fitCeilingM: 2150,
};

function reservoir(years: number) {
  const levels: DailySeries = new Map();
  const inflow: DailySeries = new Map();
  const production: DailySeries = new Map();
  const precip: DailySeries = new Map();
  let level = 2130;
  for (let i = 0; i < years * 365; i++) {
    const date = addDays("2014-01-01", i);
    const q = 60 + 55 * Math.sin((i / 365) * 2 * Math.PI) + 12 * Math.sin(i / 3.3);
    const mw = Math.min(170, Math.max(0, 95 + 6 * (level - 2128) + 18 * Math.sin(i / 11)));
    levels.set(date, level);
    inflow.set(date, q);
    production.set(date, mw * 24);
    precip.set(date, Math.max(0, 8 + 7 * Math.sin((i / 365) * 2 * Math.PI) + 5 * Math.sin(i / 2.1)));
    level = levelAt(TRUTH, volumeAt(TRUTH, level) + 86_400 * (q - TRUTH.turbineM3sPerMw * mw));
  }
  const oni: OniSeries = new Map();
  for (let y = 2013; y <= 2014 + years; y++) {
    for (let m = 1; m <= 12; m++) oni.set(`${y}-${String(m).padStart(2, "0")}`, Math.sin(y * 12 + m));
  }
  return { levels, inflow, production, covariates: { oni, precip } satisfies Covariates };
}

const DATA = reservoir(6);
const CREST = Math.max(...DATA.levels.values());
const QUICK: M4Settings = { ...DEFAULT_M4, gbm: { ...DEFAULT_M4.gbm, trees: 15 } };

describe("fitM4Live", () => {
  it("is the backtest's model at that origin, fitted only on what was known there", { timeout: 60_000 }, () => {
    const origin = "2019-03-01";
    const live = fitM4Live({ origin, ...DATA, crestM: CREST }, PUBLISHED_M4_HORIZON, QUICK, "M4-gbm-direct");
    expect(live).not.toBeNull();
    expect(live!.horizonDays).toBe(7);

    // The harness's way: every series cut at the origin before the model sees it.
    const variant = M4_VARIANTS.find((v) => v.id === "M4-gbm-direct")!;
    const [harness] = boostedModel(variant, DATA.covariates, createM4Cache(), QUICK).forecast({
      origin,
      horizonDays: [7],
      levels: truncate(DATA.levels, origin),
      inflow: truncate(DATA.inflow, origin),
      production: truncate(DATA.production, origin),
      crestM: CREST,
    });
    expect(live!.p50).toBe(harness!.p50);
    expect(live!.ownP10).toBe(harness!.quantiles!.p10);
    expect(live!.ownP10).toBeLessThanOrEqual(live!.p50);
    expect(live!.p50).toBeLessThanOrEqual(live!.ownP90);

    // The direct design does not read M3, so it reports no anchor.
    expect(live!.anchorP50).toBeNull();

    // At a first-of-month origin a design that reads M3 is anchored on the shipped M3's median.
    const residual = fitM4Live({ origin, ...DATA, crestM: CREST }, PUBLISHED_M4_HORIZON, QUICK, "M4-gbm-m3-residual");
    const m3 = waterBalanceModel(DEFAULT_WATER_BALANCE).forecast({
      origin,
      horizonDays: [7],
      levels: truncate(DATA.levels, origin),
      inflow: truncate(DATA.inflow, origin),
      production: truncate(DATA.production, origin),
      crestM: CREST,
    });
    expect(residual!.anchorP50).toBeCloseTo(m3[0]!.p50, 9);

    // The published design is the blend: half the shipped M3's median, half the direct design's,
    // and the same mean of their own spreads — what `blendPredictions` scores in the backtest.
    expect(PUBLISHED_M4_ID).toBe(M4_BLEND.id);
    expect(M4_BLEND.of).toBe("M4-gbm-direct");
    const blend = fitM4Live({ origin, ...DATA, crestM: CREST }, PUBLISHED_M4_HORIZON, QUICK);
    expect(blend!.p50).toBeCloseTo((m3[0]!.p50 + live!.p50) / 2, 9);
    expect(blend!.anchorP50).toBeCloseTo(m3[0]!.p50, 9);
    const scored = blendPredictions(
      [asPrediction("M3-water-balance", m3[0]!.p50, quantile([...m3[0]!.ensemble], 0.1), quantile([...m3[0]!.ensemble], 0.9))],
      [asPrediction("M4-gbm-direct", live!.p50, live!.ownP10, live!.ownP90)],
      M4_BLEND.id,
      M4_BLEND.weight,
    )[0]!;
    expect(blend!.p50).toBeCloseTo(scored.p50, 9);
    expect(blend!.ownP10).toBeCloseTo(scored.ensembleP10!, 9);
    expect(blend!.ownP90).toBeCloseTo(scored.ensembleP90!, 9);
    expect(fitM4Live({ origin, ...DATA, crestM: CREST }, PUBLISHED_M4_HORIZON, QUICK, "M4-nonesuch")).toBeNull();
  });
});

function asPrediction(modelId: string, p50: number, p10: number | null, p90: number | null): Prediction {
  return {
    modelId,
    origin: "2019-03-01",
    horizonDays: 7,
    targetDate: "2019-03-08",
    actual: 0,
    p50,
    ensembleP10: p10,
    ensembleP90: p90,
    p10: null,
    p90: null,
  };
}
