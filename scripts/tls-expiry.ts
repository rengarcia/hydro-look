#!/usr/bin/env node
/**
 * What in the TLS setup expires or has changed, for the weekly `tls-expiry.yml`.
 *
 *   npx tsx scripts/tls-expiry.ts                 committed facts only: pins' not_after, intermediates
 *   npx tsx scripts/tls-expiry.ts --live          also handshake with every pinned host
 *   npx tsx scripts/tls-expiry.ts --out report.md
 *
 * Committed facts: each pin's recorded `not_after` (the ORDS leaf, 2027-04-03) and every
 * certificate in data/reference/tls/*.pem (the CENACE intermediate this pipeline appends to the
 * trust store). Live: each pinned host's current leaf — an advisory pin that no longer matches
 * means the certificate rotated and the pin wants re-capturing, an enforced one that no longer
 * matches means SMEC requests are failing, and a served leaf inside the window is an expiry the
 * committed `not_after` may not know about.
 *
 * Anything within 30 days, expired, or changed exits 1, which is what the workflow opens its
 * issue on. Prints Markdown either way.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { checkPin, expiryFindings, judgeExpiry, loadPins, type ExpiryFinding } from "../src/lib/http/tls.ts";
import { todayEc } from "../src/lib/util/dates.ts";
import { DATA_REFERENCE } from "../src/lib/util/paths.ts";

const WARN_DAYS = 30;

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { live: { type: "boolean", default: false }, out: { type: "string" } },
  });
  const today = todayEc();
  const pins = loadPins();
  const directory = join(DATA_REFERENCE, "tls");
  const bundles = readdirSync(directory)
    .filter((f) => f.endsWith(".pem"))
    .sort()
    .map((f) => ({ name: `data/reference/tls/${f}`, pem: readFileSync(join(directory, f), "utf8") }));

  const findings: ExpiryFinding[] = expiryFindings(pins, bundles, today, WARN_DAYS);

  if (values.live) {
    for (const hostPort of Object.keys(pins.hosts)) {
      const [host, port] = hostPort.split(":") as [string, string];
      const subject = `served leaf for ${hostPort}`;
      try {
        const check = await checkPin(host, Number(port));
        if (!check) continue;
        if (!check.ok) {
          findings.push({
            subject,
            not_after: "",
            days_left: 0,
            level: "warn",
            message: `${subject} no longer matches its ${check.mode} pin: observed ${check.observed}, pinned ${check.expected}`,
          });
        }
        // SMEC's leaf expired in 2009 and is trusted by fingerprint alone; its date means nothing.
        if (check.mode === "advisory") findings.push(judgeExpiry(subject, check.observedNotAfter, today, WARN_DAYS));
      } catch (error) {
        findings.push({ subject, not_after: "", days_left: 0, level: "fail", message: `${subject}: ${String(error).split("\n")[0]}` });
      }
    }
  }

  const flagged = findings.filter((f) => f.level !== "ok");
  const lines = [
    `### TLS expiry and pins (${today})`,
    "",
    "| Certificate | Not after | Days left | State |",
    "|---|---|---:|---|",
    ...findings.map((f) => `| ${f.subject} | ${f.not_after || "—"} | ${f.not_after ? f.days_left : "—"} | ${f.level} |`),
    "",
    ...(flagged.length === 0
      ? ["Nothing expires within 30 days and every pin matches."]
      : flagged.map((f) => `- **${f.level}**: ${f.message}`)),
  ];
  const text = `${lines.join("\n")}\n`;
  process.stdout.write(text);
  if (values.out) writeFileSync(values.out, text);
  process.exitCode = flagged.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
