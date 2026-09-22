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
 *   SHA-256 fingerprint and a mismatch aborts the run.
 */

import { readFileSync } from "node:fs";
import { connect as tlsConnect, rootCertificates } from "node:tls";
import { Agent, type Dispatcher } from "undici";
import { repoPath } from "../util/paths.ts";

type PinMode = "enforce" | "advisory";

interface PinRecord {
  sha256: string;
  mode: PinMode;
  captured_on: string;
  notes?: string;
}

interface PinFile {
  hosts: Record<string, PinRecord>;
}

const SMEC_CIPHERS = "DEFAULT@SECLEVEL=1";

let pinsCache: PinFile | null = null;

export function loadPins(): PinFile {
  pinsCache ??= JSON.parse(readFileSync(repoPath("data/reference/tls_pins.json"), "utf8")) as PinFile;
  return pinsCache;
}

export function pinFor(host: string, port: number): PinRecord | undefined {
  return loadPins().hosts[`${host}:${port}`];
}

function cenaceTrustStore(): string[] {
  const extra = readFileSync(repoPath("data/reference/tls/intermediates_www.cenace.gob.ec.pem"), "utf8");
  return [...rootCertificates, extra];
}

/**
 * The certificate SHA-256 as OpenSSL prints it, lowercase and without colons.
 * `weakCiphers` is needed for hosts that will not complete a handshake at the default level.
 */
export async function peerFingerprint(
  host: string,
  port: number,
  opts: { weakCiphers?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const { weakCiphers = false, timeoutMs = 20_000 } = opts;
  return new Promise((resolve, reject) => {
    const socket = tlsConnect(
      {
        host,
        port,
        servername: host,
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
        resolve(fingerprint.replaceAll(":", "").toLowerCase());
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(new Error(`TLS handshake with ${host}:${port} timed out`));
    });
    socket.on("error", reject);
  });
}

export interface PinCheck {
  host: string;
  port: number;
  mode: PinMode;
  expected: string;
  observed: string;
  ok: boolean;
}

/**
 * Handshakes once and compares the fingerprint. An `enforce` mismatch throws; an `advisory`
 * mismatch is returned with `ok: false` for the caller to log, because those certificates are
 * real ones that rotate on their own schedule.
 */
export async function checkPin(host: string, port: number): Promise<PinCheck | null> {
  const pin = pinFor(host, port);
  if (!pin) return null;
  const observed = await peerFingerprint(host, port, { weakCiphers: host === "smec.cenace.gob.ec" });
  const ok = observed === pin.sha256;
  if (!ok && pin.mode === "enforce") {
    throw new Error(
      `TLS pin mismatch for ${host}:${port}\n  expected ${pin.sha256} (captured ${pin.captured_on})\n  observed ${observed}\n` +
        "This host cannot be validated any other way. Re-capture the fingerprint and commit it only after confirming the change is legitimate.",
    );
  }
  return { host, port, mode: pin.mode, expected: pin.sha256, observed, ok };
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
