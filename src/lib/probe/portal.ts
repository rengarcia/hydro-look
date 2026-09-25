/**
 * Reading an Angular single-page app for the endpoints it calls.
 *
 * INAMHI's Hydroviewer (`inamhi.geoglows.org/apps/hydroviewer-ecuador/`) is a shell page whose
 * HTML holds nothing but `<script>` tags; the URLs it fetches its rivers, forecasts and return
 * periods from are string literals inside the bundles, and the lazy routes are more bundles named
 * inside those. The development sandbox cannot open the host, so `scripts/geoglows.ts` walks the
 * bundles from a runner and records every URL-like literal with the code around it. These are the
 * pure parts, tested on strings.
 */

/** Bundles a page or a bundle refers to: `src="x.js"`, `href="x.js"`, `import("./x.js")`, `"chunk-X.js"`. */
export function bundleRefs(text: string): string[] {
  const refs = new Set<string>();
  for (const m of text.matchAll(/(?:src|href)=["']([^"']+\.m?js)["']/g)) refs.add(m[1]!);
  for (const m of text.matchAll(/["'`](\.?\/?(?:[\w-]+\/)*(?:chunk|main|polyfills|scripts)-[\w-]+\.m?js)["'`]/g)) refs.add(m[1]!);
  return [...refs].sort();
}

export interface EndpointHit {
  /** The literal as written: an absolute URL, or a path such as `/apps/x/get-data/`. */
  literal: string;
  /** Up to `contextChars` either side of it, whitespace collapsed. */
  context: string;
  file: string;
}

/** What makes a literal worth reading: a host, an API-looking path, or a hydrology word. */
export const ENDPOINT_PATTERN =
  /return|retorno|periodo|period|api|rest|geoserver|forecast|pronostico|comid|river|rivid|reach|hydro|tethys|\.json|wms|wfs/i;

/**
 * URL-like string literals in a bundle: absolute `http(s)://` URLs, and paths with at least two
 * segments that look like routes rather than asset names. Deduplicated by literal.
 */
export function endpointsIn(text: string, file: string, contextChars = 160): EndpointHit[] {
  const seen = new Map<string, EndpointHit>();
  const re = /["'`]((?:https?:)?\/\/[^"'`\s<>]{3,}|\/[\w.-]+\/[^"'`\s<>]*)["'`]/g;
  for (const m of text.matchAll(re)) {
    const literal = m[1]!;
    if (seen.has(literal)) continue;
    if (/\.(?:css|woff2?|ttf|png|svg|jpe?g|gif|ico)(?:[?#]|$)/i.test(literal)) continue;
    if (!/^(?:https?:)?\/\//.test(literal) && !ENDPOINT_PATTERN.test(literal)) continue;
    const start = Math.max(0, m.index - contextChars);
    const end = Math.min(text.length, m.index + m[0].length + contextChars);
    seen.set(literal, { literal, context: text.slice(start, end).replace(/\s+/g, " "), file });
  }
  return [...seen.values()];
}

/** A bundle reference made absolute against the URL of the page or bundle that named it. */
export function resolveRef(ref: string, base: string): string {
  return new URL(ref, base).toString();
}
