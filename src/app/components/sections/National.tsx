/** Section 04: where yesterday's electricity came from, and the six months behind it. */

import { SectionIntro } from "../Chrome.tsx";
import { MixChart, mixClass } from "../MixChart.tsx";
import { Table } from "../DataTable.tsx";
import { mix } from "../../../lib/site/data.ts";
import { conceptLabel, dateWithYear, longDate, num, pct } from "../../../lib/site/format.ts";
import type { LatestDocument } from "../../../lib/publish/latest.ts";

/** Days of the national mix on its chart. */
const MIX_DAYS = 180;

export function National({ now }: { now: LatestDocument | null }) {
  const days = mix(MIX_DAYS);
  const national = now?.national ?? null;
  if (days.length < 2 || national === null) return null;
  const supply = (national.total_generation_gwh ?? 0) + (national.total_import_gwh ?? 0);
  const parts = national.supply_gwh;

  return (
    <section id="balance" className="section section-tight" aria-labelledby="balance-title">
      <SectionIntro index="04" eyebrow="Balance nacional" titleId="balance-title" title="De dónde salió la electricidad.">
        El balance que CENACE cierra cada mañana para el día anterior, en GWh. Los porcentajes van sobre generación
        más importación: un kWh importado alumbra igual que uno generado.
      </SectionIntro>
      <div className="panel tight">
        <div className="supply-head">
          <div className="supply-caption">
            <span>
              {dateWithYear(national.date)} · {num(supply, 1)} GWh de suministro
            </span>
            <span className="meta">demanda de distribución {num(national.distribution_demand_gwh, 1)} GWh</span>
          </div>
          <div
            className="supply"
            role="img"
            aria-label={`Suministro del ${longDate(national.date)}: hidroeléctrica ${pct(national.hydro_share_pct, 1)}, térmica ${pct(national.thermal_share_pct, 1)}, importación ${pct(national.import_share_pct, 1)}.`}
          >
            {parts.map((p) => (
              <span key={p.concept} className={mixClass(p.concept)} style={{ width: `${p.pct.toFixed(2)}%` }} title={`${conceptLabel(p.concept)}: ${pct(p.pct, 1)}`} />
            ))}
          </div>
        </div>
        <MixChart days={days} label={`Generación diaria del Ecuador por tipo e importación, últimos ${MIX_DAYS} días, en GWh`} />
        <Table
          className="mix-table"
          caption={`Suministro del ${longDate(national.date)} por fuente`}
          captionHidden
          columns={[{ label: "Fuente" }, { label: "GWh", numeric: true }, { label: "Parte", numeric: true }]}
          rows={parts.map((p) => [
            <span key="name" className="mix-name">
              <span className={`swatch ${mixClass(p.concept)}`} aria-hidden="true" />
              {conceptLabel(p.concept)}
            </span>,
            num(p.gwh, 2),
            pct(p.pct, 1),
          ])}
        />
      </div>
    </section>
  );
}
