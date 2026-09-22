/**
 * Mazar's recorded level, and where the model puts it over the next ninety days.
 *
 * The history is drawn in ink and the forecast in blue, because they are not the same kind of
 * thing and should not look alike. The fan is the published p10–p90 — the ensemble of analogue
 * inflow years widened by the model's own out-of-sample error — with the p50 through it.
 *
 * Since 2026-09-22 the 7-day point can come from a different model (M4, boosted trees on M3's
 * error) than the rest of the fan (M3, the water balance). The fan is drawn as straight segments
 * between the published horizons — it has never been a daily path — so the switch cannot open a
 * gap: the segment from day 7 to day 14 joins two models the way every other segment joins two
 * horizons, by interpolation. What would be a lie is drawing that vertex as though the same model
 * made it, so a horizon whose `model` differs from `primaryModel` gets a ring and a p10–p90
 * whisker of its own, and the legend and the table beside the chart name the model. The named
 * scenarios and days-to-threshold stay M3's daily simulation and are not drawn here.
 *
 * The declared floors are drawn as horizontal rules. 2115 is drawn like the others and labelled
 * like none of them: no upstream source publishes it, it is this project's own marker from
 * PLAN.md §7, and the table under the chart says so. Drawing it unlabelled beside two CELEC
 * declarations would quietly promote it to one.
 */

import { bandPath, linePath, type Point } from "../../lib/chart/scale.ts";
import { Plot, frameOf, MARGIN, WIDTH } from "./Plot.tsx";
import { num, shortDate } from "../../lib/site/format.ts";
import { addDays, daysBetween } from "../../lib/util/dates.ts";
import type { SeriesPoint } from "../../lib/site/data.ts";

const HEIGHT = 300;

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

export function FanChart({
  history,
  origin,
  originLevel,
  horizons,
  thresholds,
  label,
  primaryModel,
}: {
  history: SeriesPoint[];
  origin: string;
  originLevel: number;
  horizons: FanHorizon[];
  thresholds: FanThreshold[];
  label: string;
  /** The model most horizons come from; a horizon from any other is marked. */
  primaryModel?: string;
}) {
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

  const pad = Math.max((high - low) * 0.08, 0.5);
  const frame = frameOf({ height: HEIGHT, xDomain: [0, span], yDomain: [low - pad, high + pad], yTickCount: 5 });

  // The fan starts at the origin day, where it has zero width: the level there is observed, not
  // forecast, and a band that starts wide implies uncertainty about a reading we have.
  const anchor = { date: origin, p10: originLevel, p50: originLevel, p90: originLevel };
  const fan = [anchor, ...horizons.map((h) => ({ date: h.target_date, p10: h.p10, p50: h.p50, p90: h.p90 }))];
  const upper: Point[] = fan.map((h) => ({ x: frame.x(at(h.date)), y: frame.y(h.p90) }));
  const lower: Point[] = fan.map((h) => ({ x: frame.x(at(h.date)), y: frame.y(h.p10) }));
  const middle: Point[] = fan.map((h) => ({ x: frame.x(at(h.date)), y: frame.y(h.p50) }));
  const switched = horizons.filter((h) => primaryModel !== undefined && h.model !== undefined && h.model !== primaryModel);

  const labelDates = [first, addDays(first, Math.round(span / 3)), origin, last];

  return (
    <Plot
      height={HEIGHT}
      frame={frame}
      xLabels={labelDates.map((date) => ({ at: at(date), text: shortDate(date) }))}
      yFormat={(v) => num(v, 0)}
      title={label}
      desc={`Cota observada de Mazar hasta ${origin} y banda p10–p90 pronosticada hasta ${last}.`}
    >
      {placeLabels(thresholds, frame.y).map(({ threshold, y, labelY }) => (
        <g key={threshold.level_masl}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y}
            y2={y}
            stroke="var(--critical)"
            strokeWidth={1.5}
            strokeDasharray={threshold.unverified ? "2 4" : "6 4"}
          />
          <text x={MARGIN.left + 4} y={labelY} fontSize={11} fill="var(--critical)">
            {threshold.label}
          </text>
        </g>
      ))}

      <path d={bandPath(upper, lower)} fill="var(--series-1)" fillOpacity={0.22} />
      <path d={linePath(middle)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" />
      {switched.map((h) => {
        // Rounded like the paths, to a hundredth of a pixel.
        const px = (v: number) => Math.round(v * 100) / 100;
        const x = px(frame.x(at(h.target_date)));
        return (
          <g key={h.target_date}>
            <title>{`${h.model}: p50 ${num(h.p50, 2)} m (${num(h.p10, 2)}–${num(h.p90, 2)})`}</title>
            <line x1={x} x2={x} y1={px(frame.y(h.p90))} y2={px(frame.y(h.p10))} stroke="var(--series-1)" strokeWidth={1.5} />
            <circle cx={x} cy={px(frame.y(h.p50))} r={4} fill="var(--surface)" stroke="var(--series-1)" strokeWidth={2} />
          </g>
        );
      })}
      <line
        x1={frame.x(at(origin))}
        x2={frame.x(at(origin))}
        y1={MARGIN.top}
        y2={MARGIN.top + frame.innerHeight}
        stroke="var(--axis)"
        strokeWidth={1}
      />
      <path
        d={linePath(history.map((p) => ({ x: frame.x(at(p.date)), y: frame.y(p.value) })))}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Plot>
  );
}

/** Vertical space a label needs before it starts sitting on the one above it. */
const LABEL_GAP = 13;

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
): { threshold: FanThreshold; y: number; labelY: number }[] {
  const out: { threshold: FanThreshold; y: number; labelY: number }[] = [];
  let lastLabelY = -Infinity;
  for (const threshold of [...thresholds].sort((a, b) => b.level_masl - a.level_masl)) {
    const line = y(threshold.level_masl);
    const above = line - 4;
    const labelY = above - lastLabelY < LABEL_GAP ? line + LABEL_GAP : above;
    out.push({ threshold, y: line, labelY });
    lastLabelY = labelY;
  }
  return out;
}
