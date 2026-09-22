import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeBody } from "../src/lib/http/client.ts";

export const FIXTURES = join(import.meta.dirname, "fixtures");

/** Reads a Phase 0 fixture through the same decoding path the HTTP client uses. */
export function fixture(...parts: string[]): string {
  return decodeBody(readFileSync(join(FIXTURES, ...parts)), undefined);
}
