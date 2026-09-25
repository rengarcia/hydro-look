/**
 * The page, rendered. `renderToStaticMarkup` over the home page and Mazar's page, built from
 * `tests/fixtures/site/` exactly as `next build` builds them from the repository.
 *
 * This is a smoke test with one sharp edge: the headline sentences are computed here by the same
 * `story.ts` rules from the fixture's numbers, and must appear in the HTML. A section that stops
 * rendering, a document field that goes missing, or a headline that is no longer wired to its
 * number fails here — before it is a blank space or a stale sentence on the live page.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adequacyHeadline,
  heroHeadline,
  importDependence,
  inflowHeadline,
  inflowVerdict,
  REGULATED_UPSTREAM,
  returnPeriodAgreement,
  returnPeriodReachedWords,
  scorecardSummary,
} from "../src/lib/site/story.ts";
import type { LatestDocument } from "../src/lib/publish/latest.ts";
import type { AdequacyDocument, ForecastDocument, ScorecardBlock, ScorecardRow } from "../src/lib/site/documents.ts";
// Types only: the modules themselves are imported after HYDRO_LOOK_SITE_ROOT is set.
import type { Mazar } from "../src/app/components/sections/Mazar.tsx";
import type { Adequacy } from "../src/app/components/sections/Adequacy.tsx";
import type { Method } from "../src/app/components/sections/Method.tsx";
import type { DayScore, ScorecardPanel } from "../src/app/components/Scorecard.tsx";
import type { InflowForecastPanel } from "../src/app/components/InflowForecast.tsx";
import type { nextScoreDue } from "../src/lib/site/data.ts";

const FIXTURE = join(process.cwd(), "tests", "fixtures", "site");
const readJson = <T>(name: string) => JSON.parse(readFileSync(join(FIXTURE, "public", "api", name), "utf8")) as T;

/** The text a reader sees: tags dropped, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

let home = "";
let mazar = "";

beforeAll(async () => {
  process.env["HYDRO_LOOK_SITE_ROOT"] = FIXTURE;
  const { default: HomePage } = await import("../src/app/(site)/page.tsx");
  const { default: MazarPage } = await import("../src/app/(site)/embalses/mazar/page.tsx");
  const { Frame } = await import("../src/app/components/Chrome.tsx");
  home = renderToStaticMarkup(createElement(Frame, null, createElement(HomePage)));
  mazar = renderToStaticMarkup(createElement(Frame, null, createElement(MazarPage)));
});

afterAll(() => {
  delete process.env["HYDRO_LOOK_SITE_ROOT"];
});

describe("the home page, from fixtures", () => {
  const latest = readJson<LatestDocument>("latest.json");
  const adequacy = readJson<AdequacyDocument>("adequacy.json");

  it("prints the day's headline from the hydro share", () => {
    expect(textOf(home)).toContain(heroHeadline(latest.national?.hydro_share_pct).text);
  });

  it("prints the inflow and adequacy headlines the rules give for the fixture's numbers", () => {
    const mazarNow = latest.reservoirs.find((r) => r.site === "mazar")!;
    expect(textOf(home)).toContain(inflowHeadline(mazarNow.inflow?.climatology?.percentile_today));
    expect(textOf(home)).toContain(adequacyHeadline(adequacy.horizons));
  });

  it("renders every section, in order", () => {
    const ids = ["lectura", "embalses", "mazar", "caudal", "balance", "suficiencia", "datos", "metodo"];
    const at = ids.map((id) => home.indexOf(`id="${id}"`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("starts with a skip link to the page's main element", () => {
    expect(home.indexOf('class="skip-link" href="#contenido"')).toBeLessThan(home.indexOf("<header"));
    expect(home).toContain('<main id="contenido"');
  });

  it("links every reservoir to its own page", () => {
    for (const r of latest.reservoirs) expect(home).toContain(`href="/embalses/${r.site}/"`);
  });

  it("says since yesterday what latest.json's delta says", () => {
    expect(textOf(home)).toContain("Desde ayer");
  });

  it("names the tier the reading was written about", () => {
    expect(textOf(home)).toContain(`el peor momento de los próximos meses: dentro de ${adequacy.current.worst_tier_horizon_days} días`);
  });

  it("uses real tables with header cells, and folds a data table under each chart", () => {
    expect(home).toMatch(/<th scope="col"/);
    expect(home).toMatch(/<th scope="row"/);
    expect(home.match(/<details class="chart-data">/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("carries no inline colour: every colour is a class", () => {
    expect(home).not.toMatch(/style="[^"]*(background|color):\s*var\(--/);
  });
});

describe("documents written before the additive blocks", () => {
  it("render the home page without a scorecard, a sensitivity table or the model notes", () => {
    const text = textOf(home);
    expect(text).not.toContain("Cómo les fue a los pronósticos publicados");
    expect(text).not.toContain("¿Cuánto depende de Colombia?");
    expect(text).not.toContain("Dónde se mide la lluvia");
  });

  it("render a plant's page and a day's page without an inflow forecast or a scorecard", async () => {
    const { default: ReservoirPage } = await import("../src/app/(site)/embalses/[site]/page.tsx");
    const { default: DayPage } = await import("../src/app/(site)/dia/[date]/page.tsx");
    const plant = textOf(renderToStaticMarkup(await ReservoirPage({ params: Promise.resolve({ site: "amaluza" }) })));
    expect(plant).toContain("Solo Mazar tiene pronóstico de nivel");
    // Amaluza has both columns, and says that Mazar, upstream, decides part of what arrives.
    expect(plant).toContain("INAMHI (GEOGLOWS)");
    expect(plant).toContain("Registro de CELEC");
    expect(plant).toContain(REGULATED_UPSTREAM["amaluza"]!);
    expect(plant).not.toContain("Pronóstico del agua que llegará");
    const day = textOf(renderToStaticMarkup(await DayPage({ params: Promise.resolve({ date: "2026-09-21" }) })));
    expect(day).toContain("Pronóstico del nivel de Mazar");
    expect(day).not.toContain("¿Acertó?");
  });
});

/**
 * The blocks the model scripts added (§5.1, §5.3, §5.5), taken from the committed documents and
 * grafted onto the fixture's, so the components are rendered against the shape the scripts really
 * write while the fixture's older documents keep proving the page renders without them.
 */
