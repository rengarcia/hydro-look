/**
 * The HTTP client against a real local server, so retry, pacing and the deadline are exercised
 * through undici itself rather than a stub: a 429 with Retry-After, 500s, a truncated body, a
 * host that hangs, and a pin check that fails.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpClient, retryAfterMs } from "../src/lib/http/client.ts";

type Handler = (req: IncomingMessage, res: ServerResponse, hit: number) => void;

let base = "";
const handlers = new Map<string, Handler>();
const hits = new Map<string, number[]>();
const server = createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  const times = hits.get(path) ?? [];
  times.push(Date.now());
  hits.set(path, times);
  const handler = handlers.get(path);
  if (!handler) {
    res.writeHead(404).end("no route");
    return;
  }
  handler(req, res, times.length);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** A client fast enough for a test: tiny backoff, no jitter, no pin check. */
const client = (options: ConstructorParameters<typeof HttpClient>[0] = {}) =>
  new HttpClient({ minIntervalMs: 0, retryBaseMs: 5, random: () => 0.5, pinCheck: async () => null, ...options });

describe("HttpClient retries", () => {
  it("retries a 500 and returns the first good answer, counting every attempt", async () => {
    handlers.set("/flaky", (_req, res, hit) => (hit < 3 ? res.writeHead(500).end("oops") : res.writeHead(200).end("fine")));
    const http = client();
    const result = await http.fetch({ key: "flaky", url: `${base}/flaky` });
    expect(result).toMatchObject({ status: 200, body: "fine", attempts: 3 });
    expect(http.count).toBe(3);
    expect(http.countByHost).toEqual({ "127.0.0.1": 3 });
  });

  it("returns the final 500 once the retries are spent, so the caller can archive and record it", async () => {
    handlers.set("/down", (_req, res) => res.writeHead(500).end("still down"));
    const http = client({ maxRetries: 2 });
    const result = await http.fetch({ key: "down", url: `${base}/down` });
    expect(result).toMatchObject({ status: 500, body: "still down", attempts: 3 });
    expect(http.count).toBe(3);
  });

  it("honours Retry-After on a 429 instead of its own backoff", async () => {
    handlers.set("/limited", (_req, res, hit) =>
      hit === 1 ? res.writeHead(429, { "retry-after": "1" }).end("slow down") : res.writeHead(200).end("ok"),
    );
    const result = await client().fetch({ key: "limited", url: `${base}/limited` });
    expect(result.status).toBe(200);
    const [first, second] = hits.get("/limited")!;
    // The backoff alone would have waited ~10 ms.
    expect(second! - first!).toBeGreaterThanOrEqual(950);
  });

  it("gives a 429 back rather than wait past the request's deadline", async () => {
    handlers.set("/limited-long", (_req, res) => res.writeHead(429, { "retry-after": "3600" }).end("come back in an hour"));
    const started = Date.now();
    const result = await client({ deadlineMs: 2_000 }).fetch({ key: "limited-long", url: `${base}/limited-long` });
    expect(result.status).toBe(429);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("does not retry a status the caller accepts as an answer", async () => {
    handlers.set("/missing", (_req, res) => res.writeHead(404).end("no report"));
    const http = client();
    const result = await http.fetch({ key: "missing", url: `${base}/missing`, allowStatus: [404] });
    expect(result).toMatchObject({ status: 404, attempts: 1 });
    expect(http.count).toBe(1);
  });

  it("retries a body cut off before its Content-Length", async () => {
    handlers.set("/truncated", (_req, res, hit) => {
      if (hit === 1) {
        res.writeHead(200, { "content-length": "100" });
        res.write("only part of it");
        res.socket?.destroy();
      } else res.writeHead(200).end("whole");
    });
    const result = await client().fetch({ key: "truncated", url: `${base}/truncated` });
    expect(result).toMatchObject({ status: 200, body: "whole", attempts: 2 });
  });

  it("stops at the overall deadline when the host hangs, instead of four full timeouts", async () => {
    handlers.set("/hang", () => {
      // Never answers.
    });
    const started = Date.now();
    await expect(client({ deadlineMs: 400 }).fetch({ key: "hang", url: `${base}/hang`, timeoutMs: 10_000 })).rejects.toThrow(
      /hang: gave up after 1 attempt/,
    );
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("adds jitter to the backoff", async () => {
    handlers.set("/jitter", (_req, res, hit) => (hit < 2 ? res.writeHead(503).end() : res.writeHead(200).end("ok")));
    // random() = 1 stretches the 2 × 50 ms backoff by half again: 150 ms.
    await client({ retryBaseMs: 50, random: () => 1 }).fetch({ key: "jitter", url: `${base}/jitter` });
    const [first, second] = hits.get("/jitter")!;
    expect(second! - first!).toBeGreaterThanOrEqual(140);
  });
});

describe("HttpClient pacing", () => {
  it("spaces requests to one host by the minimum interval", async () => {
    handlers.set("/paced", (_req, res) => res.writeHead(200).end("ok"));
    const http = client({ minIntervalMs: 200 });
    await Promise.all([http.fetch({ key: "a", url: `${base}/paced` }), http.fetch({ key: "b", url: `${base}/paced` })]);
    const [first, second] = hits.get("/paced")!;
    expect(second! - first!).toBeGreaterThanOrEqual(190);
  });
});

describe("HttpClient pin check", () => {
  it("checks a host once and fails every request to it when the check fails, without sending any", async () => {
    handlers.set("/pinned", (_req, res) => res.writeHead(200).end("should not be asked"));
    let checks = 0;
    const http = client({
      pinCheck: async () => {
        checks++;
        throw new Error("TLS pin mismatch for 127.0.0.1");
      },
    });
    await expect(http.fetch({ key: "p1", url: `${base}/pinned` })).rejects.toThrow(
      /TLS pin check failed for 127\.0\.0\.1:\d+: TLS pin mismatch/,
    );
    await expect(http.fetch({ key: "p2", url: `${base}/pinned` })).rejects.toThrow(/TLS pin check failed/);
    expect(checks).toBe(1);
    expect(hits.get("/pinned")).toBeUndefined();
    expect(http.count).toBe(0);
  });

  it("reports an advisory mismatch and carries on", async () => {
    handlers.set("/advisory", (_req, res) => res.writeHead(200).end("ok"));
    const seen: boolean[] = [];
    const http = client({
      pinCheck: async (host, port) => ({
        host,
        port,
        mode: "advisory",
        expected: "a",
        observed: "b",
        observedNotAfter: "2027-01-01T00:00:00.000Z",
        ok: false,
      }),
      onPin: (check) => seen.push(check.ok),
    });
    expect((await http.fetch({ key: "adv", url: `${base}/advisory` })).status).toBe(200);
    expect(seen).toEqual([false]);
  });
});

describe("retryAfterMs", () => {
  it("reads delay-seconds and HTTP dates", () => {
    expect(retryAfterMs("5")).toBe(5000);
    expect(retryAfterMs("Wed, 23 Sep 2026 12:00:10 GMT", Date.parse("2026-09-23T12:00:00Z"))).toBe(10_000);
    expect(retryAfterMs(undefined)).toBeUndefined();
    expect(retryAfterMs("soon")).toBeUndefined();
  });
});
