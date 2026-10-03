/**
 * The metadata a page adds to the root layout's.
 *
 * Next merges metadata one key deep: a page that sets `openGraph` replaces the layout's whole
 * `openGraph`, so a page that set only its `url` lost the site name, the locale, the type and the
 * preview image, and a link to it shared with no picture. Every page therefore builds its
 * metadata here, which carries the shared fields along with its own. The preview image is named
 * explicitly because `app/opengraph-image.tsx` reaches a child page only when the child leaves
 * `openGraph` alone.
 */

import type { Metadata } from "next";
import { dataDate } from "./data.ts";

export const SITE_NAME = "hydro-look";

/** What `app/opengraph-image.tsx` draws, in words; it exports this as its `alt`. */
export const PREVIEW_ALT = "hydro-look: cuánta de la electricidad del Ecuador salió del agua ayer, y el nivel de Mazar.";

/**
 * The image `app/opengraph-image.tsx` draws at build time, at the size it declares. The image
 * changes with each day's data at the same URL, and WhatsApp and Facebook cache a preview by
 * its URL, so the data date goes in the query — as Next's own hash does on the home page.
 */
function preview() {
  const day = dataDate();
  return { url: `/opengraph-image${day ? `?d=${day}` : ""}`, width: 1200, height: 630, type: "image/png", alt: PREVIEW_ALT };
}

export const OPEN_GRAPH = { siteName: SITE_NAME, locale: "es_EC" } as const;

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  /** The page's path, with the trailing slash the static export serves it under. */
  path: string;
  type?: "website" | "article";
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    // No `title` or `description` here: Next copies the page's own into `og:`, with the layout's
    // template applied to the title, and copies those and the image on into `twitter:`.
    openGraph: { ...OPEN_GRAPH, type, url: path, images: [preview()] },
  };
}
