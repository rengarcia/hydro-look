#!/usr/bin/env node
/**
 * Section 7's target 3.
 *
 *   npm run adequacy                      backtest, forecast, write everything
 *   npm run adequacy -- --dry-run         compute and print; touch no file
 *   npm run adequacy -- --api <path>      where adequacy.json goes
 *   npm run adequacy -- --report <path>   where the report goes
 *   npm run adequacy -- --ceilings        print the demonstrated ceilings and stop
 *
 * Like `forecast`, the backtest always runs, because the published band *is* the backtest: the
 * requirement's p10 and p90 are that model's own out-of-sample residual quantiles at that
 * horizon. There is no mode that publishes a deficit without having measured the pieces it is
 * made of.
 *
 * Exit code is 1 if the model could not be produced, so the daily workflow can gate on it.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  applyOverrides,
  backtestAdequacy,
  buildAdequacyDocument,
  crisisCheck,
  demonstratedCeilings,
  forecastAdequacy,
  DEFAULT_ADEQUACY_BACKTEST,
  MODEL_VERSION,
  type CeilingRow,
} from "../src/lib/models/adequacy.ts";
import { renderAdequacyReport } from "../src/lib/models/adequacy-report.ts";
import { readBalance, rationingEpisodes } from "../src/lib/features/balance.ts";
import { CuratedStore } from "../src/lib/store/curated.ts";
import { ADEQUACY_RUNS, ADEQUACY_VALUES, NATIONAL_BALANCE_DAILY } from "../src/lib/contracts/tables.ts";
import { parseCsv } from "../src/lib/store/csv.ts";
import { DATA_CURATED, DATA_REFERENCE, repoPath } from "../src/lib/util/paths.ts";
import { nowUtc } from "../src/lib/util/dates.ts";
import { roundTo } from "../src/lib/util/numbers.ts";

function readReference(name: string): Record<string, string>[] {
  const path = join(DATA_REFERENCE, name);
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

function readTable(name: string): Record<string, string>[] {
  const directory = join(DATA_CURATED, name);
  if (!existsSync(directory)) return [];
  const rows: Record<string, string>[] = [];
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".csv")).sort()) {
    rows.push(...parseCsv(readFileSync(join(directory, file), "utf8")));
  }
  return rows;
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      ceilings: { type: "boolean", default: false },
      api: { type: "string" },
      report: { type: "string" },
    },
  });

  const apiPath = values.api?.trim() || repoPath("public", "api", "adequacy.json");
  const reportPath = values.report?.trim() || repoPath("data", "reports", "adequacy.md");

  const balance = readBalance(readTable(NATIONAL_BALANCE_DAILY.name) as never);
  if (balance.days.length === 0) {
    console.error("no usable national balance days: nothing to compute");
    process.exitCode = 1;
    return;
  }
  const origin = balance.days.at(-1)!.date;
  const episodes = rationingEpisodes(readReference("rationing_episodes.csv") as never);

  console.log(
    `balance: ${balance.days.length} usable, ${balance.rejected.length} rejected, ` +
      `${balance.incomplete.length} incomplete — ${balance.days[0]!.date} → ${origin}`,
  );
  for (const reason of ["load below distribution demand", "load above twice distribution demand"] as const) {
    const hits = balance.rejected.filter((r) => r.reason === reason);
    if (hits.length > 0) console.log(`  rejected, ${reason}: ${hits.length} (worst ${hits[0]!.date})`);
  }
  console.log(`episodes: ${episodes.map((e) => `${e.start}..${e.end || "open"}`).join(", ") || "none"}`);

  const demonstrated = demonstratedCeilings(balance.days, origin);
  const ceilings = applyOverrides(demonstrated, readReference("adequacy_assumptions.csv") as unknown as CeilingRow[]);
  console.log(
    `ceilings: thermal ${ceilings.thermalGwhDay.toFixed(2)}, imports ${ceilings.importGwhDay.toFixed(2)} ` +
      `(stressed ${ceilings.stressedImportGwhDay.toFixed(2)}), other ${ceilings.otherGwhDay.toFixed(2)} GWh/day`,
  );
  if (values.ceilings) {
    console.log(`demonstrated: ${JSON.stringify(demonstrated, null, 2)}`);
    return;
  }

  const backtest = backtestAdequacy(balance.days, episodes, ceilings);
  console.log(`backtest: ${backtest.origins.length} origins ${backtest.origins[0]} → ${backtest.origins.at(-1)}`);
  for (const scores of backtest.scores) {
    console.log(
      `  ${scores.component.padEnd(12)}` +
        scores.horizons
          .map(
            (h) =>
              `${h.horizonDays}d ${h.maeGwhDay.toFixed(2)}` +
              `(${h.skillVsPersistence === null ? "—" : `${(h.skillVsPersistence * 100).toFixed(0)}%`})`,
          )
          .join("  "),
    );
  }

  const forecast = forecastAdequacy({
    days: balance.days,
    episodes,
    ceilings,
    origin,
    horizonDays: DEFAULT_ADEQUACY_BACKTEST.horizonDays,
    calibration: backtest.calibration,
    hydroCalibration: backtest.hydroCalibration,
  });
  if (!forecast) {
    console.error("the model could not be fitted on the committed data; nothing written");
    process.exitCode = 1;
    return;
  }

  console.log(
    `imports: ${forecast.imports.state}` +
      (forecast.imports.trailingGwhDay === null ? "" : `, ${forecast.imports.trailingGwhDay.toFixed(2)} GWh/day over the last ${forecast.imports.days} usable days`) +
      `; central case assumes ${forecast.imports.centralGwhDay.toFixed(2)}`,
  );
  const crisis = crisisCheck(balance.days, episodes, ceilings, backtest);
  for (const episode of crisis.episodes) {
    console.log(
      `crisis ${episode.start}→${episode.end}: suppression ${episode.measuredSuppressionGwhDay.toFixed(2)} ` +
        `vs implied deficit ${episode.impliedDeficitGwhDay.toFixed(2)} GWh/day ` +
        `(imports ran at ${episode.measuredImportGwhDay.toFixed(2)})`,
    );
  }

  for (const horizon of forecast.horizons) {
    console.log(
      `  +${String(horizon.horizonDays).padStart(2)}d ${horizon.targetDate}  ` +
        `demanda ${horizon.demandGwhDay.toFixed(1)}  hidro ${horizon.hydroGwhDay.toFixed(1)}  ` +
        `déficit ${horizon.deficitGwhDay >= 0 ? "+" : ""}${horizon.deficitGwhDay.toFixed(2)}  ` +
        `margen ${horizon.marginPct.toFixed(1)}%  ${horizon.tier}`,
    );
  }

  const document = buildAdequacyDocument({
    forecast,
    backtest,
    crisis,
    usableDays: balance.days.length,
    rejectedDays: balance.rejected.length,
  });
  const report = renderAdequacyReport({
    generatedAt: nowUtc(),
    forecast,
    backtest,
    crisis,
    ceilings,
    usableDays: balance.days.length,
    rejected: balance.rejected,
    range: { first: balance.days[0]!.date, last: origin },
  });

  if (values["dry-run"]) {
    console.log(`dry run: would write ${apiPath} and ${reportPath}, and ${forecast.horizons.length + 1} curated rows`);
    return;
  }

  const runId = document.run_id;
  const store = new CuratedStore();
  store.upsert(ADEQUACY_RUNS, [
    {
      run_id: runId,
      generated_at: document.generated_at,
      origin_date: forecast.origin,
      model_id: "adequacy-v1",
      model_version: MODEL_VERSION,
      features_hash: (document.model as { features_hash: string }).features_hash,
      usable_days: balance.days.length,
      rejected_days: balance.rejected.length,
      demand_fit_days: forecast.demand.days,
      demand_growth_pct_per_year: roundTo(forecast.demand.growthPctPerYear, 4),
      hydro_fit_days: forecast.hydro.days,
      hydro_anomaly: roundTo(forecast.hydro.anomaly, 6),
      thermal_gwh_day: roundTo(ceilings.thermalGwhDay, 3),
      import_gwh_day: roundTo(ceilings.importGwhDay, 3),
      stressed_import_gwh_day: roundTo(ceilings.stressedImportGwhDay, 3),
      other_gwh_day: roundTo(ceilings.otherGwhDay, 3),
      backtest_origins: backtest.origins.length,
    },
  ]);
  store.upsert(
    ADEQUACY_VALUES,
    forecast.horizons.map((h) => ({
      run_id: runId,
      origin_date: forecast.origin,
      horizon_days: h.horizonDays,
      target_date: h.targetDate,
      demand_gwh_day: roundTo(h.demandGwhDay, 3),
      hydro_gwh_day: roundTo(h.hydroGwhDay, 3),
      requirement_gwh_day: roundTo(h.requirementGwhDay, 3),
      requirement_p10: h.requirementP10 === null ? null : roundTo(h.requirementP10, 3),
      requirement_p90: h.requirementP90 === null ? null : roundTo(h.requirementP90, 3),
      deficit_gwh_day: roundTo(h.deficitGwhDay, 3),
      deficit_p10: h.deficitP10 === null ? null : roundTo(h.deficitP10, 3),
      deficit_p90: h.deficitP90 === null ? null : roundTo(h.deficitP90, 3),
      stressed_deficit_gwh_day: roundTo(h.stressedDeficitGwhDay, 3),
      margin_pct: roundTo(h.marginPct, 2),
      tier: h.tier,
    })),
  );

  for (const [path, body] of [
    [apiPath, `${JSON.stringify(document, null, 2)}\n`],
    [reportPath, report],
  ] as const) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    console.log(`wrote ${path}`);
  }
}

main();
