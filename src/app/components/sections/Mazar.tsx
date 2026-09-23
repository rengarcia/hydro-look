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
          ? `${num(t.level_masl, 0)} m · marcador propio, sin fuente oficial`
          : `${num(t.level_masl, 0)} m · mínimo declarado (${thresholdSource(t.name)})`,
      unverified: t.status === "unverified",
    })),
    label: `Cota de Mazar: ${FAN_HISTORY_DAYS} días observados y pronóstico a ${last.horizon_days} días con banda p10 a p90`,
    primaryModel: forecast.model.id,
  };
}

export function HorizonsTable({ forecast }: { forecast: ForecastDocument }) {
  const modelOf = (h: { model?: string }) => h.model ?? forecast.model.id;
  const scores = forecast.backtest.horizons;
  return (
    <Table
      className="horizons"
      caption="Pronóstico de la cota de Mazar por horizonte, en m s. n. m., con su acierto frente a la persistencia"
      captionHidden
      columns={[
        { label: "Horizonte" },
        { label: "Fecha", wideOnly: true },
        { label: "p50 (p10 – p90)", numeric: true },
        { label: "Acierto" },
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
          title="Hacia dónde va el único embalse con semanas de reserva."
        >
          Un balance hídrico cerrado en torno al operador: la curva cota–superficie y los m³/s por MW se ajustan con
          las lecturas de este repositorio, y la descarga sale cada día simulado de una regla de operación contra la
          propia cota. Junto a cada horizonte, cuánto le gana a suponer que la cota no cambia.
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
              Cota observada
            </li>
            <li>
              <span className="key-line fill-water" aria-hidden="true" />
              Pronóstico p50
            </li>
            <li>
              <span className="key-box key-fan" aria-hidden="true" />
              Banda p10–p90
            </li>
            {switched.length > 0 ? (
              <li>
                <span className="key-ring" aria-hidden="true" />
                {joinDays(switched.map((h) => h.horizon_days))} días: otro modelo ({modelShort(modelOf(switched[0]!))}, árboles potenciados)
              </li>
            ) : null}
            <li>
              <span className="key-dash" aria-hidden="true" />
              Mínimos
            </li>
          </ul>
          <span className="meta">m s. n. m.</span>
        </div>
        <FanChart {...fanChartOf(forecast)} />
      </div>

      <div className="split">
        <div className="panel tight">
          <div className="panel-head">
            <h3>Horizontes</h3>
            <span className="meta">p50 (p10 – p90) · acierto vs. persistencia</span>
          </div>
          <HorizonsTable forecast={forecast} />
          <p className="fine spaced">
            {forecast.model.backtest_origins} orígenes mensuales desde 2018.
            {ties.length > 0 ? ` A ${joinDays(ties)} días el modelo empata con la persistencia, y así se publica.` : ""}{" "}
            La banda p10–p90 cubre entre el {num(Math.min(...coverage), 0)} % y el {num(Math.max(...coverage), 0)} % de
            los casos, frente al 80 % nominal.
            {switched.length > 0
              ? ` La fila de ${joinDays(switched.map((h) => h.horizon_days))} días viene de ${modelOf(switched[0]!)}, que corrige el error del balance hídrico y es el único que le gana a la persistencia a una semana.`
              : ""}
            {fellBack
              ? ` Hoy los ${fellBack.horizon_days} días vuelven al balance hídrico: ${fellBack.candidate_model} no se publica cuando su validación no cubre los mismos orígenes.`
              : ""}
          </p>
        </div>

        {critical ? (
          <div className="scenarios">
            <div className="panel-head flush">
              <h3>Tres años reales de caudal, la misma regla</h3>
              <span className="meta">umbral {num(critical.level_masl, 0)} m</span>
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
                      como {s.analogYear} · {num(s.inflowMeanM3s, 1)} m³/s
                    </span>
                  </div>
                  <div className="scenario-verdict">{s.crossesOn ? `Cruza ${num(critical.level_masl, 0)} m` : "No cruza"}</div>
                  <div className="scenario-detail">
                    {s.crossesOn ? `el ${longDate(s.crossesOn)}, en ${num(s.days, 0)} días` : `en los próximos ${forecast.days_to_threshold.horizon_days} días`}
                    <br />
                    mínimo {num(s.minimumLevelMasl, 2)} m
                  </div>
                </div>
              );
            })}
            <p className="fine">
              De los {critical.across_all_analogue_years.analogue_years} años análogos,{" "}
              {critical.across_all_analogue_years.years_that_cross} cruzan los {num(critical.level_masl, 0)} m
              {declared.length > 0
                ? declared.every((t) => t.across_all_analogue_years.years_that_cross === 0)
                  ? `; ninguno llega a los ${num(Math.max(...declared.map((t) => t.level_masl)), 0)} m declarados.`
                  : `; ${Math.max(...declared.map((t) => t.across_all_analogue_years.years_that_cross))} llegan a un mínimo declarado.`
                : "."}{" "}
              {critical.status === "unverified" ? `${num(critical.level_masl, 0)} m es un marcador de este proyecto, no de CELEC.` : ""}
            </p>
          </div>
        ) : null}
      </div>
      <ScorecardPanel
        card={forecast.scorecard}
        nextDue={forecast.scorecard ? nextScoreDue("forecast", forecast.scorecard.observed_through) : null}
        subject="la cota de Mazar"
        digits={2}
        id="marcador-mazar"
      >
        Se compara la cota observada el día objetivo con la p50 y la banda p10–p90 que se publicaron.
      </ScorecardPanel>
      <p className="fine">Pronóstico del {dateWithYear(forecast.origin_date)}; los de días anteriores quedan en el <a href="/dia/">archivo diario</a>.</p>
    </section>
  );
}
