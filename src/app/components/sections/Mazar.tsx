/**
 * Section 02: where Mazar is going. The fan over six months of record, each horizon with the
 * model that published it and its skill against persistence, and the three named analogue years
 * read against the critical threshold. Under them, how the forecasts already published did once their
 * dates came (the `scorecard` block, when the document carries one).
 */

import { SectionIntro } from "../Chrome.tsx";
import { FanChart } from "../FanChart.tsx";
import { Table } from "../DataTable.tsx";
import { ScorecardPanel } from "../Scorecard.tsx";
import { nextScoreDue, series, window as windowOf } from "../../../lib/site/data.ts";
import type { ForecastDocument } from "../../../lib/site/documents.ts";
import { dateWithYear, longDate, num, shortDate, signed } from "../../../lib/site/format.ts";
import { SKILL_TIE, criticalThreshold, joinDays, modelShort, scenarioOf, skillTone, thresholdSource } from "../../../lib/site/story.ts";

/** Days of history drawn behind the forecast. */
export const FAN_HISTORY_DAYS = 180;

function SkillBar({ skill }: { skill: number }) {
  // Zero sits 14 px in; the bar runs right for skill and left for its absence, 1.4 px a point.
  const zero = 14;
  const width = Math.min(Math.abs(skill * 100) * 1.4, skill >= 0 ? 70 - zero : zero);
  const x = skill >= 0 ? zero : zero - width;
  return (
    <svg width="70" height="10" viewBox="0 0 70 10" aria-hidden="true">
      <rect x="0" y="4" width="70" height="2" fill="var(--sunk)" />
      <rect x={x.toFixed(1)} y="1" width={Math.max(width, 1.5).toFixed(1)} height="8" rx="2" fill="var(--tone, var(--muted))" />
      <line x1={zero} x2={zero} y1="0" y2="10" stroke="var(--ink-2)" />
    </svg>
  );
}

/** The chart's props, shared with the day's permalink and Mazar's own page. */
export function fanChartOf(forecast: ForecastDocument) {
  const last = forecast.forecast.at(-1)!;
  return {
    history: windowOf(series().get(forecast.site, "cota_masl"), FAN_HISTORY_DAYS),
    origin: forecast.origin_date,
    originLevel: forecast.current.level_masl,
    horizons: forecast.forecast,
    thresholds: forecast.thresholds.map((t) => ({
      level_masl: t.level_masl,
      label:
        t.status === "unverified"
          ? `${num(t.level_masl, 0)} m · referencia de este sitio, no oficial`
          : `${num(t.level_masl, 0)} m · mínimo oficial (${thresholdSource(t.name)})`,
      unverified: t.status === "unverified",
    })),
    label: `Nivel de Mazar: los últimos ${FAN_HISTORY_DAYS} días y el pronóstico a ${last.horizon_days} días con su rango probable`,
    primaryModel: forecast.model.id,
  };
}

export function HorizonsTable({ forecast }: { forecast: ForecastDocument }) {
  const modelOf = (h: { model?: string }) => h.model ?? forecast.model.id;
  const scores = forecast.backtest.horizons;
  return (
    <Table
      className="horizons"
      caption="Pronóstico del nivel de Mazar por plazo, en metros sobre el nivel del mar, y cuánto acierta más que suponer que el nivel no cambia"
      captionHidden
      columns={[
        { label: "Plazo" },
        { label: "Fecha", wideOnly: true },
        { label: "Más probable (rango)", numeric: true },
        { label: "Mejora" },
        { label: "Modelo" },
      ]}
      rows={forecast.forecast.map((h) => {
        const score = scores.find((b) => b.horizon_days === h.horizon_days);
        const tone = skillTone(score?.skill_vs_persistence);
        return [
          `${h.horizon_days} días`,
          shortDate(h.target_date),
          <span key="range" className="range">
            <strong>{num(h.p50, 2)}</strong>
            <small>
              {num(h.p10, 0)} – {num(h.p90, 0)}
            </small>
          </span>,
          score ? (
            <span key="skill" className={`skill tone-${tone}`}>
              <SkillBar skill={score.skill_vs_persistence} />
              <span className="num">{signed(score.skill_vs_persistence * 100, 1)} %</span>
            </span>
          ) : (
            "—"
          ),
          <abbr key="model" className="model" title={modelOf(h)}>
            {modelShort(modelOf(h))}
          </abbr>,
        ];
      })}
    />
  );
}

