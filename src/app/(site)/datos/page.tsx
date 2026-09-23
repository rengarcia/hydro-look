/**
 * `/datos/`: the documentation of the public data, for whoever wants to build on it.
 *
 * Every file under `/api/`, what it answers, when it changes, and each of its fields with type
 * and unit; the bulk tables; and the promise — what `schema_version` guarantees and what it does
 * not. The field tables are read from the JSON Schemas (`lib/site/schema-doc.ts`), the table list
 * from `data/curated`, the update times from the workflow's own cron lines, so none of it can
 * drift from what is actually published.
 *
 * The page carries schema.org `Dataset` markup, which is what Google Dataset Search indexes.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { Crumbs, MAIN_ID, REPO, SectionIntro } from "../../components/Chrome.tsx";
import { Table } from "../../components/DataTable.tsx";
import { apiDocument, latest } from "../../../lib/site/data.ts";
import type { StatusDocument } from "../../../lib/site/documents.ts";
import { dateWithYear, num } from "../../../lib/site/format.ts";
import { cronTimes, fieldRows, utcToEc } from "../../../lib/site/schema-doc.ts";
import { curatedTables } from "../../../lib/publish/bulk.ts";
import { ATTRIBUTION, DOCUMENTS, LICENSE, SCHEMA_VERSION, SITE_URL, apiUrl, schemaUrl, type DocumentName } from "../../../lib/publish/contract.ts";
import type { Schema } from "../../../lib/publish/schema.ts";

export const metadata: Metadata = {
  title: "Datos abiertos",
  description:
    "Los documentos JSON y las tablas completas de hydro-look: campos, unidades, horarios de actualización, " +
    "esquemas JSON y lo que se promete de ellos.",
  alternates: { canonical: "/datos/" },
  openGraph: { url: "/datos/" },
};

const ROOT = process.cwd();

/** What each document answers, in a sentence, and what writes it. */
const ABOUT: Record<DocumentName, { what: string; writer: string }> = {
  latest: {
    what: "El estado del día: la cota, las bandas, las pendientes y el caudal de cada embalse, el balance nacional del último día cerrado, el cambio desde ayer de cada uno, y el nivel de suficiencia copiado de adequacy.json.",
    writer: "scripts/publish.ts",
  },
  status: {
    what: "Si cada fuente sigue llegando: la última fecha de cada una frente a su límite, el tamaño de cada tabla y los avisos abiertos de las comprobaciones.",
    writer: "scripts/check.ts",
  },
  forecast: {
    what: "La cota de Mazar a 7, 14, 30, 60 y 90 días como p10/p50/p90, los días hasta cada umbral bajo años análogos, y la validación que la puntúa.",
    writer: "scripts/forecast.ts",
  },
  adequacy: {
    what: "El déficit o superávit esperado en GWh/día por horizonte, el nivel de riesgo, los techos que supone y su validación. current.narrative_tier_field dice cuál de sus dos niveles usa la lectura del día.",
    writer: "scripts/adequacy.ts",
  },
  narrative: {
    what: "La lectura del día: el texto que un modelo de lenguaje escribió solo con los números de basis, publicado únicamente si un validador lo aprobó.",
    writer: "scripts/narrative.ts",
  },
};

