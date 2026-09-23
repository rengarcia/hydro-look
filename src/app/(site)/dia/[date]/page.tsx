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
    description: `Lo que hydro-look publicó sobre el ${longDate(date)}: pronóstico de Mazar, suficiencia energética y la lectura del día.`,
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
          Lo que se publicó sobre este día, tal como quedó: los datos que describe son los del {longDate(date)}, y cada
          corrida lleva la hora en que se hizo.
        </SectionIntro>

        {day.narrative ? (
          <div className="reading inverse">
            <div className="reading-main">
              <div className="reading-head">
                <h2 className="eyebrow">Lectura del día</h2>
                {narrativeTier ? (
                  <span className="pill">
                    <span className={`dot tone-${narrativeTier.tone}`} aria-hidden="true" />
                    Nivel {narrativeTier.label.toLowerCase()}
                  </span>
                ) : null}
              </div>
              <blockquote>
                <p className="reading-rest">“{day.narrative.outlook_es}”</p>
              </blockquote>
              <p className="reading-fine">
                Redactado por <code>{day.narrative.model_id}</code> el {ecStamp(day.narrative.generated_at)}; confianza
                declarada {CONFIDENCE_ES[day.narrative.confidence as keyof typeof CONFIDENCE_ES] ?? day.narrative.confidence}.
                {day.runs.narrative > 1 ? ` Hubo ${day.runs.narrative} intentos para este día; esta es la última lectura que el validador aprobó.` : ""}
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
              ? `No se publicó lectura para este día: ${day.runs.narrative === 1 ? "el intento fue rechazado o falló" : `los ${day.runs.narrative} intentos fueron rechazados o fallaron`}.`
              : "No hay lectura del día para esta fecha."}
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
        <h3>Pronóstico de la cota de Mazar</h3>
        <span className="meta">m s. n. m.</span>
      </div>
      <p className="panel-lede">
        Desde {num(forecast.origin_level_masl, 2)} m. Corrida {forecast.run_id}, {ecStamp(forecast.generated_at)}
        {day.runs.forecast > 1 ? `; la última de ${day.runs.forecast} para este día` : ""}.
      </p>
      <Table
        caption={`Pronóstico de la cota de Mazar publicado sobre el ${longDate(day.date)}, y la cota observada después`}
        captionHidden
        columns={[
          { label: "Horizonte" },
          { label: "Fecha", wideOnly: true },
          { label: "p10", numeric: true },
          { label: "p50", numeric: true },
          { label: "p90", numeric: true },
          { label: "Observada", numeric: true },
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
      <p className="fine spaced">«Aún no» es un día que todavía no llega o que la fuente no publicó.</p>
      <DayScore card={card} runId={forecast.run_id} horizons={forecast.horizons} digits={2} subject="la cota de Mazar" href="/#marcador-mazar" />
    </div>
  );
}

function AdequacyPanel({ day, card }: { day: DayRecord; card: ScorecardBlock | null }) {
  const adequacy = day.adequacy!;
  return (
    <div className="panel tight">
      <div className="panel-head">
        <h3>Suficiencia energética</h3>
        <span className="meta">GWh/día</span>
      </div>
      <p className="panel-lede">
        Corrida {adequacy.run_id}, {ecStamp(adequacy.generated_at)}
        {day.runs.adequacy > 1 ? `; la última de ${day.runs.adequacy} para este día` : ""}.
      </p>
      <Table
        caption={`Superávit esperado por horizonte, publicado sobre el ${longDate(day.date)}`}
        captionHidden
        columns={[{ label: "Horizonte" }, { label: "Superávit", numeric: true }, { label: "Margen", numeric: true }, { label: "Nivel" }]}
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
        subject="el requerimiento neto nacional, en GWh/día"
        href="/#marcador-suficiencia"
      />
    </div>
  );
}
