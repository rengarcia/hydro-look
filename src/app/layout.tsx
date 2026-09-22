import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hydro-look — el sistema hidroeléctrico del Ecuador",
  description:
    "Cotas de embalses, caudales, generación por planta y balance nacional, recogidos a diario " +
    "de las fuentes públicas de CELEC y CENACE. No es una fuente oficial.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Decision 3: the published site is in Spanish. `lang` is what tells a screen reader which
  // voice to read these numbers in, so it is not decoration.
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
