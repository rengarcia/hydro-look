import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "../lib/publish/contract.ts";
import { OPEN_GRAPH, SITE_NAME } from "../lib/site/meta.ts";
import "./globals.css";

const DESCRIPTION =
  "Cómo están los embalses del Ecuador, cuánta agua traen los ríos, de dónde sale la electricidad y si alcanzará, " +
  "con datos públicos de CELEC y CENACE actualizados cada día. No es una fuente oficial.";

/**
 * The metadata every page inherits. `metadataBase` makes each relative URL below absolute, which
 * is what a share preview needs; `title.template` puts the brand after every child page's own
 * title so no page writes it by hand; and each page sets its own `canonical` and Open Graph
 * fields through `pageMetadata` (`lib/site/meta.ts`), which says why it must.
 *
 * The preview image is `opengraph-image.tsx`, drawn at build time from the day's headline.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "hydro-look — el sistema hidroeléctrico del Ecuador",
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
    types: { "application/atom+xml": [{ url: "/feed.xml", title: "hydro-look: el resumen del día" }] },
  },
  openGraph: {
    ...OPEN_GRAPH,
    type: "website",
    title: "hydro-look — el sistema hidroeléctrico del Ecuador",
    description: DESCRIPTION,
    url: "/",
  },
  // The card size only. A title and description here would be inherited as they stand by every
  // page, where without them Next fills each page's `twitter:` tags from its own `og:` ones.
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1513" },
  ],
};

/*
 * The typefaces are committed under `public/fonts/` — Instrument Serif, Geist and Geist Mono,
 * the Latin subset of each, under the SIL Open Font License beside them — and declared in
 * `globals.css`. The build has no network, which is why they are files and not `next/font`, and
 * serving them from the site removes a render-blocking third-party stylesheet and a request to
 * Google on every visit. The two faces the first screen is set in are preloaded.
 */
const PRELOAD = ["/fonts/instrument-serif-latin-400-normal.woff2", "/fonts/geist-sans-latin-400-normal.woff2"];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Decision 3: the published site is in Spanish. `lang` is what tells a screen reader which
  // voice to read these numbers in, so it is not decoration.
  // `preload` rather than a `<link>` in `<head>`: React hoists a resource hint on its own, and a
  // hand-written link beside it would be emitted twice.
  for (const href of PRELOAD) preload(href, { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
