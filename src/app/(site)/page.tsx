/**
 * The site's home page. Rendered to static HTML at build time from the committed data.
 *
 * The order is the order of the questions: what is the country running on today, what changed
 * since yesterday, what does the day's reading say, how full are the reservoirs, where is the one
 * with real storage going, is the water arriving, where did yesterday's electricity come from,
 * will there be enough, and can any of it be trusted. Every section that shows a modelled number
 * shows the measurement of that model beside it, because a forecast without its skill score is a
 * number with no units.
 *
 * Every headline is built from the day's numbers by `lib/site/story.ts`, never written into the
 * page: a sentence that stops being true is a wrong number in large type. Each section is its own
 * component under `components/sections/`; this file only reads the documents and orders them.
 */

import { MAIN_ID } from "../components/Chrome.tsx";
import { Hero } from "../components/sections/Hero.tsx";
import { Today } from "../components/sections/Today.tsx";
import { SinceYesterday } from "../components/sections/SinceYesterday.tsx";
import { Reading } from "../components/sections/Reading.tsx";
import { Reservoirs } from "../components/sections/Reservoirs.tsx";
import { Mazar } from "../components/sections/Mazar.tsx";
import { Inflow } from "../components/sections/Inflow.tsx";
import { National } from "../components/sections/National.tsx";
import { Adequacy } from "../components/sections/Adequacy.tsx";
import { Data } from "../components/sections/Data.tsx";
import { Method } from "../components/sections/Method.tsx";
import { apiDocument, dataDate, latest } from "../../lib/site/data.ts";
import type { AdequacyDocument, ForecastDocument, NarrativeDocument, StatusDocument } from "../../lib/site/documents.ts";

export default function HomePage() {
  const now = latest();
  const forecast = apiDocument<ForecastDocument>("forecast.json");
  const adequacy = apiDocument<AdequacyDocument>("adequacy.json");
  const status = apiDocument<StatusDocument>("status.json");
  const narrative = apiDocument<NarrativeDocument>("narrative.json");
  const asOf = dataDate(now);
  const mazar = now?.reservoirs.find((r) => r.site === "mazar") ?? null;

  return (
    <main id={MAIN_ID} className="stack-xl">
      <div>
        <Hero now={now} mazar={mazar} forecast={forecast} adequacy={adequacy} asOf={asOf} />
        <Today now={now} adequacy={adequacy} narrative={narrative} />
        <SinceYesterday now={now} />
      </div>
      <Reading narrative={narrative} forecast={forecast} adequacy={adequacy} />
      <Reservoirs now={now} />
      <Mazar forecast={forecast} />
      <div className="shell split even">
        <Inflow mazar={mazar} />
        <National now={now} />
      </div>
      <Adequacy adequacy={adequacy} />
      <Data status={status} narrative={narrative !== null} />
      <Method forecast={forecast} adequacy={adequacy} />
    </main>
  );
}
