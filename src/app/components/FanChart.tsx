/**
 * Mazar's recorded level, and where the model puts it over the next ninety days.
 *
 * The history is drawn in ink and the forecast in blue, because they are not the same kind of
 * thing and should not look alike. The fan is the published p10–p90 — the ensemble of analogue
 * inflow years widened by the model's own out-of-sample error — with the p50 through it.
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
}: {
  history: SeriesPoint[];
  origin: string;
  originLevel: number;
  horizons: FanHorizon[];
  thresholds: FanThreshold[];
  label: string;
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