describe("the additive blocks, rendered", () => {
  const api = join(process.cwd(), "public", "api");
  const committed = <T>(name: string) => JSON.parse(readFileSync(join(api, name), "utf8")) as T;
  const liveForecast = committed<ForecastDocument>("forecast.json");
  const liveAdequacy = committed<AdequacyDocument>("adequacy.json");
  const forecast = {
    ...readJson<ForecastDocument>("forecast.json"),
    scorecard: liveForecast.scorecard,
    precipitation_basin: liveForecast.precipitation_basin,
  };
  const adequacy = {
    ...readJson<AdequacyDocument>("adequacy.json"),
    scorecard: liveAdequacy.scorecard,
    import_sensitivity: liveAdequacy.import_sensitivity,
    band_method: liveAdequacy.band_method,
  };
  const pendingCard: ScorecardBlock = {
    generated_at: "2026-09-23T05:56:15Z",
    observed_through: "2026-09-21",
    target: "level on the target day, m",
    units: "m",
    runs_considered: 2,
    runs_superseded: 1,
    rows_scored: 0,
    rows_pending: 10,
    rows_excluded: 0,
    method: "",
    by_horizon: [],
    recent: [],
  };
  const scoredRow: ScorecardRow = {
    run_id: "2026-09-21-mazar-2-3eaa4e38",
    model_id: "M3-water-balance",
    model_version: "2",
    origin_date: "2026-09-21",
    horizon_days: 7,
    target_date: "2026-09-28",
    p10: 2130,
    p50: 2135,
    p90: 2140,
    observed: 2136.5,
    error: 1.5,
    in_band: true,
  };
  const scoredCard: ScorecardBlock = {
    ...pendingCard,
    observed_through: "2026-09-28",
    rows_scored: 1,
    rows_pending: 9,
    by_horizon: [
      {
        model_id: "M3-water-balance",
        model_version: "2",
        horizon_days: 7,
        n: 1,
        mae: 1.5,
        bias: 1.5,
        n_band: 1,
        coverage_p10_p90: 1,
        pinball_mean: 0.5,
        first_origin: "2026-09-21",
        last_origin: "2026-09-21",
      },
    ],
    recent: [scoredRow],
  };

  let render: (element: ReturnType<typeof createElement>) => string;
  let components: {
    Mazar: typeof Mazar;
    Adequacy: typeof Adequacy;
    Method: typeof Method;
    ScorecardPanel: typeof ScorecardPanel;
    DayScore: typeof DayScore;
    InflowForecastPanel: typeof InflowForecastPanel;
    nextScoreDue: typeof nextScoreDue;
  };

  beforeAll(async () => {
    render = (element) => renderToStaticMarkup(element);
    components = {
      ...(await import("../src/app/components/sections/Mazar.tsx")),
      ...(await import("../src/app/components/sections/Adequacy.tsx")),
      ...(await import("../src/app/components/sections/Method.tsx")),
      ...(await import("../src/app/components/Scorecard.tsx")),
      ...(await import("../src/app/components/InflowForecast.tsx")),
      ...(await import("../src/lib/site/data.ts")),
    };
  });

  it("the committed documents carry every block", () => {
    expect(liveForecast.scorecard).toBeDefined();
    expect(liveForecast.inflow_forecasts?.plants.length).toBeGreaterThan(0);
    expect(liveForecast.precipitation_basin).toBeDefined();
    expect(liveAdequacy.scorecard).toBeDefined();
    expect(liveAdequacy.import_sensitivity?.cases.length).toBeGreaterThan(0);
    expect(liveAdequacy.band_method).toBeDefined();
  });

  it("beside the fan, says nothing has been scored yet and when the first row falls due, with no empty table", () => {
    const html = render(createElement(components.Mazar, { forecast: { ...forecast, scorecard: pendingCard } }));
    const due = components.nextScoreDue("forecast", pendingCard.observed_through);
    expect(due).not.toBeNull();
    const text = textOf(html);
    expect(text).toContain("Cómo les fue a los pronósticos publicados");
    expect(text).toContain(scorecardSummary(pendingCard, due).headline);
    expect(text).toContain("el primero se comprueba el");
    expect(text).not.toContain("Error medio");
  });

  it("once rows are scored, shows them in a real table by horizon, with the rows folded under it", () => {
    const html = render(
      createElement(components.ScorecardPanel, { card: scoredCard, nextDue: "2026-10-05", subject: "el nivel de Mazar", digits: 2 }),
    );
    expect(html).toMatch(/<th scope="col"[^>]*>Error medio<\/th>/);
    expect(html).toMatch(/<th scope="row"[^>]*>7 días<\/th>/);
    expect(html).toContain('<details class="chart-data">');
    expect(textOf(html)).toContain("1 pronóstico publicado ya comprobado con los datos reales hasta el 28 de septiembre de 2026.");
  });

  it("in the adequacy section, tables the tier under each import case and carries the scorecard", () => {
    const html = render(createElement(components.Adequacy, { adequacy }));
    const text = textOf(html);
    expect(text).toContain("¿Cuánto depende de Colombia?");
    expect(text).toContain(importDependence(adequacy.import_sensitivity!)!);
    expect(text).toContain("el que usa la cuenta");
    expect(html).toMatch(/<th scope="row"[^>]*><span>El máximo visto/);
    expect(text).toContain("Cómo les fue a los pronósticos publicados");
    expect(text).toContain("El faltante no se comprueba");
  });

  it("names the rain's basin and the band's calibration in the method notes", () => {
    const text = textOf(render(createElement(components.Method, { forecast, adequacy })));
    expect(text).toContain(`Dónde se mide la lluvia: ${liveForecast.precipitation_basin!.basin}`);
    expect(text).toContain("Cómo se calcula el rango de la cuenta de energía");
  });

  it("on a day's page, says which of the run's horizons have reached their date and shows its scored rows", () => {
    const horizons = [
      { horizon_days: 7, target_date: "2026-09-28" },
      { horizon_days: 14, target_date: "2026-10-05" },
    ];
    const pending = textOf(
      render(
        createElement(components.DayScore, { card: pendingCard, runId: scoredRow.run_id, horizons, digits: 2, subject: "x", href: "/#m" }),
      ),
    );
    expect(pending).toContain(
      "Todavía no llega la fecha de ninguno de sus plazos; el primero, a 7 días, se comprueba el 28 de septiembre de 2026.",
    );
    const scored = render(
      createElement(components.DayScore, { card: scoredCard, runId: scoredRow.run_id, horizons, digits: 2, subject: "x", href: "/#m" }),
    );
    expect(textOf(scored)).toContain("Ya llegó la fecha de uno de sus 2 plazos");
    expect(scored).toMatch(/<th scope="row"[^>]*>28 sep 2026<\/th>/);
    expect(
      render(createElement(components.DayScore, { card: undefined, runId: "x", horizons, digits: 2, subject: "x", href: "/#m" })),
    ).toBe("");
  });

  it("on a plant's page, lists every inflow horizon with its backtest, and why the unpublished ones are not", () => {
    // Since the ensemble every horizon of every plant ships, so the withheld case is built from a
    // real plant by withholding its last horizon, as the forecast script would with a losing backtest.
    const live = liveForecast.inflow_forecasts!.plants.find(
      (p) => p.horizons.length >= 2 && p.horizons.some((h) => h.with_river_forecast),
    )!;
    const last = live.horizons.at(-1)!;
    const plant = {
      ...live,
      horizons: [
        ...live.horizons.slice(0, -1),
        {
          horizon_days: last.horizon_days,
          published: false,
          reason: "ensemble MAE 9.9 m3/s does not beat persistence (9.0)",
          backtest: last.backtest,
        },
      ],
    };
    const html = render(createElement(components.InflowForecastPanel, { plant, report: "data/reports/inflow.md", label: plant.site }));
    const text = textOf(html);
    for (const h of plant.horizons) {
      expect(html).toMatch(new RegExp(`<th scope="row"[^>]*><span>${h.horizon_days} días`));
      expect(text).toContain(inflowVerdict(h));
    }
    expect(text).toContain("no se publica");
    // A published horizon that had GEOGLOWS among its members says so.
    expect(text).toContain("Incluye el pronóstico de caudal de GEOGLOWS");
    expect(render(createElement(components.InflowForecastPanel, { plant: null, label: "x" }))).toBe("");
  });
});

