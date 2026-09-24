/**
 * The pieces of a reservoir that appear on more than one page: the cross-section, the inflow
 * panel with its legend, and the percentile track. The home page, Mazar's page, every other
 * reservoir's page and the embeddable cards all draw from here, so the same number is drawn the
 * same way wherever it appears.
 */

import type { ReactNode } from "react";
import { ReservoirCut, type CutLevel } from "./ReservoirCut.tsx";
import { InflowChart } from "./InflowChart.tsx";
import { ribbon, series, window as windowOf } from "../../lib/site/data.ts";
import type { ForecastDocument } from "../../lib/site/documents.ts";
import { longDate, num, shortDate } from "../../lib/site/format.ts";
import { thresholdSource } from "../../lib/site/story.ts";
import { eachDay } from "../../lib/util/dates.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";

/** Days of inflow drawn against the climatology ribbon. */
const INFLOW_DAYS = 365;

/**
 * The floors ruled across the cross-section. For the forecast reservoir they are the forecast's
 * own thresholds, 2115 included and marked as this project's; for any other, every distinct
 * floor CELEC declares.
 */
export function cutFloors(forecast: ForecastDocument | null, reservoir: ReservoirSnapshot): CutLevel[] {
  if (forecast && forecast.site === reservoir.site) {
    return forecast.thresholds.map((t) => {
      const unverified = t.status === "unverified";
      return {
        level_masl: t.level_masl,
        unverified,
        label: unverified
          ? `${num(t.level_masl, 0)} m · referencia de este sitio`
          : `${num(t.level_masl, 0)} m · mín. ${thresholdSource(t.name)}`,
        short: unverified ? `${num(t.level_masl, 0)} ref.` : `${num(t.level_masl, 0)} mín.`,
      };
    });
  }
  return [...new Set(reservoir.bands.map((b) => b.min_masl))].map((level) => ({
    level_masl: level,
    label: `${num(level, 0)} m · mínimo oficial`,
    short: `${num(level, 0)} mín.`,
  }));
}

export function ReservoirCutFor({ reservoir, forecast }: { reservoir: ReservoirSnapshot; forecast: ForecastDocument | null }) {
  if (reservoir.level === null) return null;
  const declared = reservoir.bands.length > 0;
  const crest = declared ? Math.max(...reservoir.bands.map((b) => b.max_masl)) : reservoir.level.observed_max_masl;
  const primary = reservoir.bands[0] ?? null;
  const own = forecast && forecast.site === reservoir.site ? forecast : null;
  const end = own?.forecast.at(-1) ?? null;
  const floors = cutFloors(own, reservoir);
  const lowest = floors.length > 0 ? Math.min(...floors.map((f) => f.level_masl)) : null;
  return (
    <ReservoirCut
      crest={crest}
      level={reservoir.level.masl}
      bandPct={primary?.band_pct ?? null}
      floors={floors}
      forecast={end ? { p10: end.p10, p50: end.p50, p90: end.p90, days: end.horizon_days } : null}
      label={
        `Corte del embalse de ${reservoir.label}: nivel de ${num(reservoir.level.masl, 2)} m el ${longDate(reservoir.level.date)}` +
        (lowest !== null ? `, entre el mínimo oficial más bajo, ${num(lowest, 0)} m,` : "") +
        (declared
          ? ` y el máximo de operación, ${num(crest, 0)} m.`
          : ` y el máximo registrado, ${num(crest, 0)} m; no hay rango oficial publicado.`)
      }
    />
  );
}

export function PercentileTrack({ percentile, years }: { percentile: number; years: number }) {
  return (
    <div className="percentile">
      <div className="percentile-track" aria-hidden="true">
        <span className="percentile-mark" style={{ left: `${Math.min(100, Math.max(0, percentile))}%` }} />
      </div>
      <span className="percentile-caption mono">
        {num(percentile, 0)} de 100 · frente a {years} años
      </span>
    </div>
  );
}

/** A year of a reservoir's inflow and the climatology band under it, or null without two readings. */
export function inflowWindow(site: string) {
  const inflow = series().get(site, "caudal_m3s");
  const readings = windowOf(inflow, INFLOW_DAYS);
  if (readings.length < 2) return null;
  const band = ribbon(inflow, eachDay(readings[0]!.date, readings.at(-1)!.date));
  return { readings, band };
}

export function InflowLegend() {
  return (
    <ul className="legend legend-small">
      <li>
        <span className="key-line key-water key-short" aria-hidden="true" />
        Agua que llegó cada día
      </li>
      <li>
        <span className="key-box key-band" aria-hidden="true" />
        Lo normal (8 de cada 10 años)
      </li>
      <li>
        <span className="key-dash key-muted key-short" aria-hidden="true" />
        Lo típico
      </li>
    </ul>
  );
}

/**
 * Today's inflow, where it sits in its own history, and the year behind it. `heading` is the
 * panel's title on a page that has one; the home page puts its title in the section instead.
 */
export function InflowPanel({ reservoir, heading }: { reservoir: ReservoirSnapshot; heading?: ReactNode }) {
  const data = inflowWindow(reservoir.site);
  const inflow = reservoir.inflow;
  if (data === null || inflow === null) return null;
  const climatology = inflow.climatology;
  const label = `Agua que llegó a ${reservoir.label} cada día del último año, frente a lo normal para cada fecha`;
  return (
    <div className="panel tight">
      <div className="figure-row">
        <div className="figure-stack">
          {heading ? <h3 className="panel-title">{heading}</h3> : null}
          {heading && climatology ? (
            <p className="panel-lede">
              En esta época del año lo normal es entre {num(climatology.p10, 1)} y {num(climatology.p90, 1)} m³/s, y lo típico,{" "}
              {num(climatology.p50, 1)} m³/s, según {climatology.years} años de registros.
            </p>
          ) : null}
          <span className="big-figure num">
            {num(inflow.m3s, 1)}
            <small>m³/s</small>
          </span>
          <span className="figure-caption">
            {shortDate(inflow.date)}
            {climatology ? ` · lo típico para la fecha: ${num(climatology.p50, 1)} m³/s` : ""}
          </span>
        </div>
        {climatology?.percentile_today != null ? (
          <PercentileTrack percentile={climatology.percentile_today} years={climatology.years} />
        ) : null}
      </div>
      <InflowLegend />
      <InflowChart readings={data.readings} ribbon={data.band} label={label} subject={`Agua que llega a ${reservoir.label}`} />
      <p className="fine spaced">
        El caudal es la cantidad de agua que trae el río, en metros cúbicos por segundo (m³/s). Los huecos en la línea son días sin dato
        publicado. Un cero no significa que el río se secó: en algunos reportes, cualquier valor menor a 0,5 m³/s aparece como 0.
        {climatology === null
          ? " Todavía no hay suficientes años de registro para saber qué es lo normal: hacen falta al menos cinco."
          : ""}
      </p>
    </div>
  );
}
