/**
 * Phase 6b. A paragraph a language model wrote from the numbers on this page and nothing else.
 *
 * The risk tier shown is the one the text was given, and it is the adequacy model's: the model
 * explains it and cannot choose it, so there is never a second tier on the page. `adequacy.json`
 * carries two tiers — the first horizon's and the worst across all of them — and the text is
 * handed the worst; the pill says which, and at how many days, so a reader comparing it with the
 * adequacy section below knows why the two words can differ.
 *
 * When the text is older than the forecast — the gateway rate-limited or the validator rejected
 * today's — the section says so rather than pairing yesterday's prose with today's numbers in
 * silence.
 */

import type { AdequacyDocument, ForecastDocument, NarrativeDocument } from "../../../lib/site/documents.ts";
import { ecStamp, longDate } from "../../../lib/site/format.ts";
import { narrativeTierNote, splitLead, tierOf } from "../../../lib/site/story.ts";

export const CONFIDENCE_ES: Record<NarrativeDocument["confidence"], string> = {
  low: "poco",
  medium: "bastante",
  high: "mucho",
};

export function Reading({
  narrative,
  forecast,
  adequacy,
}: {
  narrative: NarrativeDocument | null;
  forecast: ForecastDocument | null;
  adequacy: AdequacyDocument | null;
}) {
  if (narrative === null || !narrative.outlook_es) return null;
  const tier = tierOf(narrative.risk_tier);
  const stale = forecast !== null && narrative.origin_date < forecast.origin_date;
  const which = narrativeTierNote(narrative, adequacy);
  // The design sets the reading as a pull quote, which holds a sentence and not a paragraph. The
  // first sentence is set large and the rest follows at reading size, so none of the text the
  // validator passed is cut.
  const [lead, rest] = splitLead(narrative.outlook_es);

  return (
    <section id="lectura" className="shell section" aria-labelledby="lectura-title">
      <div className="reading inverse">
        <div className="reading-main">
          <div className="reading-head">
            <h2 id="lectura-title" className="eyebrow">
              Resumen del día
            </h2>
            {tier ? (
              <span className="pill">
                <span className={`dot tone-${tier.tone}`} aria-hidden="true" />
                Energía: nivel {tier.label.toLowerCase()}
                {which ? <span className="pill-note">{which}</span> : null}
              </span>
            ) : null}
          </div>
          <blockquote>
            <p>
              “{lead}
              {rest ? "" : "”"}
            </p>
            {rest ? <p className="reading-rest">{rest}”</p> : null}
          </blockquote>
          <p className="reading-fine">
            Este resumen lo escribe una inteligencia artificial (<code>{narrative.model}</code>) usando solo los números de esta página. La
            IA no hace pronósticos: el pronóstico de Mazar y el nivel de riesgo vienen de los modelos estadísticos del sitio, y ella solo
            los explica. Antes de publicarse, una revisión automática comprueba que cada cifra y cada fecha coincidan con los datos. Qué
            tanto coinciden los indicadores entre sí: {CONFIDENCE_ES[narrative.confidence] ?? narrative.confidence} · escrito el{" "}
            {ecStamp(narrative.generated_at)}.
            {stale
              ? ` Está escrito con los datos del ${longDate(narrative.origin_date)}; el resto de la página ya muestra los del ${longDate(forecast.origin_date)}.`
              : ""}{" "}
            <a href="/api/narrative.json">Los datos que recibió la IA</a> ·{" "}
            <a href={`/dia/${narrative.origin_date}/`}>enlace permanente a este día</a>.
          </p>
        </div>
        {narrative.drivers.length > 0 ? (
          <ol className="drivers">
            {narrative.drivers.map((driver, i) => (
              <li key={i}>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span>{driver}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
