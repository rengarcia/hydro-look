/**
 * A reservoir's whole recorded level, one point a week, over its declared band.
 *
 * Weekly because a decade of daily points is four thousand vertices for a line a reader looks at
 * for its shape; each point is the mean of the readings that week actually has, and a week with
 * none is a break in the line, not an interpolation. The record minimum is marked from the daily
 * series, not from the weekly means, so the number printed beside it is a reading that happened.
 */

import { linePath, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, round, yearLabels } from "./Plot.tsx";
import { num, shortDate } from "../../lib/site/format.ts";
import { addDays, daysBetween } from "../../lib/util/dates.ts";
import type { SeriesPoint } from "../../lib/site/data.ts";

/** The desktop drawing, and the phone one: same data, larger type on a narrower box. */
const SIZES = {
  wide: { width: 1136, height: 300, margin: { top: 16, right: 16, bottom: 34, left: 54 }, font: 11 },
  compact: { width: 440, height: 320, margin: { top: 16, right: 24, bottom: 40, left: 62 }, font: 15 },
};

export interface RecordRule {
  level_masl: number;
  label: string;
  unverified: boolean;
}

export function RecordChart({
  readings,
  band,
  rules,
  label,
  compact = false,
}: {
  readings: SeriesPoint[];
  band: { min: number; max: number } | null;
  rules: RecordRule[];
  label: string;
  compact?: boolean;
}) {
  const { width: WIDTH, height: HEIGHT, margin: MARGIN, font } = compact ? SIZES.compact : SIZES.wide;
  if (readings.length < 14) return null;
  const first = readings[0]!.date;
  const last = readings.at(-1)!.date;
  const span = daysBetween(first, last);
  const at = (date: string) => daysBetween(first, date);

  const weeks = weekly(readings, first);
  let low = Infinity;
  let high = -Infinity;
  for (const r of readings) {
    low = Math.min(low, r.value);
    high = Math.max(high, r.value);
  }
  if (band) {
    low = Math.min(low, band.min);
    high = Math.max(high, band.max);
  }
  for (const rule of rules) low = Math.min(low, rule.level_masl);

  const frame = frameOf({
    width: WIDTH,
    height: HEIGHT,
    margin: MARGIN,
    xDomain: [0, span],
    yDomain: [low - 2, high + 4],
    yTickCount: 3,
  });
  const y = (v: number) => round(frame.y(v));
  const x = (date: string) => round(frame.x(at(date)));
  const bottom = MARGIN.top + frame.innerHeight;

  const minimum = readings.reduce((a, b) => (b.value < a.value ? b : a));
  const newest = readings.at(-1)!;
  const runs = splitRuns(weeks);
  const minX = x(minimum.date);
  const labelLeft = minX > WIDTH / 2;

  return (
    <Plot
      frame={frame}
      xLabels={yearLabels(first, last, at).filter((_, i, all) => !compact || (all.length - 1 - i) % 3 === 0)}
      fontSize={font}
      yFormat={(v) => num(v, 0)}
      title={label}
      desc={`Cota semanal entre el ${first} y el ${last}. Mínimo del registro: ${num(minimum.value, 2)} m el ${minimum.date}.`}
    >
      {band ? (
        <rect x={MARGIN.left} y={y(band.max)} width={frame.innerWidth} height={round(y(band.min) - y(band.max))} fill="var(--water-4)" opacity=".5" />
      ) : null}
      {rules.map((rule, i) => (
        <g key={rule.level_masl}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(rule.level_masl)}
            y2={y(rule.level_masl)}
            stroke="var(--deficit)"
            strokeWidth={1.3}
            strokeDasharray={rule.unverified ? "2 4" : "6 4"}
          />
          <text
            x={MARGIN.left + 8}
            y={i === rules.length - 1 ? y(rule.level_masl) + font + 3 : y(rule.level_masl) - 6}
            fontFamily="var(--mono)"
            fontSize={font}
            fill="var(--deficit)"
          >
            {compact ? `${num(rule.level_masl, 0)} m` : rule.label}
          </text>
        </g>
      ))}
      {runs.map((run, i) => {
        const points: Point[] = run.map((p) => ({ x: frame.x(at(p.date)), y: frame.y(p.value) }));
        const area = `${linePath(points)} L${round(points.at(-1)!.x)} ${bottom} L${round(points[0]!.x)} ${bottom} Z`;
        return (
          <g key={i}>
            <path d={area} fill="var(--water)" fillOpacity={0.14} />
            <path d={linePath(points)} fill="none" stroke="var(--water)" strokeWidth={1.8} strokeLinejoin="round" />
          </g>
        );
      })}
      <circle cx={minX} cy={y(minimum.value)} r={6} fill="var(--surface)" stroke="var(--deficit)" strokeWidth={2} />
      <text
        x={labelLeft ? minX - 14 : minX + 14}
        y={y(minimum.value) + font + 6}
        textAnchor={labelLeft ? "end" : "start"}
        fontFamily="var(--mono)"
        fontSize={font + 1}
        fill="var(--ink)"
      >
        {num(minimum.value, 2)} m · {shortDate(minimum.date)} {minimum.date.slice(0, 4)}
        {compact ? "" : ", el mínimo del registro"}
      </text>
      <circle cx={x(newest.date)} cy={y(newest.value)} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
    </Plot>
  );
}

/** Mean level per seven-day block counted from `first`, dated at the block's middle. */
function weekly(readings: SeriesPoint[], first: string): SeriesPoint[] {
  const blocks = new Map<number, { sum: number; n: number }>();
  for (const r of readings) {
    const block = Math.floor(daysBetween(first, r.date) / 7);
    const b = blocks.get(block) ?? blocks.set(block, { sum: 0, n: 0 }).get(block)!;
    b.sum += r.value;
    b.n += 1;
  }
  return [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([block, b]) => ({ date: addDays(first, block * 7 + 3), value: b.sum / b.n }));
}

/** Runs of consecutive weeks; a week with no readings ends a run. */
function splitRuns(weeks: SeriesPoint[]): SeriesPoint[][] {
  const out: SeriesPoint[][] = [];
  let run: SeriesPoint[] = [];
  for (const week of weeks) {
    if (run.length > 0 && daysBetween(run.at(-1)!.date, week.date) > 7) {
      if (run.length > 1) out.push(run);
      run = [];
    }
    run.push(week);
  }
  if (run.length > 1) out.push(run);
  return out;
}
