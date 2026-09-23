/**
 * The 404, in Spanish. Next's own is in English, which on a `lang="es"` site is a page a screen
 * reader pronounces in the wrong voice. A static export serves this as `404.html`.
 */

import type { Metadata } from "next";
import { Frame, MAIN_ID } from "./components/Chrome.tsx";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <Frame>
      <main id={MAIN_ID} className="stack-lg">
        <section className="shell detail-hero not-found" aria-labelledby="nf-title">
          <div className="hero-copy">
            <div className="eyebrow">Error 404</div>
            <h1 id="nf-title">Esta página no existe.</h1>
            <p className="hero-lede">
              Puede que el enlace esté mal escrito, o que apunte a un día o a un embalse que este sitio no publica. Los números del día
              están en la portada; lo publicado sobre cada día, en el archivo.
            </p>
            <div className="actions">
              <a href="/" className="btn btn-solid">
                Ir a la portada
              </a>
              <a href="/dia/" className="btn btn-ghost">
                Archivo diario
              </a>
              <a href="/datos/" className="btn btn-ghost">
                Datos abiertos
              </a>
            </div>
          </div>
        </section>
      </main>
    </Frame>
  );
}
