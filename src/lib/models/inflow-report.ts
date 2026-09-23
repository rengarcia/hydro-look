/**
 * `data/reports/inflow.md` — §5.3's inflow forecasts, what each plant scored, and which ship.
 *
 * Written like the other reports: the comparison that decides the question first, the negatives
 * by name, and the reason a plant is not forecast stated beside the plant.
 */

import { SITES } from "../registry.ts";
import { DEFAULT_INFLOW, INFLOW_MODELS, type InflowBacktest, type InflowOptions } from "./inflow.ts";

const f = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);

export interface InflowReportInputs {
  generatedAt: string;
  backtests: readonly InflowBacktest[];
  /** Which ERA5 point each plant's analogue pool was conditioned on, or why none was. */
  precip: readonly { site: string; basin: string; used: boolean; reason: string | null }[];
  options?: InflowOptions;
}

export function renderInflowReport(inputs: InflowReportInputs): string {
  const options = inputs.options ?? DEFAULT_INFLOW;
  const lines: string[] = [];
  lines.push("# Inflow forecasts — the plants whose level is not the question");
  lines.push("");
  lines.push(
    `Generated ${inputs.generatedAt} by \`npm run forecast\` from the committed tables; no network. ` +
      "For the run-of-river and daily-storage plants the level is an operating decision taken within the day, so " +
      "the target is the water arriving: the mean inflow over the next " +
      `${options.horizonDays.join(" and ")} days, in m³/s. Origins every ${options.originStepDays} days from ` +
      `${options.firstOrigin}, once a plant has ${options.minTrainingDays} days of inflow; each rung sees only data up to its origin.`,
  );
  lines.push("");
  lines.push("- **persistence** holds the origin day's inflow.");
  lines.push("- **climatology** is the median of the same calendar window's mean over every earlier year.");
  lines.push(
    `- **analogue** takes each earlier year's window mean scaled by today's ${options.stateDays}-day flow over that year's ` +
      `(clamped to ${options.ratioBounds[0]}–${options.ratioBounds[1]}), and, where the plant's catchment centroid has adequate ERA5, ` +
      `first keeps the ${options.rainKeepShare * 100}% of years whose ${options.rainDays} days of rain before the origin were nearest today's.`,
  );
  lines.push("");
  lines.push(
    "A plant's forecast is published at a horizon only where the analogue rung's MAE beats *both* persistence and " +
      "climatology over the same origins. Its band is the analogue median widened by its own out-of-sample residual " +
      "quantiles, as every forecast here is.",
  );
  lines.push("");

  lines.push("## Verdict");
  lines.push("");
  lines.push("| plant | origins | horizon | analogue MAE | persistence | climatology | analogue coverage p10–p90 | published |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---|");
  for (const b of inputs.backtests) {
    for (const d of b.decisions) {
      const s = (m: string) => b.scores.find((x) => x.model === m && x.horizonDays === d.horizonDays);
      const a = s("analogue");
      lines.push(
        `| ${SITES[b.site as keyof typeof SITES]?.label ?? b.site} | ${b.origins} | ${d.horizonDays} d | ${f(a?.maeM3s)} | ` +
          `${f(s("persistence")?.maeM3s)} | ${f(s("climatology")?.maeM3s)} | ` +
          `${a?.coverageP10P90 === null || a?.coverageP10P90 === undefined ? "—" : `${(a.coverageP10P90 * 100).toFixed(0)}%`} | ` +
          `${d.ships ? "**yes**" : `no — ${d.reason}`} |`,
      );
    }
  }
  lines.push("");

  const shipped = inputs.backtests.flatMap((b) => b.decisions.filter((d) => d.ships).map((d) => `${b.site} ${d.horizonDays} d`));
  const refused = inputs.backtests.flatMap((b) => b.decisions.filter((d) => !d.ships).map((d) => `${b.site} ${d.horizonDays} d`));
  lines.push(
    `Published: ${shipped.length > 0 ? shipped.join(", ") : "none"}. Recorded negatives: ${refused.length > 0 ? refused.join(", ") : "none"}. ` +
      "Where climatology wins at 14 days the rivers are forgetting today's flow within a fortnight, and the " +
      "honest forecast is the calendar; where persistence wins the flow is regulated upstream enough " +
      "that today's number is the best guess for next week. Neither is published as an inflow forecast, because " +
      "neither is a forecast this repository made.",
  );
  lines.push("");

  lines.push("## Rain conditioning");
  lines.push("");
  for (const p of inputs.precip) {
    lines.push(
      `- ${SITES[p.site as keyof typeof SITES]?.label ?? p.site}: \`${p.basin}\` — ` +
        (p.used ? "adequate ERA5; the analogue pool is conditioned on antecedent rain." : `not conditioned (${p.reason ?? "no ERA5"}).`),
    );
  }
  lines.push("");
  lines.push(
    "The conditioner is the rain that had already fallen, read with ERA5's five-day latency, because that is what a " +
      "forecaster has and what can be backtested. Conditioning on the 16-day *forecast* would need Open-Meteo's " +
      "previous-runs archive, which is not ingested; §5.4's perfect-foresight experiment on Mazar says whether it is worth ingesting.",
  );
  lines.push("");

  lines.push("## Every rung, every plant");
  lines.push("");
  lines.push("| plant | horizon | rung | n | MAE m³/s | bias | coverage p10–p90 (n) | pinball |");
  lines.push("|---|---:|---|---:|---:|---:|---:|---:|");
  for (const b of inputs.backtests) {
    for (const h of options.horizonDays) {
      for (const m of INFLOW_MODELS) {
        const s = b.scores.find((x) => x.model === m && x.horizonDays === h);
        if (!s) continue;
        lines.push(
          `| ${b.site} | ${h} d | ${m} | ${s.n} | ${f(s.maeM3s)} | ${f(s.biasM3s)} | ` +
            `${s.coverageP10P90 === null ? "—" : `${(s.coverageP10P90 * 100).toFixed(0)}%`} (${s.nBand}) | ${f(s.pinballMeanM3s)} |`,
        );
      }
    }
  }
  lines.push("");

  lines.push("## Amaluza's level: not forecast, and why");
  lines.push("");
  lines.push(
    "Amaluza is the one other reservoir where a level forecast could mean something, as the cascade below Mazar. " +
      "The shipped water balance was run on it once (2026-09-23, 105 monthly origins, Amaluza's level and inflow " +
      "with Molino's production as the release): it lost to persistence by 220% at 7 days (MAE 5.55 m against " +
      "1.73 m) and by 119% at 90 days (8.56 m against 3.90 m). Amaluza holds a few hours of Molino's turbine flow " +
      "and is silted; its level moves with the day's dispatch, not with the season, and a rule curve fitted over " +
      "years has nothing to hold on to. A real cascade model would route Mazar's simulated release and the inter-dam " +
      "inflow through a daily dispatch rule for Molino, which this data does not constrain. What is published for " +
      "Amaluza is its inflow, above, where the analogue earns it.",
  );
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
}
