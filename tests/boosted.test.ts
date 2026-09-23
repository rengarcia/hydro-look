/**
 * M4's guarantees, tested on a synthetic reservoir that obeys the balance. The one that matters
 * most is look-ahead: a feature row for day `t` must be the same number whether it is built from
 * a series cut at `t` or one cut a year later, because that is the property the per-run caches
 * rely on, and a leak there would flatter every score M4 reports.
 */

import { describe, expect, it } from "vitest";
import { addDays } from "../src/lib/util/dates.ts";
import { levelAt, volumeAt, type Hypsometry } from "../src/lib/features/hydrology.ts";
import type { DailySeries } from "../src/lib/features/series.ts";
import type { OniSeries } from "../src/lib/features/enso.ts";
import { truncate } from "../src/lib/models/backtest.ts";
import {
  boostedModel,
  createM4Cache,
  DEFAULT_M4,
  featureNames,
  featureRow,
  M4_VARIANTS,
  type Covariates,
} from "../src/lib/models/boosted.ts";
import { DEFAULT_WATER_BALANCE, fitAt, simulateLevels, simulatePath, waterBalanceModel } from "../src/lib/models/water-balance.ts";
import type { ForecastContext } from "../src/lib/models/types.ts";

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
  // Precipitation runs past the level record, the way ERA5 runs past a reservoir's last reading.
  for (let i = years * 365; i < years * 365 + 30; i++) precip.set(addDays("2014-01-01", i), 99);
  const oni: OniSeries = new Map();
  for (let y = 2013; y <= 2014 + years; y++) {
    for (let m = 1; m <= 12; m++) oni.set(`${y}-${String(m).padStart(2, "0")}`, Math.sin(y * 12 + m));
  }
  return { levels, inflow, production, covariates: { oni, precip } satisfies Covariates };
}

const DATA = reservoir(7);
const CREST = Math.max(...DATA.levels.values());

function contextAt(origin: string, horizons: readonly number[] = [7, 30]): ForecastContext {
  return {
    origin,
    horizonDays: horizons,
    levels: truncate(DATA.levels, origin),
    inflow: truncate(DATA.inflow, origin),
    production: truncate(DATA.production, origin),
    crestM: CREST,
  };
}

describe("simulateLevels", () => {
  it("is simulatePath's arithmetic exactly", () => {
    const fit = fitAt(contextAt("2016-06-01"))!;
    const path = Array.from({ length: 90 }, (_, i) => 40 + 30 * Math.sin(i / 9));
    const dated = simulatePath(fit.curve, fit.rule, fit.startLevel, "2016-06-01", path, fit.stance, CREST).map((s) => s.level);
    expect([...simulateLevels(fit.curve, fit.rule, fit.startLevel, path, fit.stance, CREST)]).toEqual(dated);
  });
});

