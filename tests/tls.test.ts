/**
 * The per-host TLS policy, against a local TLS server with a throwaway self-signed certificate
 * (tests/fixtures/tls-local: generated for these tests only, valid to 2126, protects nothing).
 */

import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createServer, type Server } from "node:tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CENACE_INTERMEDIATE,
  checkPin,
  closeAgents,
  dispatcherFor,
  expiryFindings,
  loadPins,
  peerCertificate,
  pinFor,
  type PinFile,
} from "../src/lib/http/tls.ts";
import { repoPath } from "../src/lib/util/paths.ts";
import { FIXTURES } from "./helpers.ts";

const cert = readFileSync(join(FIXTURES, "tls-local", "cert.pem"), "utf8");
const key = readFileSync(join(FIXTURES, "tls-local", "key.pem"), "utf8");
const fingerprint = new X509Certificate(cert).fingerprint256.replaceAll(":", "").toLowerCase();

let server: Server;
let port = 0;
beforeAll(async () => {
  server = createServer({ cert, key }, (socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeAgents();
});

const pins = (mode: "enforce" | "advisory", sha256: string): PinFile => ({
  hosts: { [`127.0.0.1:${port}`]: { sha256, mode, captured_on: "2026-09-23" } },
});

describe("pins", () => {
  it("reads the committed pins, including the ORDS expiry nothing used to read", () => {
    expect(pinFor("smec.cenace.gob.ec", 443)?.mode).toBe("enforce");
    expect(pinFor("generacioncsr.celec.gob.ec", 8443)?.not_after).toBe("2027-04-03");
    expect(pinFor("example.org", 443)).toBeUndefined();
    expect(Object.keys(loadPins().hosts)).toHaveLength(3);
  });

  it("fingerprints the peer the way OpenSSL prints it, with its expiry", async () => {
    const peer = await peerCertificate("127.0.0.1", port);
    expect(peer.sha256).toBe(fingerprint);
    expect(peer.notAfter.slice(0, 4)).toBe("2126");
  });

  it("passes a matching pin and skips an unpinned host", async () => {
    expect(await checkPin("127.0.0.1", port, pins("enforce", fingerprint))).toMatchObject({ ok: true, mode: "enforce" });
    expect(await checkPin("127.0.0.1", port, { hosts: {} })).toBeNull();
  });

  it("throws on an enforced mismatch and reports an advisory one", async () => {
    await expect(checkPin("127.0.0.1", port, pins("enforce", "00".repeat(32)))).rejects.toThrow(/TLS pin mismatch for 127\.0\.0\.1/);
    expect(await checkPin("127.0.0.1", port, pins("advisory", "00".repeat(32)))).toMatchObject({ ok: false, observed: fingerprint });
  });

  it("fails a handshake with nothing listening instead of hanging", async () => {
    await expect(peerCertificate("127.0.0.1", 1, { timeoutMs: 2_000 })).rejects.toThrow();
  });
});

describe("dispatchers", () => {
  it("gives SMEC and the CENACE site their own agents and leaves every other host on the defaults", () => {
    const smec = dispatcherFor("https://smec.cenace.gob.ec/SMEC/ResultadoInforme1.do");
    expect(smec).toBeDefined();
    expect(dispatcherFor(new URL("https://smec.cenace.gob.ec/other"))).toBe(smec);
    expect(dispatcherFor("https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm")).toBeDefined();
    expect(dispatcherFor("https://generacioncsr.celec.gob.ec:8443/ords/csr")).toBeUndefined();
  });
});

describe("expiry", () => {
  const intermediate = { name: "cenace intermediate", pem: readFileSync(repoPath(CENACE_INTERMEDIATE), "utf8") };

  it("reads the committed pins and intermediate: nothing near expiry today", () => {
    const findings = expiryFindings(loadPins(), [intermediate], "2026-09-23");
    expect(findings.map((f) => f.subject)).toEqual([
      "pinned leaf for generacioncsr.celec.gob.ec:8443",
      "cenace intermediate: Sectigo Public Server Authentication CA DV R36",
    ]);
    expect(findings.every((f) => f.level === "ok")).toBe(true);
    expect(findings[1]!.not_after).toBe("2036-03-21");
  });

  it("warns thirty days before the ORDS leaf expires and fails once it has", () => {
    const warn = expiryFindings(loadPins(), [], "2027-03-10");
    expect(warn[0]).toMatchObject({ level: "warn", days_left: 24 });
    expect(warn[0]!.message).toMatch(/expires in 24 days \(2027-04-03\)/);
    expect(expiryFindings(loadPins(), [], "2027-03-04")[0]!.level).toBe("warn");
    expect(expiryFindings(loadPins(), [], "2027-03-03")[0]!.level).toBe("ok");
    expect(expiryFindings(loadPins(), [], "2027-04-05")[0]).toMatchObject({ level: "fail", days_left: -2 });
  });
});
