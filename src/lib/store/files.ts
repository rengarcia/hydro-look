/**
 * Writing files so that a run killed halfway leaves either the old file or the new one.
 *
 * A plain `writeFileSync` truncates the target first and fills it second, so a runner that dies
 * in between (a job timeout, an OOM, a cancelled workflow) leaves a half-written CSV that the
 * next run parses as a short table. Writing beside the target and renaming over it is atomic on
 * the same filesystem, which the temp file guarantees by living in the same directory.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export function writeFileAtomic(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  try {
    writeFileSync(temp, content);
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

/**
 * Writes a JSON document unless the only thing that changed is one of the `stamps` fields.
 *
 * `generated_at` changes on every run, so a document rewritten for it alone turns every run
 * into a commit and makes "did this run find anything" unanswerable from `git log`. Returns
 * whether the file was written.
 */
export function writeJsonUnlessOnlyStamped(
  path: string,
  document: Record<string, unknown>,
  stamps: readonly string[] = ["generated_at"],
): boolean {
  const text = `${JSON.stringify(document, null, 2)}\n`;
  if (existsSync(path)) {
    try {
      const previous = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      if (JSON.stringify(withoutStamps(previous, stamps)) === JSON.stringify(withoutStamps(document, stamps))) return false;
    } catch {
      // An unreadable previous document is replaced, not compared.
    }
  }
  writeFileAtomic(path, text);
  return true;
}

function withoutStamps(document: Record<string, unknown>, stamps: readonly string[]): Record<string, unknown> {
  // Round-trip first so `undefined` fields compare the way they are written: absent.
  const copy = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
  for (const stamp of stamps) delete copy[stamp];
  return copy;
}
