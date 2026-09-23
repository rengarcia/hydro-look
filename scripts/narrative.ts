#!/usr/bin/env node
/**
 * Phase 6b's command: one model-written paragraph over numbers computed elsewhere.
 *
 *   npm run narrative                          build the payload, call the gateway, write both outputs
 *   npm run narrative -- --dry-run             build the payload and print it; call nothing, write nothing
 *   npm run narrative -- --stage <dir>         build and call, but write the outputs into <dir> only
 *   npm run narrative -- apply --in <dir>      merge a staged result into data/ and public/api
 *   npm run narrative -- --api-dir <dir>       where the input documents are read and narrative.json goes
 *
 * The outputs are `public/api/narrative.json` (only when the text passed the validator) and one
 * `narrative_snapshots` row per attempt, whatever became of it. See `generate.ts` for the four
 * statuses and what each leaves on the page.
 *
 * Staging exists for the same reason `ingest --out` / `ingest apply` does: the daily job may lose
 * a push race and have to replay its write onto a newer tip. Replaying a model call would pay
 * twice for one narrative, so the call happens once, into a directory, and only the cheap merge
 * is repeated. `.github/scripts/narrative-and-push.sh` drives that.
 *
 * Three ways to exit 0 without calling anything, each with a line in the log saying which:
 * `--dry-run`; no `AI_GATEWAY_API_KEY` in the environment (the sandbox and CI never have one);
 * and a payload whose hash and prompt version match the last answered snapshot. Exit code is 1
 * only for a `failed` attempt — a bad key, an unknown model id, a gateway outage — so that one
 * is visibly red, and for inputs that cannot produce a payload at all.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  buildPayload,
  estimateTokens,
  loadPayloadInputs,
  payloadHash,
  type NarrativePayload,
} from "../src/lib/narrative/payload.ts";
import { promptVersionFor } from "../src/lib/narrative/prompt.ts";
import {
  generateNarrative,
  isNoOp,
  lastAnswered,
  NARRATIVE_MODEL,
  narrativeDocument,
  snapshotRow,
  type NarrativeOutput,
  type SnapshotRef,
} from "../src/lib/narrative/generate.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { NARRATIVE_SNAPSHOTS } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED, DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

const STAGED_ROW = "snapshot.json";
const STAGED_DOCUMENT = "narrative.json";

function readSnapshots(): (SnapshotRef & { run_id: string })[] {
  const directory = join(DATA_CURATED, NARRATIVE_SNAPSHOTS.name);
  if (!existsSync(directory)) return [];
  const rows: (SnapshotRef & { run_id: string })[] = [];
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    for (const row of parseCsv(readFileSync(join(directory, file), "utf8"))) {
      rows.push({
        run_id: row["run_id"] ?? "",
        generated_at: row["generated_at"] ?? "",
        status: row["status"] ?? "",
        prompt_version: row["prompt_version"] ?? "",
        payload_hash: row["payload_hash"] ?? "",
        model_id: row["model_id"] ?? "",
      });
    }
  }
  return rows;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${path}`);
}

/** Merges a staged attempt. A staging directory with nothing in it is a normal outcome. */
function apply(stageDir: string, apiDir: string): void {
  const rowPath = join(stageDir, STAGED_ROW);
  if (!existsSync(rowPath)) {
    console.log(`nothing staged in ${stageDir}: no attempt was made (no key, a no-op, or a dry run)`);
    return;
  }
  const row = JSON.parse(readFileSync(rowPath, "utf8")) as unknown;
  const report = new CuratedStore().upsert(NARRATIVE_SNAPSHOTS, [row]);
  console.log(`narrative_snapshots: ${report.added} added, ${report.updated} updated`);

  const documentPath = join(stageDir, STAGED_DOCUMENT);
  if (existsSync(documentPath)) {
    const target = join(apiDir, "narrative.json");
    mkdirSync(apiDir, { recursive: true });
    copyFileSync(documentPath, target);
    console.log(`wrote ${target}`);
  } else {
    console.log("no narrative staged (not ok); the published narrative.json is left as it was");
  }
}

