/**
 * A plant's inflow forecast (ENHANCEMENTS §5.3), from `forecast.json`'s `inflow_forecasts`.
 *
 * For the run-of-river and daily-storage plants the level is an operating decision, so the
 * forecast target is the mean inflow over the next week or fortnight. A horizon is published only
 * where the analogue years beat both persistence and climatology on the rolling-origin backtest;
 * every horizon is listed either way, with its backtest beside it, and one that is not published
 * says what it lost to — a missing row would read as a forecast nobody tried.
 *
 * Optional-safe: no block, or no entry for this plant, renders nothing.
 */

import { REPO } from "./Chrome.tsx";
import { Table } from "./DataTable.tsx";
import type { InflowForecasts, InflowPlant } from "../../lib/site/documents.ts";
import { dateWithYear, longDate, num, pct } from "../../lib/site/format.ts";
import { inflowVerdict, joinDays } from "../../lib/site/story.ts";

export function inflowPlantOf(block: InflowForecasts | null | undefined, site: string): InflowPlant | null {
  return block?.plants.find((p) => p.site === site) ?? null;
}

export function InflowForecastPanel({ plant, report, label }: { plant: InflowPlant | null; report?: string; label: string }) {
  if (plant === null || plant.horizons.length === 0) return null;
  const published = plant.horizons.filter((h) => h.published);
  const withheld = plant.horizons.filter((h) => !h.published);
  const lede =
    published.length === 0
      ? `Ningún horizonte se publica hoy: en el backtest, los años análogos no le ganan a suponer que el caudal no cambia o a su promedio de la época.`
      : withheld.length === 0
        ? `Se publica a ${joinDays(published.map((h) => h.horizon_days))} días: en el backtest, los años análogos le ganan a la persistencia y a la climatología.`
        : `Se publica a ${joinDays(published.map((h) => h.horizon_days))} días; a ${joinDays(withheld.map((h) => h.horizon_days))}, no, porque en el backtest pierde con una referencia más simple.`;

  return (
    <div className="panel inflow-forecast">
      <div className="panel-head">
        <h3>Pronóstico de caudal de entrada</h3>
        <span className="meta">m³/s · media del horizonte</span>
      </div>
      <p className="panel-lede">
        Desde el {longDate(plant.origin_date)}. {lede}
      </p>
      <div className="table-scroll">
        <Table
          className="horizons"
          caption={`Caudal medio de entrada de ${label} pronosticado por horizonte, en m³/s, con el error medio del backtest frente a la persistencia y la climatología`}
          captionHidden
          columns={[
            { label: "Horizonte" },
            { label: "p50 (p10 – p90)", numeric: true },
            { label: "Error análogos", numeric: true },
            { label: "Persistencia", numeric: true },
            { label: "Climatología", numeric: true },
            { label: "Cobertura p10–p90", numeric: true, wideOnly: true },
            { label: "n", numeric: true, wideOnly: true },
          ]}
          rows={plant.horizons.map((h) => [
            <span key="h">
              {h.horizon_days} días
              {h.published && h.target_date ? (
                <>
                  <br />
                  <span className="source">hasta el {dateWithYear(h.target_date)}</span>
                </>
              ) : null}
            </span>,
            h.published && h.p50 !== undefined ? (
              <span key="r" className="range">
                <strong>{num(h.p50, 1)}</strong>
                <small>{`${num(h.p10, 1)} – ${num(h.p90, 1)}`}</small>
              </span>
            ) : (
              <span key="r" className="withheld">
                no se publica
              </span>
            ),
            num(h.backtest.mae_m3s, 1),
            num(h.backtest.persistence_mae_m3s, 1),
            num(h.backtest.climatology_mae_m3s, 1),
            pct(h.backtest.coverage_p10_p90 === null ? null : h.backtest.coverage_p10_p90 * 100, 0),
            h.backtest.n,
          ])}
        />
      </div>
      <ul className="fine spaced inflow-reasons">
        {plant.horizons.map((h) => (
          <li key={h.horizon_days}>
            <strong>{h.horizon_days} días.</strong> {inflowVerdict(h)}
            {h.published && h.ensemble_years ? ` Banda de ${h.ensemble_years} años análogos.` : ""}
          </li>
        ))}
      </ul>
      <p className="fine spaced">
        Error medio absoluto en m³/s sobre los orígenes del backtest; gana el más bajo.{" "}
        {plant.rain_conditioned
          ? `Los años análogos se eligen también por la lluvia ERA5 de su cuenca${plant.precip_basin ? ` (${plant.precip_basin})` : ""}.`
          : plant.precip_basin === null
            ? "Los años análogos no se condicionan todavía en la lluvia: el centroide verificado de su cuenca aún no tiene historia ERA5 suficiente."
            : `La lluvia ERA5 de su cuenca (${plant.precip_basin}) está disponible, pero no condicionó ningún origen del backtest.`}
        {report ? (
          <>
            {" "}
            Detalle, negativos incluidos, en <a href={`${REPO}/blob/main/${report}`}>{report}</a>.
          </>
        ) : null}
      </p>
    </div>
  );
}
