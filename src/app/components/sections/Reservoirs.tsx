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
          title={`${count === 8 ? "Ocho" : count} embalses, una misma escala: metros de carga útil.`}
        >
          Cada columna va del mínimo declarado a la cresta de su banda y se llena hasta la cota de hoy. Mide metros, no
          agua almacenada: la superficie de Mazar más que se duplica entre los 2.110 y los 2.150 m. Cada una lleva a la
          ficha del embalse.
          {hatched ? " Las columnas rayadas no tienen banda publicada en ninguna fuente; su escala es el rango registrado." : ""}
        </SectionIntro>
        <div className="legend-stack">
          <div>
            <span className="key-floor" aria-hidden="true" />
            otro mínimo declarado por CELEC
          </div>
          {hatched ? (
            <div>
              <span className="key-hatch" aria-hidden="true" />
              sin banda declarada
            </div>
          ) : null}
          <div>
            <span className="key-p" aria-hidden="true">
              p{example}
            </span>
            percentil del caudal de hoy frente a su historia
          </div>
          <div>
            <span className="key-p" aria-hidden="true">
              m/d
            </span>
            metros por día, pendiente de 7 días
          </div>
        </div>
      </div>
      <Fleet reservoirs={now.reservoirs} />
    </section>
  );
}
