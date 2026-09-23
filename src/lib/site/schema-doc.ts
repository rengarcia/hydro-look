/**
 * The documentation page's field tables, read from the JSON Schemas themselves.
 *
 * Writing the fields out by hand beside the schemas would give two lists to keep in step, and
 * the page would be the one that drifted. Instead the page flattens each schema into one row per
 * field — its path, type, unit, whether it is always present, and the schema's own description —
 * so the documentation is wrong only when the schema is, and the schema is tested against the
 * committed documents.
 */

import type { Schema } from "../publish/schema.ts";

export interface FieldRow {
  /** `reservoirs[].level.masl`. */
  path: string;
  type: string;
  unit: string | null;
  required: boolean;
  deprecated: boolean;
  description: string | null;
}

/**
 * The unit a field's name declares. Every numeric field in these documents carries its unit as
 * a suffix — the same convention the curated tables use — so it can be read off the name.
 */
export function unitOf(name: string): string | null {
  const rules: [RegExp, string][] = [
    [/_m_per_day$|^d(7|14|30)$/, "m/día"],
    [/_masl$|^masl$/, "m s. n. m."],
    [/_m3s$|^m3s$/, "m³/s"],
    [/_gwh_day$/, "GWh/día"],
    [/_gwh$|^gwh$/, "GWh"],
    [/_hm3$/, "hm³"],
    [/_km2$/, "km²"],
    [/_pct_points$/, "puntos porcentuales"],
    [/_pct$|^pct$/, "%"],
    [/_days$|^days$/, "días"],
    [/_m$/, "m"],
    [/_usd$/, "USD"],
  ];
  for (const [pattern, unit] of rules) if (pattern.test(name)) return unit;
  return null;
}

function typeText(schema: Schema): string {
  const type = schema["type"];
  const types = Array.isArray(type) ? (type as string[]) : type === undefined ? [] : [type as string];
  const named = types.map((t) => (t === "array" ? "lista" : t === "object" ? "objeto" : t === "null" ? "null" : t));
  const text = named.join(" | ") || "—";
  return Array.isArray(schema["enum"]) ? `${text}: ${(schema["enum"] as unknown[]).map((v) => JSON.stringify(v)).join(", ")}` : text;
}

function resolve(schema: Schema, root: Schema): Schema {
  const ref = schema["$ref"];
  if (typeof ref !== "string") return schema;
  const name = ref.replace(/^#\/\$defs\//, "");
  return (root["$defs"] as Record<string, Schema> | undefined)?.[name] ?? schema;
}

/**
 * One row per field, depth first, in the schema's own order. `maxDepth` stops at objects nested
 * deeper than a reader of the page needs; the schema file itself has the rest.
 */
export function fieldRows(root: Schema, maxDepth = 4): FieldRow[] {
  const out: FieldRow[] = [];
  const walk = (schema: Schema, prefix: string, depth: number) => {
    const properties = (schema["properties"] ?? {}) as Record<string, Schema>;
    const required = new Set((schema["required"] ?? []) as string[]);
    for (const [name, raw] of Object.entries(properties)) {
      const child = resolve(raw, root);
      const path = prefix ? `${prefix}.${name}` : name;
      out.push({
        path,
        type: typeText(child),
        unit: unitOf(name),
        required: required.has(name),
        deprecated: child["deprecated"] === true,
        description: typeof child["description"] === "string" ? child["description"] : null,
      });
      if (depth >= maxDepth) continue;
      if (child["properties"]) walk(child, path, depth + 1);
      const items = child["items"] as Schema | undefined;
      if (items && typeof items === "object") {
        const item = resolve(items, root);
        if (item["properties"]) walk(item, `${path}[]`, depth + 1);
      }
    }
  };
  walk(root, "", 1);
  return out;
}

/** `"15 12 * * *"` -> `12:15`; the daily slots are the only cron shape this project writes. */
export function cronTimes(workflow: string): string[] {
  const out: string[] = [];
  for (const match of workflow.matchAll(/cron:\s*["']?(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*["']?/g)) {
    out.push(`${match[2]!.padStart(2, "0")}:${match[1]!.padStart(2, "0")}`);
  }
  return out;
}

/** `12:15` UTC -> `07:15` in Ecuador (UTC−5 all year). */
export function utcToEc(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return `${String((h + 24 - 5) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
