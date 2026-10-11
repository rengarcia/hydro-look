/**
 * The fleet: eight reservoirs on one scale — metres of usable head — side by side.
 *
 * Each column runs from the lowest declared floor to the band's crest and is filled to today's
 * level, so the fill is metres and not a share of stored water; the two are very different for a
 * reservoir whose surface more than doubles between 2110 and 2150 m. The three reservoirs with no
 * declared band anywhere (Coca Codo Sinclair, Agoyán, Manduriacu) are scaled to the range this
 * repository has recorded and hatched, so the difference is visible before the caption is read.
 *
 * The scale spans every declaration, not just the best-evidenced one. Mazar is why: its floors
 * are 2100 from both report endpoints and 2098 from the dashboard's chart title, so a column
 * scaled to the first would put the second off the end of its own axis. Every other floor CELEC
 * declares is drawn as a red rule; the percentage printed on the column names the primary band,
 * which is why it does not always equal the fill.
 *
 * A reservoir with a known shape is drawn in it. Where an area-elevation curve exists — Mazar's,
 * from `forecast.json` — the column is as wide at each level as the lake's surface is there, so
 * the water painted is the water stored, and the large number is that share of the band's volume
 * rather than of its metres. The others have no curve that closes (`lib/site/shape.ts` says why)
 * and stay straight: a rectangle is the honest drawing of a shape nobody has measured.
 *
 * On a phone each reservoir becomes a horizontal bar; both are rendered and CSS shows one, so the
 * switch needs no script.
 */

import type { ReactNode } from "react";
import { basinName, num, pct, signed } from "../../lib/site/format.ts";
import { ARROW, DIRECTION_TONE, direction } from "../../lib/site/story.ts";
import { reservoirHref } from "../../lib/site/data.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";
import {
  horizontalPath,
  outline,
  storedHm3,
  verticalPath,
  volumeShare,
  widthAt,
  type AreaCurve,
  type OutlinePoint,
} from "../../lib/site/shape.ts";

/**
 * Reservoirs with a page of their own: every one the fleet shows. Mazar's is written by hand
 * (`/embalses/mazar/`) because it carries the forecast; the other seven come from one template.
 */
export function detailPage(site: string): string {
  return reservoirHref(site);
}

/** The fill level above which the percentage is printed inside the water rather than over it. */
const INSIDE_ABOVE = 75;

/** `p29`, with what it abbreviates said in text and not only in a tooltip. */
export function PercentileAbbr({ percentile, empty = "—" }: { percentile: number | null; empty?: ReactNode }) {
  if (percentile === null) return <>{empty}</>;
  return (
    <abbr title={`el agua que llega hoy supera a la de ${percentile} de cada 100 días de esta época en otros años`}>
      p{percentile}
      <span className="visually-hidden"> (el agua que llega hoy supera a la de {percentile} de cada 100 días de esta época)</span>
    </abbr>
  );
}

/** Metres a day, abbreviated where the column is narrow. */
export function MetresPerDay() {
  return <abbr title="metros por día">m/d</abbr>;
}

interface Column {
  reservoir: ReservoirSnapshot;
  masl: number;
  min: number;
  max: number;
  fill: number;
  declared: boolean;
  /** The share printed on the column: of the primary band, or of the recorded range. */
  share: number;
  floors: number[];
  percentile: number | null;
  /** Present only where the reservoir's area-elevation curve is known. */
  shape: Shape | null;
}

interface Shape {
  /** The vessel, floor of the axis to its crest. */
  vessel: OutlinePoint[];
  /** The water, floor of the axis to today's level. */
  water: OutlinePoint[];
  /** Share of the primary band's volume held today, 0–100. */
  volumePct: number;
  storedHm3: number;
  fullHm3: number;
}

/** Area-elevation curves by site; a site missing here is drawn straight. */
export type ShapeCurves = Partial<Record<string, AreaCurve>>;

function shapeOf(curve: AreaCurve | undefined, min: number, max: number, level: number, floor: number): Shape | null {
  if (!curve) return null;
  const volumePct = volumeShare(curve, floor, max, level);
  const vessel = outline(curve, min, max);
  if (volumePct === null || vessel.length === 0) return null;
  return {
    vessel,
    water: outline(curve, min, max, level),
    volumePct,
    storedHm3: storedHm3(curve, floor, level),
    fullHm3: storedHm3(curve, floor, max),
  };
}

