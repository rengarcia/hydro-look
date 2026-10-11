/** Section 01: the eight reservoirs on one scale, each linked to its own page. */

import { SectionIntro } from "../Chrome.tsx";
import { Fleet, type ShapeCurves } from "../Fleet.tsx";
import type { LatestDocument } from "../../../lib/publish/latest.ts";
import type { ForecastDocument } from "../../../lib/site/documents.ts";
import { isAreaCurve } from "../../../lib/site/shape.ts";

/** The area-elevation curves the run published: today only the forecast site's. */
export function shapeCurves(forecast: ForecastDocument | null): ShapeCurves {
  const curve = forecast?.reservoir?.area_elevation;
  return forecast && isAreaCurve(curve) ? { [forecast.site]: curve } : {};
}

export function Reservoirs({ now, forecast = null }: { now: LatestDocument | null; forecast?: ForecastDocument | null }) {
  if (now === null) return null;
  const shapes = shapeCurves(forecast);
  const shapedMazar = shapes.mazar !== undefined && mazarDeclared(now);
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
          {shapedMazar
            ? " La de Mazar tiene la forma de su embalse: a cada altura es tan ancha como el lago, así que lo pintado es el agua guardada, y su porcentaje es de agua, no de metros. Las demás son rectas porque nadie ha medido su forma: miden la altura del agua, no cuánta hay."
            : " Ojo: mide la altura del agua, no cuánta agua hay. En Mazar, por ejemplo, el lago es más del doble de grande a 2.150 m que a 2.110 m."}{" "}
          Toca una columna para ver la ficha del embalse.
          {hatched
            ? " Las columnas rayadas no tienen un rango oficial publicado; su escala va del nivel más bajo al más alto registrado."
            : ""}
        </SectionIntro>
        <div className="legend-stack">
          {shapedMazar ? (
            <div>
              <span className="key-shape" aria-hidden="true" />
              ancho = tamaño del lago a esa altura
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
      <Fleet reservoirs={now.reservoirs} shapes={shapes} />
    </section>
  );
}

function mazarDeclared(now: LatestDocument): boolean {
  const mazar = now.reservoirs.find((r) => r.site === "mazar");
  return mazar !== undefined && mazar.level !== null && mazar.bands.length > 0;
}
