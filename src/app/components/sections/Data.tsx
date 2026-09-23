/**
 * Whether the day's numbers can be trusted — each feed with the last day it published — and
 * where to take them: the JSON documents, the bulk tables and the documentation of both.
 */

import { REPO } from "../Chrome.tsx";
import type { StatusDocument } from "../../../lib/site/documents.ts";
import { feedLabel, findingText, shortDate } from "../../../lib/site/format.ts";

const FRESHNESS: Record<string, { word: string; tone: string }> = {
  current: { word: "al día", tone: "good" },
  stale: { word: "detenida", tone: "deficit" },
  not_ingested: { word: "sin datos", tone: "watch" },
};

export function Data({ status, narrative }: { status: StatusDocument | null; narrative: boolean }) {
  const downloads = [
    { path: "/api/latest.json", what: "Embalses y balance del día, con el cambio desde ayer" },
    { path: "/api/forecast.json", what: "Pronóstico de Mazar y su validación" },
    { path: "/api/adequacy.json", what: "Suficiencia por horizonte" },
    ...(narrative ? [{ path: "/api/narrative.json", what: "La lectura del día y lo que recibió el modelo" }] : []),
    { path: "/api/status.json", what: "Frescura y comprobaciones" },
  ];
  const current = status?.feeds.filter((f) => f.state === "current").length ?? 0;
  const total = status?.feeds.length ?? 0;
  const overall = total === 0 ? "muted" : current === total ? "good" : status?.feeds.some((f) => f.state === "stale") ? "deficit" : "watch";

  return (
    <section id="datos" className="shell section split even" aria-labelledby="datos-title">
      {status ? (
        <div className="panel">
          <div className="panel-head centred">
            <h2 id="datos-title" className="panel-title">
              ¿Se puede confiar hoy?
            </h2>
            <span className="pill">
              <span className={`dot tone-${overall}`} aria-hidden="true" />
              {current} de {total} al día
            </span>
          </div>
          <p className="panel-lede">
            Cada fuente, con la última fecha que publicó. El límite de cada una es su retraso de publicación más margen
            para una ejecución fallida: el ONI siempre tiene unos dos meses.
            {status.findings.length > 0
              ? ` ${status.findings.length === 1 ? "Un aviso abierto" : `${status.findings.length} avisos abiertos`}: ${status.findings.map(findingText).join(" · ")}.`
              : ""}
          </p>
          <ul className="feeds">
            {status.feeds.map((feed) => {
              const state = FRESHNESS[feed.state] ?? { word: feed.state, tone: "watch" };
              return (
                <li key={feed.id ?? feed.feed}>
                  <span>
                    <span className={`dot tone-${state.tone}`} aria-hidden="true" />
                    {feedLabel(feed)}
                    <span className="visually-hidden">
                      : {state.word}, límite {feed.limit_days} días
                    </span>
                  </span>
                  <span className="when">{feed.latest ? shortDate(feed.latest) : "—"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="downloads">
        <h2 className="panel-title" id={status ? undefined : "datos-title"}>
          Llévate los datos
        </h2>
        <p className="panel-lede">
          JSON abiertos, actualizados cada día, con la respuesta original archivada junto a cada número. Sus campos,
          unidades y lo que se promete de ellos, en <a href="/datos/">la documentación</a>.
        </p>
        {downloads.map((d) => (
          <a key={d.path} href={d.path} className="download lift">
            <span>
              <span className="path">{d.path}</span>
              <span className="what">{d.what}</span>
            </span>
            <span className="go" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
        <a href="/datos/#tablas" className="download lift">
          <span>
            <span className="path">/api/bulk/</span>
            <span className="what">Cada tabla completa, de su primer día al último, en un CSV comprimido</span>
          </span>
          <span className="go" aria-hidden="true">
            ↗
          </span>
        </a>
        <p className="fine">
          También: <a href="/dia/">el archivo de cada día</a>, <a href="/feed.xml">la lectura del día en Atom</a> y{" "}
          <a href={`${REPO}/tree/main/data/curated`}>las tablas en el repositorio</a>.
        </p>
      </div>
    </section>
  );
}
