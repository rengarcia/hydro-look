/**
 * An embeddable card per reservoir, for a news site to put in an `<iframe>`:
 *
 *   <iframe src="https://hydro-look.vercel.app/embed/mazar/" width="400" height="260"
 *           title="Mazar: cota de hoy" style="border:0"></iframe>
 *
 * A fixed 400 × 260 box, no navigation, no chrome of the site around it, and every link opening
 * in a new tab so a reader never finds the site inside someone else's article. It is a static
 * file rebuilt with the site, so it is as current as the page and costs the host nothing.
 * `vercel.json` allows it in any frame; the page asks search engines not to index it, because
 * the reservoir's own page is the one to find.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiDocument, latest, reservoirHref } from "../../../lib/site/data.ts";
import type { ForecastDocument } from "../../../lib/site/documents.ts";
import { dateWithYear, num, pct, signed } from "../../../lib/site/format.ts";
import { ARROW, DIRECTION_TONE, direction, inflowWords } from "../../../lib/site/story.ts";
import { SITE_URL } from "../../../lib/publish/contract.ts";

export const dynamicParams = false;

export function generateStaticParams(): { site: string }[] {
  return (latest()?.reservoirs ?? []).filter((r) => r.level !== null).map((r) => ({ site: r.site }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const { site } = await params;
  const reservoir = latest()?.reservoirs.find((r) => r.site === site);
  return {
    title: reservoir ? `${reservoir.label}: nivel de hoy` : "Embalse",
    robots: { index: false, follow: true },
    alternates: { canonical: reservoirHref(site) },
  };
}

export default async function EmbedCard({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const reservoir = latest()?.reservoirs.find((r) => r.site === site) ?? null;
  if (reservoir === null || reservoir.level === null) notFound();
  const level = reservoir.level;
  const primary = reservoir.bands[0] ?? null;
  const slope = reservoir.slopes_m_per_day.d7;
  const dir = direction(slope);
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const end = forecast && forecast.site === site ? forecast.forecast.at(-1) : null;
  const href = `${SITE_URL}${reservoirHref(site)}`;
  const fill = primary?.band_pct ?? null;

  return (
    <main className="embed-card">
      <div className="embed-head">
        <span className="embed-name">{reservoir.label}</span>
        <span className="embed-date">{dateWithYear(level.date)}</span>
      </div>
      <div className="embed-level num">
        {num(level.masl, 2)}
        <small>m sobre el mar</small>
      </div>
      {fill !== null ? (
        <div
          className="embed-bar"
          role="img"
          aria-label={`${pct(fill, 1)} de su rango de operación, ${num(primary!.min_masl, 0)}–${num(primary!.max_masl, 0)} m`}
        >
          <span style={{ width: `${Math.min(100, Math.max(0, fill)).toFixed(1)}%` }} />
        </div>
      ) : null}
      <ul className="embed-facts">
        <li>{fill !== null ? `${pct(fill, 1)} de su rango de operación` : "sin rango oficial publicado"}</li>
        <li>
          <span className={`arrow tone-${DIRECTION_TONE[dir]}`} aria-hidden="true">
            {ARROW[dir]}
          </span>{" "}
          {signed(slope, 2)} m al día en la última semana
        </li>
        {inflowWords(reservoir.inflow?.climatology?.percentile_today) ? (
          <li>le llega {inflowWords(reservoir.inflow?.climatology?.percentile_today)}</li>
        ) : null}
        {end ? (
          <li>
            en {end.horizon_days} días, lo más probable: {num(end.p50, 2)} m (entre {num(end.p10, 0)} y {num(end.p90, 0)})
          </li>
        ) : null}
      </ul>
      <div className="embed-foot">
        <a href={href} target="_blank" rel="noopener">
          hydro<em>·</em>look
        </a>
        <span>Datos de CELEC. No es una fuente oficial.</span>
      </div>
    </main>
  );
}
