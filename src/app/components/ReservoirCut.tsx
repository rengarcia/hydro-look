/**
 * A cross-section of a reservoir: the valley, the dam, and the water standing at today's level,
 * with the band's crest, the ninety-day forecast and every declared floor ruled across it.
 *
 * It is an illustration drawn to scale on one axis only. Height is metres of level, linear, from
 * the crest of the band down to a little below the lowest floor; the valley's width is a fixed
 * wedge, not the reservoir's real bathymetry. That is why the label under the level names a
 * share of the *band* and never of stored water — the same distinction the gauges make.
 *
 * Two variants exist because the labels do not survive being scaled down to a phone: `compact`
 * moves the dam left to give the labels room and sets them at a size that stays legible when the
 * whole drawing is 350 px wide. The page renders both and CSS shows one.
 */

import { num } from "../../lib/site/format.ts";

export interface CutLevel {
  level_masl: number;
  label: string;
  /** Short form for the compact variant. */
  short: string;
  /** This project's own marker rather than a declaration: drawn with a finer dash. */
  unverified?: boolean;
}

const TOP = 76;
const BOTTOM = 490;
const VALLEY_TOP = 30;

export function ReservoirCut({
  crest,
  level,
  bandPct,
  floors,
  forecast,
  label,
  compact = false,
  className,
}: {
  crest: number;
  level: number;
  bandPct: number | null;
  floors: CutLevel[];
  forecast: { p10: number; p50: number; p90: number; days: number } | null;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const dam = compact ? 320 : 384;
  const bankBottom = dam * 0.4667;
  const lowestFloor = floors.length > 0 ? Math.min(...floors.map((f) => f.level_masl)) : level;
  const low = Math.min(lowestFloor, level) - (crest - Math.min(lowestFloor, level)) * 0.15;
  const k = (BOTTOM - TOP) / (crest - low || 1);
  const y = (v: number) => clamp(TOP + (crest - v) * k, 20, BOTTOM);
  const bank = (yy: number) => ((yy - VALLEY_TOP) * bankBottom) / (BOTTOM - VALLEY_TOP);
  const r = (v: number) => Math.round(v * 10) / 10;

  const surface = y(level);
  const fontSize = compact ? 22 : 12;
  const labelX = dam + 96;

  const rules: { y: number; text: string; color: string; dash?: string; width: number }[] = [
    { y: TOP, text: compact ? `${num(crest, 0)} cresta` : `${num(crest, 0)} m · cresta de la banda`, color: "var(--ink-2)", width: 1 },
  ];
  if (forecast) {
    rules.push({
      y: y(forecast.p50),
      text: compact ? `${num(forecast.p50, 0)} p50 ${forecast.days} d` : `${num(forecast.p50, 0)} m · p50 a ${forecast.days} días`,
      color: "var(--water)",
      dash: "5 5",
      width: 1.4,
    });
  }
  for (const floor of floors) {
    rules.push({
      y: y(floor.level_masl),
      text: compact ? floor.short : floor.label,
      color: "var(--deficit)",
      dash: floor.unverified ? "2 4" : "6 4",
      width: 1.4,
    });
  }
  rules.sort((a, b) => a.y - b.y);

  // Labels that would overprint are pushed down by one line height, in order, so two floors two
  // metres apart are both readable instead of one hiding the other.
  const gap = fontSize + 2;
  let last = -Infinity;
  const labelled = rules.map((rule) => {
    const labelY = Math.max(rule.y + fontSize / 3, last + gap);
    last = labelY;
    return { ...rule, labelY };
  });

  const wave: string[] = [];
  for (let x = -40; x <= dam + 90; x += 5) {
    wave.push(`${x === -40 ? "M" : "L"}${x} ${r(surface + 7 + 1.6 * Math.sin((x / 80) * Math.PI * 2))}`);
  }

  const whiskerX = dam - 53;
  const id = compact ? "cut-c" : "cut-w";

  return (
    <svg
      className={className ? `cut ${className}` : "cut"}
      viewBox={`0 0 640 ${compact ? 560 : 540}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--water)" stopOpacity=".7" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={`M${r(bank(surface))} ${r(surface)} L${dam} ${r(surface)} L${dam} ${BOTTOM} L${r(bankBottom)} ${BOTTOM} Z`} />
        </clipPath>
      </defs>

      <path d={`M0 ${VALLEY_TOP} L${r(bankBottom)} ${BOTTOM} L${dam} ${BOTTOM} L${dam} 540 L0 540 Z`} fill="var(--sunk)" />
      <path
        d={`M${r(bank(surface))} ${r(surface)} L${dam} ${r(surface)} L${dam} ${BOTTOM} L${r(bankBottom)} ${BOTTOM} Z`}
        fill={`url(#${id}-water)`}
      />
      <g clipPath={`url(#${id}-clip)`}>
        <path className="wave" d={wave.join(" ")} fill="none" stroke="var(--water-3)" strokeWidth="2" opacity=".85" />
      </g>

      {labelled.map((rule) => (
        <g key={`${rule.text}-${rule.y}`}>
          <line
            x1={r(bank(rule.y))}
            x2={dam}
            y1={r(rule.y)}
            y2={r(rule.y)}
            stroke={rule.color}
            strokeWidth={rule.width}
            strokeDasharray={rule.dash}
          />
          <line x1={dam + 84} x2={dam + 90} y1={r(rule.y)} y2={r(rule.y)} stroke={rule.color} strokeWidth="1" />
          <text x={labelX} y={r(rule.labelY)} fontFamily="var(--mono)" fontSize={fontSize} fill={rule.color}>
            {rule.text}
          </text>
        </g>
      ))}

      <path d={`M${dam} 49.7 L${dam + 26} 49.7 L${dam + 80} 540 L${dam} 540 Z`} fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />

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
          <text
            x={whiskerX}
            y={r(y(forecast.p10) + (compact ? 26 : 18))}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize={compact ? 18 : 11}
            fill="var(--ink-2)"
          >
            p10–p90
          </text>
          <text
            x={whiskerX}
            y={r(y(forecast.p10) + (compact ? 50 : 32))}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize={compact ? 18 : 11}
            fill="var(--ink-2)"
          >
            {forecast.days} días
          </text>
        </g>
      ) : null}

      <text x={r(bank(surface) + 18)} y={r(surface - 16)} fontFamily="var(--serif)" fontSize={compact ? 54 : 40} fill="var(--ink)">
        {num(level, 2)} m
      </text>
      {bandPct !== null ? (
        <text x={r(bank(surface) + 20)} y={r(surface + 26)} fontFamily="var(--mono)" fontSize={compact ? 20 : 12} fill="var(--surface)">
          {compact ? `HOY · ${num(bandPct, 1)} %` : `HOY · ${num(bandPct, 1)} % DE LA BANDA`}
        </text>
      ) : null}
    </svg>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
