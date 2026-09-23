/**
 * Section 06: what to know before using any of it. The two model caveats are rules over the
 * day's backtest numbers; the standing notes come from `lib/site/method.ts`.
 */

import { REPO, SectionIntro } from "../Chrome.tsx";
import type { AdequacyDocument, ForecastDocument } from "../../../lib/site/documents.ts";
import { num, pct } from "../../../lib/site/format.ts";
import { METHOD_NOTES, splitCode } from "../../../lib/site/method.ts";
import { countWord } from "../../../lib/site/story.ts";

/** Text with its backticked parts set as code. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {splitCode(text).map((part, i) => (typeof part === "string" ? part : <code key={i}>{part.code}</code>))}
    </>
  );
}

export function Method({ forecast, adequacy }: { forecast: ForecastDocument | null; adequacy: AdequacyDocument | null }) {
  const sixty = forecast?.backtest.horizons.find((h) => h.horizon_days === 60);
  const ninety = forecast?.backtest.horizons.find((h) => h.horizon_days === 90);
  const tiers = adequacy?.tier_history;
  const firstA = adequacy?.horizons[0];
  const ninetyA = adequacy?.horizons.find((h) => h.horizon_days === 90);
  return (
    <section id="metodo" className="shell section" aria-labelledby="metodo-title">
      <SectionIntro index="06" eyebrow="Método y advertencias" titleId="metodo-title" title="Lo que conviene saber antes de usar estos números.">
        Cada una está documentada, con las mediciones que la establecieron, en el <a href={REPO}>repositorio</a>.
      </SectionIntro>
      <div className="caveats">
        {forecast && sixty && ninety ? (
          <p>
            <strong>El pronóstico de cota.</strong> Sobre {forecast.model.backtest_origins} orígenes mensuales, el
            balance hídrico es {pct(sixty.skill_vs_persistence * 100, 1)} mejor que la persistencia a 60 días y{" "}
            {pct(ninety.skill_vs_persistence * 100, 1)} a 90, e indistinguible de ella por debajo del mes. De los{" "}
            {countWord(forecast.crisis_check.episodes.length)} cruces de los {num(forecast.crisis_check.threshold_masl, 0)} m en 2024, la
            mediana no anticipó ninguno; dio {forecast.crisis_check.false_alarms_p50}{" "}
            {forecast.crisis_check.false_alarms_p50 === 1 ? "falsa alarma" : "falsas alarmas"}. Todo, negativos incluidos,
            en <a href={`${REPO}/blob/main/${forecast.backtest.report}`}>{forecast.backtest.report}</a>.
          </p>
        ) : null}
        {adequacy && tiers ? (
          <p>
            <strong>La suficiencia.</strong> El requerimiento le gana a suponer que el último mes se repite
            {firstA?.backtest.requirement_skill_vs_persistence != null
              ? ` por ${pct(firstA.backtest.requirement_skill_vs_persistence * 100, 1)} a 7 días`
              : ""}
            {ninetyA?.backtest.requirement_skill_vs_persistence != null
              ? ` y ${pct(ninetyA.backtest.requirement_skill_vs_persistence * 100, 1)} a 90`
              : ""}
            , y su banda p10–p90 cubre unos dos tercios de los casos, no cuatro quintos. Aplicados a{" "}
            {tiers.origins} meses del registro, los niveles marcaron {tiers.origins_flagged}; de los marcados,{" "}
            {pct((tiers.share_of_flagged_that_preceded_cuts ?? 0) * 100, 0)} precedieron cortes, y de los cortes se marcó{" "}
            {pct((tiers.share_of_cuts_that_were_flagged ?? 0) * 100, 0)}: no da falsas alarmas, pero se le escapan la mayoría
            de las crisis. Nada de esto modela la red. Detalle en{" "}
            <a href={`${REPO}/blob/main/data/reports/adequacy.md`}>data/reports/adequacy.md</a>.
          </p>
        ) : null}
      </div>
      <div className="notes">
        {METHOD_NOTES.map((note) => (
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
