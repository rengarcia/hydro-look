/**
 * The frame every time-series chart on this page shares: margins, gridlines, axis labels.
 *
 * Charts are inline SVG rendered on the server. No client JavaScript ships, so the interaction
 * a reader gets is the browser's own: `<title>` inside a shape is a native tooltip, and every
 * chart is followed by the same numbers as a table. That is a deliberate trade — a crosshair
 * would be nicer, and it is not worth a hydration pass on a page whose numbers change once a
 * day.
 *
 * The grid is recessive by construction: hairlines in `--grid`, labels in `--muted`, and no
 * frame around the plot. The data is the only thing drawn in a strong colour.
 */

import type { ReactNode } from "react";
import { linearScale, niceTicks, type Scale } from "../../lib/chart/scale.ts";

/** The SVG user-space box every chart is laid out in; CSS scales it to the container width. */
export const WIDTH = 720;

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MARGIN: Margin = { top: 8, right: 12, bottom: 24, left: 46 };

export interface PlotFrame {
  x: Scale;
  y: Scale;
  yTicks: number[];
  innerWidth: number;
  innerHeight: number;
}

export function frameOf(options: {
  height: number;
  xDomain: [number, number];
  yDomain: [number, number];
  yTickCount?: number;
  margin?: Margin;
}): PlotFrame {
  const margin = options.margin ?? MARGIN;
  const innerWidth = WIDTH - margin.left - margin.right;
  const innerHeight = options.height - margin.top - margin.bottom;
  return {
    x: linearScale(options.xDomain, [margin.left, margin.left + innerWidth]),
    y: linearScale(options.yDomain, [margin.top + innerHeight, margin.top]),
    yTicks: niceTicks(options.yDomain[0], options.yDomain[1], options.yTickCount ?? 4),
    innerWidth,
    innerHeight,
  };
}

export interface XLabel {
  at: number;
  text: string;
}

/**
 * Gridlines, the y axis and a handful of x labels, with the chart's own marks drawn on top.
 *
 * `title` and `desc` are the accessible description: a screen reader is given the chart's
 * subject and its range in words, because an SVG full of paths says nothing on its own.
 */
export function Plot({
  height,
  frame,
  xLabels,
  yFormat,
  title,
  desc,
  margin = MARGIN,
  children,
}: {
  height: number;
  frame: PlotFrame;
  xLabels: XLabel[];
  yFormat: (value: number) => string;
  title: string;
  desc?: string;
  margin?: Margin;
  children: ReactNode;
}) {
  const baseline = margin.top + frame.innerHeight;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={title}>
      <title>{title}</title>
      {desc ? <desc>{desc}</desc> : null}

      <g aria-hidden="true">
        {frame.yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={margin.left + frame.innerWidth}
              y1={frame.y(tick)}
              y2={frame.y(tick)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text x={margin.left - 8} y={frame.y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
              {yFormat(tick)}
            </text>
          </g>
        ))}
        <line x1={margin.left} x2={margin.left + frame.innerWidth} y1={baseline} y2={baseline} stroke="var(--axis)" strokeWidth={1} />
        {xLabels.map((label) => (
          <text key={`${label.at}-${label.text}`} x={frame.x(label.at)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {label.text}
          </text>
        ))}
      </g>

      {children}
    </svg>
  );
}

/**
 * About `count` evenly spaced labels from a list of dates, always including the last one.
 *
 * The newest day is the one a reader looks for first, so it is pinned rather than left to
 * whatever the spacing happens to land on; the rest are spread back from it. `at` converts a
 * date to its x position, which is a day offset rather than a position in the array — the two
 * differ exactly where the record has holes, and that is where a label must not slide.
 */
export function spacedLabels(
  dates: readonly string[],
  count: number,
  format: (iso: string) => string,
  at: (iso: string) => number,
): XLabel[] {
  if (dates.length === 0) return [];
  const step = Math.max(1, Math.floor((dates.length - 1) / Math.max(1, count - 1)));
  const out: XLabel[] = [];
  for (let i = dates.length - 1; i >= 0; i -= step) {
    const iso = dates[i]!;
    out.unshift({ at: at(iso), text: format(iso) });
  }
  return out;
}
