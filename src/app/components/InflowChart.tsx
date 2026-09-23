/**
 * A year of inflow against what this river normally does on the same days.
 *
 * The ribbon is the p10–p90 of every year on record within a week either side of each calendar
 * day; the dashed line through it is the median. Both are drawn in pale, recessive ink rather
 * than the reading's colour, because they are a reference range and not a second thing being
 * compared.
 *
 * The x axis is days, not readings. That distinction is the whole point on this data: laying
 * the readings out evenly would close every hole in the record without saying so, and the
 * holes are real. A run of missing days shows as a break in the line, because the line is
 * drawn as separate segments either side of it rather than bridged across.
 */

import { bandPath, linePath, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, monthLabels, round } from "./Plot.tsx";
import { num } from "../../lib/site/format.ts";
import { daysBetween } from "../../lib/util/dates.ts";
import type { RibbonPoint, SeriesPoint } from "../../lib/site/data.ts";

export function InflowChart({
  readings,
  ribbon,
  label,
  width = 540,
  height = 270,
  compact = false,
}: {
  readings: SeriesPoint[];
  ribbon: RibbonPoint[];
  label: string;
  width?: number;
  height?: number;
  /** The phone drawing: a narrower box, so the same type renders larger. */
  compact?: boolean;
}) {
  if (compact) {
    width = 360;
    height = 280;
  }
  const font = compact ? 14 : 10.5;
  if (readings.length < 2) return null;

  const first = readings[0]!.date;
  const last = readings.at(-1)!.date;
  const span = daysBetween(first, last);
  if (span < 1) return null;
  const at = (date: string) => daysBetween(first, date);

  let top = 0;
  for (const r of readings) top = Math.max(top, r.value);
  for (const r of ribbon) top = Math.max(top, r.band.p90);

  const frame = frameOf({
    width,
    height,
    margin: compact ? { top: 12, right: 8, bottom: 34, left: 44 } : { top: 12, right: 10, bottom: 30, left: 40 },
    xDomain: [0, span],
    yDomain: [0, top * 1.05],
  });

  const onChart = ribbon.filter((r) => r.date >= first && r.date <= last);
  const upper: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p90) }));
  const lower: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p10) }));
  const median: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p50) }));
  const newest = readings.at(-1)!;

  return (
    <Plot
      frame={frame}
      xLabels={monthLabels(first, last, compact ? 4 : 3, at)}
      fontSize={font}
      yFormat={(v) => num(v, 0)}
      title={label}
      desc={`Caudal diario entre el ${first} y el ${last}, sobre la franja p10–p90 de los mismos días del año en todos los años disponibles.`}
    >
      {upper.length > 1 ? <path d={bandPath(upper, lower)} fill="var(--water-3)" opacity={0.8} /> : null}
      {median.length > 1 ? (
        <path d={linePath(median)} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeDasharray="4 4" />
      ) : null}
      {segments(readings, at, frame).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--water)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <circle
        cx={round(frame.x(at(newest.date)))}
        cy={round(frame.y(newest.value))}
        r={4.5}
        fill="var(--water)"
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </Plot>
  );
}

/**
 * The reading line, split wherever the record skips a day.
 *
 * "Missing" is a day absent from the series, not a day whose value is zero: on both routes a
 * zero can be a real reading, and `repDiaHid12m` published 0 for Mazar at the worst of the 2024
 * drought while the historian published 0.142 for the same day.
 */
function segments(
  readings: SeriesPoint[],
  at: (date: string) => number,
  frame: { x: (v: number) => number; y: (v: number) => number },
): string[] {
  const out: string[] = [];
  let run: Point[] = [];
  let previous: string | null = null;
  for (const reading of readings) {
    if (previous !== null && daysBetween(previous, reading.date) > 1) {
      out.push(linePath(run));
      run = [];
    }
    run.push({ x: frame.x(at(reading.date)), y: frame.y(reading.value) });
    previous = reading.date;
  }
  out.push(linePath(run));
  return out.filter((d) => d !== "");
}
