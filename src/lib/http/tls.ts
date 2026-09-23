/**
 * Per-host TLS policy.
 *
 * Three hosts, three different problems, none of them solved by turning verification off
 * globally:
 *
 * - `generacioncsr.celec.gob.ec:8443` (CELEC ORDS) has had a valid Sectigo certificate since
 *   2026-09-17, so it needs nothing at all. Its pin is advisory.
 * - `www.cenace.gob.ec` serves a valid leaf but omits its intermediate. The intermediate is
 *   published in the leaf's AIA field and committed under data/reference/tls/; appending it
 *   to the trust store makes normal verification succeed.
 * - `smec.cenace.gob.ec` serves a self-signed certificate that expired in 2009 and only
 *   negotiates at SECLEVEL=1. Chain validation is impossible, so the certificate is pinned by
 *   SHA-256 fingerprint and a mismatch fails every request to that host (the client checks the
 *   pin before a host's first request; see http/client.ts). The other sources carry on.
 */

import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { connect as tlsConnect, rootCertificates } from "node:tls";
import { Agent, type Dispatcher } from "undici";
import { repoPath } from "../util/paths.ts";

type PinMode = "enforce" | "advisory";

export interface PinRecord {
  sha256: string;
  mode: PinMode;
  captured_on: string;
  /** The leaf's expiry, where one was recorded (YYYY-MM-DD). */
  not_after?: string;
  notes?: string;
}

export interface PinFile {
  hosts: Record<string, PinRecord>;
}

const SMEC_CIPHERS = "DEFAULT@SECLEVEL=1";
export const CENACE_INTERMEDIATE = "data/reference/tls/intermediates_www.cenace.gob.ec.pem";

let pinsCache: PinFile | null = null;

export function loadPins(): PinFile {
  pinsCache ??= JSON.parse(readFileSync(repoPath("data/reference/tls_pins.json"), "utf8")) as PinFile;
  return pinsCache;
}

export function pinFor(host: string, port: number, pins: PinFile = loadPins()): PinRecord | undefined {
  return pins.hosts[`${host}:${port}`];
}

function cenaceTrustStore(): string[] {
  const extra = readFileSync(repoPath(CENACE_INTERMEDIATE), "utf8");
  return [...rootCertificates, extra];
}

export interface ExpiryFinding {
  subject: string;
  not_after: string;
  days_left: number;
  level: "ok" | "warn" | "fail";
  message: string;
}

/**
 * What expires when, from what is committed: each pin's recorded `not_after` and every
 * certificate in the committed intermediate bundles. Nothing read the ORDS leaf's 2027-04-03
 * before this, so the first sign of its expiry would have been a failed run.
 *
 * `warn` inside `warnDays`, `fail` once expired. A pin without `not_after` is skipped: SMEC's
 * certificate expired in 2009 and is trusted by fingerprint alone, which is the point of it.
 */
