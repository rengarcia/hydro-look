/**
 * Mazar's own page: the one reservoir in the fleet with weeks of storage, and so the one this
 * project forecasts.
 *
 * The home page answers where Mazar is going; this one answers how far the answer can be
 * trusted. It carries the whole record the forecast is fitted on, the analogue years behind the
 * days-to-threshold numbers, the two times in 2024 the model was tested against a real crossing,
 * and the two floors CELEC publishes for it — side by side, because this site does not choose
 * between them.
 *
 * The other seven reservoirs share one template (`../[site]/page.tsx`) and most of its parts:
 * the tiles, the record, the inflow panel and the floors table are the same components here.
 */

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Crumbs, MAIN_ID } from "../../../components/Chrome.tsx";
import { Table } from "../../../components/DataTable.tsx";
import { InflowPanel } from "../../../components/ReservoirParts.tsx";
import { FloorsPanel, RecordSection, ReservoirHero } from "../../../components/ReservoirPage.tsx";
import { apiDocument, latest } from "../../../../lib/site/data.ts";
import type { CrossingThreshold, ForecastDocument } from "../../../../lib/site/documents.ts";
import { dateWithYear, longDate, num } from "../../../../lib/site/format.ts";
import { countWord, criticalThreshold, scenarioOf } from "../../../../lib/site/story.ts";

export const metadata: Metadata = {
  title: "Mazar",
  description:
    "Cota, pronóstico a 90 días, años análogos y los dos mínimos declarados de Mazar, el embalse con más " +
    "almacenamiento del Ecuador. No es una fuente oficial.",
  alternates: { canonical: "/embalses/mazar/" },
  openGraph: { url: "/embalses/mazar/" },
};

export default function MazarPage() {
  const now = latest();
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const mazar = now?.reservoirs.find((r) => r.site === "mazar") ?? null;

  return (
    <main id={MAIN_ID} className="stack-lg">
      <Crumbs trail={[{ href: "/", label: "Inicio" }, { href: "/#embalses", label: "Embalses" }, { label: "Mazar" }]} />
      {mazar ? (
        <ReservoirHero
          reservoir={mazar}
          forecast={forecast}
          lede="El único embalse de la flota con almacenamiento de varias semanas, y por eso el que se pronostica."
        />
      ) : null}
      {mazar ? <RecordSection reservoir={mazar} forecast={forecast} /> : null}
      {forecast ? (
        <section className="shell split even" aria-label="Umbrales y validación">
          <Crossing forecast={forecast} />
          <Foresight forecast={forecast} />
        </section>
      ) : null}
      {mazar ? (
        <section className="shell split lean-left" aria-label="Caudal y mínimos declarados">
          <InflowPanel reservoir={mazar} heading="Caudal frente a su historia" />
          <FloorsPanel reservoir={mazar} />
        </section>
      ) : null}
      <div className="shell footer-bar flush">
        <a href="/" className="btn btn-ghost">
          ← Volver al inicio
        </a>
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------- crossing */

function Crossing({ forecast }: { forecast: ForecastDocument }) {
  const threshold: CrossingThreshold | undefined = criticalThreshold(forecast.days_to_threshold.thresholds);
  if (!threshold) return null;
  const all = threshold.across_all_analogue_years;
  const level = num(threshold.level_masl, 0);
  const strip = `${all.years_that_cross} de ${all.analogue_years} años análogos cruzan los ${level} m`;

  return (
    <div className="panel">
      <h3 className="panel-title">¿Cuándo cruzaría los {level} m?</h3>
      <p className="panel-lede">
        Cada año análogo es un año real de caudal —de los registrados para esta época del año— pasado por la misma
        regla de descarga.
        {threshold.status === "unverified" ? ` ${level} m es un marcador de este proyecto (PLAN.md §7), no de CELEC.` : ""}
      </p>
      {/* One square per analogue year, filled when that year crosses. A picture of a count: the
          list items are empty, so the strip is one image with the count as its name. */}
      <div className="years" role="img" aria-label={strip} style={{ "--count": all.analogue_years } as CSSProperties}>
        {Array.from({ length: all.analogue_years }, (_, i) => (
          <span key={i} className={i < all.years_that_cross ? "crosses" : undefined} />
        ))}
      </div>
      <div className="years-caption">
        <span>
          <strong>
            {all.years_that_cross} de {all.analogue_years}
          </strong>{" "}
          años análogos cruzan
        </span>
        {all.p10_days !== null ? <span>en el 10 % más seco, en {all.p10_days} días</span> : null}
      </div>
      <Table
        className="scenarios-table"
        caption={`Tres años análogos con nombre, frente a los ${level} m`}
        captionHidden
        columns={[{ label: "Escenario" }, { label: "Año", numeric: true }, { label: "Caudal medio", numeric: true, wideOnly: true }, { label: "Resultado" }]}
        rows={threshold.scenarios.map((s) => [
          scenarioOf(s.scenario).name,
          s.analogYear,
          `${num(s.inflowMeanM3s, 2)} m³/s`,
          s.crossesOn
            ? `cruza el ${dateWithYear(s.crossesOn)} · ${num(s.days, 0)} días`
            : `no cruza · mínimo ${num(s.minimumLevelMasl, 2)} m`,
        ])}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- foresight */

function Foresight({ forecast }: { forecast: ForecastDocument }) {
  const check = forecast.crisis_check;
  const years = [...new Set(check.episodes.map((e) => e.crossed_on.slice(0, 4)))];
  return (
    <div className="panel">
      <h3 className="panel-title">¿Lo habría visto venir?</h3>
      <p className="panel-lede">
        Aplicado a las {countWord(check.episodes.length)} veces que Mazar bajó de {num(check.threshold_masl, 0)} m
        {years.length === 1 ? ` en ${years[0]}` : ""}, desde {check.origins_considered} orígenes mensuales.
      </p>
      <div className="foresight">
        {check.episodes.map((e) => {
          const verdict =
            e.p50_lead_time_days !== null
              ? { text: `La mediana lo anticipó ${e.p50_lead_time_days} días antes.`, pill: `${e.p50_lead_time_days} días antes`, tone: "good" }
              : e.p10_lead_time_days !== null
                ? {
                    text: `La cola seca (p10) lo marcó ${e.p10_lead_time_days} días antes; la mediana, no.`,
                    pill: `${e.p10_lead_time_days} días antes`,
                    tone: "watch",
                  }
                : { text: "Ni la mediana ni el caso seco lo anticiparon.", pill: "No anticipado", tone: "deficit" };
          return (
            <div key={e.crossed_on}>
              <div>
                <strong>{longDate(e.crossed_on)}</strong>
                <p>{verdict.text}</p>
              </div>
              <span className="pill">
                <span className={`dot tone-${verdict.tone}`} aria-hidden="true" />
                {verdict.pill}
              </span>
            </div>
          );
        })}
        <div>
          <div>
            <strong>Falsas alarmas</strong>
            <p>Veces que la mediana anunció un cruce que no ocurrió.</p>
          </div>
          <span className="count num">
            {check.false_alarms_p50} <small>de {check.origins_considered}</small>
          </span>
        </div>
      </div>
    </div>
  );
}
