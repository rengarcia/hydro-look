/**
 * `/feed.xml`: the daily reading as Atom. Rendered once at build time into a static file — the
 * route has no request to answer, which is what `force-static` says and what `output: "export"`
 * requires.
 */

import { days } from "../../lib/site/data.ts";
import { atomFeed } from "../../lib/site/feed.ts";
import { SITE_URL } from "../../lib/publish/contract.ts";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(atomFeed(days(), SITE_URL), {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
