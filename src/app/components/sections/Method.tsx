/**
 * Section 06: what to know before using any of it. The two model caveats are rules over the
 * day's backtest numbers; the standing notes come from `lib/site/method.ts`.
 */

import { REPO, SectionIntro } from "../Chrome.tsx";
import type { AdequacyDocument, ForecastDocument } from "../../../lib/site/documents.ts";
import { num, pct } from "../../../lib/site/format.ts";
import { METHOD_NOTES, modelNotes, splitCode } from "../../../lib/site/method.ts";
import { countWord } from "../../../lib/site/story.ts";

/** Text with its backticked parts set as code. */
export function Rich({ text }: { text: string }) {
  return <>{splitCode(text).map((part, i) => (typeof part === "string" ? part : <code key={i}>{part.code}</code>))}</>;
}

export function Method({ forecast, adequacy }: { forecast: ForecastDocument | null; adequacy: AdequacyDocument | null }) {
  const sixty = forecast?.backtest.horizons.find((h) => h.horizon_days === 60);
  const ninety = forecast?.backtest.horizons.find((h) => h.horizon_days === 90);
  const tiers = adequacy?.tier_history;
  const firstA = adequacy?.horizons[0];
  const ninetyA = adequacy?.horizons.find((h) => h.horizon_days === 90);
  const coverageA = (adequacy?.horizons ?? [])
    .map((h) => h.backtest.requirement_coverage_p10_p90)
    .filter((c): c is number => c !== null && c !== undefined)
    .map((c) => c * 100);
  const nominalA = Math.round((adequacy?.band_method?.nominal_coverage ?? 0.8) * 100);
  const notes = [
    ...METHOD_NOTES,
    ...modelNotes({ precipitation_basin: forecast?.precipitation_basin, band_method: adequacy?.band_method }),
  ];
  return (
    <section id="metodo" className="shell section" aria-labelledby="metodo-title">
      <SectionIntro
        index="06"
        eyebrow="Cómo se hace y sus límites"
        titleId="metodo-title"
        title="Lo que conviene saber antes de usar estos números."
      >
        Todo el detalle, con las pruebas que lo respaldan, está en el <a href={REPO}>repositorio del proyecto</a>.
      </SectionIntro>
      <div className="caveats">
        {forecast && sixty && ninety ? (
          <p>
            <strong>¿Qué tan bueno es el pronóstico de Mazar?</strong> Lo probamos con datos del pasado, {forecast.model.backtest_origins}{" "}
            veces. A 60 días acierta {pct(sixty.skill_vs_persistence * 100, 1)} más que suponer que el nivel no cambia, y a 90 días,{" "}
            {pct(ninety.skill_vs_persistence * 100, 1)} más. A menos de un mes no mejora esa suposición. En 2024 Mazar bajó{" "}
            {countWord(forecast.crisis_check.episodes.length)} veces de {num(forecast.crisis_check.threshold_masl, 0)} m y el valor más
            probable no anticipó ninguna; dio {forecast.crisis_check.false_alarms_p50}{" "}
            {forecast.crisis_check.false_alarms_p50 === 1 ? "falsa alarma" : "falsas alarmas"}. Los resultados, también los malos, están en{" "}
            <a href={`${REPO}/blob/main/${forecast.backtest.report}`}>{forecast.backtest.report}</a>.
          </p>
        ) : null}
        {adequacy && tiers ? (
          <p>
            <strong>¿Qué tan buena es la cuenta de energía?</strong> Estima la energía que hace falta mejor que suponer que el último mes se
            repite
            {firstA?.backtest.requirement_skill_vs_persistence != null
              ? `: ${pct(firstA.backtest.requirement_skill_vs_persistence * 100, 1)} mejor a 7 días`
              : ""}
            {ninetyA?.backtest.requirement_skill_vs_persistence != null
              ? ` y ${pct(ninetyA.backtest.requirement_skill_vs_persistence * 100, 1)} a 90`
              : ""}
            {coverageA.length > 0
              ? `. Su rango probable acertó entre el ${num(Math.min(...coverageA), 0)} % y el ${num(Math.max(...coverageA), 0)} % de las veces; lo ideal sería un ${nominalA} %.`
              : "."}{" "}
            Probada en {tiers.origins} meses del pasado, dio alerta {tiers.origins_flagged} veces, y el{" "}
            {pct((tiers.share_of_flagged_that_preceded_cuts ?? 0) * 100, 0)} de esas alertas llegó antes de apagones reales. Pero solo avisó
            antes del {pct((tiers.share_of_cuts_that_were_flagged ?? 0) * 100, 0)} de los apagones: cuando alerta, suele tener razón, pero
            se le escapan la mayoría de las crisis. Tampoco tiene en cuenta los problemas de la red de transmisión. Detalle en{" "}
            <a href={`${REPO}/blob/main/data/reports/adequacy.md`}>data/reports/adequacy.md</a>.
          </p>
        ) : null}
      </div>
      <div className="notes">
        {notes.map((note) => (
          <article key={note.title}>
            <h3>
              <Rich text={note.title} />
            </h3>
            <p>
              <Rich text={note.body} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
