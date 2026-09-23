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
        label: unverified ? `${num(t.level_masl, 0)} m · marcador propio` : `${num(t.level_masl, 0)} m · mín. ${thresholdSource(t.name)}`,
        short: unverified ? `${num(t.level_masl, 0)} propio` : `${num(t.level_masl, 0)} mín.`,
      };
    });
  }
  return [...new Set(reservoir.bands.map((b) => b.min_masl))].map((level) => ({
    level_masl: level,
    label: `${num(level, 0)} m · mínimo declarado`,
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
        `Corte del embalse de ${reservoir.label}: cota de ${num(reservoir.level.masl, 2)} m el ${longDate(reservoir.level.date)}` +
        (lowest !== null ? `, entre el mínimo declarado más bajo, ${num(lowest, 0)} m,` : "") +
        (declared ? ` y la cresta de la banda, ${num(crest, 0)} m.` : ` y el máximo registrado, ${num(crest, 0)} m; no hay banda declarada.`)
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
        percentil {num(percentile, 0)} · {years} años
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
        Caudal diario
      </li>
      <li>
        <span className="key-box key-band" aria-hidden="true" />
        p10–p90 histórico
      </li>
      <li>
        <span className="key-dash key-muted key-short" aria-hidden="true" />
        Mediana
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
  const label = `Caudal de entrada a ${reservoir.label} del último año frente a su franja histórica p10 a p90`;
  return (
    <div className="panel tight">
      <div className="figure-row">
        <div className="figure-stack">
          {heading ? <h3 className="panel-title">{heading}</h3> : null}
          {heading && climatology ? (
            <p className="panel-lede">
              p10 {num(climatology.p10, 1)} · p50 {num(climatology.p50, 1)} · p90 {num(climatology.p90, 1)} m³/s en esta
              época del año, {climatology.years} años.
            </p>
          ) : null}
          <span className="big-figure num">
            {num(inflow.m3s, 1)}
            <small>m³/s</small>
          </span>
          <span className="figure-caption">
            {shortDate(inflow.date)}
            {climatology ? ` · mediana histórica ${num(climatology.p50, 1)} m³/s` : ""}
          </span>
        </div>
        {climatology?.percentile_today != null ? <PercentileTrack percentile={climatology.percentile_today} years={climatology.years} /> : null}
      </div>
      <InflowLegend />
      <InflowChart readings={data.readings} ribbon={data.band} label={label} subject={`Caudal de entrada a ${reservoir.label}`} />
      <p className="fine spaced">
        Los cortes en la línea son días que la fuente nunca publicó. Un cero no significa «el río se detuvo»: en los
        reportes de doce meses es cualquier valor por debajo de 0,5 m³/s.
        {climatology === null ? " Este registro aún es corto para una franja histórica: se necesitan al menos cinco años." : ""}
      </p>
    </div>
  );
}
