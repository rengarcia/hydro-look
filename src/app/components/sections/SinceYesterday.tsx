/**
 * "Desde ayer": what moved between the day before and the day the page describes.
 *
 * Built from the `previous` and `delta_1d` fields `latest.json` carries, so a reader of the page
 * and a consumer of the API see the same changes. A change is only shown against the calendar
 * day before: when a feed skipped a day there is no "yesterday" to compare with, and the item
 * says so rather than comparing with whatever came last.
 *
 * Each card says where the number stood yesterday and one line of context the same document
 * carries: the week's pace for the level, the usual flow for the date, the rest of the mix. Under
 * the cards every reservoir gets its own change, linked to its page.
 */

import { dateWithYear, num } from "../../../lib/site/format.ts";
import { reservoirHref } from "../../../lib/site/data.ts";
import { ARROW, changeWord, inflowWords, paceWords } from "../../../lib/site/story.ts";
import type { LatestDocument } from "../../../lib/publish/latest.ts";

interface Change {
  label: string;
  now: string;
  yesterday: string | null;
  /** The signed number alone, or "sin cambio"; null when there is no calendar day before. */
  change: string | null;
  unit: string;
  /** `up`, `down` or `flat`, for the colour of the change. */
  sign: "up" | "down" | "flat";
  /** One line of context from the same document, or null when it has none. */
  context: string | null;
}

function signOf(delta: number | null | undefined, digits: number): Change["sign"] {
  if (delta === null || delta === undefined) return "flat";
  const rounded = Number(delta.toFixed(digits));
  return rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
}

/** The change set large: arrow and number together, the unit smaller beside them. */
function ChangeValue({ change, unit, sign }: { change: string | null; unit: string; sign: Change["sign"] }) {
  if (change === null) return "—";
  return (
    <>
      <span className="since-value">
        {sign === "flat" ? null : (
          <span className="since-arrow" aria-hidden="true">
            {ARROW[sign]}
          </span>
        )}
        {change}
      </span>
      {sign === "flat" ? null : <small> {unit}</small>}
    </>
  );
}

export function SinceYesterday({ now }: { now: LatestDocument | null }) {
  if (now === null) return null;
  const changes: Change[] = [];
  const mazar = now.reservoirs.find((r) => r.site === "mazar");
  if (mazar?.level) {
    changes.push({
      label: "Nivel de Mazar",
      now: `${num(mazar.level.masl, 2)} m`,
      yesterday: mazar.level.previous ? `${num(mazar.level.previous.masl, 2)} m` : null,
      change: changeWord(mazar.level.delta_1d_m, 2, ""),
      unit: "m",
      sign: signOf(mazar.level.delta_1d_m, 2),
      context: paceWords(mazar.level.delta_1d_m, mazar.slopes_m_per_day.d7),
    });
  }
  if (mazar?.inflow) {
    const usual = mazar.inflow.climatology;
    const words = inflowWords(usual?.percentile_today);
    changes.push({
      label: "Agua que llega a Mazar",
      now: `${num(mazar.inflow.m3s, 1)} m³/s`,
      yesterday: mazar.inflow.previous ? `${num(mazar.inflow.previous.m3s, 1)} m³/s` : null,
      change: changeWord(mazar.inflow.delta_1d_m3s, 1, ""),
      unit: "m³/s",
      sign: signOf(mazar.inflow.delta_1d_m3s, 1),
      context: words && usual ? `Trae ${words} (lo usual: ${num(usual.p50, 1)} m³/s)` : null,
    });
  }
  const national = now.national;
  if (national) {
    const thermal = changeWord(national.delta_1d?.thermal_share_pct_points, 1, "puntos");
    const imports = changeWord(national.delta_1d?.import_share_pct_points, 1, "puntos");
    const previous = national.previous;
    changes.push(
      {
        label: "Electricidad del agua",
        now: `${num(national.hydro_share_pct, 1)} %`,
        yesterday: previous?.hydro_share_pct != null ? `${num(previous.hydro_share_pct, 1)} %` : null,
        change: changeWord(national.delta_1d?.hydro_share_pct_points, 1, ""),
        unit: "puntos",
        sign: signOf(national.delta_1d?.hydro_share_pct_points, 1),
        context: thermal && imports ? `Térmica ${thermal} · Colombia ${imports}` : null,
      },
      {
        label: "Electricidad generada",
        now: `${num(national.total_generation_gwh, 1)} GWh`,
        yesterday: previous?.total_generation_gwh != null ? `${num(previous.total_generation_gwh, 1)} GWh` : null,
        change: changeWord(national.delta_1d?.total_generation_gwh, 1, ""),
        unit: "GWh",
        sign: signOf(national.delta_1d?.total_generation_gwh, 1),
        context:
          national.distribution_demand_gwh != null
            ? `Demanda de las distribuidoras: ${num(national.distribution_demand_gwh, 1)} GWh`
            : null,
      },
    );
  }
  if (changes.length === 0) return null;
  const levels = now.reservoirs.map((r) => ({
    site: r.site,
    label: r.label,
    masl: r.level?.masl ?? null,
    change: changeWord(r.level?.delta_1d_m, 2, ""),
    sign: signOf(r.level?.delta_1d_m, 2),
  }));
  const rising = levels.filter((l) => l.change !== null && l.sign === "up").length;
  const falling = levels.filter((l) => l.change !== null && l.sign === "down").length;
  const from = mazar?.level?.previous?.date ?? national?.previous?.date ?? null;
  const to = mazar?.level?.date ?? national?.date ?? null;

  return (
    <section className="shell since" aria-labelledby="desde-ayer-title">
      <div className="since-panel">
        <div className="since-head">
          <div className="since-heading">
            <p className="eyebrow">Día a día</p>
            <h2 id="desde-ayer-title" className="since-title">
              Desde ayer
            </h2>
          </div>
          {from && to ? (
            <p className="since-dates meta">
              {dateWithYear(from)} → {dateWithYear(to)}
            </p>
          ) : null}
        </div>
        <ul className="since-list">
          {changes.map((c) => (
            <li className="since-item" key={c.label}>
              <span className="since-label">{c.label}</span>
              <span className={`since-change num since-${c.change === null ? "none" : c.sign}`}>
                <ChangeValue change={c.change} unit={c.unit} sign={c.sign} />
              </span>
              <span className="since-now">
                {c.change === null ? "sin dato de ayer · " : ""}hoy <span className="num">{c.now}</span>
                {c.yesterday ? (
                  <>
                    {" "}
                    · ayer <span className="num">{c.yesterday}</span>
                  </>
                ) : null}
              </span>
              {c.context ? <span className="since-context">{c.context}</span> : null}
            </li>
          ))}
        </ul>
        <div className="since-fleet">
          <p className="since-fleet-head">
            <span className="since-label">Embalses, uno por uno</span>
            <span className="since-fleet-count">
              {rising} {rising === 1 ? "sube" : "suben"} · {falling} {falling === 1 ? "baja" : "bajan"} · de {levels.length}
            </span>
          </p>
          <ul className="since-fleet-list">
            {levels.map((l) => (
              <li key={l.site}>
                <a className="since-fleet-item" href={reservoirHref(l.site)}>
                  <span className="since-fleet-name">{l.label}</span>
                  <span className={`since-fleet-change num since-${l.change === null ? "none" : l.sign}`}>
                    <ChangeValue change={l.change} unit="m" sign={l.sign} />
                  </span>
                  <span className="since-fleet-level num">{l.masl === null ? "sin lectura" : `${num(l.masl, 2)} m`}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
