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
 *
 * One drawing serves every screen: the box is close enough to square that it survives being
 * scaled to a phone, and the axis type is enlarged there by CSS rather than by a second copy.
 */

import { bandPath, linePath, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, monthLabels, responsiveLabels, round } from "./Plot.tsx";
import { ChartData, sampleBack } from "./DataTable.tsx";
import { dateWithYear, num } from "../../lib/site/format.ts";
import { daysBetween } from "../../lib/util/dates.ts";
import type { RibbonPoint, SeriesPoint } from "../../lib/site/data.ts";

const WIDTH = 480;
const HEIGHT = 270;
const MARGIN = { top: 12, right: 10, bottom: 36, left: 50 };

export function InflowChart({
  readings,
  ribbon,
  label,
  subject = "Agua que llega al embalse",
}: {
  readings: SeriesPoint[];
  ribbon: RibbonPoint[];
  label: string;
  /** What the readings are, for the data table's caption. */
  subject?: string;
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

  const frame = frameOf({ width: WIDTH, height: HEIGHT, margin: MARGIN, xDomain: [0, span], yDomain: [0, top * 1.05] });

  const onChart = ribbon.filter((r) => r.date >= first && r.date <= last);
  const upper: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p90) }));
  const lower: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p10) }));
  const median: Point[] = onChart.map((r) => ({ x: frame.x(at(r.date)), y: frame.y(r.band.p50) }));
  const newest = readings.at(-1)!;
  const bandOn = new Map(onChart.map((r) => [r.date, r.band]));

  return (
    <>
      <Plot
        frame={frame}
        scalable
        xLabels={responsiveLabels(monthLabels(first, last, 3, at), monthLabels(first, last, 4, at))}
        yFormat={(v) => num(v, 0)}
        title={label}
        desc={`Agua que llegó cada día entre el ${first} y el ${last}, sobre la franja de lo normal para esas fechas en todos los años disponibles.`}
      >
        {upper.length > 1 ? <path d={bandPath(upper, lower)} fill="var(--water-3)" opacity={0.8} /> : null}
        {median.length > 1 ? <path d={linePath(median)} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeDasharray="4 4" /> : null}
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
      <ChartData
        caption={`${subject}, m³/s, un dato por semana, con lo normal para esa fecha`}
        columns={[
          { label: "Día" },
          { label: "Agua que llegó", numeric: true },
          { label: "Normal, bajo", numeric: true },
          { label: "Lo típico", numeric: true },
          { label: "Normal, alto", numeric: true },
        ]}
        rows={sampleBack(readings, 7).map((r) => {
          const band = bandOn.get(r.date);
          return [dateWithYear(r.date), num(r.value, 1), num(band?.p10, 1), num(band?.p50, 1), num(band?.p90, 1)];
        })}
        note="Cada séptimo día contado desde el más reciente. La serie diaria completa está en /api/bulk/observations_daily.csv.gz."
      />
    </>
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
