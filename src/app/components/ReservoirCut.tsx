/**
 * A cross-section of a reservoir: the valley, the dam, and the water standing at today's level,
 * with the band's crest, the ninety-day forecast and every declared floor ruled across it.
 *
 * It is an illustration drawn to scale on one axis only. Height is metres of level, linear, from
 * the crest of the band down to a little below the lowest floor; the valley's width is a fixed
 * wedge, not the reservoir's real bathymetry. That is why the label under the level names a
 * share of the *band* and never of stored water — the same distinction the gauges make.
 *
 * One drawing serves every screen. The labels are what does not survive being scaled down to a
 * phone, so they alone come in two sets — full sentences at desk size and short forms set large
 * — each placed for its own type size and shown by CSS at its breakpoint (`.cut .wide-label`,
 * `.cut .compact-label`). The valley, the water and the dam are drawn once.
 */

import { num } from "../../lib/site/format.ts";

export interface CutLevel {
  level_masl: number;
  label: string;
  /** Short form for a phone. */
  short: string;
  /** This project's own marker rather than a declaration: drawn with a finer dash. */
  unverified?: boolean;
}

const TOP = 76;
const BOTTOM = 490;
const VALLEY_TOP = 30;
const HEIGHT = 550;
const DAM = 336;
/** Type sizes in drawing units: desk labels, phone labels. They must match `.cut` in globals.css. */
const FONT = { wide: 12, compact: 22 };

interface Rule {
  y: number;
  long: string;
  short: string;
  color: string;
  dash?: string;
  width: number;
}

/** Labels that would overprint are pushed down a line, in order, so two floors 2 m apart both read. */
function stackLabels(rules: Rule[], fontSize: number): number[] {
  const gap = fontSize + 2;
  let last = -Infinity;
  return rules.map((rule) => {
    const labelY = Math.max(rule.y + fontSize / 3, last + gap);
    last = labelY;
    return labelY;
  });
}

