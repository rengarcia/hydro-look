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
  low: "baja",
  medium: "media",
  high: "alta",
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
              Lectura del día
            </h2>
            {tier ? (
              <span className="pill">
                <span className={`dot tone-${tier.tone}`} aria-hidden="true" />
                Nivel {tier.label.toLowerCase()}
                {which ? <span className="pill-note">{which}</span> : null}
              </span>
            ) : null}
          </div>
          <blockquote>
            <p>“{lead}{rest ? "" : "”"}</p>
            {rest ? <p className="reading-rest">{rest}”</p> : null}
          </blockquote>
          <p className="reading-fine">
            Texto redactado por un modelo de lenguaje (<code>{narrative.model}</code>) solo con los números de esta
            página; el pronóstico y el nivel de riesgo son de los modelos estadísticos, que el texto describe y no
            produce. Un validador rechaza cualquier cota o fecha que no esté en esos números. Confianza declarada:{" "}
            {CONFIDENCE_ES[narrative.confidence] ?? narrative.confidence} · generado el {ecStamp(narrative.generated_at)}.
            {stale ? ` Escrito sobre los datos del ${longDate(narrative.origin_date)}; el resto de la página ya muestra los del ${longDate(forecast!.origin_date)}.` : ""}{" "}
            <a href="/api/narrative.json">Lo que recibió el modelo</a> ·{" "}
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
