/**
 * The pieces of Mazar that appear on both the home page and Mazar's own page: the cross-section,
 * the inflow window with its legend, and the percentile track.
 */

import { ReservoirCut, type CutLevel } from "./ReservoirCut.tsx";
import { ribbon, series, window as windowOf } from "../../lib/site/data.ts";
import type { ForecastDocument } from "../../lib/site/documents.ts";
import { longDate, num } from "../../lib/site/format.ts";
import { eachDay } from "../../lib/util/dates.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";

/** Days of inflow drawn against the climatology ribbon. */
const INFLOW_DAYS = 365;

export function cutFloors(forecast: ForecastDocument | null, mazar: ReservoirSnapshot | null): CutLevel[] {
  if (forecast) {
    return forecast.thresholds.map((t) => {
      const unverified = t.status === "unverified";
      const where = /dashboard/.test(t.name) ? "tablero" : "reportes";
      return {
        level_masl: t.level_masl,
        unverified,
        label: unverified ? `${num(t.level_masl, 0)} m · marcador propio` : `${num(t.level_masl, 0)} m · mín. ${where}`,
        short: unverified ? `${num(t.level_masl, 0)} propio` : `${num(t.level_masl, 0)} mín.`,
      };
    });
  }
  return [...new Set((mazar?.bands ?? []).map((b) => b.min_masl))].map((level) => ({
    level_masl: level,
    label: `${num(level, 0)} m · mínimo declarado`,
    short: `${num(level, 0)} mín.`,
  }));
}

export function MazarCut({ mazar, forecast }: { mazar: ReservoirSnapshot; forecast: ForecastDocument | null }) {
  if (mazar.level === null) return null;
  const crest = mazar.bands.length > 0 ? Math.max(...mazar.bands.map((b) => b.max_masl)) : mazar.level.observed_max_masl;
  const primary = mazar.bands[0] ?? null;
  const end = forecast?.forecast.at(-1) ?? null;
  const floors = cutFloors(forecast, mazar);
  const lowest = floors.length > 0 ? Math.min(...floors.map((f) => f.level_masl)) : null;
  const props = {
    crest,
    level: mazar.level.masl,
    bandPct: primary?.band_pct ?? null,
    floors,
    forecast: end ? { p10: end.p10, p50: end.p50, p90: end.p90, days: end.horizon_days } : null,
    label:
      `Corte del embalse de Mazar: cota de ${num(mazar.level.masl, 2)} m el ${longDate(mazar.level.date)}` +
      (lowest !== null ? `, entre el mínimo declarado más bajo, ${num(lowest, 0)} m,` : "") +
      ` y la cresta de la banda, ${num(crest, 0)} m.`,
  };
  return (
    <>
      <ReservoirCut {...props} className="only-wide" />
      <ReservoirCut {...props} compact className="only-compact" />
    </>
  );
}

export function PercentileTrack({ percentile, years }: { percentile: number; years: number }) {
  return (
    <div className="percentile">
      <div className="percentile-track" aria-hidden="true">
        <span className="percentile-mark" style={{ left: `${Math.min(100, Math.max(0, percentile))}%` }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
        percentil {num(percentile, 0)} · {years} años
      </span>
    </div>
  );
}

export function inflowWindow() {
  const inflow = series().get("mazar", "caudal_m3s");
  const readings = windowOf(inflow, INFLOW_DAYS);
  if (readings.length < 2) return null;
  const band = ribbon(inflow, eachDay(readings[0]!.date, readings.at(-1)!.date));
  return { readings, band };
}

export function InflowLegend() {
  return (
    <ul className="legend" style={{ marginTop: 12, fontSize: 12.5 }}>
      <li>
        <span className="key-line" style={{ width: 16, background: "var(--water)" }} aria-hidden="true" />
        Caudal diario
      </li>
      <li>
        <span className="key-box" style={{ background: "var(--water-3)" }} aria-hidden="true" />
        p10–p90 histórico
      </li>
      <li>
        <span className="key-dash" style={{ width: 16, borderTopColor: "var(--muted)" }} aria-hidden="true" />
        Mediana
      </li>
    </ul>
  );
}
