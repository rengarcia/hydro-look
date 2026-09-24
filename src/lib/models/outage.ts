/**
 * §8a gap 5: the adequacy picture with Coca Codo Sinclair out of service.
 *
 * The central case assumes the hydro fleet delivers what the model forecasts, and nothing in its
 * inputs can see a plant being lost. Coca Codo Sinclair is the one loss that would matter on its
 * own: about half of national hydro, run-of-river, and the Coca's regressive erosion has been
 * advancing towards its intake since the San Rafael falls collapsed in 2020. This is not a
 * forecast of that happening; it is the arithmetic of what the tier would be if it did, published
 * beside the import cases so the page can say how much of the margin is one plant.
 *
 * The loss is the plant's *share* of national hydro over a trailing window, applied to the hydro
 * forecast at each horizon, rather than its trailing energy: the forecast already carries the
 * season, and a share moves with it where a fixed GWh figure would not. Imports stay at the
 * central case's assumption and thermal at its ceiling, because the question is what one plant
 * costs, not what everything going wrong at once costs. Nothing else in the fleet is assumed to
 * make up for it: the other large plants are hydro on the same slope, and thermal is already at
 * its demonstrated ceiling in the central case.
 */

import { addDays, type IsoDate } from "../util/dates.ts";
import { roundOrNull, roundTo } from "../util/numbers.ts";
import type { BalanceDay } from "../features/balance.ts";
import type { DailySeries } from "../features/series.ts";
import { tierFor, type AdequacyForecast, type RiskTier } from "./adequacy.ts";

/** The plant whose loss is costed. */
export const OUTAGE_SITE = "coca_codo_sinclair";

/** Trailing days the plant's share of national hydro is read over. */
export const OUTAGE_SHARE_WINDOW_DAYS = 28;

/** Fewest days with both the plant's energy and a usable national balance before a share is read. */
export const OUTAGE_MIN_DAYS = 14;

export interface PlantShare {
  site: string;
  /** Plant energy over national hydro across the matched days, 0–1. */
  share: number;
  /** Mean plant energy over the matched days, GWh/day. */
  plantGwhDay: number;
  days: number;
  from: IsoDate;
  to: IsoDate;
}

export interface OutageHorizon {
  horizonDays: number;
  lostGwhDay: number;
  hydroGwhDay: number;
  deficitGwhDay: number;
  deficitP90: number | null;
  tier: RiskTier;
}

export interface OutageScenario {
  share: PlantShare;
  horizons: OutageHorizon[];
}

/** Daily plant energy in GWh, from `observations_daily` rows (`produccion_mwh`). */
export function plantEnergy(rows: readonly Record<string, string>[], site: string = OUTAGE_SITE): DailySeries {
  const out: DailySeries = new Map();
  for (const row of rows) {
    if (row["site"] !== site || row["variable"] !== "produccion_mwh" || row["value"] === "") continue;
    const value = Number(row["value"]);
    if (Number.isFinite(value) && value >= 0) out.set(row["date"]!, value / 1000);
  }
  return out;
}

/**
 * The plant's share of national hydro over the window ending at the origin, on the days both
 * are known. Null when fewer than `OUTAGE_MIN_DAYS` match, so a feed that has stopped does not
 * publish a share read from a handful of days.
 */
export function plantShare(
  days: readonly BalanceDay[],
  plant: DailySeries,
  origin: IsoDate,
  site: string = OUTAGE_SITE,
  windowDays: number = OUTAGE_SHARE_WINDOW_DAYS,
): PlantShare | null {
  const from = addDays(origin, -(windowDays - 1));
  const matched = days.filter((d) => d.date >= from && d.date <= origin && plant.has(d.date) && d.hydroGwh > 0);
  if (matched.length < OUTAGE_MIN_DAYS) return null;
  const plantTotal = matched.reduce((a, d) => a + plant.get(d.date)!, 0);
  const hydroTotal = matched.reduce((a, d) => a + d.hydroGwh, 0);
  return {
    site,
    share: plantTotal / hydroTotal,
    plantGwhDay: plantTotal / matched.length,
    days: matched.length,
    from: matched[0]!.date,
    to: matched.at(-1)!.date,
  };
}

export function outageScenario(forecast: AdequacyForecast, share: PlantShare): OutageScenario {
  const supply = forecast.ceilings.thermalGwhDay + forecast.ceilings.otherGwhDay + forecast.imports.centralGwhDay;
  return {
    share,
    horizons: forecast.horizons.map((h) => {
      const lost = h.hydroGwhDay * share.share;
      const deficit = h.requirementGwhDay + lost - supply;
      const p90 = h.requirementP90 === null ? null : h.requirementP90 + lost - supply;
      return {
        horizonDays: h.horizonDays,
        lostGwhDay: lost,
        hydroGwhDay: h.hydroGwhDay - lost,
        deficitGwhDay: deficit,
        deficitP90: p90,
        tier: tierFor(deficit, p90, forecast.rules.tightGwhDay),
      };
    }),
  };
}

/** `adequacy.json`'s `plant_outage` block. Additive: the central case is unchanged. */
export function outageBlock(scenario: OutageScenario | null, reason: string | null = null): Record<string, unknown> {
  const note =
    "El déficit y el nivel de riesgo si Coca Codo Sinclair saliera de servicio durante todo el horizonte. " +
    "No es un pronóstico: es cuánto del margen depende de una sola central. Se resta su participación reciente " +
    "en la generación hidroeléctrica nacional; importaciones y térmica quedan como en el caso central.";
  if (scenario === null) return { note, site: OUTAGE_SITE, available: false, reason };
  const { share } = scenario;
  return {
    note,
    site: share.site,
    available: true,
    share_of_hydro: roundTo(share.share, 4),
    plant_gwh_day: roundTo(share.plantGwhDay, 3),
    share_days: share.days,
    share_from: share.from,
    share_to: share.to,
    horizons: scenario.horizons.map((h) => ({
      horizon_days: h.horizonDays,
      lost_gwh_day: roundTo(h.lostGwhDay, 3),
      hydro_gwh_day: roundTo(h.hydroGwhDay, 3),
      deficit_gwh_day: roundTo(h.deficitGwhDay, 3),
      deficit_p90: roundOrNull(h.deficitP90, 3),
      tier: h.tier,
    })),
  };
}
