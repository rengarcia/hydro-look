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
 * A reservoir with a known shape is drawn in it (`lib/site/geometry.ts` says which, and why).
 * Where an area-elevation curve exists — Mazar's fit, or a curve through CELEC's design volumes —
 * the column is as wide at each level as the lake's surface is there, so the water painted is the
 * water stored, and the large number is that share of the band's volume rather than of its metres.
 * A pond too small to have a measurable shape stays straight and says how little it holds;
 * Sopladora, which is a chamber and not a reservoir, is ruled at the level where it spills. A
 * rectangle is the honest drawing of a shape nobody has measured.
 *
 * On a phone each reservoir becomes a horizontal bar; both are rendered and CSS shows one, so the
 * switch needs no script.
 */

import type { ReactNode } from "react";
import { basinName, num, pct, signed } from "../../lib/site/format.ts";
import { ARROW, DIRECTION_TONE, direction } from "../../lib/site/story.ts";
import { reservoirHref } from "../../lib/site/data.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";
import { horizontalPath, outline, storedHm3, verticalPath, volumeShare, widthAt, type OutlinePoint } from "../../lib/site/shape.ts";
import type { Geometry, SiteGeometry } from "../../lib/site/geometry.ts";

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
  /** A chamber's spill level, as a position on the axis. */
  spill: number | null;
  percentile: number | null;
  /** Present only where the reservoir's area-elevation curve is known. */
  shape: Shape | null;
  /** What else the gauge must say: a pond's size, a chamber's thresholds, a drawdown. */
  note: string | null;
}

interface Shape {
  source: "fit" | "design";
  /** The vessel, floor of the axis to its crest. */
  vessel: OutlinePoint[];
  /** The water, floor of the axis to today's level. */
  water: OutlinePoint[];
  /** Share of the band's volume held today, 0–100: the same band the level share is of. */
  volumePct: number;
  /** Water held above the band's floor, hm³, under each curve that may be shown; empty hides it. */
  storedHm3: number[];
  fullHm3: number[];
}

function shapeOf(geometry: SiteGeometry | undefined, min: number, max: number, level: number, floor: number): Shape | null {
  const curve = geometry?.curve;
  if (!geometry || !curve || !geometry.curveSource) return null;
  const volumePct = volumeShare(curve, floor, max, level);
  const vessel = outline(curve, min, max);
  if (volumePct === null || vessel.length === 0) return null;
  return {
    source: geometry.curveSource,
    vessel,
    water: outline(curve, min, max, level),
    volumePct,
    storedHm3: geometry.volumeCurves.map((c) => storedHm3(c, floor, level)),
    fullHm3: geometry.volumeCurves.map((c) => storedHm3(c, floor, max)),
  };
}

/** `≈0,6 hm³`, or `67–117 hm³` when the curves disagree on it. */
export function hm3Text(values: readonly number[]): string | null {
  if (values.length === 0) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const digits = hi < 10 ? 1 : 0;
  return num(lo, digits) === num(hi, digits) ? `≈${num(hi, digits)} hm³` : `${num(lo, digits)}–${num(hi, digits)} hm³`;
}

/** The sentence a gauge carries beyond its numbers, or null. */
export function noteOf(geometry: SiteGeometry | undefined, level: number): string | null {
  if (!geometry) return null;
  if (geometry.tripMasl !== null && geometry.spillMasl !== null) {
    return `cámara de paso, no embalse: la central se detiene bajo ${num(geometry.tripMasl, 0)} m y vierte desde ${num(geometry.spillMasl, 1)} m`;
  }
  if (geometry.pondHm3 !== null) {
    const hours = geometry.designFlowM3s ? (geometry.pondHm3 * 1e6) / geometry.designFlowM3s / 3600 : null;
    const flow = hours === null ? "" : `, ${hours < 1.5 ? "una hora" : `${num(hours, 0)} horas`} de caudal de diseño`;
    return `embalse pequeño (≈${num(geometry.pondHm3, 1)} hm³${flow}): mide altura, no agua`;
  }
  if (geometry.designMinMasl !== null && level < geometry.designMinMasl) {
    return `bajo su mínimo de diseño (${num(geometry.designMinMasl, 1)} m): vaciado o purga`;
  }
  return null;
}

