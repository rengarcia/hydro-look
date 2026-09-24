/** Section 01: the eight reservoirs on one scale, each linked to its own page. */

import { SectionIntro } from "../Chrome.tsx";
import { Fleet } from "../Fleet.tsx";
import type { LatestDocument } from "../../../lib/publish/latest.ts";

export function Reservoirs({ now }: { now: LatestDocument | null }) {
  if (now === null) return null;
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
          Cada columna va del nivel mínimo al máximo con que CELEC opera el embalse, y se llena hasta el nivel de hoy. Ojo: mide la altura
          del agua, no cuánta agua hay. En Mazar, por ejemplo, el lago es más del doble de grande a 2.150 m que a 2.110 m. Toca una columna
          para ver la ficha del embalse.
          {hatched
            ? " Las columnas rayadas no tienen un rango oficial publicado; su escala va del nivel más bajo al más alto registrado."
            : ""}
        </SectionIntro>
        <div className="legend-stack">
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
      <Fleet reservoirs={now.reservoirs} />
    </section>
  );
}
