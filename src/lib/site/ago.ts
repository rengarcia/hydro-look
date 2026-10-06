/**
 * How long ago something happened, in the masthead's words: `hace 3 h`.
 *
 * Kept apart from `format.ts` because it is the one formatter that runs in the browser: the site
 * is a static export, so "three hours ago" is only true at the moment someone reads it, and the
 * masthead recomputes it there. This module imports nothing, so the client bundle stays small.
 */

const MINUTE = 60_000;

/** `timestamp` against `now` (ms since the epoch) in Spanish; null for an unparseable stamp. */
export function agoEs(timestamp: string, now: number): string | null {
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return null;
  // A clock a little behind the runner's would otherwise read "hace -2 min".
  const minutes = Math.max(0, Math.floor((now - then) / MINUTE));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
}

/**
 * The pill's tone for an update this old. Four slots a day leave at most about twelve hours
 * between two good runs (overnight), so anything past a day means a run, or several, did not land.
 */
export function agoTone(timestamp: string, now: number): "good" | "watch" | "tight" {
  const hours = (now - Date.parse(timestamp)) / (60 * MINUTE);
  if (Number.isNaN(hours) || hours >= 30) return "tight";
  return hours >= 14 ? "watch" : "good";
}
