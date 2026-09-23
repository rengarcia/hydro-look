/**
 * The page of every reservoir other than Mazar, from one template.
 *
 * Each has a level, its declared bands (or none), its slopes and a year of inflow against its own
 * climatology in `latest.json` and the curated tables. None has a level forecast; where
 * `forecast.json` carries an inflow forecast for the plant (§5.3), the page shows every horizon with
 * its backtest, published or not, and why not. Mazar's page is its own file because it carries the
 * forecast; `generateStaticParams` leaves it out, and the static folder wins over this one.
 *
 * `dynamicParams = false` makes the list closed: in a static export there is no server to render
 * a reservoir that was not in `latest.json` at build time, so an unknown one is a 404.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crumbs, MAIN_ID } from "../../../components/Chrome.tsx";
import { InflowPanel } from "../../../components/ReservoirParts.tsx";
import { InflowForecastPanel, inflowPlantOf } from "../../../components/InflowForecast.tsx";
import { FloorsPanel, RecordSection, ReservoirHero } from "../../../components/ReservoirPage.tsx";
import { apiDocument, latest } from "../../../../lib/site/data.ts";
import type { ForecastDocument } from "../../../../lib/site/documents.ts";
import { basinLabel, num } from "../../../../lib/site/format.ts";
import type { ReservoirSnapshot } from "../../../../lib/publish/latest.ts";

export const dynamicParams = false;

export function generateStaticParams(): { site: string }[] {
  return (latest()?.reservoirs ?? []).filter((r) => r.site !== "mazar" && r.level !== null).map((r) => ({ site: r.site }));
}

function reservoirOf(site: string): ReservoirSnapshot | null {
  return latest()?.reservoirs.find((r) => r.site === site) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const { site } = await params;
  const reservoir = reservoirOf(site);
  if (reservoir === null) return {};
  const path = `/embalses/${site}/`;
  return {
    title: reservoir.label,
    description:
      `Cota, bandas declaradas, pendientes y caudal frente a su historia del embalse ${reservoir.label} ` +
      `(${basinLabel(reservoir.basin)})${reservoir.level ? `: ${num(reservoir.level.masl, 2)} m el ${reservoir.level.date}` : ""}. ` +
      "No es una fuente oficial.",
    alternates: { canonical: path },
    openGraph: { url: path },
  };
}

/**
 * What the reservoir is, in a sentence, from what the data can support and nothing more: whether
 * a band is declared for it, and — for Amaluza — its place in the Paute cascade below Mazar.
 */
function ledeOf(reservoir: ReservoirSnapshot): string {
  if (reservoir.site === "amaluza") {
    return "El embalse de la central Molino, aguas abajo de Mazar en la cascada del Paute: lo que Mazar descarga llega aquí.";
  }
  if (reservoir.bands.length === 0) {
    return "Ninguna fuente le declara una banda de operación, así que su escala es el rango que este repositorio ha registrado.";
  }
  return "CELEC le declara una banda de operación, y su cota se lee dentro de ella: metros de carga útil, no agua almacenada.";
}

export default async function ReservoirPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const reservoir = reservoirOf(site);
  if (reservoir === null) notFound();
  const inflowForecasts = apiDocument<ForecastDocument>("forecast.json")?.inflow_forecasts;
  const plant = inflowPlantOf(inflowForecasts, site);
  const publishes = plant?.horizons.some((h) => h.published) ?? false;

  return (
    <main id={MAIN_ID} className="stack-lg">
      <Crumbs trail={[{ href: "/", label: "Inicio" }, { href: "/#embalses", label: "Embalses" }, { label: reservoir.label }]} />
      <ReservoirHero reservoir={reservoir} forecast={null} lede={ledeOf(reservoir)} />
      <RecordSection reservoir={reservoir} forecast={null} />
      <section className="shell split lean-left" aria-label="Caudal y bandas declaradas">
        <InflowPanel reservoir={reservoir} heading="Caudal frente a su historia" />
        <FloorsPanel reservoir={reservoir} />
      </section>
      {plant ? (
        <section className="shell" aria-label="Pronóstico de caudal de entrada">
          <InflowForecastPanel plant={plant} report={inflowForecasts?.report} label={reservoir.label} />
        </section>
      ) : null}
      <div className="shell">
        <p className="fine">
          Solo Mazar tiene pronóstico de cota: es el único embalse con semanas de reserva.
          {plant
            ? publishes
              ? ` De ${reservoir.label} se pronostica el caudal de entrada, en /api/forecast.json.`
              : ` De ${reservoir.label} se prueba un pronóstico de caudal de entrada, que hoy no se publica.`
            : ""}{" "}
          Para insertar esta ficha en otra página, <a href={`/embed/${site}/`}>/embed/{site}/</a>; sus números, en{" "}
          <a href="/api/latest.json">/api/latest.json</a>.
        </p>
      </div>
      <div className="shell footer-bar flush">
        <a href="/" className="btn btn-ghost">
          ← Volver al inicio
        </a>
      </div>
    </main>
  );
}