function columnOf(reservoir: ReservoirSnapshot, curves: ShapeCurves): Column | null {
  const { level, bands } = reservoir;
  if (level === null) return null;
  const declared = bands.length > 0;
  const min = declared ? Math.min(...bands.map((b) => b.min_masl)) : level.observed_min_masl;
  const max = declared ? Math.max(...bands.map((b) => b.max_masl)) : level.observed_max_masl;
  const span = max - min;
  const at = (v: number) => (span > 0 ? Math.min(100, Math.max(0, ((v - min) / span) * 100)) : 50);
  const primary = bands[0];
  const share = primary?.band_pct ?? at(level.masl);
  // One rule per distinct floor, minus the one the axis already ends at.
  const floors = [...new Set(bands.map((b) => b.min_masl))].filter((f) => f !== min).map(at);
  return {
    reservoir,
    masl: level.masl,
    min,
    max,
    fill: at(level.masl),
    declared,
    share,
    floors,
    percentile: roundOrNull(reservoir.inflow?.climatology?.percentile_today),
    // Only against a declared band: the recorded range is not an operating volume.
    shape: declared ? shapeOf(curves[reservoir.site], min, max, level.masl, primary!.min_masl) : null,
  };
}

export function Fleet({ reservoirs, shapes = {} }: { reservoirs: ReservoirSnapshot[]; shapes?: ShapeCurves }) {
  const columns = reservoirs.map((r) => columnOf(r, shapes)).filter((c): c is Column => c !== null);
  return (
    <ul className="fleet">
      {columns.map((column) => (
        <li key={column.reservoir.site}>
          <TankColumn column={column} />
          <BarRow column={column} />
        </li>
      ))}
    </ul>
  );
}

function trendOf(column: Column) {
  const slope = column.reservoir.slopes_m_per_day.d7;
  const dir = direction(slope);
  return { slope, dir, tone: `tone-${DIRECTION_TONE[dir]}` };
}

function TankColumn({ column }: { column: Column }) {
  const { reservoir, fill } = column;
  const href = detailPage(reservoir.site);
  const { slope, dir, tone } = trendOf(column);
  const inside = fill >= INSIDE_ABOVE;
  const { shape } = column;
  const headline = shape ? shape.volumePct : column.share;
  const body = (
    <>
      <div>
        <div className="column-name">{reservoir.label}</div>
        <div className="column-basin">{basinName(reservoir.basin)}</div>
      </div>
      <div className={shape ? "tank shaped" : column.declared ? "tank" : "tank hatched"} role="img" aria-label={ariaLabel(column)}>
        {shape ? (
          <TankShape site={reservoir.site} shape={shape} fill={fill} floors={column.floors} />
        ) : (
          <>
            <div className="tank-fill" style={{ height: `${fill.toFixed(1)}%` }} />
            <div className="tank-surface" style={{ bottom: `${fill.toFixed(1)}%` }} />
            {column.floors.map((f) => (
              <div key={f} className="tank-floor" style={{ bottom: `${f.toFixed(1)}%` }} />
            ))}
          </>
        )}
        <div className={fill > 92 ? "tank-top inside" : "tank-top"} aria-hidden="true">
          {num(column.max, 0)}
        </div>
        <div className="tank-bottom" aria-hidden="true">
          {num(column.min, 0)}
        </div>
        <div
          className={inside ? "tank-pct inside" : "tank-pct"}
          style={inside ? { top: `${(100 - fill + 3).toFixed(1)}%` } : { bottom: `calc(${fill.toFixed(1)}% + 8px)` }}
          aria-hidden="true"
        >
          {num(headline, 0)}
          <small>%</small>
          {shape ? <span className="tank-pct-unit">del agua</span> : null}
        </div>
      </div>
      <div className="column-foot">
        <div className="column-level num">{num(column.masl, 2)} m</div>
        <div className="column-trend">
          <span>
            <span className={`arrow ${tone}`} aria-hidden="true">
              {ARROW[dir]}
            </span>{" "}
            {dir === "flat" ? num(0, 2) : signed(slope, 2)} <MetresPerDay />
          </span>
          <span className="mono column-percentile">
            <PercentileAbbr percentile={column.percentile} />
          </span>
        </div>
        <div className="column-scale">
          {shape ? (
            <>
              <span className="num">
                {num(shape.storedHm3, 0)} de {num(shape.fullHm3, 0)} hm³
              </span>{" "}
              · {pct(column.share, 0)} del rango
            </>
          ) : column.declared ? (
            "rango oficial · mide altura, no agua"
          ) : (
            "sin rango oficial: lo registrado"
          )}
        </div>
      </div>
    </>
  );
  return href ? (
    <a className="column lift" href={href}>
      {body}
    </a>
  ) : (
    <div className="column lift">{body}</div>
  );
}

