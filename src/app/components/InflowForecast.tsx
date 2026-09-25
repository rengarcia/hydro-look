/**
 * A plant's inflow forecast (ENHANCEMENTS §5.3), from `forecast.json`'s `inflow_forecasts`.
 *
 * For the run-of-river and daily-storage plants the level is an operating decision, so the
 * forecast target is the mean inflow over the next week or fortnight. A horizon is published only
 * where the ensemble (analogue years averaged with the calendar's usual) beats both persistence and
 * climatology on the rolling-origin backtest;
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
      ? `Hoy no se publica ningún plazo: en las pruebas con datos pasados, el método no acertó más que suponer que el caudal no cambia o que será el promedio de la época.`
      : withheld.length === 0
        ? `Se publica a ${joinDays(published.map((h) => h.horizon_days))} días: en las pruebas con datos pasados, acertó más que suponer que el caudal no cambia y que usar el promedio de la época.`
        : `Se publica a ${joinDays(published.map((h) => h.horizon_days))} días; a ${joinDays(withheld.map((h) => h.horizon_days))}, no, porque en las pruebas con datos pasados una suposición más simple acertó más.`;

  return (
    <div className="panel inflow-forecast">
      <div className="panel-head">
        <h3>Pronóstico del agua que llegará</h3>
        <span className="meta">m³/s · promedio del plazo</span>
      </div>
      <p className="panel-lede">
        Desde el {longDate(plant.origin_date)}. {lede}
      </p>
      <div className="table-scroll">
        <Table
          className="horizons"
          caption={`Agua que llegará a ${label}, en promedio, por plazo, en m³/s, con el error de las pruebas frente a dos suposiciones simples`}
          captionHidden
          columns={[
            { label: "Plazo" },
            { label: "Más probable (rango)", numeric: true },
            { label: "Error del método", numeric: true },
            { label: "Error «sin cambios»", numeric: true },
            { label: "Error «promedio de la época»", numeric: true },
            { label: "Dentro del rango", numeric: true, wideOnly: true },
            { label: "Pruebas", numeric: true, wideOnly: true },
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
            {h.published && h.ensemble_years ? ` Rango calculado con las lluvias de ${h.ensemble_years} años pasados.` : ""}
          </li>
        ))}
      </ul>
      <p className="fine spaced">
        El error es cuánto se equivocó en promedio, en m³/s, al probarlo con datos pasados: cuanto más bajo, mejor.{" "}
        {plant.rain_conditioned
          ? `Los años del pasado que se usan se eligen también según la lluvia de su cuenca${plant.precip_basin ? ` (${plant.precip_basin})` : ""}.`
          : plant.precip_basin === null
            ? "Todavía no se tiene en cuenta la lluvia: el punto de medición de su cuenca aún no tiene suficientes años de datos."
            : `Ya hay datos de lluvia de su cuenca (${plant.precip_basin}), pero todavía no se usaron en ninguna prueba.`}
        {report ? (
          <>
            {" "}
            Todos los resultados, también los malos, en <a href={`${REPO}/blob/main/${report}`}>{report}</a>.
          </>
        ) : null}
      </p>
    </div>
  );
}
