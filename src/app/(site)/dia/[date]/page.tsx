/**
 * One day's permanent page: what was published about it, as it was published.
 *
 * Rebuilt from `forecast_runs`/`forecast_values`, `adequacy_runs`/`adequacy_values` and
 * `narrative_snapshots` (see `lib/site/days.ts`), never from today's documents, so a citation of
 * a day stays checkable after the numbers on the home page move. Where a forecast's target date
 * has since been observed, the observed level sits beside it; under each run, what the published
 * scorecard (`forecast.json`/`adequacy.json`) says of it — which horizons have reached their date,
 * when the next one does, and the rows of this run it has scored.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crumbs, MAIN_ID, SectionIntro } from "../../../components/Chrome.tsx";
import { Table } from "../../../components/DataTable.tsx";
import { DayScore } from "../../../components/Scorecard.tsx";
import { apiDocument, days, series } from "../../../../lib/site/data.ts";
import type { DayRecord } from "../../../../lib/site/days.ts";
import type { AdequacyDocument, ForecastDocument, ScorecardBlock } from "../../../../lib/site/documents.ts";
import { dateWithYear, ecStamp, longDate, num, signed } from "../../../../lib/site/format.ts";
import { modelShort, tierOf, weekday } from "../../../../lib/site/story.ts";
import { CONFIDENCE_ES } from "../../../components/sections/Reading.tsx";

export const dynamicParams = false;

export function generateStaticParams(): { date: string }[] {
  return days().map((d) => ({ date: d.date }));
}

function dayOf(date: string): DayRecord | null {
  return days().find((d) => d.date === date) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const path = `/dia/${date}/`;
  return {
    title: `El ${longDate(date)}`,
    description: `Lo que hydro-look publicó sobre el ${longDate(date)}: pronóstico de Mazar, si alcanza la energía y el resumen del día.`,
    alternates: { canonical: path },
    openGraph: { url: path, type: "article" },
  };
}

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const day = dayOf(date);
  if (day === null) notFound();
  const all = days();
  const index = all.findIndex((d) => d.date === date);
  const newer = index > 0 ? all[index - 1]! : null;
  const older = index < all.length - 1 ? all[index + 1]! : null;
  const narrativeTier = tierOf(day.narrative?.risk_tier);
  const levelCard = apiDocument<ForecastDocument>("forecast.json")?.scorecard ?? null;
  const requirementCard = apiDocument<AdequacyDocument>("adequacy.json")?.scorecard ?? null;

  return (
    <main id={MAIN_ID} className="stack-lg">
      <Crumbs trail={[{ href: "/", label: "Inicio" }, { href: "/dia/", label: "Archivo diario" }, { label: dateWithYear(date) }]} />
      <section className="shell section" aria-labelledby="dia-title">
        <SectionIntro index="—" eyebrow={`Archivo · ${weekday(date)}`} titleId="dia-title" title={`El ${longDate(date)}.`}>
          Lo que el sitio publicó sobre este día, sin cambios: los datos son los del {longDate(date)}, y cada cálculo lleva la hora en que
          se hizo.
        </SectionIntro>

        {day.narrative ? (
          <div className="reading inverse">
            <div className="reading-main">
              <div className="reading-head">
                <h2 className="eyebrow">Resumen del día</h2>
                {narrativeTier ? (
                  <span className="pill">
                    <span className={`dot tone-${narrativeTier.tone}`} aria-hidden="true" />
                    Energía: nivel {narrativeTier.label.toLowerCase()}
                  </span>
                ) : null}
              </div>
              <blockquote>
                <p className="reading-rest">“{day.narrative.outlook_es}”</p>
              </blockquote>
              <p className="reading-fine">
                Escrito por inteligencia artificial (<code>{day.narrative.model_id}</code>) el {ecStamp(day.narrative.generated_at)}. Qué
                tanto coinciden los indicadores entre sí:{" "}
                {CONFIDENCE_ES[day.narrative.confidence as keyof typeof CONFIDENCE_ES] ?? day.narrative.confidence}.
                {day.runs.narrative > 1
                  ? ` Hubo ${day.runs.narrative} intentos para este día; este es el último que pasó la revisión automática de cifras.`
                  : ""}
              </p>
            </div>
            {day.narrative.drivers.length > 0 ? (
              <ol className="drivers">
                {day.narrative.drivers.map((driver, i) => (
                  <li key={i}>
                    <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : (
          <p className="panel-lede">
            {day.runs.narrative > 0
              ? `No se publicó resumen para este día: ${day.runs.narrative === 1 ? "el intento no pasó la revisión o falló" : `los ${day.runs.narrative} intentos no pasaron la revisión o fallaron`}.`
              : "No hay resumen del día para esta fecha."}
          </p>
        )}

        <div className="split even">
          {day.forecast ? <ForecastPanel day={day} card={levelCard} /> : null}
          {day.adequacy ? <AdequacyPanel day={day} card={requirementCard} /> : null}
        </div>

        <nav className="day-nav" aria-label="Otros días">
          {older ? <a href={`/dia/${older.date}/`}>← {dateWithYear(older.date)}</a> : <span />}
          <a href="/dia/">Todos los días</a>
          {newer ? <a href={`/dia/${newer.date}/`}>{dateWithYear(newer.date)} →</a> : <span />}
        </nav>
      </section>
    </main>
  );
}

function ForecastPanel({ day, card }: { day: DayRecord; card: ScorecardBlock | null }) {
  const forecast = day.forecast!;
  const observed = series().get(forecast.site || "mazar", "cota_masl");
  return (
    <div className="panel tight">
      <div className="panel-head">
        <h3>Pronóstico del nivel de Mazar</h3>
        <span className="meta">metros sobre el nivel del mar</span>
      </div>
      <p className="panel-lede">
        Partía de {num(forecast.origin_level_masl, 2)} m. Calculado el {ecStamp(forecast.generated_at)}
        {day.runs.forecast > 1 ? `; el último de ${day.runs.forecast} cálculos para este día` : ""} (<code>{forecast.run_id}</code>).
      </p>
      <Table
        caption={`Pronóstico del nivel de Mazar publicado sobre el ${longDate(day.date)}, y el nivel real después`}
        captionHidden
        columns={[
          { label: "Plazo" },
          { label: "Fecha", wideOnly: true },
          { label: "Bajo", numeric: true },
          { label: "Más probable", numeric: true },
          { label: "Alto", numeric: true },
          { label: "Nivel real", numeric: true },
          { label: "Modelo", wideOnly: true },
        ]}
        rows={forecast.horizons.map((h) => {
          const seen = observed.get(h.target_date);
          return [
            `${h.horizon_days} días`,
            dateWithYear(h.target_date),
            num(h.p10, 2),
            num(h.p50, 2),
            num(h.p90, 2),
            seen === undefined ? "aún no" : num(seen, 2),
            <abbr key="m" title={h.model_id}>
              {modelShort(h.model_id)}
            </abbr>,
          ];
        })}
      />
      <p className="fine spaced">
        «Bajo» y «alto» son los extremos del rango probable: 8 de cada 10 veces el nivel real debería quedar entre ellos. «Aún no» es un día
        que todavía no llega o del que la fuente no publicó dato.
      </p>
      <DayScore
        card={card}
        runId={forecast.run_id}
        horizons={forecast.horizons}
        digits={2}
        subject="el nivel de Mazar"
        href="/#marcador-mazar"
      />
    </div>
  );
}

function AdequacyPanel({ day, card }: { day: DayRecord; card: ScorecardBlock | null }) {
  const adequacy = day.adequacy!;
  return (
    <div className="panel tight">
      <div className="panel-head">
        <h3>¿Alcanza la energía?</h3>
        <span className="meta">GWh/día</span>
      </div>
      <p className="panel-lede">
        Calculado el {ecStamp(adequacy.generated_at)}
        {day.runs.adequacy > 1 ? `; el último de ${day.runs.adequacy} cálculos para este día` : ""} (<code>{adequacy.run_id}</code>).
      </p>
      <Table
        caption={`Energía que sobraría o faltaría cada día, por plazo, publicada sobre el ${longDate(day.date)}`}
        captionHidden
        columns={[
          { label: "Plazo" },
          { label: "Sobra (+) o falta (−)", numeric: true },
          { label: "Margen", numeric: true },
          { label: "Nivel" },
        ]}
        rows={adequacy.horizons.map((h) => {
          const tier = tierOf(h.tier);
          return [
            `${h.horizon_days} días`,
            signed(h.deficit_gwh_day === null ? null : -h.deficit_gwh_day, 1),
            h.margin_pct === null ? "—" : `${signed(h.margin_pct, 2)} %`,
            <span key="t" className="tier-cell">
              <span className={`dot tone-${tier?.tone ?? "muted"}`} aria-hidden="true" />
              {tier?.label ?? h.tier}
            </span>,
          ];
        })}
      />
      <DayScore
        card={card}
        runId={adequacy.run_id}
        horizons={adequacy.horizons}
        digits={2}
        subject="la energía que el país necesita de fuentes no hidráulicas, en GWh/día"
        href="/#marcador-suficiencia"
      />
    </div>
  );
}
