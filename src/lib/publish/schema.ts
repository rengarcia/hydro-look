/**
 * A JSON Schema validator for the subset the files under `public/api/schema/` use.
 *
 * The schemas are ordinary draft 2020-12 documents, so a consumer can hand them to any
 * validator. This one exists so the repository can check its own documents without a runtime
 * dependency for a dozen keywords: `type` (a name or a list of names), `enum`, `const`,
 * `pattern`, `minimum`, `maximum`, `properties`, `required`, `additionalProperties`, `items`,
 * `minItems`, `$ref` into `$defs`, and `$defs` itself. Annotations (`$schema`, `$id`, `title`,
 * `description`, `deprecated`, `examples`) are accepted and ignored.
 *
 * Anything else is an error rather than a silent pass: a schema that says `oneOf` to a
 * validator that ignores `oneOf` would pass every document, and the test built on it would
 * prove nothing. `unsupportedKeywords` finds them, and the schema test fails on any.
 */

export type Schema = { [keyword: string]: unknown };

const CHECKED = new Set([
  "type",
  "enum",
  "const",
  "pattern",
  "minimum",
  "maximum",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "$ref",
  "$defs",
]);
const ANNOTATIONS = new Set(["$schema", "$id", "title", "description", "deprecated", "examples"]);

export interface SchemaError {
  path: string;
  message: string;
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  const actual = typeOf(value);
  return actual === type || (type === "number" && actual === "integer");
}

function resolve(root: Schema, ref: string): Schema {
  const match = /^#\/\$defs\/(.+)$/.exec(ref);
  const defs = root["$defs"] as Record<string, Schema> | undefined;
  const target = match ? defs?.[match[1]!] : undefined;
  if (!target) throw new Error(`unresolvable $ref ${ref}`);
  return target;
}

/** Every error in `value` against `schema`; empty means valid. */
export function validate(value: unknown, schema: Schema, root: Schema = schema, path = "$"): SchemaError[] {
  if (typeof schema["$ref"] === "string") return validate(value, resolve(root, schema["$ref"]), root, path);
  const errors: SchemaError[] = [];
  const fail = (message: string) => errors.push({ path, message });

  const type = schema["type"];
  if (type !== undefined) {
    const types = Array.isArray(type) ? (type as string[]) : [type as string];
    if (!types.some((t) => matchesType(value, t))) {
      fail(`expected ${types.join(" or ")}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (Array.isArray(schema["enum"]) && !schema["enum"].some((option) => option === value)) {
    fail(`expected one of ${JSON.stringify(schema["enum"])}, got ${JSON.stringify(value)}`);
  }
  if ("const" in schema && schema["const"] !== value) fail(`expected ${JSON.stringify(schema["const"])}`);
  if (typeof value === "string" && typeof schema["pattern"] === "string" && !new RegExp(schema["pattern"]).test(value)) {
    fail(`"${value}" does not match ${schema["pattern"]}`);
  }
  if (typeof value === "number") {
    if (typeof schema["minimum"] === "number" && value < schema["minimum"]) fail(`below the minimum ${schema["minimum"]}`);
    if (typeof schema["maximum"] === "number" && value > schema["maximum"]) fail(`above the maximum ${schema["maximum"]}`);
  }

  if (typeOf(value) === "object") {
    const object = value as Record<string, unknown>;
    const properties = (schema["properties"] ?? {}) as Record<string, Schema>;
    for (const key of (schema["required"] ?? []) as string[]) {
      if (!(key in object)) fail(`missing required field "${key}"`);
    }
    for (const [key, item] of Object.entries(object)) {
      const child = properties[key];
      if (child) errors.push(...validate(item, child, root, `${path}.${key}`));
      else if (schema["additionalProperties"] === false) fail(`unexpected field "${key}"`);
      else if (typeof schema["additionalProperties"] === "object" && schema["additionalProperties"] !== null) {
        errors.push(...validate(item, schema["additionalProperties"] as Schema, root, `${path}.${key}`));
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema["minItems"] === "number" && value.length < schema["minItems"]) fail(`fewer than ${schema["minItems"]} items`);
    if (typeof schema["items"] === "object" && schema["items"] !== null) {
      value.forEach((item, i) => errors.push(...validate(item, schema["items"] as Schema, root, `${path}[${i}]`)));
    }
  }
  return errors;
}

/**
 * Keywords in `schema` this validator would not enforce. Walks the keywords that hold
 * subschemas, so a `oneOf` three levels down is found as surely as one at the top.
 */
export function unsupportedKeywords(schema: Schema, path = "$"): string[] {
  const out: string[] = [];
  for (const [keyword, child] of Object.entries(schema)) {
    if (!CHECKED.has(keyword) && !ANNOTATIONS.has(keyword)) out.push(`${path}.${keyword}`);
    if (keyword === "properties" || keyword === "$defs") {
      for (const [name, sub] of Object.entries(child as Record<string, Schema>)) {
        out.push(...unsupportedKeywords(sub, `${path}.${keyword}.${name}`));
      }
    } else if ((keyword === "items" || keyword === "additionalProperties") && typeof child === "object" && child !== null) {
      out.push(...unsupportedKeywords(child as Schema, `${path}.${keyword}`));
    }
  }
  return out;
}
