/**
 * The strip under the headline: the day's supply by source, and the rain and ENSO context the
 * narrative was given. Each tile names the day or window its number describes.
 */

import type { AdequacyDocument, NarrativeDocument } from "../../../lib/site/documents.ts";
import { num, shortDate, signed } from "../../../lib/site/format.ts";
import { monthName } from "../../../lib/site/story.ts";
import type { LatestDocument } from "../../../lib/publish/latest.ts";

const THERMAL = ["generacion_turbinas_gas", "generacion_motores_bunker", "generacion_vapor_bunker", "generacion_turbinas_diesel"];

interface Stat {
  label: string;
  /** A `fill-*` class: the swatch colour. */
  chip: string;
  value: string;
  unit: string;
  note: string;
}

export function Today({
  now,
  adequacy,
  narrative,
}: {
  now: LatestDocument | null;
  adequacy: AdequacyDocument | null;
  narrative: NarrativeDocument | null;
}) {
  const national = now?.national ?? null;
  const stats: Stat[] = [];
  if (national) {
    const gwh = (concept: string) => national.supply_gwh.find((p) => p.concept === concept)?.gwh ?? 0;
    const thermal = THERMAL.reduce((sum, c) => sum + gwh(c), 0);
    const regime = adequacy?.assumptions.import_regime;
    stats.push(
      {
        label: "Hidroeléctrica",
        chip: "fill-water",
        value: num(national.hydro_share_pct, 1),
        unit: "%",
        note: `de la electricidad del ${shortDate(national.date)}: ${num(gwh("generacion_hidraulica"), 1)} GWh`,
      },
      {
        label: "Térmica",
        chip: "fill-t1",
        value: num(national.thermal_share_pct, 1),
        unit: "%",
        note: `búnker, diésel y gas: ${num(thermal, 1)} GWh`,
      },
      {
        label: "Importación",
        chip: "fill-import",
        value: num(national.import_share_pct, 1),
        unit: "%",
        note:
          regime?.state === "cutoff"
            ? `Colombia no está enviando: ${num(regime.trailing_gwh_day, 2)} GWh/día en ${regime.window_days} días`
            : `${num(national.total_import_gwh, 2)} GWh desde Colombia`,
      },
    );
  }
  const rain = narrative?.basis?.precipitation_16d ?? null;
  if (rain) {
    stats.push({
      label: `Lluvia, ${rain.days} días`,
      chip: "fill-water-2",
      value: num(rain.forecast_total_mm, 1),
      unit: "mm",
      note:
        (rain.percentile_vs_climatology !== null ? `percentil ${num(rain.percentile_vs_climatology, 0)} · ` : "") +
        (rain.coordinate_status === "provisional" ? "un punto provisional del Paute" : "cuenca del Paute"),
    });
  }
  const enso = narrative?.basis?.enso ?? null;
  if (enso) {
    const phase = { el_nino: "El Niño", la_nina: "La Niña", neutral: "Neutral" }[enso.phase] ?? enso.phase;
    const earliest = enso.previous?.at(-1) ?? null;
    const trend =
      earliest === null
        ? ""
        : enso.oni > earliest.oni
          ? `, en ascenso desde ${num(earliest.oni, 2)} en ${monthName(earliest.month)}`
          : enso.oni < earliest.oni
            ? `, en descenso desde ${num(earliest.oni, 2)} en ${monthName(earliest.month)}`
            : `, igual que en ${monthName(earliest.month)}`;
    stats.push({
      label: `ENSO · ONI ${monthName(enso.month)}`,
      chip: enso.phase === "el_nino" ? "fill-tight" : enso.phase === "la_nina" ? "fill-water" : "fill-muted",
      value: signed(enso.oni, 1).replace(/^\+/, ""),
      unit: "",
      note: `${phase}${trend}`,
    });
  }
  if (stats.length === 0) return null;

  return (
    <div className="shell">
      <div className={`strip strip-${stats.length}`}>
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <div className="stat-label">
              <span className={`chip ${stat.chip}`} aria-hidden="true" />
              {stat.label}
            </div>
            <div className="stat-value num">
              {stat.value}
              {stat.unit ? <small>{stat.unit}</small> : null}
            </div>
            <div className="stat-note">{stat.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
