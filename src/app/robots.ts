import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/publish/contract.ts";

export const dynamic = "force-static";

/** Everything may be crawled except the embeddable cards, whose pages are the ones to find. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/embed/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
