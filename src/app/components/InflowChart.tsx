/**
 * A year of inflow against what this river normally does on the same days.
 *
 * The ribbon is the p10–p90 of every year on record within a week either side of each calendar
 * day; the dashed line through it is the median. Both are drawn in neutral ink rather than a
 * series colour, because they are a reference range and not a second thing being compared —
 * spending a categorical hue on them would say otherwise.
 *
 * The x axis is days, not readings. That distinction is the whole point on this data: laying
 * the readings out evenly would close every hole in the record without saying so, and the
 * holes are real. A run of missing days shows as a break in the line, because the line is
 * drawn as separate segments either side of it rather than bridged across.
 */

import { bandPath, linePath, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, spacedLabels } from "./Plot.tsx";
import { num, shortDate } from "../../lib/site/format.ts";
import { daysBetween } from "../../lib/util/dates.ts";
import type { RibbonPoint, SeriesPoint } from "../../lib/site/data.ts";

const HEIGHT = 240;

export function InflowChart({
  readings,
  ribbon,
  label,
}: {
  readings: SeriesPoint[];
  ribbon: RibbonPoint[];
  label: string;
}) {
  if (readings.length < 2) return null;

  const first = readings[0]!.date;
  const last = readings.at(-1)!.date;
  const span = daysBetween(first, last);
  if (span < 1) return null;
  const at = (date: string) => daysBetween(first, date);

  let top = 0;
  for (const r of readings) top = Math.max(top, r.value);
  for (const r of ribbon) top = Math.max(top, r.band.p90);

  const frame = frameOf({ height: HEIGHT, xDomain: [0, span], yDomain: [0, top * 1.05] });

  const onChart = ribbon.filter((r) => r.date >= first && r.date <= last);
  const upper: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p90) }));
  const lower: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p10) }));
  const median: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p50) }));

  return (
    <Plot
      height={HEIGHT}
      frame={frame}
      xLabels={spacedLabels(readings.map((r) => r.date), 6, shortDate, at)}
      yFormat={(v) => num(v, 0)}
      title={label}
      desc={`Caudal diario entre ${first} y ${last}, sobre la franja p10–p90 de los mismos días del año en todos los años disponibles.`}
    >
      {upper.length > 1 ? <path d={bandPath(upper, lower)} fill="var(--axis)" fillOpacity={0.28} /> : null}
      {median.length > 1 ? (
        <path d={linePath(median)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />
      ) : null}
      {segments(readings, at, frame).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}
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
