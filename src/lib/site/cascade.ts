/**
 * The Paute cascade in profile: Mazar, Amaluza and the chamber Sopladora draws from, one above the
 * other, after Sterl et al. (2026, *Nature Water* 4, 571–585, Fig. 3a), with today's levels.
 *
 * Heights are to scale; distances are not — Mazar's lake is some 30 km long and the chamber sits
 * at the end of Molino's tunnel, and a profile drawn to distance would be a line. So each lake is
 * a wedge between its dam and the point upstream where a straight riverbed reaches the water,
 * which is the shape the eye reads as "how full", and the page says it is a schematic.
 */

/** A point of the profile: `x` in drawing units, `m` in metres above sea level. */
export interface ProfilePoint {
  x: number;
  m: number;
}

/**
 * The water in a lake at `level`: the polygon between the dam face and the riverbed, which runs
 * straight from `upstream` down to `dam`. Empty when the level is at or below the riverbed at the
 * dam; capped at the upstream end when the level is above the riverbed there.
 */
export function lakeWater(upstream: ProfilePoint, dam: ProfilePoint, level: number): ProfilePoint[] {
  if (!(level > dam.m)) return [];
  const t = upstream.m === dam.m ? 0 : Math.min(1, (level - dam.m) / (upstream.m - dam.m));
  const shore = { x: dam.x + t * (upstream.x - dam.x), m: dam.m + t * (upstream.m - dam.m) };
  const top = { x: shore.x, m: level };
  return t >= 1 ? [top, { x: dam.x, m: level }, dam, upstream] : [top, { x: dam.x, m: level }, dam];
}

/** Sterl et al. (2026), Fig. 3a: each lake's storage in days of the river's average discharge. */
export const STORAGE_DAYS: Record<string, number> = { mazar: 39, amaluza: 11 };
