/**
 * Tables: the real ones the page is built from, and the collapsed one under every chart.
 *
 * A chart's `<title>` and `<desc>` say what it shows and over which dates; they cannot say what
 * the numbers are. `ChartData` puts them in a `<details>` under the chart — closed by default,
 * opened by the browser itself, so it needs no script — as a proper table with a caption and
 * header cells, which a screen reader can walk cell by cell and a reader can copy into a
 * spreadsheet.
 *
 * `Table` is the same markup without the disclosure, for the tables that are part of the page:
 * the horizons, the scenarios, the floors, the national mix. Each used to be a stack of `<div>`s
 * with the header row `aria-hidden`, which read as loose text.
 */

import type { ReactNode } from "react";

export interface Column {
  label: ReactNode;
  /** Right-aligned in tabular figures. */
  numeric?: boolean;
  /**
   * Hidden on a phone, where the column does not fit. Only for a column whose content is also
   * said elsewhere on the page, or is a detail the phone reader can reach in the documents.
   */
  wideOnly?: boolean;
}

export function Table({
  caption,
  columns,
  rows,
  captionHidden = false,
  className,
}: {
  caption: ReactNode;
  columns: Column[];
  /** The first cell of each row is its header (`<th scope="row">`). */
  rows: ReactNode[][];
  captionHidden?: boolean;
  className?: string;
}) {
  const cellClass = (column: Column | undefined) =>
    [column?.numeric ? "num" : "", column?.wideOnly ? "wide-cell" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <table className={className ? `table ${className}` : "table"}>
      <caption className={captionHidden ? "visually-hidden" : undefined}>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column, i) => (
            <th key={i} scope="col" className={cellClass(column)}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className={cellClass(columns[i])}>
                  {cell}
                </th>
              ) : (
                <td key={i} className={cellClass(columns[i])}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartData({
  caption,
  columns,
  rows,
  note,
}: {
  caption: string;
  columns: Column[];
  rows: ReactNode[][];
  /** Said under the table: the sampling, and where the full series is. */
  note?: ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <details className="chart-data">
      <summary>Ver los datos de la gráfica</summary>
      <div className="table-scroll">
        <Table caption={caption} columns={columns} rows={rows} />
      </div>
      {note ? <p className="fine">{note}</p> : null}
    </details>
  );
}

/** Every `step`-th item counted back from the newest, oldest first, so the newest is always in. */
export function sampleBack<T>(items: readonly T[], step: number): T[] {
  const out: T[] = [];
  for (let i = items.length - 1; i >= 0; i -= step) out.unshift(items[i]!);
  return out;
}
