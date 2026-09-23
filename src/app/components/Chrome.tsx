/**
 * The furniture every page shares: the skip link, the mark, the masthead, the footer and the
 * contour lines drawn behind the top of the page. `Frame` assembles them, and the site's layout
 * wraps every page in it, so no page repeats the chrome by hand.
 *
 * The navigation collapses into a `<details>` element on a phone rather than a scripted drawer.
 * The page needs no JavaScript to read — the only scripts it ships are Next's runtime and the
 * analytics beacon, and neither draws anything — and `<details>` is a disclosure the browser
 * already knows how to open, close, focus and announce, with or without them.
 */

import type { ReactNode } from "react";
import { dateWithYear } from "../../lib/site/format.ts";
import { dataDate } from "../../lib/site/data.ts";
import { REPO_URL } from "../../lib/publish/contract.ts";

export const REPO = REPO_URL;

/** The home page's sections, linked from every page's masthead. */
export const NAV: NavLink[] = [
  { href: "/#embalses", label: "Embalses" },
  { href: "/#mazar", label: "Mazar" },
  { href: "/#caudal", label: "Caudal" },
  { href: "/#balance", label: "Balance" },
  { href: "/#suficiencia", label: "Suficiencia" },
  { href: "/#datos", label: "Datos" },
];

/** The id every page's `<main>` carries, which the skip link jumps to. */
export const MAIN_ID = "contenido";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <path
        d="M3 15.5c2.6 0 2.6-2 5.2-2s2.6 2 5.2 2 2.6-2 5.2-2 2.6 2 5.2 2"
        fill="none"
        stroke="var(--water)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M5.5 20.5h17" stroke="var(--water)" strokeWidth="1.8" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function Brand({ size = 28 }: { size?: number }) {
  return (
    <a href="/" className="brand" aria-label="hydro-look, inicio">
      <Mark size={size} />
      <span className="brand-word" aria-hidden="true">
        hydro<em>·</em>look
      </span>
    </a>
  );
}

export interface NavLink {
  href: string;
  label: string;
}

/**
 * The strip across the top. `asOf` is the date of the data, not of the build: the pill is the
 * first thing a reader sees, and what it has to answer is how old the numbers are. It says so in
 * words ("actualizados al") on every width, shortening only on a phone, where the navigation has
 * folded into the menu and the pill is the one thing beside the mark.
 */
export function Masthead({ asOf, links }: { asOf: string | null; links: NavLink[] }) {
  return (
    <header className="masthead">
      <div className="shell">
        <Brand />
        <nav className="nav" aria-label="Secciones">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        {asOf ? (
          <span className="pill masthead-date" title="El último día con datos publicados por CELEC y CENACE">
            <span className="dot tone-good" aria-hidden="true" />
            <span>
              <span className="pill-long">Datos actualizados al </span>
              <span className="pill-short">Actualizado: </span>
              {dateWithYear(asOf)}
            </span>
          </span>
        ) : null}
        <details className="menu">
          <summary aria-label="Abrir el menú">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 5h14M2 9h14M2 13h9" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <nav aria-label="Menú">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

/** Where a page below the home page sits, as a trail of links ending at the page itself. */
export function Crumbs({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav className="shell crumbs" aria-label="Ruta">
      {trail.map((step, i) => (
        <span key={step.label}>
          {i > 0 ? <span aria-hidden="true">/ </span> : null}
          {step.href ? <a href={step.href}>{step.label}</a> : <span aria-current="page">{step.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-lead">
          <Brand size={26} />
          <p>
            <strong>No es una fuente oficial.</strong> Cada número es una copia de lo que publicaron CELEC o CENACE, con la respuesta que lo
            produjo archivada junto a él. Este sitio no representa la posición de ninguna institución.
          </p>
        </div>
        <div className="footer-fine">
          <p>
            Código bajo licencia MIT. Energía: CELEC EP y CENACE. Meteorología: <a href="https://open-meteo.com/">Open-Meteo</a> (ERA5, CC
            BY 4.0). Índice ONI: <a href="https://psl.noaa.gov/data/correlation/oni.data">NOAA PSL / CPC</a>. Intercambios con Colombia: XM.{" "}
            <a href={REPO}>Código y datos en GitHub</a>.
          </p>
          <p className="footer-links">
            <a href="/datos/">Los datos y su contrato</a>
            <a href="/dia/">Archivo diario</a>
            <a href="/feed.xml">Suscribirse (Atom)</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Nine topographic lines behind the top of the page. Decoration, so hidden from assistive
 * technology, and generated from fixed sines rather than randomness so every build draws the
 * same page.
 */
export function Contours() {
  const width = 1440;
  const height = 760;
  const lines = 9;
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const base = 40 + (i * (height - 100)) / (lines - 1);
    const points: string[] = [];
    for (let x = 0; x <= width; x += 36) {
      const y = base + 12 * Math.sin(x / 170 + i * 0.9) + 7 * Math.sin(x / 83 - i * 1.7) + 4 * Math.cos(x / 41 + i * 0.4);
      points.push(`${x === 0 ? "M" : "L"}${x} ${Math.round(y * 10) / 10}`);
    }
    paths.push(points.join(" "));
  }
  return (
    <svg className="contours" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--contour)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/**
 * Every page's frame. The skip link comes first, before the masthead, so a keyboard reader's
 * first tab offers to jump past the navigation straight to the page's `<main id="contenido">`.
 */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href={`#${MAIN_ID}`}>
        Saltar al contenido
      </a>
      <div className="site">
        <Contours />
        <Masthead asOf={dataDate()} links={NAV} />
        {children}
        <Footer />
      </div>
    </>
  );
}

/** The number, the rule and the eyebrow over each section's title. */
export function Kicker({ index, children }: { index: string; children: ReactNode }) {
  return (
    <div className="kicker">
      <span className="index">{index}</span>
      <span className="rule" aria-hidden="true" />
      <div className="eyebrow">{children}</div>
    </div>
  );
}

export function SectionIntro({
  index,
  eyebrow,
  title,
  titleId,
  children,
  wide = false,
}: {
  index: string;
  eyebrow: ReactNode;
  title: ReactNode;
  /** The heading's id, for the section's `aria-labelledby`. */
  titleId?: string;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "section-intro wide" : "section-intro"}>
      <Kicker index={index}>{eyebrow}</Kicker>
      <h2 id={titleId} className="section-title">
        {title}
      </h2>
      {children ? <p className="section-lede">{children}</p> : null}
    </div>
  );
}
