/**
 * The frame every time-series chart on the site shares: margins, gridlines, axis labels.
 *
 * Charts are inline SVG rendered on the server, and nothing in them depends on a script: the
 * only JavaScript the page ships is Next's runtime and the analytics beacon. The interaction a
 * reader gets is the browser's own — `<title>` inside a shape is a native tooltip — and every
 * chart has its numbers beside it in words and in a collapsed table. That is a deliberate
 * trade: a crosshair would be nicer, and it is not worth a client component on a page whose
 * numbers change once a day.
 *
 * The grid is recessive by construction: hairlines in `--line`, labels in `--muted` monospace,
 * and no frame around the plot. The data is the only thing drawn in a strong colour.
 */

import type { ReactNode } from "react";
import { linearScale, niceTicks, type Scale } from "../../lib/chart/scale.ts";
import { addDays, daysBetween } from "../../lib/util/dates.ts";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotFrame {
  width: number;
  height: number;
  margin: Margin;
  x: Scale;
  y: Scale;
  yTicks: number[];
  innerWidth: number;
  innerHeight: number;
}

export function frameOf(options: {
  width: number;
  height: number;
  margin: Margin;
  xDomain: [number, number];
  yDomain: [number, number];
  yTickCount?: number;
  /** Explicit tick values, when the nice ones land somewhere the chart does not want them. */
  yTicks?: number[];
}): PlotFrame {
  const { width, height, margin } = options;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  return {
    width,
    height,
    margin,
    x: linearScale(options.xDomain, [margin.left, margin.left + innerWidth]),
    y: linearScale(options.yDomain, [margin.top + innerHeight, margin.top]),
    yTicks: options.yTicks ?? niceTicks(options.yDomain[0], options.yDomain[1], options.yTickCount ?? 4),
    innerWidth,
    innerHeight,
  };
}

export interface XLabel {
  at: number;
  text: string;
}

/**
 * Gridlines, the y labels and a handful of x labels, with the chart's own marks drawn on top.
 *
 * `title` and `desc` are the accessible description: a screen reader is given the chart's
 * subject and its range in words, because an SVG full of paths says nothing on its own.
 */
export function Plot({
  frame,
  xLabels,
  yFormat,
  title,
  desc,
  fontSize = 11,
  children,
}: {
  frame: PlotFrame;
  xLabels: XLabel[];
  yFormat: (value: number) => string;
  title: string;
  desc?: string;
  fontSize?: number;
  children: ReactNode;
}) {
  const { width, height, margin } = frame;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <title>{title}</title>
      {desc ? <desc>{desc}</desc> : null}

      <g aria-hidden="true" fontFamily="var(--mono)" fontSize={fontSize} fill="var(--muted)">
        {frame.yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={margin.left + frame.innerWidth}
              y1={round(frame.y(tick))}
              y2={round(frame.y(tick))}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text x={margin.left - 10} y={round(frame.y(tick))} dy="0.35em" textAnchor="end">
              {yFormat(tick)}
            </text>
          </g>
        ))}
        {xLabels.map((label) => (
          <text key={`${label.at}-${label.text}`} x={round(frame.x(label.at))} y={height - 8} textAnchor="middle">
            {label.text}
          </text>
        ))}
      </g>

      {children}
    </svg>
  );
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * A label on the middle of every `every`-th month between `first` and `last`, positioned by day
 * offset from `first`. Months are counted from `last` backwards, so the newest month is always
 * among the labelled ones — it is the one a reader looks for first.
 */
export function monthLabels(first: string, last: string, every: number, at: (iso: string) => number): XLabel[] {
  const out: XLabel[] = [];
  let year = Number(last.slice(0, 4));
  let month = Number(last.slice(5, 7));
  for (let i = 0; ; i++) {
    const mid = `${year}-${String(month).padStart(2, "0")}-15`;
    if (mid < first) break;
    if (i % every === 0 && mid <= last && daysBetween(first, mid) > 4) {
      out.unshift({ at: at(mid), text: MONTHS_SHORT[month - 1]! });
    }
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

/** A label at the middle of each calendar year between `first` and `last`. */
export function yearLabels(first: string, last: string, at: (iso: string) => number): XLabel[] {
  const out: XLabel[] = [];
  for (let year = Number(first.slice(0, 4)); year <= Number(last.slice(0, 4)); year++) {
    const mid = `${year}-07-01`;
    if (mid >= first && mid <= addDays(last, 60)) out.push({ at: at(mid), text: String(year) });
  }
  return out;
}

export function round(v: number): number {
  return Math.round(v * 10) / 10;
}
