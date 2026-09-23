/**
 * Where the country's electricity came from, day by day.
 *
 * The bands are stacked in a fixed order — water, then each way of burning something, then
 * imports — and each one keeps its colour whatever the day's values are. That is the only way
 * a stacked area is readable: a stack sorted by size repaints itself whenever the mix changes,
 * which is exactly when a reader is trying to follow one band across the change.
 *
 * Water is teal and every fuel is a terracotta, so the chart reads as water against fuel before
 * any single band is picked out. The terracottas are close to one another by design, which is
 * why the chart always ships beside a table naming every band with its number: colour is never
 * the only thing carrying identity here.
 *
 * Days SMEC never published are holes: the stack is drawn in runs of consecutive days, so a
 * missing day is a gap in the area rather than a straight line drawn through it.
 *
 * This was the heaviest drawing on the page and it used to be drawn twice, once per screen
 * width. It is now one scalable drawing whose axis type CSS enlarges on a phone.
 */

import { bandPath, stack, stackMax, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, monthLabels, responsiveLabels } from "./Plot.tsx";
import { ChartData, sampleBack } from "./DataTable.tsx";
import { conceptLabel, dateWithYear, num } from "../../lib/site/format.ts";
import { daysBetween } from "../../lib/util/dates.ts";
import type { MixDay } from "../../lib/site/data.ts";

/** Colour per concept, in stacking order. Fixed: a concept never changes colour. */
export const MIX_SERIES: { concept: string; token: string }[] = [
  { concept: "generacion_hidraulica", token: "var(--water)" },
  { concept: "generacion_turbinas_gas", token: "var(--t1)" },
  { concept: "generacion_motores_bunker", token: "var(--t2)" },
  { concept: "generacion_vapor_bunker", token: "var(--t3)" },
  { concept: "generacion_turbinas_diesel", token: "var(--t4)" },
  { concept: "generacion_otros_tipos", token: "var(--sage)" },
  { concept: "total_importacion", token: "var(--import)" },
];

/** The CSS class that paints a concept's swatch: `mix-generacion_hidraulica`. */
export function mixClass(concept: string): string {
  return MIX_SERIES.some((s) => s.concept === concept) ? `mix-${concept}` : "mix-other";
}

const WIDTH = 480;
const HEIGHT = 260;
const MARGIN = { top: 12, right: 10, bottom: 36, left: 50 };

export function MixChart({ days, label }: { days: MixDay[]; label: string }) {
  if (days.length < 2) return null;

  const first = days[0]!.date;
  const last = days.at(-1)!.date;
  const span = daysBetween(first, last);
  if (span < 1) return null;
  const at = (date: string) => daysBetween(first, date);

  const keys = MIX_SERIES.map((s) => s.concept);
  const bands = stack(
    days.map((d) => d.values),
    keys,
  );
  const frame = frameOf({
    width: WIDTH,
    height: HEIGHT,
    margin: MARGIN,
    xDomain: [0, span],
    yDomain: [0, stackMax(bands) * 1.05],
    yTickCount: 2,
  });

  // Indices of `days` that are consecutive in the calendar, as runs. Each run is drawn as its
  // own closed band so a break in the record is a break in the area.
  const runs: [number, number][] = [];
  let start = 0;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1]!.date, days[i]!.date) > 1) {
      runs.push([start, i - 1]);
      start = i;
    }
  }
  runs.push([start, days.length - 1]);

  const shown = MIX_SERIES.filter((s) => days.some((d) => d.values[s.concept] !== undefined));

  return (
    <>
      <Plot
        frame={frame}
        scalable
        xLabels={responsiveLabels(monthLabels(first, last, 2, at), monthLabels(first, last, 3, at))}
        yFormat={(v) => num(v, 0)}
        title={label}
        desc={`Generación diaria por tipo e importación, en GWh, entre el ${first} y el ${last}.`}
      >
        {MIX_SERIES.map((series, slot) => {
          const band = bands[slot]!;
          return (
            <g key={series.concept}>
              {runs.map(([from, to]) => {
                if (to <= from) return null;
                const upper: Point[] = [];
                const lower: Point[] = [];
                for (let i = from; i <= to; i++) {
                  const x = frame.x(at(days[i]!.date));
                  const [y0, y1] = band.extents[i]!;
                  upper.push({ x, y: frame.y(y1) });
                  lower.push({ x, y: frame.y(y0) });
                }
                return (
                  <path
                    key={`${from}-${to}`}
                    d={bandPath(upper, lower)}
                    fill={series.token}
                    /* A hairline in the surface colour is the spacer between stacked fills, drawn
                       on the band itself so it costs no extra element per day. */
                    stroke="var(--surface)"
                    strokeWidth={0.6}
                  />
                );
              })}
            </g>
          );
        })}
      </Plot>
      <ChartData
        caption="Generación diaria por tipo e importación, GWh, un día por semana"
        columns={[{ label: "Día" }, ...shown.map((s) => ({ label: conceptLabel(s.concept), numeric: true }))]}
        rows={sampleBack(days, 7).map((d) => [dateWithYear(d.date), ...shown.map((s) => num(d.values[s.concept], 2))])}
        note="Cada séptimo día contado desde el más reciente. El balance diario completo está en /api/bulk/national_balance_daily.csv.gz."
      />
    </>
  );
}
