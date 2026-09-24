/**
 * Section 05: will there be enough energy. The expected surplus at each horizon with its tier,
 * the ceilings it assumes, the one assumption the answer rests on, and the check against the
 * rationing episodes the model can be held to. Under them, how far the tier moves with the import
 * assumption and how the published requirement did once its window closed — each only when the
 * document carries the block.
 */

import { SectionIntro } from "../Chrome.tsx";
import { Table } from "../DataTable.tsx";
import { ScorecardPanel } from "../Scorecard.tsx";
import { nextScoreDue } from "../../../lib/site/data.ts";
import type { AdequacyDocument, ImportSensitivity, PlantOutage } from "../../../lib/site/documents.ts";
import { num, signed } from "../../../lib/site/format.ts";
import {
  IMPORT_CASES,
  TIERS,
  adequacyHeadline,
  countWord,
  importCaseLabel,
  importDependence,
  monthName,
  monthSpan,
  tierOf,
} from "../../../lib/site/story.ts";

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
  const sensitivity = adequacy.import_sensitivity ? <ImportSensitivityPanel sensitivity={adequacy.import_sensitivity} /> : null;
  const scorecard = adequacy.scorecard ? (
    <ScorecardPanel
      card={adequacy.scorecard}
      nextDue={nextScoreDue("adequacy", adequacy.scorecard.observed_through)}
      subject="la energía que el país necesita además de la hidroeléctrica"
      digits={2}
      id="marcador-suficiencia"
    >
      Se comprueba la energía que el país necesita además de la que dan sus hidroeléctricas (la demanda menos la hidroeléctrica), porque eso
      sí se puede medir después. El faltante no se comprueba: es una cuenta de «qué pasaría si», no algo que se observe. Los períodos con
      apagones quedan fuera.
    </ScorecardPanel>
  ) : null;

  return (
    <section id="suficiencia" className="shell section" aria-labelledby="suficiencia-title">
      <SectionIntro
        index="05"
        eyebrow="Energía para los próximos meses"
        titleId="suficiencia-title"
        title={adequacyHeadline(adequacy.horizons)}
        wide
      >
        Una cuenta sencilla: la electricidad que el país necesitaría, menos lo que pueden dar las hidroeléctricas, las centrales térmicas y
        lo que llega de Colombia. Si el resultado es positivo, sobra energía; si es negativo, faltaría. Para estimar cuánto se necesita no
        usamos los días de apagones, porque esos días se consumió lo que se pudo, no lo que hacía falta.
      </SectionIntro>

      <div className="split wide-left">
        <div className="panel">
          <div className="panel-head roomy">
            <h3>Energía que sobraría (+) o faltaría (−) cada día</h3>
            {worst ? (
              <span className="pill">
                <span className={`dot tone-${worst.tone}`} aria-hidden="true" />
                Peor momento: {worst.label.toLowerCase()}, dentro de {adequacy.current.worst_tier_horizon_days} días
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
                    <div className="step-when">en {h.horizon_days} días</div>
                    <div className="step-dot" aria-hidden="true" />
                    <div className={surplus < 0 ? "step-value num short" : "step-value num"}>{signed(surplus, 1)}</div>
                    <div className="step-note">
                      GWh/día
                      <br />
                      margen: {signed(h.margin_pct, 2)} %
                    </div>
                    <div className="step-tier">{tier?.label ?? h.tier}</div>
                  </li>
                );
              })}
            </ol>
          </div>
          {worst && first ? (
            <p className="fine spaced tier-note">
              Para la próxima semana el nivel es {first.label.toLowerCase()}; el peor momento es {worst.label.toLowerCase()}, dentro de{" "}
              {adequacy.current.worst_tier_horizon_days} días.{" "}
              {usesWorst
                ? "El resumen del día y el titular de la página usan el peor momento."
                : "El resumen del día usa el nivel de la próxima semana."}{" "}
              {Object.values(TIERS)
                .map((t) => `${t.label}: ${t.gloss}.`)
                .join(" ")}
            </p>
          ) : null}
          <div className="assumptions">
            <div className="assumption">
              <span className="assumption-label">Térmica</span>
              <span className="assumption-value num">{num(a.thermal_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · lo más que ha dado</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Desde Colombia</span>
              <span className="assumption-value num">{num(cutoff ? regime.central_import_gwh_day : a.import_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · {cutoff ? "lo que está llegando" : "lo más que ha llegado"}</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Otras fuentes</span>
              <span className="assumption-value num">{num(a.other_gwh_day, 2)}</span>
              <span className="assumption-note">GWh/día · lo típico</span>
            </div>
            <div className="assumption">
              <span className="assumption-label">Hidroeléctrica, 15 días</span>
              <span className="assumption-value num">{num(adequacy.data.hydro_anomaly, 2)} ×</span>
              <span className="assumption-note">lo normal para la época</span>
            </div>
          </div>
          <p className="fine spaced">
            Estos topes son lo máximo que cada fuente ha dado en los últimos tres años, no su capacidad oficial: no hay una fuente pública
            con los mantenimientos programados de las centrales.
          </p>
        </div>

        <div className="aside-stack">
          <div className="inverse fragile">
            <span className="eyebrow">Lo que más puede fallar</span>
            <p className="fragile-claim">
              {cutoff
                ? `Colombia envió ${num(regime.trailing_gwh_day, 2)} GWh/día en los últimos ${regime.window_days} días.`
                : `La cuenta supone que llegan ${num(a.import_gwh_day, 2)} GWh/día desde Colombia.`}{" "}
              {peak ? `En ${monthName(peak)} de ${peak.slice(0, 4)} llegó a ${num(a.import_gwh_day, 2)}.` : ""}
            </p>
            <p className="fragile-fine">
              Colombia no siempre puede vender cuando la sequía también la golpea: entre el 1 de octubre y el 10 de noviembre de 2024, con
              apagones en Ecuador, llegaron solo {num(a.stressed_import_gwh_day, 2)} GWh/día.
              {cutoff ? " Por eso la cuenta usa lo que está llegando ahora, no el máximo." : ""}
            </p>
          </div>
          <OutageCard outage={adequacy.plant_outage} />
          {episodes.length > 0 ? (
            <div className="inverse check">
              <div className="check-head">
                <strong>¿Funciona la cuenta?</strong>
                <span>GWh/día</span>
              </div>
              <p className="check-lede">
                En cada período de apagones, la energía que dejó de consumirse (medida) frente a la que, según la cuenta, faltaba. Si la
                cuenta es buena, las dos barras deberían medir parecido.
              </p>
              {episodes.map((e) => (
                <div className="episode" key={e.start}>
                  <div>
                    {monthSpan(e.start, e.end)}
                    <small>
                      {e.days} {e.days === 1 ? "día" : "días"}
                    </small>
                  </div>
                  <div className="episode-bars">
                    <div>
                      <span className="episode-bar fill-inv-accent" style={{ width: barWidth(e.measured_suppression_gwh_day) }} />
                      {num(e.measured_suppression_gwh_day, 1)} medida
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

      {sensitivity && scorecard ? (
        <div className="split wide-left">
          {sensitivity}
          {scorecard}
        </div>
      ) : (
        (sensitivity ?? scorecard)
      )}
    </section>
  );
}

/**
 * What the margin would be without Coca Codo Sinclair (PLAN §8a gap 5), at 30 days: one plant's
 * share of the answer, stated as arithmetic rather than as a forecast of losing it.
 */
function OutageCard({ outage }: { outage: PlantOutage | undefined }) {
  const month = outage?.available ? outage.horizons?.find((h) => h.horizon_days === 30) : undefined;
  if (!outage || month === undefined || outage.share_of_hydro === undefined || outage.plant_gwh_day === undefined) return null;
  const tier = tierOf(month.tier);
  return (
    <div className="inverse fragile">
      <span className="eyebrow">Si falla una sola central</span>
      <p className="fragile-claim">
        {month.deficit_gwh_day > 0
          ? `Sin Coca Codo Sinclair faltarían ${num(month.deficit_gwh_day, 1)} GWh/día a 30 días.`
          : `Sin Coca Codo Sinclair el sistema aún cubriría la demanda a 30 días, con ${num(-month.deficit_gwh_day, 1)} GWh/día de margen.`}{" "}
        Nivel: {(tier?.label ?? month.tier).toLowerCase()}.
      </p>
      <p className="fragile-fine">
        Dio el {num(outage.share_of_hydro * 100, 0)} % de la electricidad hidráulica de las últimas cuatro semanas (
        {num(outage.plant_gwh_day, 1)} GWh/día). No es un pronóstico: muestra cuánto depende el margen de una sola central, que no tiene
        embalse y cuya toma de agua está amenazada desde 2020 por la erosión del río Coca.
      </p>
    </div>
  );
}

function TierCell({ tier, suffix }: { tier: string; suffix?: string }) {
  const t = tierOf(tier);
  return (
    <span className="tier-cell">
      <span className={`dot tone-${t?.tone ?? "muted"}`} aria-hidden="true" />
      {t?.label ?? tier}
      {suffix ? <small> {suffix}</small> : null}
    </span>
  );
}

/**
 * The tier under each import ceiling (§5.5): the one assumption the answer rests on, shown as the
 * three answers it would give. The worst tier per case is the table; every horizon of every case
 * is folded under it.
 */
export function ImportSensitivityPanel({ sensitivity }: { sensitivity: ImportSensitivity }) {
  if (sensitivity.cases.length === 0) return null;
  const verdict = importDependence(sensitivity);
  return (
    <div className="panel tight">
      <div className="panel-head">
        <h3>¿Cuánto depende de Colombia?</h3>
        <span className="meta">lo que llega de Colombia, en GWh/día</span>
      </div>
      {verdict ? <p className="panel-lede">{verdict}</p> : null}
      <Table
        caption="Peor nivel de riesgo según cuánta energía llegue desde Colombia"
        captionHidden
        columns={[{ label: "Si llega…" }, { label: "Desde Colombia", numeric: true }, { label: "Peor nivel" }]}
        rows={sensitivity.cases.map((c) => [
          <span key="c">
            {importCaseLabel(c.case)}
            {c.case === sensitivity.central_case ? <small className="central-tag"> · el que usa la cuenta</small> : null}
            {IMPORT_CASES[c.case] ? (
              <>
                <br />
                <span className="source">{IMPORT_CASES[c.case]!.gloss}</span>
              </>
            ) : null}
          </span>,
          num(c.import_gwh_day, 2),
          <TierCell key="t" tier={c.worst_tier} suffix={`en ${c.worst_tier_horizon_days} días`} />,
        ])}
      />
      <details className="chart-data">
        <summary>Ver cada plazo en cada caso</summary>
        <div className="table-scroll">
          <Table
            caption="Energía que sobraría o faltaría y nivel, por plazo, según lo que llegue de Colombia, en GWh/día"
            columns={[
              { label: "Caso y plazo" },
              { label: "Sobra (+) o falta (−)", numeric: true },
              { label: "Si la demanda sube más", numeric: true },
              { label: "Nivel" },
            ]}
            rows={sensitivity.cases.flatMap((c) =>
              c.horizons.map((h) => [
                `${importCaseLabel(c.case)} · ${h.horizon_days} días`,
                signed(-h.deficit_gwh_day, 1),
                signed(h.deficit_p90 === null ? null : -h.deficit_p90, 1),
                <TierCell key="t" tier={h.tier} />,
              ]),
            )}
          />
        </div>
        <p className="fine">
          «Si la demanda sube más» es un caso exigente: la demanda solo lo supera 1 de cada 10 veces. Cuando en ese caso falta energía, el
          nivel pasa de holgado a vigilancia.
        </p>
      </details>
      <p className="fine spaced">
        Todo lo demás —demanda, hidroeléctrica, térmica— es igual en{" "}
        {sensitivity.cases.length === 1 ? "la fila" : `las ${countWord(sensitivity.cases.length)} filas`}; solo cambia cuánta energía se
        supone que llega de Colombia. La cuenta usa «{importCaseLabel(sensitivity.central_case).toLowerCase()}».
      </p>
    </div>
  );
}
