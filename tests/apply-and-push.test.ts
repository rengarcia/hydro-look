/**
 * apply-and-push.sh against a local bare repository, with `npm` replaced by a stub on PATH, so
 * the shell logic runs for real: commit and push, skip a run whose only change is
 * `generated_at`, apply onto a tip another run moved, and hand the run summary over.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(import.meta.dirname, "..", ".github", "scripts", "apply-and-push.sh");

// Stands in for the repository's npm scripts: `apply` writes whatever $FAKE_ROWS says, `check`
// always rewrites status.json with a fresh generated_at, and `publish:api` does nothing.
const NPM_STUB = `#!/usr/bin/env bash
set -euo pipefail
case "$2" in
  ingest)
    mkdir -p data/curated
    printf '%s\\n' "$FAKE_ROWS" > data/curated/table.csv
    prev=""
    for arg in "$@"; do if [ "$prev" = "--summary" ]; then echo "### summary" > "$arg"; fi; prev="$arg"; done
    ;;
  check)
    mkdir -p public/api
    printf '{\\n  "generated_at": "%s",\\n  "ok": true\\n}\\n' "$(date +%s%N)" > public/api/status.json
    ;;
  publish:api) ;;
esac
`;

// Whatever the machine's global git config says about push negotiation, a local bare remote needs none.
const GIT_ENV = { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "push.negotiate", GIT_CONFIG_VALUE_0: "false" };
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV } }).trim();

function setup() {
  const root = mkdtempSync(join(tmpdir(), "hydro-push-"));
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  const bin = join(root, "bin");
  const batch = join(root, "batch");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root");
  git(work, "push", "-q", "origin", "HEAD:main");
  mkdirSync(bin);
  writeFileSync(join(bin, "npm"), NPM_STUB);
  chmodSync(join(bin, "npm"), 0o755);
  mkdirSync(batch);
  writeFileSync(join(batch, "batch.json"), "{}");
  const run = (rows: string, extra: Record<string, string> = {}) =>
    spawnSync("bash", [script, "Test ingest"], {
      cwd: work,
      encoding: "utf8",
      env: {
        ...process.env,
        ...GIT_ENV,
        PATH: `${bin}:${process.env["PATH"]}`,
        BRANCH: "main",
        BATCH_DIR: batch,
        FAKE_ROWS: rows,
        ...extra,
      },
    });
  return { root, origin, work, run };
}

describe("apply-and-push.sh", () => {
  it("commits and pushes new rows, then commits nothing when only generated_at changed", () => {
    const { root, origin, run } = setup();
    const summary = join(root, "summary.md");
    const stepSummary = join(root, "step-summary.md");
    writeFileSync(stepSummary, "");

    const first = run("date,value\n2026-09-23,1", { SUMMARY: summary, GITHUB_STEP_SUMMARY: stepSummary });
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toMatch(/Pushed on attempt 1/);
    expect(git(origin, "log", "--format=%s", "main")).toBe("Test ingest\nroot");
    expect(readFileSync(stepSummary, "utf8")).toBe("### summary\n");

    // Same rows again: status.json's stamp moves, nothing else does.
    const second = run("date,value\n2026-09-23,1");
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toMatch(/No data changes/);
    expect(git(origin, "rev-list", "--count", "main")).toBe("2");

    // A real change is committed again.
    const third = run("date,value\n2026-09-23,1\n2026-09-24,2");
    expect(third.stdout).toMatch(/Pushed on attempt 1/);
    expect(git(origin, "rev-list", "--count", "main")).toBe("3");
  }, 30_000);

  it("does nothing when the fetch job staged no batch", () => {
    const { root, work } = setup();
    const result = spawnSync("bash", [script, "Test ingest"], {
      cwd: work,
      encoding: "utf8",
      env: { ...process.env, BRANCH: "main", BATCH_DIR: join(root, "missing") },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/No staged batch/);
  });

  it("applies onto the tip as it stands when the script runs, not onto the checkout", () => {
    const { root, origin, work, run } = setup();
    // Another run lands a commit after this checkout was made.
    const other = join(root, "other");
    git(root, "clone", "-q", origin, other);
    writeFileSync(join(other, "other.txt"), "theirs\n");
    git(other, "add", "other.txt");
    git(other, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "other run");
    git(other, "push", "-q", "origin", "HEAD:main");

    const result = run("date,value\n2026-09-23,1");
    expect(result.status, result.stderr).toBe(0);
    expect(git(origin, "log", "--format=%s", "main")).toBe("Test ingest\nother run\nroot");
    expect(readFileSync(join(work, "other.txt"), "utf8")).toBe("theirs\n");
  }, 30_000);
});
