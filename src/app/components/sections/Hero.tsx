/**
 * The top of the home page: the day's headline, Mazar's level in a sentence, and the worst tier
 * the adequacy model gives, with Mazar's cross-section beside them.
 */

import { ReservoirCutFor } from "../ReservoirParts.tsx";
import type { AdequacyDocument, ForecastDocument } from "../../../lib/site/documents.ts";
import { longDate, num } from "../../../lib/site/format.ts";
import { direction, heroHeadline, inflowWords, marginClause, tierOf, weekday } from "../../../lib/site/story.ts";
import type { LatestDocument, ReservoirSnapshot } from "../../../lib/publish/latest.ts";

export function Hero({
  now,
  mazar,
  forecast,
  adequacy,
  asOf,
}: {
  now: LatestDocument | null;
  mazar: ReservoirSnapshot | null;
  forecast: ForecastDocument | null;
  adequacy: AdequacyDocument | null;
  asOf: string | null;
}) {
  const headline = heroHeadline(now?.national?.hydro_share_pct);
  const slope = mazar?.slopes_m_per_day.d7 ?? null;
  const dir = direction(slope);
  const water = inflowWords(mazar?.inflow?.climatology?.percentile_today);
  const worst = adequacy?.current.worst_tier ?? null;
  const worstTier = tierOf(worst);
  const clause =
    adequacy && worst ? marginClause(worst, adequacy.current.worst_tier_horizon_days, adequacy.horizons.at(-1)?.horizon_days ?? 90) : null;

  return (
    <section className="shell hero" aria-labelledby="hero-title">
      <div className="hero-copy rise">
        {asOf ? (
          <div className="eyebrow">
            Ecuador · {weekday(asOf)} {longDate(asOf)}
          </div>
        ) : null}
        <h1 id="hero-title">
          {headline.share !== null ? (
            <>
              {headline.before}
              <em>{headline.emphasis}</em>
              {headline.after}
            </>
          ) : (
            headline.before
          )}
        </h1>
        {mazar?.level ? (
          <p className="hero-lede">
            Mazar, el embalse que guarda agua para varias semanas, está a {num(mazar.level.masl, 2)} m sobre el nivel del mar
            {dir === "flat" ? " y se mantiene estable" : ` y ${dir === "down" ? "baja" : "sube"} ${num(Math.abs(slope!), 2)} m al día`}.
            {water ? ` Hoy le llega ${water}.` : ""}
            {clause && worstTier ? (
              <>
                {" "}
                {clause.before} <strong className={`tone-${worstTier.tone}`}>{clause.word}</strong>.
              </>
            ) : null}
          </p>
        ) : null}
        <div className="actions">
          <a href="#mazar" className="btn btn-solid">
            Ver hacia dónde va Mazar
          </a>
          <a href="#suficiencia" className="btn btn-ghost">
            ¿Alcanza la energía?
          </a>
        </div>
      </div>
      <div className="rise rise-late">{mazar ? <ReservoirCutFor reservoir={mazar} forecast={forecast} /> : null}</div>
    </section>
  );
}