describe("Mazar's page, from fixtures", () => {
  it("keeps its sections: record, crossing, foresight, inflow, floors and return periods", () => {
    const text = textOf(mazar);
    for (const heading of [
      "Toda su historia",
      "¿Bajaría de",
      "¿Lo habría visto venir?",
      "El agua que llega, frente a otros años",
      "Dos niveles mínimos, los dos de CELEC",
      "Crecidas: cada cuántos años llega tanta agua",
    ]) {
      expect(text).toContain(heading);
    }
  });

  it("puts GEOGLOWS' return periods beside the record's, and says how far apart they are", () => {
    const periods = readJson<LatestDocument>("latest.json").reservoirs.find((r) => r.site === "mazar")!.inflow!.return_periods;
    const [model, measured] = [periods.geoglows!.inamhi[0]!.m3s, periods.measured!.values[0]!.m3s];
    const text = textOf(mazar);
    expect(text).toContain(returnPeriodAgreement(model, measured));
    expect(text).toContain(`según el INAMHI, ${returnPeriodReachedWords(periods.geoglows!.reached_years, model)}`);
  });

  it("draws the analogue-year strip as one image with its count as its name", () => {
    expect(mazar).toMatch(/class="years" role="img" aria-label="En \d+ de \d+ años de lluvias el nivel baja de/);
  });
});
