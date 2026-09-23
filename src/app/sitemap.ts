import type { MetadataRoute } from "next";
import { days, latest, reservoirHref } from "../lib/site/data.ts";
import { SITE_URL } from "../lib/publish/contract.ts";

export const dynamic = "force-static";

/**
 * Every page the site builds, dated by the data it shows rather than by the build: the home
 * page and the reservoirs change with each day's reading, and a day's permalink stops changing
 * once that day is published.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = latest();
  const dataDay = now?.data_date ?? undefined;
  const url = (path: string) => `${SITE_URL}${path}`;
  return [
    { url: url("/"), lastModified: dataDay, changeFrequency: "daily", priority: 1 },
    ...(now?.reservoirs ?? [])
      .filter((r) => r.level !== null)
      .map((r) => ({ url: url(reservoirHref(r.site)), lastModified: r.level!.date, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: url("/datos/"), lastModified: dataDay, changeFrequency: "weekly", priority: 0.6 },
    { url: url("/dia/"), lastModified: dataDay, changeFrequency: "daily", priority: 0.5 },
    ...days().map((d) => ({ url: url(`/dia/${d.date}/`), lastModified: d.date, changeFrequency: "never" as const, priority: 0.3 })),
  ];
}
