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
import { adequacyHeadline, heroHeadline, inflowHeadline } from "../src/lib/site/story.ts";
import type { LatestDocument } from "../src/lib/publish/latest.ts";
import type { AdequacyDocument } from "../src/lib/site/documents.ts";

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
    expect(textOf(home)).toContain(`el peor de los horizontes, a ${adequacy.current.worst_tier_horizon_days} días`);
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

describe("Mazar's page, from fixtures", () => {
  it("keeps its sections: record, crossing, foresight, inflow and floors", () => {
    const text = textOf(mazar);
    for (const heading of ["El registro completo", "¿Cuándo cruzaría", "¿Lo habría visto venir?", "Caudal frente a su historia", "Dos pisos, los dos de CELEC"]) {
      expect(text).toContain(heading);
    }
  });

  it("draws the analogue-year strip as one image with its count as its name", () => {
    expect(mazar).toMatch(/class="years" role="img" aria-label="\d+ de \d+ años análogos cruzan/);
  });
});
