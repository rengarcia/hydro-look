/**
 * GEOGLOWS' river forecast as a member of the inflow ensemble (§5.3), where it has earned it.
 *
 * The forecast's volume is wrong by up to 2.8× at these rivers, so it is used as an anomaly: the
 * forecast window mean over the model's own climatology for the same calendar window, applied to
 * the measured climatology (`anomalyForecast`). Tried at seven plants on 270 origins from
 * 2024-07 (`data/reports/geoglows-experiment.md`), it improved the analogue + climatology
 * ensemble beyond a block-bootstrap interval at Agoyán, Manduriacu and Minas San Francisco, at 7
 * and 10 days; it was neutral at Mazar, Amaluza and Coca Codo Sinclair and made Delsitanisagua
 * worse, so it is a member only at the three.
 *
 * Reads `data/curated/geoglows_forecasts` (`npm run geoglows:daily`) and the model climatology in
 * `data/reference/geoglows_simulated_climatology.csv`, fitted on 1940–2023 so that no backtest
 * origin sees a simulated year after its own.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GEOGLOWS_FORECASTS } from "../contracts/tables.ts";
import { anomalyForecast, forecastWindowMean } from "../models/geoglows-inflow.ts";
import type { InflowForecastMember } from "../models/inflow.ts";
import { parseCsv } from "../store/csv.ts";
import { addDays, type IsoDate } from "../util/dates.ts";
import { DATA_CURATED, DATA_REFERENCE } from "../util/paths.ts";

/** The plants where the forecast is an ensemble member. */
export const GEOGLOWS_MEMBER_PLANTS = ["agoyan", "manduriacu", "minas_san_francisco"] as const;
/** The high-resolution member runs ten days; a longer horizon keeps the two-member ensemble. */
export const GEOGLOWS_MAX_LEAD = 10;
/** The horizons the model climatology is kept for: the §5.3 horizons the forecast reaches. */
export const GEOGLOWS_CLIMATOLOGY_HORIZONS = [7] as const;
/** The last simulated year the climatology uses: the year before the first archived forecast. */
export const GEOGLOWS_CLIMATOLOGY_LAST_YEAR = 2023;
export const SIMULATED_CLIMATOLOGY_FILE = "geoglows_simulated_climatology.csv";

/** Site → issue date → daily mean by lead (index 0 = lead 1), high-resolution member. */
export type GeoglowsForecasts = Map<string, Map<IsoDate, (number | null)[]>>;

export function readGeoglowsForecasts(root: string = DATA_CURATED): GeoglowsForecasts {
  const dir = join(root, GEOGLOWS_FORECASTS.name);
  const out: GeoglowsForecasts = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".csv"))) {
    for (const row of parseCsv(readFileSync(join(dir, file), "utf8"))) {
      if (row["member"] !== "high_res") continue;
      const site = row["site"]!;
      const lead = Number(row["lead_days"]);
      const bySite = out.get(site) ?? out.set(site, new Map()).get(site)!;
      const daily = bySite.get(row["issued"]!) ?? bySite.set(row["issued"]!, []).get(row["issued"]!)!;
      while (daily.length < lead) daily.push(null);
      daily[lead - 1] = Number(row["q_m3s"]);
    }
  }
  return out;
}

/** Site → `MM-DD:h` → the model's median window mean. */
export type SimulatedClimatology = Map<string, Map<string, number>>;

export function readSimulatedClimatology(path: string = join(DATA_REFERENCE, SIMULATED_CLIMATOLOGY_FILE)): SimulatedClimatology {
  const out: SimulatedClimatology = new Map();
  if (!existsSync(path)) return out;
  for (const row of parseCsv(readFileSync(path, "utf8"))) {
    const bySite = out.get(row["site"]!) ?? out.set(row["site"]!, new Map()).get(row["site"]!)!;
    bySite.set(`${row["month_day"]}:${row["horizon_days"]}`, Number(row["median_m3s"]));
  }
  return out;
}

const monthDay = (origin: IsoDate) => (origin.slice(5) === "02-29" ? "02-28" : origin.slice(5));

/**
 * The ensemble member for one plant, or null where the plant is not one the forecast earned, or
 * no forecast or climatology is stored for it. A forecast issued at 00 UTC on origin + 1 is the
 * one the daily job has when the origin is CELEC's last published day.
 */
export function geoglowsMember(site: string, forecasts: GeoglowsForecasts, climatology: SimulatedClimatology): InflowForecastMember | null {
  if (!(GEOGLOWS_MEMBER_PLANTS as readonly string[]).includes(site)) return null;
  const runs = forecasts.get(site);
  const clim = climatology.get(site);
  if (!runs || runs.size === 0 || !clim) return null;
  return (origin, horizonDays, measuredClimatology) => {
    if (horizonDays > GEOGLOWS_MAX_LEAD) return null;
    const daily = runs.get(addDays(origin, 1));
    const simulated = clim.get(`${monthDay(origin)}:${horizonDays}`);
    const f = daily ? forecastWindowMean(daily, horizonDays) : null;
    if (f === null || simulated === undefined) return null;
    return anomalyForecast(measuredClimatology, f, simulated);
  };
}