function summarise(payload: NarrativePayload, hash: string): void {
  const mazar = payload.reservoirs.find((r) => r.site === "mazar");
  console.log(
    `payload ${hash.slice(0, 12)} (prompt ${promptVersionFor(payload)}, ~${estimateTokens(payload)} tokens): origin ${payload.origin_date}, ` +
      `${payload.reservoirs.length} reservoirs` +
      (mazar ? `, Mazar ${mazar.level_masl} m` : "") +
      (payload.adequacy ? `, tier ${payload.adequacy.risk_tier}` : ", no adequacy") +
      (payload.precipitation_16d ? `, rain ${payload.precipitation_16d.forecast_total_mm} mm vs p50 ${payload.precipitation_16d.climatology_p50_mm ?? "?"}` : "") +
      (payload.enso ? `, ONI ${payload.enso.month} ${payload.enso.oni} (${payload.enso.phase})` : ""),
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      stage: { type: "string" },
      in: { type: "string" },
      "api-dir": { type: "string" },
    },
  });
  const apiDir = values["api-dir"]?.trim() || repoPath("public", "api");

  if (positionals[0] === "apply") {
    const stageDir = values.in?.trim();
    if (!stageDir) throw new Error("apply needs --in <dir>");
    apply(stageDir, apiDir);
    return;
  }

  const dryRun = values["dry-run"] ?? false;
  const key = process.env["AI_GATEWAY_API_KEY"]?.trim() ?? "";

  // Checked before any data is read, so a keyless run is instant and provably touches nothing.
  if (!dryRun && key === "") {
    console.log("AI_GATEWAY_API_KEY is not set: no narrative generated and nothing written (expected in the sandbox and in CI).");
    return;
  }

  const inputs = loadPayloadInputs({ curated: DATA_CURATED, api: apiDir, basins: join(DATA_REFERENCE, "basins.csv") });
  if (inputs === null) {
    console.error(`no latest.json under ${apiDir}: nothing to write a narrative about`);
    process.exitCode = 1;
    return;
  }
  const payload = buildPayload(inputs);
  const hash = payloadHash(payload);
  summarise(payload, hash);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    console.log(`dry run: would call ${NARRATIVE_MODEL} unless the last answered snapshot has this hash and prompt`);
    return;
  }

  const snapshots = readSnapshots();
  if (isNoOp(snapshots, hash, promptVersionFor(payload))) {
    console.log(`unchanged since ${lastAnswered(snapshots)?.run_id ?? "the last snapshot"} (same payload and prompt ${promptVersionFor(payload)}): no call made`);
    return;
  }

  const generatedAt = nowUtc();
  const result = await generateNarrative(payload);
  console.log(
    `${result.status}: ${result.modelId}, ${result.usage.inputTokens ?? "?"} in / ${result.usage.outputTokens ?? "?"} out, ` +
      `cost ${result.usage.costUsd === null ? "not reported" : `USD ${result.usage.costUsd}`}`,
  );
  for (const reason of result.reasons) console.log(`  ${reason}`);

  const row = snapshotRow({ generatedAt, result, payload, payloadHash: hash });
  const document =
    result.status === "ok" && result.output
      ? narrativeDocument({ generatedAt, result: { ...result, output: result.output as NarrativeOutput }, payload, payloadHash: hash })
      : null;

  const stageDir = values.stage?.trim();
  if (stageDir) {
    writeJson(join(stageDir, STAGED_ROW), row);
    if (document) writeJson(join(stageDir, STAGED_DOCUMENT), document);
  } else {
    const report = new CuratedStore().upsert(NARRATIVE_SNAPSHOTS, [row]);
    console.log(`narrative_snapshots: ${report.added} added`);
    if (document) writeJson(join(apiDir, "narrative.json"), document);
  }

  if (result.status === "failed") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