export function expiryFindings(
  pins: PinFile,
  bundles: { name: string; pem: string }[],
  today: string,
  warnDays = 30,
): ExpiryFinding[] {
  const findings: ExpiryFinding[] = [];
  const judge = (subject: string, notAfter: string): void => {
    const daysLeft = Math.floor((Date.parse(`${notAfter.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const level = daysLeft < 0 ? "fail" : daysLeft <= warnDays ? "warn" : "ok";
    const when = daysLeft < 0 ? `expired ${-daysLeft} days ago` : `expires in ${daysLeft} days`;
    findings.push({ subject, not_after: notAfter.slice(0, 10), days_left: daysLeft, level, message: `${subject} ${when} (${notAfter.slice(0, 10)})` });
  };
  for (const [host, pin] of Object.entries(pins.hosts)) {
    if (pin.not_after) judge(`pinned leaf for ${host}`, pin.not_after);
  }
  for (const bundle of bundles) {
    const blocks = bundle.pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
    for (const block of blocks) {
      const cert = new X509Certificate(block);
      const subject = /CN=([^\n,]+)/.exec(cert.subject)?.[1] ?? cert.subject;
      judge(`${bundle.name}: ${subject}`, new Date(cert.validTo).toISOString());
    }
  }
  return findings;
}

/**
 * The peer's leaf certificate: its SHA-256 as OpenSSL prints it (lowercase, no colons) and its
 * expiry. `weakCiphers` is needed for hosts that will not complete a handshake at the default
 * level.
 */
export async function peerCertificate(
  host: string,
  port: number,
  opts: { weakCiphers?: boolean; timeoutMs?: number } = {},
): Promise<{ sha256: string; notAfter: string }> {
  const { weakCiphers = false, timeoutMs = 20_000 } = opts;
  return new Promise((resolve, reject) => {
    const socket = tlsConnect(
      {
        host,
        port,
        // SNI carries names only; an address (a test server) gets none.
        ...(isIP(host) ? {} : { servername: host }),
        rejectUnauthorized: false,
        ...(weakCiphers ? { ciphers: SMEC_CIPHERS, minVersion: "TLSv1" as const } : {}),
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        const fingerprint = cert?.fingerprint256;
        if (!fingerprint) {
          reject(new Error(`no peer certificate from ${host}:${port}`));
          return;
        }
        resolve({ sha256: fingerprint.replaceAll(":", "").toLowerCase(), notAfter: new Date(cert.valid_to).toISOString() });
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(new Error(`TLS handshake with ${host}:${port} timed out`));
    });
    socket.on("error", reject);
  });
}

export async function peerFingerprint(
  host: string,
  port: number,
  opts: { weakCiphers?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  return (await peerCertificate(host, port, opts)).sha256;
}

export interface PinCheck {
  host: string;
  port: number;
  mode: PinMode;
  expected: string;
  observed: string;
  /** The observed leaf's expiry, so a scheduled check can see a renewal coming. */
  observedNotAfter: string;
  ok: boolean;
}

/**
 * Handshakes once and compares the fingerprint. An `enforce` mismatch throws; an `advisory`
 * mismatch is returned with `ok: false` for the caller to log, because those certificates are
 * real ones that rotate on their own schedule.
 */
export async function checkPin(host: string, port: number, pins: PinFile = loadPins()): Promise<PinCheck | null> {
  const pin = pinFor(host, port, pins);
  if (!pin) return null;
  const observed = await peerCertificate(host, port, { weakCiphers: host === "smec.cenace.gob.ec" });
  const ok = observed.sha256 === pin.sha256;
  if (!ok && pin.mode === "enforce") {
    throw new Error(
      `TLS pin mismatch for ${host}:${port}\n  expected ${pin.sha256} (captured ${pin.captured_on})\n  observed ${observed.sha256}\n` +
        "This host cannot be validated any other way. Re-capture the fingerprint and commit it only after confirming the change is legitimate.",
    );
  }
  return { host, port, mode: pin.mode, expected: pin.sha256, observed: observed.sha256, observedNotAfter: observed.notAfter, ok };
}

/**
 * The dispatcher to use for a URL, or undefined when Node's defaults are correct.
 * Agents are cached: one connection pool per host for the life of the process.
 */
const agents = new Map<string, Agent>();

export function dispatcherFor(url: string | URL): Dispatcher | undefined {
  const { hostname } = typeof url === "string" ? new URL(url) : url;
  const cached = agents.get(hostname);
  if (cached) return cached;

  let agent: Agent | undefined;
  if (hostname === "smec.cenace.gob.ec") {
    // Verification is off for this host only, and only because its certificate is self-signed
    // and expired; checkPin() is what actually establishes its identity, before any request.
    agent = new Agent({
      connect: { ciphers: SMEC_CIPHERS, minVersion: "TLSv1", rejectUnauthorized: false, servername: hostname },
    });
  } else if (hostname === "www.cenace.gob.ec") {
    agent = new Agent({ connect: { ca: cenaceTrustStore(), servername: hostname } });
  }

  if (agent) agents.set(hostname, agent);
  return agent;
}

export async function closeAgents(): Promise<void> {
  await Promise.all([...agents.values()].map((a) => a.close()));
  agents.clear();
}
