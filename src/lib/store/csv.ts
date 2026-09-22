/** Minimal RFC-4180 CSV, deliberately not a dependency: these files are committed and diffed. */

export function encodeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? formatNumber(value) : value;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Plain decimal notation: `1e-7` in a CSV is a trap for every downstream reader. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  const text = String(value);
  return text.includes("e") || text.includes("E") ? value.toFixed(9).replace(/0+$/, "").replace(/\.$/, "") : text;
}

export function toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => encodeCell(row[c] as string | number | null)).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((cells) => cells.length > 1 || (cells[0] ?? "") !== "")
    .map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
