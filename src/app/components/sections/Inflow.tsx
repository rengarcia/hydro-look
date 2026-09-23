/** Section 03: whether the water is arriving, as Mazar's inflow against its own history. */

import { SectionIntro } from "../Chrome.tsx";
import { InflowPanel } from "../ReservoirParts.tsx";
import { inflowHeadline } from "../../../lib/site/story.ts";
import type { ReservoirSnapshot } from "../../../lib/publish/latest.ts";

export function Inflow({ mazar }: { mazar: ReservoirSnapshot | null }) {
  if (mazar === null) return null;
  return (
    <section id="caudal" className="section section-tight" aria-labelledby="caudal-title">
      <SectionIntro index="03" eyebrow="Caudal" titleId="caudal-title" title={inflowHeadline(mazar.inflow?.climatology?.percentile_today)}>
        Caudal de entrada a Mazar del último año sobre la franja p10–p90 de los mismos días en todo el registro desde 2010. La franja
        describe lo que este río ha hecho, no lo que vaya a hacer.
      </SectionIntro>
      <InflowPanel reservoir={mazar} />
    </section>
  );
}