export function ReservoirCut({
  crest,
  level,
  bandPct,
  floors,
  forecast,
  label,
}: {
  crest: number;
  level: number;
  bandPct: number | null;
  floors: CutLevel[];
  forecast: { p10: number; p50: number; p90: number; days: number } | null;
  label: string;
}) {
  const bankBottom = DAM * 0.4667;
  const lowestFloor = floors.length > 0 ? Math.min(...floors.map((f) => f.level_masl)) : level;
  const low = Math.min(lowestFloor, level) - (crest - Math.min(lowestFloor, level)) * 0.15;
  const k = (BOTTOM - TOP) / (crest - low || 1);
  const y = (v: number) => clamp(TOP + (crest - v) * k, 20, BOTTOM);
  const bank = (yy: number) => ((yy - VALLEY_TOP) * bankBottom) / (BOTTOM - VALLEY_TOP);
  const r = (v: number) => Math.round(v * 10) / 10;

  const surface = y(level);
  const labelX = DAM + 96;

  const rules: Rule[] = [
    { y: TOP, long: `${num(crest, 0)} m · máximo de operación`, short: `${num(crest, 0)} máx.`, color: "var(--ink-2)", width: 1 },
  ];
  if (forecast) {
    rules.push({
      y: y(forecast.p50),
      long: `${num(forecast.p50, 0)} m · p50 a ${forecast.days} días`,
      short: `${num(forecast.p50, 0)} p50 ${forecast.days} d`,
      color: "var(--water)",
      dash: "5 5",
      width: 1.4,
    });
  }
  for (const floor of floors) {
    rules.push({
      y: y(floor.level_masl),
      long: floor.label,
      short: floor.short,
      color: "var(--deficit)",
      dash: floor.unverified ? "2 4" : "6 4",
      width: 1.4,
    });
  }
  rules.sort((a, b) => a.y - b.y);
  const wideY = stackLabels(rules, FONT.wide);
  const compactY = stackLabels(rules, FONT.compact);

  const wave: string[] = [];
  for (let x = -40; x <= DAM + 90; x += 5) {
    wave.push(`${x === -40 ? "M" : "L"}${x} ${r(surface + 7 + 1.6 * Math.sin((x / 80) * Math.PI * 2))}`);
  }
  const whiskerX = DAM - 53;

  return (
    <svg className="cut" viewBox={`0 0 640 ${HEIGHT}`} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <linearGradient id="cut-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--water)" stopOpacity=".7" />
        </linearGradient>
        <clipPath id="cut-clip">
          <path d={`M${r(bank(surface))} ${r(surface)} L${DAM} ${r(surface)} L${DAM} ${BOTTOM} L${r(bankBottom)} ${BOTTOM} Z`} />
        </clipPath>
      </defs>

      <path d={`M0 ${VALLEY_TOP} L${r(bankBottom)} ${BOTTOM} L${DAM} ${BOTTOM} L${DAM} ${HEIGHT} L0 ${HEIGHT} Z`} fill="var(--sunk)" />
      <path
        d={`M${r(bank(surface))} ${r(surface)} L${DAM} ${r(surface)} L${DAM} ${BOTTOM} L${r(bankBottom)} ${BOTTOM} Z`}
        fill="url(#cut-water)"
      />
      <g clipPath="url(#cut-clip)">
        <path className="wave" d={wave.join(" ")} fill="none" stroke="var(--water-3)" strokeWidth="2" opacity=".85" />
      </g>

      {rules.map((rule, i) => (
        <g key={`${rule.long}-${rule.y}`}>
          <line
            x1={r(bank(rule.y))}
            x2={DAM}
            y1={r(rule.y)}
            y2={r(rule.y)}
            stroke={rule.color}
            strokeWidth={rule.width}
            strokeDasharray={rule.dash}
          />
          <line x1={DAM + 84} x2={DAM + 90} y1={r(rule.y)} y2={r(rule.y)} stroke={rule.color} strokeWidth="1" />
          <text className="cut-label wide-label" x={labelX} y={r(wideY[i]!)} fill={rule.color}>
            {rule.long}
          </text>
          <text className="cut-label compact-label" x={labelX} y={r(compactY[i]!)} fill={rule.color}>
            {rule.short}
          </text>
        </g>
      ))}

      <path
        d={`M${DAM} 49.7 L${DAM + 26} 49.7 L${DAM + 80} ${HEIGHT} L${DAM} ${HEIGHT} Z`}
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />

      {forecast ? (
        <g>
          <rect
            x={whiskerX - 7}
            y={r(y(forecast.p90))}
            width="14"
            height={r(Math.max(y(forecast.p10) - y(forecast.p90), 14))}
            rx="7"
            fill="var(--surface)"
            fillOpacity=".55"
            stroke="var(--water)"
            strokeWidth="1.4"
          />
          <circle cx={whiskerX} cy={r(y(forecast.p50))} r="5" fill="var(--water)" stroke="var(--surface)" strokeWidth="2" />
          {/* Offsets in em, so each line sits one line below the whisker at either type size. */}
          <text className="cut-note" x={whiskerX} y={r(y(forecast.p10))} dy="1.5em" textAnchor="middle" fill="var(--ink-2)">
            p10–p90
          </text>
          <text className="cut-note" x={whiskerX} y={r(y(forecast.p10))} dy="2.8em" textAnchor="middle" fill="var(--ink-2)">
            {forecast.days} días
          </text>
        </g>
      ) : null}

      <text className="cut-level" x={r(bank(surface) + 18)} y={r(surface - 16)} fill="var(--ink)">
        {num(level, 2)} m
      </text>
      {bandPct !== null ? (
        <text className="cut-note" x={r(bank(surface) + 20)} y={r(surface + 26)} fill="var(--surface)">
          <tspan className="compact-label">HOY · {num(bandPct, 1)} %</tspan>
          <tspan className="wide-label">HOY · {num(bandPct, 1)} % DE LA BANDA</tspan>
        </text>
      ) : null}
    </svg>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
