/**
 * Where the country's electricity came from, day by day.
 *
 * The bands are stacked in a fixed order — water, then each way of burning something, then
 * imports — and each one keeps its colour whatever the day's values are. That is the only way
 * a stacked area is readable: a stack sorted by size repaints itself whenever the mix changes,
 * which is exactly when a reader is trying to follow one band across the change.
 *
 * Three of the light-mode series sit below 3:1 against the surface, so this chart always ships
 * with a legend naming every band and the same numbers as a table beneath it. Colour is never
 * the only thing carrying identity here.
 *
 * Days SMEC never published are holes: the stack is drawn in runs of consecutive days, so a
 * missing day is a gap in the area rather than a straight line drawn through it.
 */

import { bandPath, stack, stackMax, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, spacedLabels } from "./Plot.tsx";
import { num, shortDate } from "../../lib/site/format.ts";
import { daysBetween } from "../../lib/util/dates.ts";
import type { MixDay } from "../../lib/site/data.ts";

const HEIGHT = 260;

/** Series slot per concept, by position. Fixed: a concept never changes colour. */
export const MIX_SERIES: { concept: string; token: string }[] = [
  { concept: "generacion_hidraulica", token: "var(--series-1)" },
  { concept: "generacion_turbinas_gas", token: "var(--series-2)" },
  { concept: "generacion_motores_bunker", token: "var(--series-3)" },
  { concept: "generacion_vapor_bunker", token: "var(--series-4)" },
  { concept: "generacion_turbinas_diesel", token: "var(--series-5)" },
  { concept: "generacion_otros_tipos", token: "var(--series-6)" },
  { concept: "total_importacion", token: "var(--series-7)" },
];

export function MixChart({ days, label }: { days: MixDay[]; label: string }) {
  if (days.length < 2) return null;

  const first = days[0]!.date;
  const last = days.at(-1)!.date;
  const span = daysBetween(first, last);
  if (span < 1) return null;
  const at = (date: string) => daysBetween(first, date);

  const keys = MIX_SERIES.map((s) => s.concept);
  const bands = stack(days.map((d) => d.values), keys);
  const frame = frameOf({ height: HEIGHT, xDomain: [0, span], yDomain: [0, stackMax(bands) * 1.05] });

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

  return (
    <Plot
      height={HEIGHT}
      frame={frame}
      xLabels={spacedLabels(days.map((d) => d.date), 6, shortDate, at)}
      yFormat={(v) => num(v, 0)}
      title={label}
      desc={`Generación diaria por tipo e importación, en GWh, entre ${first} y ${last}.`}
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
                  /* A hairline in the surface colour is the 2px spacer between stacked fills,
                     drawn on the band itself so it costs no extra element per day. */
                  stroke="var(--surface)"
                  strokeWidth={0.75}
                />
              );
            })}
          </g>
        );
      })}
    </Plot>
  );
}
