/**
 * The frame of every page of the site proper: skip link, contours, masthead and footer. The
 * embeddable cards under `/embed/` sit outside this group, because a card inside a news article
 * must not carry the site's navigation.
 */

import { Frame } from "../components/Chrome.tsx";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <Frame>{children}</Frame>;
}