describe("M4 feature rows", () => {
  it("name every column they fill", () => {
    for (const variant of M4_VARIANTS) {
      const row = featureRow(variant, contextAt("2019-03-01"), DATA.covariates, "2019-02-14", 30, createM4Cache());
      expect(row?.features.length).toBe(featureNames(variant).length);
    }
  });

  it("are the same whether the series stops at t or a year later — no look-ahead", { timeout: 60_000 }, () => {
    const days = ["2018-03-01", "2018-07-19", "2018-11-30", "2019-01-01"];
    for (const variant of M4_VARIANTS) {
      for (const day of days) {
        for (const horizon of [7, 30, 90]) {
          const atT = featureRow(variant, contextAt(day), DATA.covariates, day, horizon, createM4Cache());
          const later = featureRow(variant, contextAt(addDays(day, 365)), DATA.covariates, day, horizon, createM4Cache());
          expect(atT).not.toBeNull();
          expect(later).toEqual(atT);
        }
      }
    }
  });

  it("read ERA5 only up to five days before t, and ONI only as it could have been read", () => {
    const variant = M4_VARIANTS[0]!;
    const day = "2018-05-10";
    const names = featureNames(variant);
    const base = featureRow(variant, contextAt(day), DATA.covariates, day, 7, createM4Cache())!;
    // Poison everything a forecaster on `day` could not have seen.
    const precip = new Map(DATA.covariates.precip);
    for (let k = -4; k <= 30; k++) precip.set(addDays(day, k), 1e6);
    const oni = new Map(DATA.covariates.oni);
    for (const month of ["2018-04", "2018-05", "2018-06"]) oni.set(month, 42);
    const poisoned = featureRow(variant, contextAt(day), { oni, precip }, day, 7, createM4Cache())!;
    expect(poisoned.features).toEqual(base.features);
    // And the lag is not so long that the features ignore the rain altogether.
    precip.set(addDays(day, -5), 1e6);
    const seen = featureRow(variant, contextAt(day), { oni, precip }, day, 7, createM4Cache())!;
    expect(seen.features[names.indexOf("era5_precip_paute_provisional_point_7d_mm")]).toBeGreaterThan(1e5);
  });

  it("carry M3's own median at a first-of-month origin, to the last digit", () => {
    for (const origin of ["2018-09-01", "2019-02-01", "2019-10-01"]) {
      const context = contextAt(origin, [7, 30, 90]);
      const shipped = waterBalanceModel(DEFAULT_WATER_BALANCE).forecast(context);
      expect(shipped.map((f) => f.horizonDays)).toEqual([7, 30, 90]);
      const cache = createM4Cache();
      for (const forecast of shipped) {
        const row = featureRow(M4_VARIANTS[2]!, context, DATA.covariates, origin, forecast.horizonDays, cache);
        expect(row!.anchor).toBe(forecast.p50);
      }
    }
  });
});

// Each of these refits boosted trees on a simulated decade; several seconds apiece on a shared
// runner, so they carry their own timeout rather than raising the whole suite's.
describe("boostedModel", () => {
  const settings = { ...DEFAULT_M4, gbm: { ...DEFAULT_M4.gbm, trees: 20 } };

  it("gives the same forecast from a fresh cache as from a warm one, every time", { timeout: 60_000 }, () => {
    const context = contextAt("2019-06-01", [30]);
    const variant = M4_VARIANTS[2]!;
    const warm = createM4Cache();
    const a = boostedModel(variant, DATA.covariates, warm, settings).forecast(context);
    const b = boostedModel(variant, DATA.covariates, warm, settings).forecast(context);
    const c = boostedModel(variant, DATA.covariates, createM4Cache(), settings).forecast(context);
    expect(a).toHaveLength(1);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("returns ordered quantiles on the requested horizons", { timeout: 60_000 }, () => {
    const context = contextAt("2019-06-01");
    const cache = createM4Cache();
    for (const variant of M4_VARIANTS) {
      const a = boostedModel(variant, DATA.covariates, cache, settings).forecast(context);
      expect(a.map((f) => f.horizonDays)).toEqual([7, 30]);
      for (const f of a) {
        expect(f.quantiles!.p10).toBeLessThanOrEqual(f.p50);
        expect(f.p50).toBeLessThanOrEqual(f.quantiles!.p90);
        expect(f.targetDate).toBe(addDays("2019-06-01", f.horizonDays));
      }
    }
  });

  it("ignores covariates dated after the origin", () => {
    const context = contextAt("2019-06-01");
    const precip = new Map(DATA.covariates.precip);
    for (let k = 0; k < 200; k++) precip.set(addDays("2019-06-01", k), 1e6);
    const variant = M4_VARIANTS[0]!;
    const clean = boostedModel(variant, DATA.covariates, createM4Cache(), settings).forecast(context);
    const poisoned = boostedModel(variant, { oni: DATA.covariates.oni, precip }, createM4Cache(), settings).forecast(context);
    expect(poisoned).toEqual(clean);
  });

  it("declines a horizon it has too little history to train, rather than guessing", () => {
    const context = contextAt("2014-05-01", [7, 90]);
    const out = boostedModel(M4_VARIANTS[0]!, DATA.covariates, createM4Cache(), { ...settings, minRows: 50 }).forecast(context);
    expect(out.map((f) => f.horizonDays)).toEqual([7]);
  });
});
