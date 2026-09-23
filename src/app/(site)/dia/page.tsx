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
  description: "Cada día que los modelos publicaron: el pronóstico de Mazar, la suficiencia y la lectura del día, tal como quedaron.",
  alternates: { canonical: "/dia/" },
  openGraph: { url: "/dia/" },
};

export default function DaysIndex() {
  const all = days();
  return (
    <main id={MAIN_ID} className="stack-lg">
      <Crumbs trail={[{ href: "/", label: "Inicio" }, { label: "Archivo diario" }]} />
      <section className="shell section" aria-labelledby="archivo-title">
        <SectionIntro index="—" eyebrow="Archivo" titleId="archivo-title" title="Lo que se publicó sobre cada día.">
          Una página por cada día en que los modelos corrieron, reconstruida de las tablas donde queda cada corrida:
          el pronóstico de Mazar, la suficiencia y la lectura del día. Si un día se corrió más de una vez, la página
          muestra la última corrida y dice cuántas hubo.
        </SectionIntro>
        {all.length === 0 ? (
          <p className="panel-lede">Aún no hay días archivados.</p>
        ) : (
          <div className="panel tight">
            <Table
              className="days-table"
              caption="Días con corridas publicadas, del más reciente al más antiguo"
              captionHidden
              columns={[
                { label: "Día" },
                { label: "Mazar p50 al último horizonte", numeric: true },
                { label: "Peor nivel de suficiencia" },
                { label: "Lectura", wideOnly: true },
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
                  day.narrative ? "publicada" : day.runs.narrative > 0 ? "rechazada o fallida" : "—",
                ];
              })}
            />
          </div>
        )}
      </section>
    </main>
  );
}
