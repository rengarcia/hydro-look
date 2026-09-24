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
  change: string | null;
  /** `up`, `down` or `flat`, for the colour of the change. */
  sign: "up" | "down" | "flat";
}

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
      change: changeWord(mazar.level.delta_1d_m, 2, "m"),
      sign: signOf(mazar.level.delta_1d_m, 2),
    });
  }
  if (mazar?.inflow) {
    changes.push({
      label: "Agua que llega a Mazar",
      now: `${num(mazar.inflow.m3s, 1)} m³/s`,
      change: changeWord(mazar.inflow.delta_1d_m3s, 1, "m³/s"),
      sign: signOf(mazar.inflow.delta_1d_m3s, 1),
    });
  }
  const national = now.national;
  if (national) {
    changes.push(
      {
        label: "Electricidad del agua",
        now: `${num(national.hydro_share_pct, 1)} %`,
        change: changeWord(national.delta_1d?.hydro_share_pct_points, 1, "puntos"),
        sign: signOf(national.delta_1d?.hydro_share_pct_points, 1),
      },
      {
        label: "Electricidad generada",
        now: `${num(national.total_generation_gwh, 1)} GWh`,
        change: changeWord(national.delta_1d?.total_generation_gwh, 1, "GWh"),
        sign: signOf(national.delta_1d?.total_generation_gwh, 1),
      },
    );
  }
  const falling = now.reservoirs.filter((r) => r.level?.delta_1d_m != null && Number(r.level.delta_1d_m.toFixed(2)) < 0).length;
  const rising = now.reservoirs.filter((r) => r.level?.delta_1d_m != null && Number(r.level.delta_1d_m.toFixed(2)) > 0).length;
  if (changes.length === 0) return null;
  const from = mazar?.level?.previous?.date ?? national?.previous?.date ?? null;
  const to = mazar?.level?.date ?? national?.date ?? null;

  return (
    <section className="shell since" aria-labelledby="desde-ayer-title">
      <h2 id="desde-ayer-title" className="since-title">
        Desde ayer
        {from && to ? (
          <span className="since-dates">
            {dateWithYear(from)} → {dateWithYear(to)}
          </span>
        ) : null}
      </h2>
      <ul className="since-list">
        {changes.map((c) => (
          <li key={c.label}>
            <span className="since-label">{c.label}</span>
            <span className="since-now num">{c.now}</span>
            <span className={`since-change num since-${c.sign}`}>{c.change ?? "sin dato de ayer"}</span>
          </li>
        ))}
        <li>
          <span className="since-label">Embalses</span>
          <span className="since-now num">
            {rising} suben · {falling} bajan
          </span>
          <span className="since-change">de {now.reservoirs.length}, comparado con ayer</span>
        </li>
      </ul>
    </section>
  );
}
