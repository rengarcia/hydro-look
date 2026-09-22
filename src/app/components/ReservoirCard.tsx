/**
 * One reservoir: where it sits, which way it is moving, and how its inflow compares with its
 * own record.
 *
 * Every card reads the same, including the three that have no declared band. Coca Codo
 * Sinclair, Agoyán and Manduriacu reach this repository through the historian and no source
 * publishes an operating band for any of them, so their gauge is scaled to the range this
 * repository has recorded and the card says that is what the axis is. The alternative — no
 * gauge at all, or a gauge on an invented band — is worse in both directions.
 */

import { Gauge } from "./Gauge.tsx";
import { num, pct, signed } from "../../lib/site/format.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";

export function ReservoirCard({ reservoir }: { reservoir: ReservoirSnapshot }) {
  const { level, bands, inflow } = reservoir;
  if (level === null) return null;

  const primary = bands[0];

  /*
   * The scale spans every declaration, not just the best-evidenced one.
   *
   * Mazar is why. Its two floors are 2100 from both report endpoints and 2098 from the
   * dashboard's chart title, so a bar scaled to the first puts the second off the end of its
   * own axis — and the one reservoir whose disagreement this project keeps pointing at would be
   * the one that showed a single floor. The bar therefore measures metres on the axis its end
   * labels give; the percentage beneath it names the band it belongs to, and the two are not
   * the same statement.
   */
  const min = bands.length > 0 ? Math.min(...bands.map((b) => b.min_masl)) : level.observed_min_masl;
  const max = bands.length > 0 ? Math.max(...bands.map((b) => b.max_masl)) : level.observed_max_masl;

  // One tick per distinct floor, minus the one the axis already ends at: a mark drawn on top
  // of the axis end tells the reader nothing.
  const marks = [...new Map(bands.map((band) => [band.min_masl, band])).values()]
    .filter((band) => band.min_masl !== min)
    .map((band) => ({ level: band.min_masl, label: `Mínimo declarado ${num(band.min_masl, 0)} m (${band.declaration})` }));

  const climatology = inflow?.climatology ?? null;

  return (
    <article className="card">
      <h3>
        {reservoir.label}
        <span className="basin">cuenca {reservoir.basin}</span>
      </h3>

      <p className="figure" style={{ margin: "4px 0 0" }}>
        {num(level.masl, 2)} <span className="unit">m s. n. m.</span>
      </p>
      <p className="sub" style={{ margin: "0 0 10px" }}>
        {/* The percentage names the declaration it was computed against, which for Mazar is not
            the span the bar is drawn on — 2100–2153 from the report endpoints, on an axis that
            reaches down to the dashboard's 2098 so that floor has somewhere to be drawn. */}
        {primary
          ? `${pct(primary.band_pct)} de la banda ${num(primary.min_masl, 0)}–${num(primary.max_masl, 0)} m`
          : `Sin banda declarada; la escala es el rango registrado, ${num(min, 0)}–${num(max, 0)} m`}
      </p>

      <Gauge
        min={min}
        max={max}
        level={level.masl}
        marks={marks}
        label={`${reservoir.label}: ${num(level.masl, 2)} m sobre una escala de ${num(min, 0)} a ${num(max, 0)} m`}
      />

      <dl className="pairs">
        <dt>Tendencia 7 d</dt>
        <dd>{signed(reservoir.slopes_m_per_day.d7, 2)} m/día</dd>
        <dt>Tendencia 30 d</dt>
        <dd>{signed(reservoir.slopes_m_per_day.d30, 2)} m/día</dd>
        <dt>Caudal</dt>
        <dd>{inflow ? `${num(inflow.m3s, 1)} m³/s` : "—"}</dd>
        <dt>Frente a su historia</dt>
        <dd>
          {climatology
            ? `percentil ${num(climatology.percentile_today, 0)} (p50 ${num(climatology.p50, 0)} m³/s, ${climatology.years} años)`
            : `sin base suficiente (${inflow?.days ?? 0} días)`}
        </dd>
      </dl>
    </article>
  );
}
