/**
 * Mazar's recorded level, and where the model puts it over the next ninety days.
 *
 * The history is drawn in ink and the forecast in water, because they are not the same kind of
 * thing and should not look alike; the forecast half of the plot also sits on a tinted ground,
 * so the line where the record stops is visible before any label is read. The fan is the
 * published p10–p90 — the ensemble of analogue inflow years widened by the model's own
 * out-of-sample error — with the p50 through it.
 *
 * Since 2026-09-22 the 7-day point can come from a different model (M4, boosted trees on M3's
 * error) than the rest of the fan (M3, the water balance). The fan is drawn as straight segments
 * between the published horizons — it has never been a daily path — so the switch cannot open a
 * gap: the segment from day 7 to day 14 joins two models the way every other segment joins two
 * horizons, by interpolation. What would be a lie is drawing that vertex as though the same model
 * made it, so a horizon whose `model` differs from `primaryModel` gets a ring and a p10–p90
 * whisker of its own, and the legend and the list beside the chart name the model. The named
 * scenarios and days-to-threshold stay M3's daily simulation and are not drawn here.
 *
 * The declared floors are drawn as horizontal rules. 2115 is drawn like the others and labelled
 * like none of them: no upstream source publishes it, it is this project's own marker from
 * PLAN.md §7. Drawing it unlabelled beside two CELEC declarations would quietly promote it to one.
 */

import { bandPath, linePath, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, monthLabels, round } from "./Plot.tsx";
import { ChartData, sampleBack } from "./DataTable.tsx";
import { dateWithYear, num, shortDate } from "../../lib/site/format.ts";
import { daysBetween } from "../../lib/util/dates.ts";
import type { SeriesPoint } from "../../lib/site/data.ts";

/** The desktop drawing, and the phone one: same data, larger type on a narrower box. */
const SIZES = {
  wide: { width: 1136, height: 380, margin: { top: 16, right: 16, bottom: 34, left: 54 }, font: 11, months: 2 },
  compact: { width: 440, height: 400, margin: { top: 28, right: 10, bottom: 40, left: 64 }, font: 16, months: 3 },
};

export interface FanHorizon {
  target_date: string;
  p10: number;
  p50: number;
  p90: number;
  /** The model this horizon was published from; absent means `primaryModel`. */
  model?: string;
}

export interface FanThreshold {
  level_masl: number;
  label: string;
  unverified: boolean;
}

function FanDrawing({
  history,
  origin,
  originLevel,
  horizons,
  thresholds,
  label,
  primaryModel,
  compact = false,
}: {
  history: SeriesPoint[];
  origin: string;
  originLevel: number;
  horizons: FanHorizon[];
  thresholds: FanThreshold[];
  label: string;
  /** The model most horizons come from; a horizon from any other is marked. */
  primaryModel?: string;
  compact?: boolean;
}) {
  const { width: WIDTH, height: HEIGHT, margin: MARGIN, font, months } = compact ? SIZES.compact : SIZES.wide;
  if (history.length < 2 || horizons.length === 0) return null;

  const first = history[0]!.date;
  const last = horizons.at(-1)!.target_date;
  const span = daysBetween(first, last);
  if (span < 1) return null;
  const at = (date: string) => daysBetween(first, date);

  let low = Infinity;
  let high = -Infinity;
  for (const point of history) {
    low = Math.min(low, point.value);
    high = Math.max(high, point.value);
  }
  for (const h of horizons) {
    low = Math.min(low, h.p10);
    high = Math.max(high, h.p90);
  }
  // The floors are on the axis only when the forecast comes near them. Anchoring the axis to
  // 2098 on a day the reservoir sits at 2138 would flatten forty metres of real movement into
  // the top eighth of the chart to make room for a line nothing is close to.
  for (const t of thresholds) if (t.level_masl > low - 12) low = Math.min(low, t.level_masl);

  const pad = Math.max((high - low) * 0.06, 0.5);
  const frame = frameOf({
    width: WIDTH,
    height: HEIGHT,
    margin: MARGIN,
    xDomain: [0, span],
    yDomain: [low - pad, high + pad],
    yTickCount: 4,
  });
  const x = (date: string) => round(frame.x(at(date)));
  const y = (v: number) => round(frame.y(v));

  // The fan starts at the origin day, where it has zero width: the level there is observed, not
  // forecast, and a band that starts wide implies uncertainty about a reading we have.
  const anchor = { date: origin, p10: originLevel, p50: originLevel, p90: originLevel };
  const fan = [anchor, ...horizons.map((h) => ({ date: h.target_date, p10: h.p10, p50: h.p50, p90: h.p90 }))];
  const upper: Point[] = fan.map((h) => ({ x: frame.x(at(h.date)), y: frame.y(h.p90) }));
  const lower: Point[] = fan.map((h) => ({ x: frame.x(at(h.date)), y: frame.y(h.p10) }));
  const middle: Point[] = fan.map((h) => ({ x: frame.x(at(h.date)), y: frame.y(h.p50) }));
  const switched = (h: FanHorizon) => primaryModel !== undefined && h.model !== undefined && h.model !== primaryModel;

  const top = MARGIN.top;
  const bottom = MARGIN.top + frame.innerHeight;
  const end = horizons.at(-1)!;
  const originX = x(origin);

  return (
    <Plot
      frame={frame}
      xLabels={monthLabels(first, last, months, at)}
      fontSize={font}
      yFormat={(v) => num(v, 0)}
      title={label}
      desc={`Cota observada de Mazar hasta el ${origin} y banda p10–p90 pronosticada hasta el ${last}.`}
    >
      <rect x={originX} y={top} width={round(WIDTH - MARGIN.right - originX)} height={bottom - top} fill="var(--water-4)" opacity=".55" />

      {placeLabels(thresholds, (v) => frame.y(v), font + 3).map(({ threshold, y: ly, labelY }) => (
        <g key={threshold.level_masl}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={round(ly)}
            y2={round(ly)}
            stroke="var(--deficit)"
            strokeWidth={1.4}
            strokeDasharray={threshold.unverified ? "2 4" : "6 4"}
          />
          <text x={MARGIN.left + 8} y={round(labelY)} fontFamily="var(--mono)" fontSize={font} fill="var(--deficit)">
            {compact ? `${num(threshold.level_masl, 0)} m` : threshold.label}
          </text>
        </g>
      ))}

      <path d={bandPath(upper, lower)} fill="var(--water)" fillOpacity={0.2} />
      <path d={linePath(middle)} fill="none" stroke="var(--water)" strokeWidth={2.4} strokeLinejoin="round" />
      {horizons.map((h) => (
        <g key={h.target_date}>
          <title>{`${h.model ?? primaryModel ?? ""} ${shortDate(h.target_date)}: p50 ${num(h.p50, 2)} m (${num(h.p10, 2)}–${num(h.p90, 2)})`}</title>
          {switched(h) ? (
            <>
              <line x1={x(h.target_date)} x2={x(h.target_date)} y1={y(h.p90)} y2={y(h.p10)} stroke="var(--water)" strokeWidth={1.5} />
              <circle cx={x(h.target_date)} cy={y(h.p50)} r={6} fill="none" stroke="var(--water)" strokeWidth={2} />
            </>
          ) : null}
          <circle cx={x(h.target_date)} cy={y(h.p50)} r={3.5} fill="var(--surface)" stroke="var(--water)" strokeWidth={2} />
        </g>
      ))}

      <line x1={originX} x2={originX} y1={top} y2={bottom} stroke="var(--line-2)" strokeWidth={1} />
      <text x={originX - 8} y={top + font + 3} textAnchor="end" fontFamily="var(--mono)" fontSize={font} fill="var(--ink-2)">
        OBSERVADO
      </text>
      <text x={originX + 8} y={top + font + 3} fontFamily="var(--mono)" fontSize={font} fill="var(--water)">
        PRONÓSTICO
      </text>

      <path
        d={linePath(history.map((p) => ({ x: frame.x(at(p.date)), y: frame.y(p.value) })))}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={originX} cy={y(originLevel)} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
      {compact ? null : (
      <text
        x={WIDTH - MARGIN.right - 4}
        y={round(Math.max(y(end.p90) - font, top + 2.8 * font))}
        textAnchor="end"
        fontFamily="var(--mono)"
        fontSize={font + 1}
        fill="var(--water)"
      >
        p50 {num(end.p50, 2)} m · {shortDate(end.target_date)}
      </text>
      )}
    </Plot>
  );
}

