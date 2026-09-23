/**
 * Section 05: will there be enough energy. The expected surplus at each horizon with its tier,
 * the ceilings it assumes, the one assumption the answer rests on, and the check against the
 * rationing episodes the model can be held to.
 */

import { SectionIntro } from "../Chrome.tsx";
import type { AdequacyDocument } from "../../../lib/site/documents.ts";
import { num, signed } from "../../../lib/site/format.ts";
import { adequacyHeadline, monthName, monthSpan, tierOf } from "../../../lib/site/story.ts";

/** The day the import maximum was set, read from the assumptions' own prose when it names one. */
function importPeakDate(basis: string | undefined): string | null {
  const match = /import = [\d.]+ \([^()]*\((\d{4}-\d{2}-\d{2})\)/.exec(basis ?? "");
  return match ? match[1]! : null;
}

export function Adequacy({ adequacy }: { adequacy: AdequacyDocument | null }) {
  if (adequacy === null) return null;
  const worst = tierOf(adequacy.current.worst_tier);
  const first = tierOf(adequacy.current.tier);
  const a = adequacy.assumptions;
  const regime = a.import_regime;
  const cutoff = regime?.state === "cutoff";
  const peak = importPeakDate(a.basis);
  const episodes = adequacy.crisis_check.episodes;
  const scale = Math.max(1, ...episodes.flatMap((e) => [Math.abs(e.measured_suppression_gwh_day), Math.abs(e.implied_deficit_gwh_day)]));
  const barWidth = (v: number) => `calc(${Math.max((Math.max(v, 0) / scale) * 50, 1.5).toFixed(1)}% * var(--bar-scale, 1))`;
  const tones = adequacy.horizons.map((h) => `var(--${tierOf(h.tier)?.tone ?? "muted"})`);
  const track =
    tones.length > 1
      ? `linear-gradient(90deg, ${tones.map((t, i) => `${t} ${Math.round((i / (tones.length - 1)) * 100)}%`).join(", ")})`
      : tones[0];
  const usesWorst = (adequacy.current.narrative_tier_field ?? "worst_tier") === "worst_tier";

  return (
    <section id="suficiencia" className="shell section" aria-labelledby="suficiencia-title">
      <SectionIntro index="05" eyebrow="Suficiencia energética" titleId="suficiencia-title" title={adequacyHeadline(adequacy.horizons)} wide>
        Una sola identidad: demanda no suprimida menos hidroeléctrica menos el techo térmico menos la importación. Lo
        que queda es el superávit; en negativo, el déficit esperado. La demanda excluye los días de racionamiento,
        porque durante un corte los contadores miden la demanda que se permitió, no la que había.
      </SectionIntro>

      <div className="split wide-left">
        <div className="panel">
          <div className="panel-head roomy">
            <h3>Superávit esperado por horizonte</h3>
            {worst ? (
              <span className="pill">
                <span className={`dot tone-${worst.tone}`} aria-hidden="true" />
                Peor nivel: {worst.label.toLowerCase()} a {adequacy.current.worst_tier_horizon_days} días
              </span>
            ) : null}
          </div>
          <div className="timeline">
            <div className="timeline-track" style={{ background: track }} aria-hidden="true" />
            <ol>
              {adequacy.horizons.map((h) => {
                const tier = tierOf(h.tier);
                const surplus = -h.deficit_gwh_day;
                return (
                  <li className={`step tone-${tier?.tone ?? "muted"}`} key={h.horizon_days}>
                    <div className="step-when">{h.horizon_days} días</div>
                    <div className="step-dot" aria-hidden="true" />
                    <div className={surplus < 0 ? "step-value num short" : "step-value num"}>{signed(surplus, 1)}</div>
                    <div className="step-note">
                      GWh/día
                      <br />
                      margen {signed(h.margin_pct, 2)} %
                    </div>
                    <div className="step-tier">{tier?.label ?? h.tier}</div>
                  </li>
                );
              })}
            </ol>
          </div>
          {worst && first ? (
            <p className="fine spaced tier-note">
              Dos niveles salen de este documento: el del primer horizonte ({first.label.toLowerCase()}) y el peor de
              todos ({worst.label.toLowerCase()}, a {adequacy.current.worst_tier_horizon_days} días).{" "}
              {usesWorst
                ? "La lectura del día y el titular de la página usan el peor; en adequacy.json es el campo current.worst_tier."
                : "La lectura del día usa el del primer horizonte; en adequacy.json es el campo current.tier."}
            </p>
          ) : null}
          <div className="assumptions">
            <div className="assumption">
              <span className="assumption-label">Térmica</span>
              <span className="assumption-value num">{num(a.thermal_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · máx. demostrado</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Importación</span>
              <span className="assumption-value num">{num(cutoff ? regime!.central_import_gwh_day : a.import_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · {cutoff ? "lo que llega" : "máx. demostrado"}</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Otros tipos</span>
              <span className="assumption-value num">{num(a.other_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · mediana</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Quincena hídrica</span>
              <span className="assumption-value num">{num(adequacy.data.hydro_anomaly, 2)} ×</span>
              <span className="assumption-note">su climatología</span>
            </div>
          </div>
          <p className="fine spaced">
            Los techos son máximos demostrados en los últimos tres años, no declaraciones de disponibilidad: ninguna
            fuente que alcance este proyecto publica los mantenimientos programados. Se editan en{" "}
            <code>{a.editable_at}</code>.
          </p>
        </div>

        <div className="aside-stack">
          <div className="inverse fragile">
            <span className="eyebrow">El supuesto más frágil</span>
            <p className="fragile-claim">
              {cutoff
                ? `Colombia envió ${num(regime!.trailing_gwh_day, 2)} GWh/día en los últimos ${regime!.window_days} días.`
                : `El caso central cuenta con ${num(a.import_gwh_day, 2)} GWh/día desde Colombia.`}{" "}
              {peak ? `En ${monthName(peak)} de ${peak.slice(0, 4)} llegó a ${num(a.import_gwh_day, 2)}.` : ""}
            </p>
            <p className="fragile-fine">
              Un interconector no es firme cuando la sequía es compartida: entre el 1 de octubre y el 10 de noviembre
              de 2024, con el país racionando, llegaron {num(a.stressed_import_gwh_day, 2)} GWh/día.
              {cutoff ? " El caso central usa lo que está llegando, no el máximo." : ""}
            </p>
          </div>
          {episodes.length > 0 ? (
            <div className="inverse check">
              <div className="check-head">
                <strong>La comprobación</strong>
                <span>GWh/día</span>
              </div>
              <p className="check-lede">
                En cada racionamiento, la demanda suprimida que midieron los contadores frente al déficit que calcula
                el modelo. Si la identidad es correcta, deben tener el mismo tamaño.
              </p>
              {episodes.map((e) => (
                <div className="episode" key={e.start}>
                  <div>
                    {monthSpan(e.start, e.end)}
                    <small>{e.days} días</small>
                  </div>
                  <div className="episode-bars">
                    <div>
                      <span className="episode-bar fill-inv-accent" style={{ width: barWidth(e.measured_suppression_gwh_day) }} />
                      {num(e.measured_suppression_gwh_day, 1)} observada
                    </div>
                    <div>
                      <span className="episode-bar fill-t3" style={{ width: barWidth(e.implied_deficit_gwh_day) }} />
                      {signed(e.implied_deficit_gwh_day, 1)} calculada
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