function schemaOf(name: DocumentName): Schema | null {
  const path = join(ROOT, "public", "api", "schema", `${name}.schema.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Schema) : null;
}

function headerOf(path: string): string[] {
  const text = readFileSync(path, "utf8");
  return (text.split("\n", 1)[0] ?? "").split(",").filter(Boolean);
}

export default function DataPage() {
  const now = latest();
  const status = apiDocument<StatusDocument>("status.json");
  const workflow = join(ROOT, ".github", "workflows", "daily.yml");
  const slots = existsSync(workflow) ? cronTimes(readFileSync(workflow, "utf8")) : [];
  const tables = curatedTables(join(ROOT, "data", "curated"));
  const firstReading = now?.reservoirs.map((r) => r.inflow?.first_reading ?? r.level?.first_reading).filter((d): d is string => !!d).sort()[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "hydro-look: el sistema hidroeléctrico del Ecuador",
    description:
      "Cota y caudal diarios de ocho embalses del Ecuador, energía por central, el balance eléctrico nacional de CENACE, " +
      "un pronóstico de la cota de Mazar y un modelo de suficiencia energética, copiados a diario de los servicios públicos " +
      "de CELEC EP y CENACE, con la respuesta original archivada junto a cada número. No es una fuente oficial.",
    url: `${SITE_URL}/datos/`,
    sameAs: REPO,
    inLanguage: "es",
    isAccessibleForFree: true,
    license: LICENSE.code_url,
    keywords: ["Ecuador", "hidroelectricidad", "embalses", "Mazar", "CELEC", "CENACE", "energía", "balance eléctrico", "racionamiento"],
    creator: { "@type": "Organization", name: "hydro-look", url: REPO },
    spatialCoverage: { "@type": "Place", name: "Ecuador" },
    ...(firstReading && now?.data_date ? { temporalCoverage: `${firstReading}/${now.data_date}` } : {}),
    ...(now?.generated_at ? { dateModified: now.generated_at } : {}),
    variableMeasured: ["cota de embalse (m s. n. m.)", "caudal de entrada (m³/s)", "generación por tipo (GWh)", "importación (GWh)"],
    citation: ATTRIBUTION.map((a) => `${a.name}: ${a.url}`),
    distribution: [
      ...DOCUMENTS.map((name) => ({ "@type": "DataDownload", name: `${name}.json`, encodingFormat: "application/json", contentUrl: apiUrl(name) })),
      ...tables.map((t) => ({
        "@type": "DataDownload",
        name: `${t.table}.csv.gz`,
        encodingFormat: "text/csv",
        contentUrl: `${SITE_URL}/api/bulk/${t.table}.csv.gz`,
      })),
    ],
  };

  return (
    <main id={MAIN_ID} className="stack-lg">
      {/* Serialised by us, from our own constants and documents: nothing user-supplied reaches it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Crumbs trail={[{ href: "/", label: "Inicio" }, { label: "Datos abiertos" }]} />

      <section className="shell section" aria-labelledby="datos-doc-title">
        <SectionIntro index="—" eyebrow="Datos abiertos" titleId="datos-doc-title" title="Todo lo que la página muestra, para usarlo fuera de ella." wide>
          Cinco documentos JSON con el estado del día y los modelos, y cada tabla completa en CSV. Sin clave, sin
          límite y con CORS abierto: se pueden pedir desde cualquier sitio web. Cada número es una copia de lo que
          publicaron CELEC, CENACE, XM, Open-Meteo o la NOAA; cítelos a ellos y a este proyecto.
        </SectionIntro>

        <div className="split even">
          <div className="panel">
            <h2 className="panel-title">Lo que se promete</h2>
            <ul className="promise">
              <li>
                <strong>schema_version</strong> ({SCHEMA_VERSION} hoy) es la versión del formato, no de un modelo. Solo cambia
                cuando se quita, se renombra o cambia de tipo un campo. Añadir un campo no la cambia: un lector debe
                ignorar los campos que no conoce.
              </li>
              <li>
                Cada documento se valida en cada cambio contra su <a href="#esquemas">esquema JSON</a>; un cambio de forma
                es una prueba que falla antes de ser un lector roto.
              </li>
              <li>
                <strong>data_date</strong> es la misma fecha en todos: el día de Ecuador que describen las lecturas del
                documento. En los modelos es igual a origin_date, el día sobre el que se paran.
              </li>
              <li>
                Los códigos son palabras en inglés estables (<code>ords_levels</code>, <code>report_endpoint</code>,{" "}
                <code>watch</code>); junto a cada uno va su etiqueta en español (<code>label_es</code>,{" "}
                <code>declaration_es</code>, <code>tier_label_es</code>).
              </li>
              <li>
                Un campo que se va a quitar se anuncia en el bloque <code>deprecated</code> del documento y se mantiene una
                versión. Hoy: <code>as_of</code> en latest.json y status.json (use data_date) y{" "}
                <code>feeds[].feed</code> en status.json (use id y label_es). El campo <code>tier</code> de la suficiencia
                conserva la palabra del modelo; el código estable es <code>tier_code</code>.
              </li>
              <li>Lo que no se promete: que un modelo no cambie. Cada documento dice qué modelo y qué versión lo produjo.</li>
            </ul>
          </div>
          <div className="panel">
            <h2 className="panel-title">Cuándo cambian</h2>
            <p className="panel-lede">
              {slots.length > 0 ? (
                <>
                  El trabajo diario está programado a las {slots.map((t) => `${t} UTC (${utcToEc(t)} en Ecuador)`).join(" y a las ")}.
                  GitHub suele empezarlo con retraso, a veces de horas, así que la hora real de cada documento es su{" "}
                  <code>generated_at</code>.
                </>
              ) : (
                <>La hora de cada documento es su <code>generated_at</code>.</>
              )}{" "}
              Las cotas de CELEC llegan la mañana siguiente al día que describen, y el balance de CENACE cierra el día
              anterior hacia las 11:15 de Ecuador, así que data_date suele ser ayer. La lectura del día se genera después
              de los modelos y puede quedarse un día atrás; lo dice su propia fecha.
            </p>
            <p className="panel-lede spaced">
              Los documentos se sirven con <code>Access-Control-Allow-Origin: *</code> y una caché de cinco minutos.{" "}
              {status ? `La última comprobación, del ${dateWithYear(status.generated_at.slice(0, 10))}, vio ${status.feeds.filter((f) => f.state === "current").length} de ${status.feeds.length} fuentes al día.` : ""}
            </p>
            <p className="panel-lede spaced">
              Licencia: código {LICENSE.code}. Datos: {ATTRIBUTION.map((a) => `${a.name} (${a.terms_es})`).join("; ")}.
            </p>
          </div>
        </div>
      </section>

      <section className="shell section" aria-labelledby="documentos-title" id="documentos">
        <h2 id="documentos-title" className="section-title">
          Los documentos
        </h2>
        {DOCUMENTS.map((name) => {
          const schema = schemaOf(name);
          const rows = schema ? fieldRows(schema) : [];
          return (
            <article className="panel doc" key={name} id={name} aria-labelledby={`${name}-title`}>
              <div className="panel-head">
                <h3 id={`${name}-title`} className="doc-title">
                  <a href={`/api/${name}.json`}>/api/{name}.json</a>
                </h3>
                <span className="meta">
                  <a href={schemaUrl(name).replace(SITE_URL, "")}>esquema</a> · lo escribe {ABOUT[name].writer}
                </span>
              </div>
              <p className="panel-lede">{ABOUT[name].what}</p>
              {rows.length > 0 ? (
                <details className="chart-data">
                  <summary>Los {rows.length} campos</summary>
                  <div className="table-scroll">
                    <Table
                      className="fields-table"
                      caption={`Campos de ${name}.json, con su tipo y su unidad`}
                      columns={[{ label: "Campo" }, { label: "Tipo" }, { label: "Unidad" }, { label: "Siempre" }, { label: "Descripción (del esquema)" }]}
                      rows={rows.map((r) => [
                        <code key="p" className={r.deprecated ? "deprecated" : undefined}>
                          {r.path}
                        </code>,
                        r.type,
                        r.unit ?? "",
                        r.required ? "sí" : "no",
                        r.description ? (
                          <span key="d" lang="en">
                            {r.deprecated ? "Deprecated. " : ""}
                            {r.description}
                          </span>
                        ) : (
                          ""
                        ),
                      ])}
                    />
                  </div>
                </details>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="shell section" aria-labelledby="tablas-title" id="tablas">
        <h2 id="tablas-title" className="section-title">
          Las tablas completas
        </h2>
        <p className="section-lede">
          Cada tabla del repositorio en un solo CSV comprimido con gzip, de su primer día al último, reconstruido en
          cada publicación del sitio: la cabecera una vez y cada fila exactamente como está en{" "}
          <a href={`${REPO}/tree/main/data/curated`}>data/curated</a>, donde se guardan partidas por año. La lista con
          filas y columnas, en <a href="/api/bulk/index.json">/api/bulk/index.json</a>.
        </p>
        <div className="panel tight">
          <div className="table-scroll">
            <Table
              className="bulk-table"
              caption="Tablas completas descargables"
              captionHidden
              columns={[{ label: "Archivo" }, { label: "Filas", numeric: true }, { label: "Columnas", wideOnly: true }]}
              rows={tables.map((t) => [
                <a key="f" href={`/api/bulk/${t.table}.csv.gz`}>
                  {t.table}.csv.gz
                </a>,
                status?.tables[t.table] ? num(status.tables[t.table]!.rows, 0) : "—",
                <code key="c" className="columns">
                  {headerOf(t.paths[0]!).join(", ")}
                </code>,
              ])}
            />
          </div>
        </div>
      </section>

      <section className="shell section" aria-labelledby="esquemas-title" id="esquemas">
        <h2 id="esquemas-title" className="section-title">
          Esquemas JSON
        </h2>
        <p className="section-lede">
          Un esquema JSON (draft 2020-12) por documento, el mismo contra el que se prueba cada cambio:{" "}
          {DOCUMENTS.map((name, i) => (
            <span key={name}>
              {i > 0 ? ", " : ""}
              <a href={`/api/schema/${name}.schema.json`}>{name}.schema.json</a>
            </span>
          ))}
          . También hay un <a href="/feed.xml">feed Atom</a> de la lectura del día y un <a href="/dia/">archivo</a> con lo que
          se publicó sobre cada día.
        </p>
      </section>
    </main>
  );
}
