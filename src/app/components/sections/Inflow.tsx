/** Section 03: whether the water is arriving, as Mazar's inflow against its own history. */

import { SectionIntro } from "../Chrome.tsx";
import { InflowPanel } from "../ReservoirParts.tsx";
import { inflowHeadline } from "../../../lib/site/story.ts";
import type { ReservoirSnapshot } from "../../../lib/publish/latest.ts";

export function Inflow({ mazar }: { mazar: ReservoirSnapshot | null }) {
  if (mazar === null) return null;
  return (
    <section id="caudal" className="section section-tight" aria-labelledby="caudal-title">
      <SectionIntro
        index="03"
        eyebrow="El agua que llega"
        titleId="caudal-title"
        title={inflowHeadline(mazar.inflow?.climatology?.percentile_today)}
      >
        La línea es el agua que llegó a Mazar cada día del último año. La franja es lo normal para cada fecha según los registros desde
        2010: 8 de cada 10 años caen dentro. Muestra lo que el río ha hecho, no lo que hará.
      </SectionIntro>
      <InflowPanel reservoir={mazar} />
    </section>
  );
}
