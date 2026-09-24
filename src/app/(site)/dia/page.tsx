/**
 * The archive: every day a model stood on, newest first, each linked to its permanent page.
 *
 * The home page is overwritten every morning; these are not. A reading quoted in the press on a
 * given day can be checked here against what was published about that day, after the numbers on
 * the home page have moved on.
 */

import type { Metadata } from "next";
import { Crumbs, MAIN_ID, SectionIntro } from "../../components/Chrome.tsx";
import { Table } from "../../components/DataTable.tsx";
import { days } from "../../../lib/site/data.ts";
import { worstTierOf } from "../../../lib/site/days.ts";
import { longDate, num } from "../../../lib/site/format.ts";
import { tierOf, weekday } from "../../../lib/site/story.ts";

export const metadata: Metadata = {
  title: "Archivo diario",
  description: "Cada día que el sitio publicó: el pronóstico de Mazar, si alcanza la energía y el resumen del día, tal como quedaron.",
  alternates: { canonical: "/dia/" },
  openGraph: { url: "/dia/" },
};

export default function DaysIndex() {
  const all = days();
  return (
    <main id={MAIN_ID} className="stack-lg">
      <Crumbs trail={[{ href: "/", label: "Inicio" }, { label: "Archivo diario" }]} />
      <section className="shell section" aria-labelledby="archivo-title">
        <SectionIntro index="—" eyebrow="Archivo" titleId="archivo-title" title="Lo que se publicó cada día.">
          La portada cambia cada mañana; estas páginas no. Hay una por día, con el pronóstico de Mazar, si alcanzaba la energía y el resumen
          del día tal como se publicaron. Sirven para comprobar, tiempo después, qué decía el sitio en una fecha concreta.
        </SectionIntro>
        {all.length === 0 ? (
          <p className="panel-lede">Aún no hay días archivados.</p>
        ) : (
          <div className="panel tight">
            <Table
              className="days-table"
              caption="Días con datos publicados, del más reciente al más antiguo"
              captionHidden
              columns={[
                { label: "Día" },
                { label: "Mazar: nivel más probable al final", numeric: true },
                { label: "Energía: peor nivel" },
                { label: "Resumen", wideOnly: true },
              ]}
              rows={all.map((day) => {
                const lastHorizon = day.forecast?.horizons.at(-1) ?? null;
                const worst = day.adequacy ? tierOf(worstTierOf(day.adequacy.horizons)) : null;
                return [
                  <a key="day" href={`/dia/${day.date}/`}>
                    {weekday(day.date)} {longDate(day.date)}
                  </a>,
                  lastHorizon ? `${num(lastHorizon.p50, 2)} m a ${lastHorizon.horizon_days} días` : "—",
                  worst ? (
                    <span key="tier" className="tier-cell">
                      <span className={`dot tone-${worst.tone}`} aria-hidden="true" />
                      {worst.label}
                    </span>
                  ) : (
                    "—"
                  ),
                  day.narrative ? "publicado" : day.runs.narrative > 0 ? "no pasó la revisión" : "—",
                ];
              })}
            />
          </div>
        )}
      </section>
    </main>
  );
}
