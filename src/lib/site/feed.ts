/**
 * The Atom feed of the daily reading: one entry per day the validator passed a narrative, newest
 * first, each linking to that day's permanent page.
 *
 * A pure function of the day records, so the route that serves it has nothing to decide and the
 * test can hold the XML to the spec's required elements. Every piece of text is escaped; the
 * narrative is model output and is treated as text, never as markup.
 */

import type { DayRecord } from "./days.ts";
import { longDate } from "./format.ts";

/** Entries kept in the feed. A reader subscribing today needs the last month, not the archive. */
export const FEED_ENTRIES = 30;

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function atomFeed(days: readonly DayRecord[], siteUrl: string): string {
  const entries = days.filter((d) => d.narrative !== null).slice(0, FEED_ENTRIES);
  const updated =
    entries
      .map((d) => d.narrative!.generated_at)
      .sort()
      .at(-1) ?? "1970-01-01T00:00:00Z";
  const lines = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">`,
    `  <title>hydro-look: la lectura del día</title>`,
    `  <subtitle>El sistema hidroeléctrico del Ecuador, en un párrafo por día. No es una fuente oficial.</subtitle>`,
    `  <id>${escapeXml(`${siteUrl}/`)}</id>`,
    `  <link rel="alternate" type="text/html" href="${escapeXml(`${siteUrl}/`)}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(`${siteUrl}/feed.xml`)}"/>`,
    `  <updated>${escapeXml(updated)}</updated>`,
    `  <author><name>hydro-look</name></author>`,
  ];
  for (const day of entries) {
    const n = day.narrative!;
    const url = `${siteUrl}/dia/${day.date}/`;
    const body = [n.outlook_es, ...n.drivers.map((d) => `• ${d}`)].join("\n\n");
    lines.push(
      `  <entry>`,
      `    <title>${escapeXml(`La lectura del ${longDate(day.date)}`)}</title>`,
      `    <id>${escapeXml(url)}</id>`,
      `    <link rel="alternate" type="text/html" href="${escapeXml(url)}"/>`,
      `    <published>${escapeXml(n.generated_at)}</published>`,
      `    <updated>${escapeXml(n.generated_at)}</updated>`,
      `    <summary type="text">${escapeXml(n.outlook_es)}</summary>`,
      `    <content type="text">${escapeXml(body)}</content>`,
      `  </entry>`,
    );
  }
  lines.push(`</feed>`, "");
  return lines.join("\n");
}
