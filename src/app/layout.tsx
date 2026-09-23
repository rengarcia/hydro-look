import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hydro-look — el sistema hidroeléctrico del Ecuador",
  description:
    "Cotas de embalses, caudales, generación por central y balance nacional, recogidos a diario " +
    "de los servicios públicos de CELEC y CENACE. No es una fuente oficial.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1513" },
  ],
};

/*
 * The typefaces are linked, not bundled through `next/font`. `next/font/google` downloads the
 * files during `next build`, and the build runs with no network in CI by design; a stylesheet
 * link costs the reader one request and the build nothing. Every family falls back to a system
 * stack in `globals.css`, so a blocked request degrades the look and never the numbers.
 */
const FONTS =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Decision 3: the published site is in Spanish. `lang` is what tells a screen reader which
  // voice to read these numbers in, so it is not decoration.
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
