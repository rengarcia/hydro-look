#!/usr/bin/env node
/**
 * §5.6's offline narrative evaluation.
 *
 *   npm run narrative:eval                                 revalidate every committed answer; write the report
 *   npm run narrative:eval -- --dry-run                    print the table; write nothing
 *   npm run narrative:eval -- --replay --models a/b,c/d    also call each model on each committed payload
 *
 * The replay needs `AI_GATEWAY_API_KEY` and costs what the calls cost; without the flag nothing
 * leaves the machine. The payloads are the committed `narrative.json` basis and the one today's
 * code builds from the committed tables, so a replay compares models on what they would actually
 * be sent. See `src/lib/narrative/evaluate.ts`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { buildPayload, loadPayloadInputs, payloadHash, type NarrativePayload } from "../src/lib/narrative/payload.ts";
import { generateNarrative } from "../src/lib/narrative/generate.ts";
import { promptVersionFor } from "../src/lib/narrative/prompt.ts";
import {
  evaluateRecorded,
  payloadSize,
  renderNarrativeReport,
  replay,
  summariseEval,
  type EvalRow,
} from "../src/lib/narrative/evaluate.ts";
import { readCuratedTable } from "../src/lib/models/scorecard.ts";
import { NARRATIVE_SNAPSHOTS } from "../src/lib/contracts/tables.ts";
import { DATA_CURATED, DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      replay: { type: "boolean", default: false },
      models: { type: "string" },
      report: { type: "string" },
    },
  });
  const apiDir = repoPath("public", "api");
  const reportPath = values.report?.trim() || repoPath("data", "reports", "narrative.md");

  const payloads = new Map<string, NarrativePayload>();
  const sizes = [];
  const committedPath = join(apiDir, "narrative.json");
  if (existsSync(committedPath)) {
    const basis = (JSON.parse(readFileSync(committedPath, "utf8")) as { basis?: NarrativePayload }).basis;
    if (basis) {
      payloads.set(payloadHash(basis), basis);
      sizes.push(payloadSize("committed narrative.json basis", basis));
    }
  }
  const inputs = loadPayloadInputs({ curated: DATA_CURATED, api: apiDir, basins: join(DATA_REFERENCE, "basins.csv") });
  const today = inputs ? buildPayload(inputs) : null;
  if (today) {
    payloads.set(payloadHash(today), today);
    sizes.push(payloadSize("built today from the committed tables", today));
  }

  const rows: EvalRow[] = evaluateRecorded(readCuratedTable(NARRATIVE_SNAPSHOTS.name), payloads);
  if (values.replay) {
    const models = (values.models ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (models.length === 0 || !process.env["AI_GATEWAY_API_KEY"]?.trim()) {
      console.error("--replay needs --models <slug,...> and AI_GATEWAY_API_KEY");
      process.exitCode = 1;
      return;
    }
    rows.push(
      ...(await replay(
        [...payloads.values()],
        models,
        (payload, modelId) => generateNarrative(payload, { model: modelId, modelId }),
        promptVersionFor,
      )),
    );
  }

  for (const s of summariseEval(rows)) {
    console.log(
      `${s.source.padEnd(8)} ${s.modelId.padEnd(28)} ${s.promptVersion.padEnd(6)} ${s.attempts} attempts, ${s.okAtTheTime} ok then, ` +
        `${s.passNow}/${s.checked} pass now, ~${s.meanWords?.toFixed(0) ?? "—"} words, mean USD ${s.meanCostUsd?.toFixed(4) ?? "—"}`,
    );
  }
  for (const s of sizes) console.log(`payload ${s.label}: v${s.payloadVersion}, ${s.characters} chars, ~${s.estimatedTokens} tokens`);

  const report = renderNarrativeReport({ generatedAt: nowUtc(), rows, sizes, replayed: values.replay ?? false });
  if (values["dry-run"]) {
    console.log(`dry run: would write ${reportPath}`);
    return;
  }
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report);
  console.log(`wrote ${reportPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
