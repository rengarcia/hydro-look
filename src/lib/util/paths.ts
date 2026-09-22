/** Repository-root-relative paths, so the CLI works from any working directory. */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..", "..", "..");

export function repoPath(...parts: string[]): string {
  return resolve(REPO_ROOT, ...parts);
}

export const DATA_RAW = repoPath("data", "raw");
export const DATA_CURATED = repoPath("data", "curated");
export const DATA_LATEST = repoPath("data", "latest");
export const DATA_REFERENCE = repoPath("data", "reference");
