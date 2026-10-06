"use client";

/**
 * The masthead's "Actualizado hace 3 h". The site is a static export rebuilt after every ingest
 * run, so the build can only know *when* it was updated, not how long ago that is for whoever is
 * reading: the server renders the time itself ("el 5 oct, 21:33"), which reads correctly with no
 * JavaScript at all, and the browser replaces it with the age after mounting and once a minute
 * after that. Rendering the age on the server would freeze "hace un momento" into the HTML.
 */

import { useEffect, useState } from "react";
import { agoEs, agoTone } from "../../lib/site/ago.ts";

export function UpdatedAgo({ at, stamp, title }: { at: string; stamp: string; title: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const ago = now === null ? null : agoEs(at, now);
  const tone = now === null ? "good" : agoTone(at, now);
  return (
    <span className="pill masthead-date" title={title}>
      <span className={`dot tone-${tone}`} aria-hidden="true" />
      <span>
        <span className="pill-long">Datos actualizados </span>
        <span className="pill-short">Actualizado </span>
        <time dateTime={at}>{ago ?? stamp}</time>
      </span>
    </span>
  );
}