function BarRow({ column }: { column: Column }) {
  const { reservoir, fill } = column;
  const href = detailPage(reservoir.site);
  const { slope, dir, tone } = trendOf(column);
  const body = (
    <>
      <div className="top">
        <span>{reservoir.label}</span>
        <span className="num">
          {num(column.masl, 2)} m{" "}
          <span className={`arrow ${tone}`} aria-hidden="true">
            {ARROW[dir]}
          </span>
        </span>
      </div>
      {column.shape ? (
        <BarShape site={reservoir.site} shape={column.shape} floors={column.floors} />
      ) : (
        <div className={column.declared ? "bar" : "bar hatched"} aria-hidden="true">
          <div className="bar-fill" style={{ width: `${fill.toFixed(1)}%` }} />
          {column.floors.map((f) => (
            <div key={f} className="bar-floor" style={{ left: `${f.toFixed(1)}%` }} />
          ))}
        </div>
      )}
      <div className="bottom">
        {column.shape ? (
          <span>
            <VolumeAbbr>{pct(column.shape.volumePct, 0)} del agua</VolumeAbbr> · {num(column.shape.storedHm3, 0)} hm³
          </span>
        ) : (
          <span>
            {pct(column.share, 1)} {column.declared ? "de su rango" : "del rango registrado"}
          </span>
        )}
        <span>
          {dir === "flat" ? num(0, 2) : signed(slope, 2)} m/día · agua que llega{" "}
          <PercentileAbbr percentile={column.percentile} empty="sin datos" />
        </span>
      </div>
    </>
  );
  return href ? (
    <a className="column-row" href={href}>
      {body}
    </a>
  ) : (
    <div className="column-row">{body}</div>
  );
}

function ariaLabel(column: Column): string {
  const { reservoir, shape } = column;
  const band = `${pct(column.share, 1)} ${column.declared ? "de su rango de operación" : "del rango registrado"}`;
  const water = shape
    ? `, ${pct(shape.volumePct, 0)} del agua de ese rango (${num(shape.storedHm3, 0)} de ${num(shape.fullHm3, 0)} hm³)`
    : "";
  return `${reservoir.label}: ${num(column.masl, 2)} m, ${band}${water}, en una escala de ${num(column.min, 0)} a ${num(column.max, 0)} m`;
}

/** What "del agua" means, said in text and not only in a tooltip, like `PercentileAbbr`. */
function VolumeAbbr({ children }: { children: ReactNode }) {
  const said = "del volumen entre el nivel mínimo y el máximo de operación, según la curva área-cota ajustada a las lecturas del embalse";
  return (
    <abbr title={said}>
      {children}
      <span className="visually-hidden"> ({said})</span>
    </abbr>
  );
}

/** A line ruled across the vessel at axis position `t` (0–1), as far as the vessel's walls. */
function rule(points: readonly OutlinePoint[], t: number): { from: number; to: number } {
  const w = widthAt(points, t);
  return { from: 50 - w * 50, to: 50 + w * 50 };
}

/** The column drawn in the reservoir's shape: 100 × 100 units, stretched to the tank's box. */
function TankShape({ site, shape, fill, floors }: { site: string; shape: Shape; fill: number; floors: number[] }) {
  const id = `tank-water-${site}`;
  const surface = rule(shape.vessel, fill / 100);
  return (
    <svg className="tank-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water-2)" />
          <stop offset="1" stopColor="var(--water)" />
        </linearGradient>
      </defs>
      <path className="tank-vessel" d={verticalPath(shape.vessel, 100, 100)} />
      <path d={verticalPath(shape.water, 100, 100)} fill={`url(#${id})`} />
      <line className="tank-shape-surface" x1={surface.from} x2={surface.to} y1={100 - fill} y2={100 - fill} />
      {floors.map((f) => {
        const at = rule(shape.vessel, f / 100);
        return <line key={f} className="tank-shape-floor" x1={at.from} x2={at.to} y1={100 - f} y2={100 - f} />;
      })}
    </svg>
  );
}

/** The phone bar drawn in the reservoir's shape: deep end left, crest right. */
function BarShape({ site, shape, floors }: { site: string; shape: Shape; floors: number[] }) {
  const id = `bar-water-${site}`;
  const height = 18;
  return (
    <svg className="bar-shape" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--water-2)" />
          <stop offset="1" stopColor="var(--water)" />
        </linearGradient>
      </defs>
      <path className="tank-vessel" d={horizontalPath(shape.vessel, 100, height)} />
      <path d={horizontalPath(shape.water, 100, height)} fill={`url(#${id})`} />
      {floors.map((f) => {
        const half = (widthAt(shape.vessel, f / 100) * height) / 2;
        return <line key={f} className="tank-shape-floor" x1={f} x2={f} y1={height / 2 - half} y2={height / 2 + half} />;
      })}
    </svg>
  );
}

function roundOrNull(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v);
}