export interface FanChartProps {
  history: SeriesPoint[];
  origin: string;
  originLevel: number;
  horizons: FanHorizon[];
  thresholds: FanThreshold[];
  label: string;
  /** The model most horizons come from; a horizon from any other is marked. */
  primaryModel?: string;
}

/**
 * The chart at both widths, and its numbers.
 *
 * This one is still drawn twice. On a desk it is a 3:1 strip across the page, which is what six
 * months of history and three of forecast need; scaled down to a phone the same strip would be
 * a hundred pixels tall. The phone drawing is a near-square with larger type instead, and CSS
 * shows one. The table under both carries the history a week at a time and every horizon.
 */
export function FanChart(props: FanChartProps) {
  const { history, horizons, primaryModel } = props;
  if (history.length < 2 || horizons.length === 0) return null;
  return (
    <>
      <div className="only-wide">
        <FanDrawing {...props} />
      </div>
      <div className="only-compact">
        <FanDrawing {...props} compact />
      </div>
      <ChartData
        caption="Cota de Mazar, m s. n. m.: la observada, una lectura por semana, y el pronóstico p10, p50 y p90 en cada horizonte"
        columns={[{ label: "Día" }, { label: "Observada", numeric: true }, { label: "p10", numeric: true }, { label: "p50", numeric: true }, { label: "p90", numeric: true }, { label: "Modelo" }]}
        rows={[
          ...sampleBack(history, 7).map((p) => [dateWithYear(p.date), num(p.value, 2), "", "", "", ""]),
          ...horizons.map((h) => [dateWithYear(h.target_date), "", num(h.p10, 2), num(h.p50, 2), num(h.p90, 2), h.model ?? primaryModel ?? ""]),
        ]}
        note="La cota diaria completa está en /api/bulk/observations_daily.csv.gz; el pronóstico, en /api/forecast.json."
      />
    </>
  );
}

/**
 * Where each threshold's label goes.
 *
 * Mazar's two declared floors are two metres apart, which on a chart spanning forty metres is
 * about ten pixels: labelled the same way they overprint each other and neither is readable.
 * A label that would collide is moved under its own line instead of over it, which keeps it
 * next to the rule it belongs to — the alternative, dropping one, would hide exactly the
 * disagreement the rest of this page goes out of its way to show.
 */
function placeLabels(
  thresholds: FanThreshold[],
  y: (level: number) => number,
  /** Vertical space a label needs before it starts sitting on the one above it. */
  gap: number,
): { threshold: FanThreshold; y: number; labelY: number }[] {
  const out: { threshold: FanThreshold; y: number; labelY: number }[] = [];
  let lastLabelY = -Infinity;
  for (const threshold of [...thresholds].sort((a, b) => b.level_masl - a.level_masl)) {
    const line = y(threshold.level_masl);
    const above = line - 6;
    const labelY = above - lastLabelY < gap ? line + gap : above;
    out.push({ threshold, y: line, labelY });
    lastLabelY = labelY;
  }
  return out;
}
