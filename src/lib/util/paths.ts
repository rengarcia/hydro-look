/** Repository-root-relative paths, so the CLI works from any working directory. */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..", "..", "..");

export function repoPath(...parts: string[]): string {
  return resolve(REPO_ROOT, ...parts);
}

/**
 * Where the data lives. `HYDRO_LOOK_DATA_ROOT` moves it, which is how the end-to-end test
 * exercises the real CLI without writing into the repository's own tables.
 * `data/reference/` is committed input, not output, so it always comes from the repository.
 */
export const DATA_ROOT = process.env["HYDRO_LOOK_DATA_ROOT"]
  ? resolve(process.env["HYDRO_LOOK_DATA_ROOT"])
  : repoPath("data");

export const DATA_RAW = resolve(DATA_ROOT, "raw");
export const DATA_CURATED = resolve(DATA_ROOT, "curated");
export const DATA_LATEST = resolve(DATA_ROOT, "latest");
export const DATA_REFERENCE = repoPath("data", "reference");
