/**
 * The strip under the headline: the day so far, the last closed day's supply by source, and the
 * rain and ENSO context the narrative was given. Each tile names the day or window its number
 * describes.
 */

import type { AdequacyDocument, NarrativeDocument } from "../../../lib/site/documents.ts";
import { num, shortDate, signed } from "../../../lib/site/format.ts";
import { monthName } from "../../../lib/site/story.ts";
import { ecWallClock } from "../../../lib/util/dates.ts";
import type { LatestDocument } from "../../../lib/publish/latest.ts";

const THERMAL = ["generacion_turbinas_gas", "generacion_motores_bunker", "generacion_vapor_bunker", "generacion_turbinas_diesel"];

/** Where the rain forecast sits against the same days of past years, in words. */
function rainWords(percentile: number): string {
  if (percentile >= 95) return "de las más altas para estas fechas";
  if (percentile > 60) return "más de lo normal para estas fechas";
  if (percentile >= 40) return "lo normal para estas fechas";
  if (percentile > 5) return "menos de lo normal para estas fechas";
  return "de las más bajas para estas fechas";
}

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
  // CENACE's running total for a day that has not closed yet: the one number on the page that
  // moves between runs. Shown only while it is newer than the closed day, and labelled with the
  // hour it was read, since a share at 08:00 and one at 20:00 describe different mixes.
  const live = now?.live ?? null;
  if (live && live.hydro_share_pct !== null && (national === null || live.date > national.date)) {
    const read = ecWallClock(live.fetched_at);
    stats.push({
      label: read?.date === live.date ? `${shortDate(live.date)}, hasta las ${read.time}` : `${shortDate(live.date)}, en curso`,
      chip: "fill-water",
      value: num(live.hydro_share_pct, 1),
      unit: "%",
      note: `del agua en lo que va del día: ${num(live.hydro_gwh, 1)} de ${num(live.total_production_gwh, 1)} GWh. Cifra preliminar de CENACE, en tiempo real`,
    });
  }
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
        note: `de la electricidad del ${shortDate(national.date)} salió del agua: ${num(gwh("generacion_hidraulica"), 1)} GWh`,
      },
      {
        label: "Térmica",
        chip: "fill-t1",
        value: num(national.thermal_share_pct, 1),
        unit: "%",
        note: `quemando búnker, diésel y gas: ${num(thermal, 1)} GWh`,
      },
      {
        label: "Desde Colombia",
        chip: "fill-import",
        value: num(national.import_share_pct, 1),
        unit: "%",
        note:
          regime?.state === "cutoff"
            ? `Colombia casi no está enviando: ${num(regime.trailing_gwh_day, 2)} GWh/día en los últimos ${regime.window_days} días`
            : `${num(national.total_import_gwh, 2)} GWh comprados a Colombia`,
      },
    );
  }
  const rain = narrative?.basis?.precipitation_16d ?? null;
  if (rain) {
    stats.push({
      label: `Lluvia prevista, ${rain.days} días`,
      chip: "fill-water-2",
      value: num(rain.forecast_total_mm, 1),
      unit: "mm",
      note:
        (rain.percentile_vs_climatology !== null ? `${rainWords(rain.percentile_vs_climatology)} · ` : "") +
        (rain.coordinate_status === "provisional" ? "medida en un punto del Paute" : "cuenca del Paute, sobre Mazar"),
    });
  }
  const enso = narrative?.basis?.enso ?? null;
  if (enso) {
    const phase = { el_nino: "Hay El Niño", la_nina: "Hay La Niña", neutral: "Ni El Niño ni La Niña" }[enso.phase] ?? enso.phase;
    const earliest = enso.previous?.at(-1) ?? null;
    const trend =
      earliest === null
        ? ""
        : enso.oni > earliest.oni
          ? `, más fuerte que en ${monthName(earliest.month)} (${num(earliest.oni, 2)})`
          : enso.oni < earliest.oni
            ? `, más débil que en ${monthName(earliest.month)} (${num(earliest.oni, 2)})`
            : `, igual que en ${monthName(earliest.month)}`;
    stats.push({
      label: `Índice de El Niño · ${monthName(enso.month)}`,
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