function columnOf(reservoir: ReservoirSnapshot, geometry: Geometry): Column | null {
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
  const site = geometry[reservoir.site];
  return {
    reservoir,
    masl: level.masl,
    min,
    max,
    fill: at(level.masl),
    declared,
    share,
    floors,
    spill: site?.spillMasl != null ? at(site.spillMasl) : null,
    percentile: roundOrNull(reservoir.inflow?.climatology?.percentile_today),
    // The water's share is of the same band the level's is: the primary band, or what was recorded.
    shape: shapeOf(site, min, max, level.masl, primary?.min_masl ?? min),
    note: noteOf(site, level.masl),
  };
}

export function Fleet({ reservoirs, geometry = {} }: { reservoirs: ReservoirSnapshot[]; geometry?: Geometry }) {
  const columns = reservoirs.map((r) => columnOf(r, geometry)).filter((c): c is Column => c !== null);
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

function bandWords(column: Column, digits: number): string {
  return `${pct(column.share, digits)} ${column.declared ? "de su rango" : "del rango registrado"}`;
}

/** The desk caption under a column: what the scale is, and what the shape rests on. */
function scaleCaption(column: Column): string {
  const { shape } = column;
  if (!shape) return column.declared ? "rango oficial · mide altura, no agua" : "sin rango oficial: lo registrado";
  const volume = hm3Text(shape.storedHm3);
  const parts = [
    volume === null ? null : shape.storedHm3.length > 1 ? `${volume} (ajuste–diseño)` : volume,
    `${pct(column.share, 0)} ${column.declared ? "del rango" : "de lo registrado"}`,
    shape.source === "design" ? "forma de diseño" : null,
  ];
  return parts.filter((p) => p !== null).join(" · ");
}

function TankColumn({ column }: { column: Column }) {
  const { reservoir, fill } = column;
  const href = detailPage(reservoir.site);
  const { slope, dir, tone } = trendOf(column);
  const inside = fill >= INSIDE_ABOVE;
  const { shape } = column;
  const headline = shape ? shape.volumePct : column.share;
  const tankClass = ["tank", shape ? "shaped" : null, column.declared ? null : "hatched"].filter(Boolean).join(" ");
  const body = (
    <>
      <div>
        <div className="column-name">{reservoir.label}</div>
        <div className="column-basin">{basinName(reservoir.basin)}</div>
      </div>
      <div className={tankClass} role="img" aria-label={ariaLabel(column)}>
        {shape ? (
          <TankShape site={reservoir.site} shape={shape} fill={fill} floors={column.floors} hatched={!column.declared} />
        ) : (
          <>
            <div className="tank-fill" style={{ height: `${fill.toFixed(1)}%` }} />
            <div className="tank-surface" style={{ bottom: `${fill.toFixed(1)}%` }} />
            {column.floors.map((f) => (
              <div key={f} className="tank-floor" style={{ bottom: `${f.toFixed(1)}%` }} />
            ))}
            {column.spill !== null ? <div className="tank-spill" style={{ bottom: `${column.spill.toFixed(1)}%` }} /> : null}
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
        <div className="column-scale">{scaleCaption(column)}</div>
        {column.note ? <div className="column-scale column-note">{column.note}</div> : null}
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
  const { reservoir, fill, shape } = column;
  const href = detailPage(reservoir.site);
  const { slope, dir, tone } = trendOf(column);
  const volume = shape ? hm3Text(shape.storedHm3) : null;
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
      {shape ? (
        <BarShape site={reservoir.site} shape={shape} floors={column.floors} hatched={!column.declared} />
      ) : (
        <div className={column.declared ? "bar" : "bar hatched"} aria-hidden="true">
          <div className="bar-fill" style={{ width: `${fill.toFixed(1)}%` }} />
          {column.floors.map((f) => (
            <div key={f} className="bar-floor" style={{ left: `${f.toFixed(1)}%` }} />
          ))}
          {column.spill !== null ? <div className="bar-spill" style={{ left: `${column.spill.toFixed(1)}%` }} /> : null}
        </div>
      )}
      <div className="bottom">
        {shape ? (
          <span>
            <VolumeAbbr source={shape.source}>{pct(shape.volumePct, 0)} del agua</VolumeAbbr>
            {volume ? ` · ${volume}` : ""}
          </span>
        ) : (
          <span>{bandWords(column, 1)}</span>
        )}
        <span>
          {dir === "flat" ? num(0, 2) : signed(slope, 2)} m/día · agua que llega{" "}
          <PercentileAbbr percentile={column.percentile} empty="sin datos" />
        </span>
      </div>
      {column.note ? <div className="note">{column.note}</div> : null}
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
  const volume = shape ? hm3Text(shape.storedHm3) : null;
  const water = shape
    ? `, ${pct(shape.volumePct, 0)} del agua de ese rango${volume ? ` (${volume})` : ""} según una curva ${shape.source === "fit" ? "ajustada a sus lecturas" : "de diseño"}`
    : "";
  const note = column.note ? `; ${column.note}` : "";
  return `${reservoir.label}: ${num(column.masl, 2)} m, ${band}${water}, en una escala de ${num(column.min, 0)} a ${num(column.max, 0)} m${note}`;
}

/** What "del agua" means, said in text and not only in a tooltip, like `PercentileAbbr`. */
function VolumeAbbr({ source, children }: { source: Shape["source"]; children: ReactNode }) {
  const curve =
    source === "fit"
      ? "la curva área-cota ajustada a las lecturas del embalse"
      : "una curva área-cota trazada por los volúmenes de diseño que publica CELEC";
  const said = `del volumen entre el nivel mínimo y el máximo del rango, según ${curve}`;
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

/** The empty vessel's fill: plain, or hatched where the scale is only what was recorded. */
function VesselDefs({ id, hatched, water, horizontal }: { id: string; hatched: boolean; water: string; horizontal: boolean }) {
  return (
    <defs>
      <linearGradient id={water} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
        <stop offset="0" stopColor="var(--water-2)" />
        <stop offset="1" stopColor="var(--water)" />
      </linearGradient>
      {hatched ? (
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="var(--sunk)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--line)" strokeWidth="1" />
        </pattern>
      ) : null}
    </defs>
  );
}

/** The column drawn in the reservoir's shape: 100 × 100 units, stretched to the tank's box. */
function TankShape({
  site,
  shape,
  fill,
  floors,
  hatched,
}: {
  site: string;
  shape: Shape;
  fill: number;
  floors: number[];
  hatched: boolean;
}) {
  const water = `tank-water-${site}`;
  const hatch = `tank-hatch-${site}`;
  const surface = rule(shape.vessel, fill / 100);
  return (
    <svg className="tank-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <VesselDefs id={hatch} hatched={hatched} water={water} horizontal={false} />
      <path className="tank-vessel" d={verticalPath(shape.vessel, 100, 100)} style={hatched ? { fill: `url(#${hatch})` } : undefined} />
      <path d={verticalPath(shape.water, 100, 100)} fill={`url(#${water})`} />
      <line className="tank-shape-surface" x1={surface.from} x2={surface.to} y1={100 - fill} y2={100 - fill} />
      {floors.map((f) => {
        const at = rule(shape.vessel, f / 100);
        return <line key={f} className="tank-shape-floor" x1={at.from} x2={at.to} y1={100 - f} y2={100 - f} />;
      })}
    </svg>
  );
}

/** The phone bar drawn in the reservoir's shape: deep end left, crest right. */
function BarShape({ site, shape, floors, hatched }: { site: string; shape: Shape; floors: number[]; hatched: boolean }) {
  const water = `bar-water-${site}`;
  const hatch = `bar-hatch-${site}`;
  const height = 18;
  return (
    <svg className="bar-shape" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <VesselDefs id={hatch} hatched={hatched} water={water} horizontal />
      <path
        className="tank-vessel"
        d={horizontalPath(shape.vessel, 100, height)}
        style={hatched ? { fill: `url(#${hatch})` } : undefined}
      />
      <path d={horizontalPath(shape.water, 100, height)} fill={`url(#${water})`} />
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
