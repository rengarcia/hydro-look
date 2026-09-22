/**
 * A reservoir's level inside its declared band.
 *
 * The bar runs from the band's floor to its crest and is filled to today's level, so the
 * length of the fill is metres of usable head and not a share of stored water — the two are
 * very different for a reservoir whose surface area more than doubles between 2110 and 2150,
 * and `nivel_pct_banda` is the field that invites the confusion. The caption says which it is.
 *
 * Where CELEC declares more than one floor they are all drawn, as ticks under the bar. Mazar's
 * two — 2098 from the dashboard's chart title, 2100 from both report endpoints — are two metres
 * apart and both are CELEC's; a gauge that quietly picked one would be inventing an agreement
 * that does not exist.
 */

import { linearScale } from "../../lib/chart/scale.ts";
import { num } from "../../lib/site/format.ts";

const WIDTH = 320;
const HEIGHT = 46;
const PAD = 4;
const TRACK_Y = 8;
const TRACK_H = 12;

export interface GaugeMark {
  level: number;
  label: string;
}

export function Gauge({
  min,
  max,
  level,
  marks,
  label,
}: {
  min: number;
  max: number;
  level: number;
  marks: GaugeMark[];
  label: string;
}) {
  const x = linearScale([min, max], [PAD, WIDTH - PAD]);
  // A level outside the declared band is a real reading, not an error — 27 of them are in the
  // committed data — so the fill is clamped to the track while the number beside it is not.
  const filled = Math.min(Math.max(x(level), PAD), WIDTH - PAD);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      <title>{label}</title>
      <rect x={PAD} y={TRACK_Y} width={WIDTH - PAD * 2} height={TRACK_H} rx={6} fill="var(--grid)" />
      <rect x={PAD} y={TRACK_Y} width={Math.max(filled - PAD, 0)} height={TRACK_H} rx={6} fill="var(--series-1)" />

      {/* A 2px ring in the surface colour keeps the marker legible where it sits on the fill. */}
      <line
        x1={filled}
        x2={filled}
        y1={TRACK_Y - 4}
        y2={TRACK_Y + TRACK_H + 4}
        stroke="var(--surface)"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line
        x1={filled}
        x2={filled}
        y1={TRACK_Y - 4}
        y2={TRACK_Y + TRACK_H + 4}
        stroke="var(--ink)"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {marks.map((mark) => {
        const at = x(mark.level);
        if (at < PAD || at > WIDTH - PAD) return null;
        return (
          <g key={`${mark.level}-${mark.label}`}>
            <title>{mark.label}</title>
            <line x1={at} x2={at} y1={TRACK_Y} y2={TRACK_Y + TRACK_H + 3} stroke="var(--critical)" strokeWidth={2} />
          </g>
        );
      })}

      <text x={PAD} y={HEIGHT - 6} fontSize={11} fill="var(--muted)">
        {num(min, 0)}
      </text>
      <text x={WIDTH - PAD} y={HEIGHT - 6} textAnchor="end" fontSize={11} fill="var(--muted)">
        {num(max, 0)}
      </text>
    </svg>
  );
}
