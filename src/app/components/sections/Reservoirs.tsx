/** Section 01: the eight reservoirs on one scale, each linked to its own page. */

import { SectionIntro } from "../Chrome.tsx";
import { Fleet } from "../Fleet.tsx";
import type { LatestDocument } from "../../../lib/publish/latest.ts";
import type { ForecastDocument } from "../../../lib/site/documents.ts";
import { referenceTable } from "../../../lib/site/data.ts";
import { GEOMETRY_FILE, geometryFrom, type Geometry } from "../../../lib/site/geometry.ts";
import { isAreaCurve } from "../../../lib/site/shape.ts";

/** Each reservoir's geometry: the design table, with the forecast's fitted curve where one was published. */
export function fleetGeometry(forecast: ForecastDocument | null, rows = referenceTable(GEOMETRY_FILE)): Geometry {
  const curve = forecast?.reservoir?.area_elevation;
  return geometryFrom(rows, forecast && isAreaCurve(curve) ? { [forecast.site]: curve } : {});
}

export function Reservoirs({ now, forecast = null }: { now: LatestDocument | null; forecast?: ForecastDocument | null }) {
  if (now === null) return null;
  const geometry = fleetGeometry(forecast);
  const shaped = now.reservoirs.filter((r) => r.level !== null && geometry[r.site]?.curve).map((r) => r.label);
  const mazar = now.reservoirs.find((r) => r.site === "mazar");
  const count = now.reservoirs.filter((r) => r.level !== null).length;
  const hatched = now.reservoirs.some((r) => r.level !== null && r.bands.length === 0);
  const example = Math.round(mazar?.inflow?.climatology?.percentile_today ?? 50);
  return (
    <section id="embalses" className="shell section" aria-labelledby="embalses-title">
      <div className="section-head">
        <SectionIntro
          index="01"
          eyebrow="Embalses"
          titleId="embalses-title"
          title={`${count === 8 ? "Ocho" : count} embalses: ¿a qué altura está el agua hoy?`}
        >
          Cada columna va del nivel mínimo al máximo con que CELEC opera el embalse, y se llena hasta el nivel de hoy.
          {shaped.length > 0
            ? ` ${listEs(shaped)} ${shaped.length === 1 ? "tiene" : "tienen"} la forma de su embalse: a cada altura la columna es tan ancha como el lago, así que lo pintado es el agua guardada y el porcentaje es de agua, no de metros. La forma de Mazar se ajusta a sus propias lecturas; la de las demás sale de los volúmenes de diseño que publica CELEC, y vale para el porcentaje más que para los hectómetros cúbicos, porque los sedimentos se han llevado parte del volumen. Las columnas rectas son embalses demasiado pequeños para medir su forma, o una cámara que no es embalse: miden la altura del agua, no cuánta hay.`
            : " Ojo: mide la altura del agua, no cuánta agua hay. En Mazar, por ejemplo, el lago es más del doble de grande a 2.150 m que a 2.110 m."}{" "}
          Toca una columna para ver la ficha del embalse.
          {hatched
            ? " Las columnas rayadas no tienen un rango oficial publicado; su escala va del nivel más bajo al más alto registrado."
            : ""}
        </SectionIntro>
        <div className="legend-stack">
          {shaped.length > 0 ? (
            <div>
              <span className="key-shape" aria-hidden="true" />
              ancho = tamaño del lago a esa altura
            </div>
          ) : null}
          {now.reservoirs.some((r) => geometry[r.site]?.spillMasl != null) ? (
            <div>
              <span className="key-spill" aria-hidden="true" />
              nivel desde el que vierte (Sopladora)
            </div>
          ) : null}
          <div>
            <span className="key-floor" aria-hidden="true" />
            otro nivel mínimo que publica CELEC
          </div>
          {hatched ? (
            <div>
              <span className="key-hatch" aria-hidden="true" />
              sin rango oficial
            </div>
          ) : null}
          <div>
            <span className="key-p" aria-hidden="true">
              p{example}
            </span>
            agua que llega hoy frente a otros años (50 = lo normal; menos, más seco)
          </div>
          <div>
            <span className="key-p" aria-hidden="true">
              m/d
            </span>
            metros que sube o baja al día (promedio de la última semana)
          </div>
        </div>
      </div>
      <Fleet reservoirs={now.reservoirs} geometry={geometry} />
    </section>
  );
}

/** `Mazar, Amaluza y Agoyán`. */
function listEs(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}
