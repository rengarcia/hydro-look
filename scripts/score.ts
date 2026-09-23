#!/usr/bin/env node
/**
 * §5.1's command: score every published forecast and adequacy run whose horizon has passed.
 *
 *   npm run score                          score, write the report and both scorecard blocks
 *   npm run score -- --dry-run             score and print; touch no file
 *   npm run score -- --api-dir <dir>       where forecast.json and adequacy.json are patched
 *   npm run score -- --report <path>       where the scorecard report goes
 *
 * `npm run forecast` and `npm run adequacy` write the same block when they run, from the same
 * functions; this command exists so that a day's new observations score yesterday's forecasts
 * even on a day the models are not rerun, and so the report can be regenerated on its own. It
 * patches only the `scorecard` key of each document; everything else is restamped unchanged.
 *
 * A pure function of the committed tables: no network, no model fit, a second or two.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { publicJson } from "../src/lib/publish/contract.ts";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadSeries } from "../src/lib/features/series.ts";
import { readBalance, rationingEpisodes } from "../src/lib/features/balance.ts";
import {
  readCuratedTable,
  renderScorecardReport,
  scoreAdequacyRuns,
  scorecardBlock,
  scoreLevelForecasts,
} from "../src/lib/models/scorecard.ts";
import { ADEQUACY_RUNS, ADEQUACY_VALUES, FORECAST_RUNS, FORECAST_VALUES, NATIONAL_BALANCE_DAILY } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      "api-dir": { type: "string" },
      report: { type: "string" },
    },
  });
  const apiDir = values["api-dir"]?.trim() || repoPath("public", "api");
  const reportPath = values.report?.trim() || repoPath("data", "reports", "scorecard.md");
  const generatedAt = nowUtc();

  const series = loadSeries();
  const level = scoreLevelForecasts(readCuratedTable(FORECAST_RUNS.name), readCuratedTable(FORECAST_VALUES.name), (site) =>
    series.get(site, "cota_masl"),
  );
  const balance = readBalance(readCuratedTable(NATIONAL_BALANCE_DAILY.name) as never);
  const rationingPath = join(DATA_REFERENCE, "rationing_episodes.csv");
  const episodes = rationingEpisodes((existsSync(rationingPath) ? parseCsv(readFileSync(rationingPath, "utf8")) : []) as never);
  const adequacy = scoreAdequacyRuns(readCuratedTable(ADEQUACY_RUNS.name), readCuratedTable(ADEQUACY_VALUES.name), balance.days, episodes);

  for (const card of [level, adequacy]) {
    console.log(
      `${card.kind}: ${card.runsConsidered} runs (${card.runsSuperseded} superseded), ${card.rowsScored} rows scored, ` +
        `${card.rowsPending} pending, ${card.rowsExcluded} excluded; observed through ${card.observedThrough ?? "—"}`,
    );
    for (const g of card.groups) {
      console.log(
        `  ${g.modelId} v${g.modelVersion} ${String(g.horizonDays).padStart(2)}d n=${g.n} MAE ${g.mae?.toFixed(3) ?? "—"} ${card.units}` +
          ` coverage ${g.coverageP10P90 === null ? "—" : `${(g.coverageP10P90 * 100).toFixed(0)}%`}`,
      );
    }
  }

  const report = renderScorecardReport({ generatedAt, level, adequacy });
  const patches: [string, "forecast" | "adequacy", Record<string, unknown>][] = [
    [join(apiDir, "forecast.json"), "forecast", scorecardBlock(level, generatedAt)],
    [join(apiDir, "adequacy.json"), "adequacy", scorecardBlock(adequacy, generatedAt)],
  ];

  if (values["dry-run"]) {
    console.log(`dry run: would write ${reportPath} and patch the scorecard block of ${patches.map(([p]) => p).join(" and ")}`);
    return;
  }

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report);
  console.log(`wrote ${reportPath}`);
  for (const [path, name, block] of patches) {
    if (!existsSync(path)) {
      console.log(`no ${path}: nothing to patch`);
      continue;
    }
    const document = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    document["scorecard"] = block;
    // Restamped so the block sits before the provenance fields; stamping is idempotent.
    writeFileSync(path, publicJson(name, document));
    console.log(`patched ${path}`);
  }
}

main();
