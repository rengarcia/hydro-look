/**
 * "Desde ayer": what moved between the day before and the day the page describes.
 *
 * Built from the `previous` and `delta_1d` fields `latest.json` carries, so a reader of the page
 * and a consumer of the API see the same changes. A change is only shown against the calendar
 * day before: when a feed skipped a day there is no "yesterday" to compare with, and the item
 * says so rather than comparing with whatever came last.
 */

import { dateWithYear, num } from "../../../lib/site/format.ts";
import { changeWord } from "../../../lib/site/story.ts";
import type { LatestDocument } from "../../../lib/publish/latest.ts";

interface Change {
  label: string;
  now: string;
  /** The signed number alone, or "sin cambio"; null when there is no calendar day before. */
  change: string | null;
  unit: string;
  /** `up`, `down` or `flat`, for the colour of the change. */
  sign: "up" | "down" | "flat";
}

const ARROW: Record<Change["sign"], string> = { up: "↑", down: "↓", flat: "=" };
const TONE: Record<Change["sign"], string> = { up: "tone-water", down: "tone-tight", flat: "tone-muted" };

function signOf(delta: number | null | undefined, digits: number): Change["sign"] {
  if (delta === null || delta === undefined) return "flat";
  const rounded = Number(delta.toFixed(digits));
  return rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
}

export function SinceYesterday({ now }: { now: LatestDocument | null }) {
  if (now === null) return null;
  const changes: Change[] = [];
  const mazar = now.reservoirs.find((r) => r.site === "mazar");
  if (mazar?.level) {
    changes.push({
      label: "Nivel de Mazar",
      now: `${num(mazar.level.masl, 2)} m`,
      change: changeWord(mazar.level.delta_1d_m, 2, ""),
      unit: "m",
      sign: signOf(mazar.level.delta_1d_m, 2),
    });
  }
  if (mazar?.inflow) {
    changes.push({
      label: "Agua que llega a Mazar",
      now: `${num(mazar.inflow.m3s, 1)} m³/s`,
      change: changeWord(mazar.inflow.delta_1d_m3s, 1, ""),
      unit: "m³/s",
      sign: signOf(mazar.inflow.delta_1d_m3s, 1),
    });
  }
  const national = now.national;
  if (national) {
    changes.push(
      {
        label: "Electricidad del agua",
        now: `${num(national.hydro_share_pct, 1)} %`,
        change: changeWord(national.delta_1d?.hydro_share_pct_points, 1, ""),
        unit: "puntos",
        sign: signOf(national.delta_1d?.hydro_share_pct_points, 1),
      },
      {
        label: "Electricidad generada",
        now: `${num(national.total_generation_gwh, 1)} GWh`,
        change: changeWord(national.delta_1d?.total_generation_gwh, 1, ""),
        unit: "GWh",
        sign: signOf(national.delta_1d?.total_generation_gwh, 1),
      },
    );
  }
  if (changes.length === 0) return null;
  const directions = now.reservoirs.map((r) => ({
    site: r.site,
    sign: r.level?.delta_1d_m == null ? null : signOf(r.level.delta_1d_m, 2),
  }));
  const rising = directions.filter((d) => d.sign === "up").length;
  const falling = directions.filter((d) => d.sign === "down").length;
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
                {c.change === null ? (
                  "—"
                ) : (
                  <>
                    <span className="since-value">
                      <span className="since-arrow" aria-hidden="true">
                        {ARROW[c.sign]}
                      </span>
                      {c.change}
                    </span>
                    {c.sign === "flat" ? null : <small> {c.unit}</small>}
                  </>
                )}
              </span>
              <span className="since-now">
                {c.change === null ? "sin dato de ayer · " : ""}ahora <span className="num">{c.now}</span>
              </span>
            </li>
          ))}
          <li className="since-item">
            <span className="since-label">Embalses</span>
            <span className="since-change num">
              <span className="since-value since-up">
                <span className="since-arrow" aria-hidden="true">
                  {ARROW.up}
                </span>
                {rising}
              </span>
              <span className="since-value since-down">
                <span className="since-arrow" aria-hidden="true">
                  {ARROW.down}
                </span>
                {falling}
              </span>
            </span>
            <span className="since-dots" aria-hidden="true">
              {directions.map((d) => (
                <span key={d.site} className={`dot ${d.sign === null ? "dot-empty" : TONE[d.sign]}`} />
              ))}
            </span>
            <span className="since-now">
              de {now.reservoirs.length}: {rising} {rising === 1 ? "sube" : "suben"}, {falling} {falling === 1 ? "baja" : "bajan"}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
