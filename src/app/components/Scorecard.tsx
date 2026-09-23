/**
 * How the published forecasts did (ENHANCEMENTS §5.1): the `scorecard` block of `forecast.json`
 * and `adequacy.json`, beside the numbers it scores.
 *
 * The backtest says how a method *would have* done at origins it never published from; this says
 * how the numbers the site actually published did once their dates came. Until the first one
 * does, the panel says so and says when — a table of zero rows would say nothing, and an absent
 * panel would hide that nothing has been checked yet.
 *
 * Both parts are optional-safe: a document written before the block existed renders nothing.
 */

import type { ReactNode } from "react";
import { Table } from "./DataTable.tsx";
import type { ScorecardBlock, ScorecardRow } from "../../lib/site/documents.ts";
import { dateWithYear, num, pct, signed } from "../../lib/site/format.ts";
import { dayScoreNote, modelShort, scorecardSummary } from "../../lib/site/story.ts";

/** `GWh/day` -> `GWh/día`; the block states its units in English. */
export function unitsEs(units: string): string {
  return units === "GWh/day" ? "GWh/día" : units;
}

function inBand(value: boolean | null): string {
  return value === null ? "—" : value ? "sí" : "no";
}

function RecentTable({ rows, units, digits, caption }: { rows: readonly ScorecardRow[]; units: string; digits: number; caption: string }) {
  return (
    <Table
      caption={caption}
      columns={[
        { label: "Fecha" },
        { label: "Horizonte" },
        { label: `p50 (p10 – p90), ${unitsEs(units)}`, numeric: true },
        { label: "Observado", numeric: true },
        { label: "Error", numeric: true },
        { label: "En banda" },
      ]}
      rows={rows.map((r) => [
        dateWithYear(r.target_date),
        `${r.horizon_days} días`,
        `${num(r.p50, digits)} (${num(r.p10, digits)} – ${num(r.p90, digits)})`,
        num(r.observed, digits),
        signed(r.error, digits),
        inBand(r.in_band),
      ])}
    />
  );
}

export function ScorecardPanel({
  card,
  nextDue,
  subject,
  digits,
  id,
  children,
}: {
  card: ScorecardBlock | null | undefined;
  /** The first pending row's target date, from the published rows (`nextScoreDue`). */
  nextDue: string | null;
  /** What is scored, for the table caption: "la cota de Mazar". */
  subject: string;
  /** Decimals the scored quantity is published at. */
  digits: number;
  id?: string;
  /** A sentence on what is scored, under the summary. */
  children?: ReactNode;
}) {
  if (!card) return null;
  const summary = scorecardSummary(card, nextDue);
  const units = unitsEs(card.units);
  return (
    <div className="panel tight scorecard" id={id}>
      <div className="panel-head">
        <h3>Cómo les fue a los pronósticos publicados</h3>
        <span className="meta">{units}</span>
      </div>
      <p className="panel-lede">{summary.headline}</p>
      {summary.detail ? <p className="fine">{summary.detail}</p> : null}
      {card.by_horizon.length > 0 ? (
        <div className="table-scroll">
          <Table
            caption={`Error de los pronósticos publicados de ${subject}, por modelo, versión y horizonte, en ${units}`}
            captionHidden
            columns={[
              { label: "Horizonte" },
              { label: "Modelo" },
              { label: "n", numeric: true },
              { label: "Error medio", numeric: true },
              { label: "Sesgo", numeric: true },
              { label: "Cobertura p10–p90", numeric: true },
              { label: "Orígenes", wideOnly: true },
            ]}
            rows={card.by_horizon.map((g) => [
              `${g.horizon_days} días`,
              <abbr key="m" title={`${g.model_id}, versión ${g.model_version}`}>
                {modelShort(g.model_id)} v{g.model_version}
              </abbr>,
              g.n,
              num(g.mae, digits),
              signed(g.bias, digits),
              g.coverage_p10_p90 === null ? "—" : `${pct(g.coverage_p10_p90 * 100, 0)} (${g.n_band})`,
              g.first_origin && g.last_origin
                ? g.first_origin === g.last_origin
                  ? dateWithYear(g.first_origin)
                  : `${dateWithYear(g.first_origin)} → ${dateWithYear(g.last_origin)}`
                : "—",
            ])}
          />
        </div>
      ) : null}
      {card.recent.length > 0 ? (
        <details className="chart-data">
          <summary>Ver las últimas filas puntuadas</summary>
          <div className="table-scroll">
            <RecentTable rows={card.recent} units={card.units} digits={digits} caption={`Últimas filas puntuadas de ${subject}`} />
          </div>
        </details>
      ) : null}
      <p className="fine spaced">
        {children}
        {children ? " " : ""}
        Cada fila se puntúa bajo el modelo y la versión que la publicaron, y de cada origen solo la última corrida
        {card.runs_superseded > 0
          ? ` (${card.runs_superseded} ${card.runs_superseded === 1 ? "corrida reemplazada queda" : "corridas reemplazadas quedan"} fuera)`
          : ""}
        . Unas pocas filas son una anécdota, no una puntuación: lea la n antes que el error.
      </p>
    </div>
  );
}

/**
 * One day's run against the scorecard, for `/dia/<fecha>/`: how many of its horizons have
 * reached their date, when the next one does, and the rows of this run the block has scored.
 */
export function DayScore({
  card,
  runId,
  horizons,
  digits,
  subject,
  href,
}: {
  card: ScorecardBlock | null | undefined;
  runId: string;
  horizons: readonly { horizon_days: number; target_date: string }[];
  digits: number;
  subject: string;
  /** Where the whole scorecard is: the section on the home page. */
  href: string;
}) {
  if (!card) return null;
  const note = dayScoreNote(horizons, card.observed_through);
  const scored = card.recent.filter((r) => r.run_id === runId);
  const passed = horizons.some((h) => card.observed_through !== null && h.target_date <= card.observed_through);
  return (
    <>
      {note ? (
        <p className="fine spaced">
          <strong>Marcador.</strong> {note}
          {passed && scored.length === 0 ? (
            <>
              {" "}
              Sus filas puntuadas cuentan en el <a href={href}>marcador de la portada</a>.
            </>
          ) : null}
        </p>
      ) : null}
      {scored.length > 0 ? (
        <div className="table-scroll">
          <RecentTable rows={scored} units={card.units} digits={digits} caption={`Filas de esta corrida ya puntuadas: ${subject}`} />
        </div>
      ) : null}
    </>
  );
}