export function Mazar({ forecast }: { forecast: ForecastDocument | null }) {
  if (forecast === null) return null;

  // Since 2026-09-22 the 7-day row can come from M4 while the rest are M3; each row names its
  // model, and older documents that do not are all `model.id`.
  const modelOf = (h: { model?: string }) => h.model ?? forecast.model.id;
  const switched = forecast.forecast.filter((h) => modelOf(h) !== forecast.model.id);
  const fellBack = forecast.horizon_switch?.status === "fallback" ? forecast.horizon_switch : null;
  const scores = forecast.backtest.horizons;
  const ties = scores.filter((b) => Math.abs(b.skill_vs_persistence) < SKILL_TIE).map((b) => b.horizon_days);
  const coverage = scores.map((b) => b.coverage_p10_p90 * 100);
  const critical = criticalThreshold(forecast.days_to_threshold.thresholds);
  const declared = forecast.days_to_threshold.thresholds.filter((t) => t.status !== "unverified");
  const last = forecast.forecast.at(-1)!;

  return (
    <section id="mazar" className="shell section" aria-labelledby="mazar-title">
      <div className="section-head">
        <SectionIntro
          index="02"
          eyebrow={`Mazar · pronóstico a ${last.horizon_days} días`}
          titleId="mazar-title"
          title="Hacia dónde va Mazar, el embalse que guarda agua para semanas."
        >
          El pronóstico hace, día por día, la cuenta del agua: cuánta llega, cuánta se usa para generar electricidad y cuánto sube o baja el
          nivel por eso. Usa lo que el operador ha hecho en el pasado con el embalse a cada nivel. Junto a cada plazo te decimos si acierta
          más que la opción más simple: suponer que el nivel se queda igual.
        </SectionIntro>
        <a href="/embalses/mazar/" className="btn btn-ghost">
          Ficha completa de Mazar →
        </a>
      </div>

      <div className="panel">
        <div className="chart-head">
          <ul className="legend">
            <li>
              <span className="key-line fill-ink" aria-hidden="true" />
              Nivel real
            </li>
            <li>
              <span className="key-line fill-water" aria-hidden="true" />
              Pronóstico: lo más probable
            </li>
            <li>
              <span className="key-box key-fan" aria-hidden="true" />
              Rango probable (8 de cada 10 casos)
            </li>
            {switched.length > 0 ? (
              <li>
                <span className="key-ring" aria-hidden="true" />
                {joinDays(switched.map((h) => h.horizon_days))} días: otro modelo ({modelShort(modelOf(switched[0]!))})
              </li>
            ) : null}
            <li>
              <span className="key-dash" aria-hidden="true" />
              Niveles mínimos
            </li>
          </ul>
          <span className="meta">metros sobre el nivel del mar</span>
        </div>
        <FanChart {...fanChartOf(forecast)} />
      </div>

      <div className="split">
        <div className="panel tight">
          <div className="panel-head">
            <h3>Plazos</h3>
            <span className="meta">lo más probable (rango) · mejora frente a «el nivel no cambia»</span>
          </div>
          <HorizonsTable forecast={forecast} />
          <p className="fine spaced">
            «Mejora» sale de probar el pronóstico con datos del pasado, a inicios de cada mes desde 2018 ({forecast.model.backtest_origins}{" "}
            veces).
            {ties.length > 0
              ? ` A ${joinDays(ties)} días no acierta más que suponer que el nivel no cambia; lo publicamos igual, y lo decimos.`
              : ""}{" "}
            El rango probable acertó entre el {num(Math.min(...coverage), 0)} % y el {num(Math.max(...coverage), 0)} % de las veces; lo
            ideal sería un 80 %.
            {switched.length > 0
              ? ` La fila de ${joinDays(switched.map((h) => h.horizon_days))} días viene de otro modelo (${modelOf(switched[0]!)}), que corrige los errores del primero y es el único que mejora a una semana.`
              : ""}
            {fellBack
              ? ` Hoy los ${fellBack.horizon_days} días vuelven al modelo principal: ${fellBack.candidate_model} no se publica cuando no se pudo probar en las mismas fechas.`
              : ""}
          </p>
        </div>

        {critical ? (
          <div className="scenarios">
            <div className="panel-head flush">
              <h3>¿Y si llueve como en otros años?</h3>
              <span className="meta">referencia: {num(critical.level_masl, 0)} m</span>
            </div>
            {critical.scenarios.map((s) => {
              const kind = scenarioOf(s.scenario);
              return (
                <div className="scenario lift" key={s.scenario}>
                  <div className="scenario-head">
                    <span className="scenario-name">
                      <span className={`dot tone-${kind.tone}`} aria-hidden="true" />
                      {kind.name}
                    </span>
                    <span className="meta">
                      como en {s.analogYear} · {num(s.inflowMeanM3s, 1)} m³/s
                    </span>
                  </div>
                  <div className="scenario-verdict">
                    {s.crossesOn ? `Baja de ${num(critical.level_masl, 0)} m` : `No baja de ${num(critical.level_masl, 0)} m`}
                  </div>
                  <div className="scenario-detail">
                    {s.crossesOn
                      ? `el ${longDate(s.crossesOn)}, en ${num(s.days, 0)} días`
                      : `en los próximos ${forecast.days_to_threshold.horizon_days} días`}
                    <br />
                    lo más bajo: {num(s.minimumLevelMasl, 2)} m
                  </div>
                </div>
              );
            })}
            <p className="fine">
              Cada escenario repite las lluvias reales de un año pasado. Con las de los {critical.across_all_analogue_years.analogue_years}{" "}
              años registrados, en {critical.across_all_analogue_years.years_that_cross} el nivel baja de {num(critical.level_masl, 0)} m
              {declared.length > 0
                ? declared.every((t) => t.across_all_analogue_years.years_that_cross === 0)
                  ? `; en ninguno llega al mínimo oficial de ${num(Math.max(...declared.map((t) => t.level_masl)), 0)} m.`
                  : `; en ${Math.max(...declared.map((t) => t.across_all_analogue_years.years_that_cross))} llega a un mínimo oficial.`
                : "."}{" "}
              {critical.status === "unverified"
                ? `${num(critical.level_masl, 0)} m es un nivel de referencia de este sitio, no una cifra oficial de CELEC.`
                : ""}
            </p>
          </div>
        ) : null}
      </div>
      <ScorecardPanel
        card={forecast.scorecard}
        nextDue={forecast.scorecard ? nextScoreDue("forecast", forecast.scorecard.observed_through) : null}
        subject="el nivel de Mazar"
        digits={2}
        id="marcador-mazar"
      >
        Cuando llega la fecha de un pronóstico, comparamos el nivel real con el valor más probable y el rango que publicamos.
      </ScorecardPanel>
      <p className="fine">
        Pronóstico del {dateWithYear(forecast.origin_date)}; los de días anteriores están en el <a href="/dia/">archivo diario</a>.
      </p>
    </section>
  );
}
