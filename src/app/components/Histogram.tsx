/**
 * How a reservoir's days are spread: one bar per range of values, its height the share of days
 * on record that fell in it.
 *
 * The bars are the whole record in pale ink, the reference; the outline over them is the last
 * year, in the reading's colour, so a dry year shows as an outline pushed to the left of the
 * bars. The rule is the newest reading. Heights are shares, not counts, so a year and twelve
 * years can be drawn on one axis.
 *
 * The x axis stops at the record's 99th percentile, not its maximum: on an inflow record the
 * floods are a long tail, and drawing the axis out to the largest one leaves every other day in
 * two bars at the left. Days beyond the last edge are counted in the last bar, and its table row
 * says "o más".
 */

import { binsFor, histogram, type Bin } from "../../lib/chart/histogram.ts";
import { niceTicks } from "../../lib/chart/scale.ts";
import { Plot, frameOf, round } from "./Plot.tsx";
import { ChartData } from "./DataTable.tsx";
import { num, pct } from "../../lib/site/format.ts";

const WIDTH = 480;
const HEIGHT = 240;
const MARGIN = { top: 22, right: 12, bottom: 36, left: 62 };

/** Decimals that tell two bin edges `width` apart, and no more. */
function digitsFor(width: number): number {
  return Math.max(0, Math.min(3, -Math.floor(Math.log10(width))));
}

export function HistogramLegend({ recent }: { recent: boolean }) {
  return (
    <ul className="legend legend-small">
      <li>
        <span className="key-box key-band" aria-hidden="true" />
        Todos los días registrados
      </li>
      {recent ? (
        <li>
          <span className="key-line key-water key-short" aria-hidden="true" />
          El último año
        </li>
      ) : null}
      <li>
        <span className="key-dash key-ink key-short" aria-hidden="true" />
        El dato más reciente
      </li>
    </ul>
  );
}

export function HistogramChart({
  record,
  recent,
  today,
  unit,
  label,
  subject,
}: {
  /** Every daily value on record. */
  record: number[];
  /** The last year's values, drawn as an outline; null when the record is no longer than that. */
  recent: number[] | null;
  /** The newest reading, ruled across the bars. */
  today: number | null;
  unit: string;
  label: string;
  /** What the values are, for the data table's caption. */
  subject: string;
}) {
  const bins = binsFor(record);
  if (bins === null) return null;
  const all = histogram(record, bins);
  const year = recent ? histogram(recent, bins) : null;
  const last = bins.edges.at(-1)!;
  const digits = digitsFor(bins.width);
  const ticks = niceTicks(0, last, 5);
  const tickDigits = ticks.length > 1 ? digitsFor(ticks[1]! - ticks[0]!) : digits;

  let top = 0;
  for (const b of all) top = Math.max(top, b.share * 100);
  for (const b of year ?? []) top = Math.max(top, b.share * 100);

  const frame = frameOf({
    width: WIDTH,
    height: HEIGHT,
    margin: MARGIN,
    xDomain: [0, last],
    yDomain: [0, top * 1.08],
    yTickCount: 3,
  });
  const base = frame.y(0);
  const range = (b: Bin, i: number) =>
    i === all.length - 1 && bins.open ? `${num(b.from, digits)} ${unit} o más` : `${num(b.from, digits)} a ${num(b.to, digits)} ${unit}`;

  return (
    <>
      <Plot
        frame={frame}
        scalable
        xLabels={ticks.map((at) => ({ at, text: num(at, tickDigits) }))}
        yFormat={(v) => `${num(v, v < 1 && v > 0 ? 1 : 0)} %`}
        title={label}
        desc={
          `Cada barra es la parte de los ${record.length} días registrados en que el valor cayó en ese rango, en ${unit}.` +
          (year ? " La línea es lo mismo para el último año." : "") +
          (today !== null ? ` La raya vertical marca el dato más reciente, ${num(today, digits + 1)} ${unit}.` : "")
        }
      >
        {all.map((b, i) => {
          const x0 = frame.x(b.from);
          const x1 = frame.x(b.to);
          const y = frame.y(b.share * 100);
          return (
            <rect
              key={b.from}
              x={round(x0 + 0.5)}
              y={round(y)}
              width={round(Math.max(0, x1 - x0 - 1))}
              height={round(Math.max(0, base - y))}
              fill="var(--water-3)"
            >
              <title>{`${range(b, i)}: ${pct(b.share * 100, 1)} de los días`}</title>
            </rect>
          );
        })}
        {year ? (
          <path d={outline(year, frame)} fill="none" stroke="var(--water)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {today !== null ? (
          <g>
            <line
              x1={round(frame.x(Math.min(today, last)))}
              x2={round(frame.x(Math.min(today, last)))}
              y1={round(MARGIN.top - 6)}
              y2={round(base)}
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text
              className="axis"
              x={round(frame.x(Math.min(today, last)))}
              y={round(MARGIN.top - 10)}
              textAnchor={frame.x(Math.min(today, last)) > WIDTH - 60 ? "end" : "middle"}
              fontFamily="var(--mono)"
              fill="var(--ink)"
            >
              {today > last ? "hoy →" : "hoy"}
            </text>
          </g>
        ) : null}
      </Plot>
      <ChartData
        caption={`${subject}: parte de los días en cada rango, en ${unit}`}
        columns={[
          { label: "Rango" },
          { label: "Todos los días", numeric: true },
          ...(year ? [{ label: "Último año", numeric: true }] : []),
        ]}
        rows={all.map((b, i) => [range(b, i), pct(b.share * 100, 1), ...(year ? [pct(year[i]!.share * 100, 1)] : [])])}
        note={`${record.length} días con dato. La serie diaria completa está en /api/bulk/observations_daily.csv.gz.`}
      />
    </>
  );
}

/**
 * The last year as a stepped outline: up each bar's left edge, across its top, and down to the
 * next. Drawn as one path from the baseline to the baseline so it reads as a shape, not a line.
 */
function outline(bins: Bin[], frame: { x: (v: number) => number; y: (v: number) => number }): string {
  if (bins.length === 0) return "";
  const fmt = (v: number) => String(round(v));
  const parts = [`M${fmt(frame.x(bins[0]!.from))} ${fmt(frame.y(0))}`];
  for (const b of bins) {
    const y = fmt(frame.y(b.share * 100));
    parts.push(`L${fmt(frame.x(b.from))} ${y}`, `L${fmt(frame.x(b.to))} ${y}`);
  }
  parts.push(`L${fmt(frame.x(bins.at(-1)!.to))} ${fmt(frame.y(0))}`);
  return parts.join(" ");
}
