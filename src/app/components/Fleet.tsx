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
 * On a phone each reservoir becomes a horizontal bar; both are rendered and CSS shows one, so the
 * switch needs no script.
 */

import type { ReactNode } from "react";
import { basinName, num, pct, signed } from "../../lib/site/format.ts";
import { ARROW, DIRECTION_TONE, direction } from "../../lib/site/story.ts";
import { reservoirHref } from "../../lib/site/data.ts";
import type { ReservoirSnapshot } from "../../lib/publish/latest.ts";

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
    <abbr title={`percentil ${percentile} del caudal de hoy frente a su historia`}>
      p{percentile}
      <span className="visually-hidden"> (percentil {percentile} del caudal frente a su historia)</span>
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
}

function columnOf(reservoir: ReservoirSnapshot): Column | null {
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
  };
}

export function Fleet({ reservoirs }: { reservoirs: ReservoirSnapshot[] }) {
  const columns = reservoirs.map(columnOf).filter((c): c is Column => c !== null);
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
  const body = (
    <>
      <div>
        <div className="column-name">{reservoir.label}</div>
        <div className="column-basin">{basinName(reservoir.basin)}</div>
      </div>
      <div
        className={column.declared ? "tank" : "tank hatched"}
        role="img"
        aria-label={`${reservoir.label}: ${num(column.masl, 2)} m, ${pct(column.share, 1)} ${column.declared ? "de la banda declarada" : "del rango registrado"}, en una escala de ${num(column.min, 0)} a ${num(column.max, 0)} m`}
      >
        <div className="tank-fill" style={{ height: `${fill.toFixed(1)}%` }} />
        <div className="tank-surface" style={{ bottom: `${fill.toFixed(1)}%` }} />
        {column.floors.map((f) => (
          <div key={f} className="tank-floor" style={{ bottom: `${f.toFixed(1)}%` }} />
        ))}
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
          {num(column.share, 0)}
          <small>%</small>
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
        <div className="column-scale">{column.declared ? "banda declarada" : "sin banda: rango registrado"}</div>
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
      <div className={column.declared ? "bar" : "bar hatched"} aria-hidden="true">
        <div className="bar-fill" style={{ width: `${fill.toFixed(1)}%` }} />
        {column.floors.map((f) => (
          <div key={f} className="bar-floor" style={{ left: `${f.toFixed(1)}%` }} />
        ))}
      </div>
      <div className="bottom">
        <span>
          {pct(column.share, 1)} {column.declared ? "de la banda" : "del rango registrado"}
        </span>
        <span>
          {dir === "flat" ? num(0, 2) : signed(slope, 2)} m/día · caudal{" "}
          <PercentileAbbr percentile={column.percentile} empty="sin base" />
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

function roundOrNull(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v);
}
