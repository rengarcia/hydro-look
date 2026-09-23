/**
 * The one place that talks to the network.
 *
 * Etiquette is enforced here rather than left to each source: an identified User-Agent with a
 * contact URL, at most one request per second per host, and retries only on 5xx, 429 or
 * transport errors. A 4xx other than 429 is an answer, not a hiccup, so it is returned to the
 * caller unretried.
 *
 * Retries back off exponentially with jitter, so two runs that failed together do not retry
 * together; a 429's `Retry-After` is honoured when it is given; and every request has one
 * overall deadline across all of its attempts, so a host that hangs costs minutes at most
 * rather than four full timeouts.
 *
 * The first request to a host with a pinned certificate (data/reference/tls_pins.json) checks
 * the pin first. The check runs inside `fetch`, so a failed handshake or an enforced mismatch
 * surfaces as that request's error — caught by the source that asked, recorded on its batch —
 * instead of aborting the run before any other source has been asked. The outcome is cached per
 * host, so a host that failed its check fails every later request at once without touching
 * the network again.
 */

import { request } from "undici";
import { checkPin, dispatcherFor, type PinCheck } from "./tls.ts";
import { nowUtc } from "../util/dates.ts";

export const USER_AGENT =
  "hydro-look/0.1 (+https://github.com/rengarcia/hydro-look; open data pipeline; contact via GitHub issues)";

export interface RequestSpec {
  /** Stable identifier used as the archive key, e.g. `repDiaHid12m:2026-09-20`. */
  key: string;
  url: string;
  method?: "GET" | "POST";
  params?: Record<string, string>;
  jsonBody?: unknown;
  /** Per-attempt timeout for headers and for the body, each. */
  timeoutMs?: number;
  /** Accept these statuses as a normal answer: returned at once, never retried. */
  allowStatus?: number[];
}

export interface FetchResult {
  key: string;
  url: string;
  method: string;
  status: number;
  body: string;
  fetchedAt: string;
  durationMs: number;
  attempts: number;
}

export interface HttpClientOptions {
  minIntervalMs?: number;
  maxRetries?: number;
  /** Base of the exponential backoff; each wait is jittered to between half and one and a half times it. */
  retryBaseMs?: number;
  /** Ceiling on one request, across every attempt and every wait between them. */
  deadlineMs?: number;
  userAgent?: string;
  /** Called after every attempt; used by the CLI to print progress. */
  onAttempt?: (info: { key: string; attempt: number; status?: number; error?: string }) => void;
  /** The pin check run before a host's first request. Defaults to the real handshake. */
  pinCheck?: (host: string, port: number) => Promise<PinCheck | null>;
  /** Called with each host's pin check result, so the CLI can log an advisory mismatch. */
  onPin?: (check: PinCheck) => void;
  /** Source of jitter; injectable so tests are deterministic. */
  random?: () => number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/**
 * `Retry-After` in milliseconds: either delay-seconds or an HTTP date. Undefined when absent or
 * unreadable, in which case the ordinary backoff applies.
 */
export function retryAfterMs(header: string | string[] | undefined, now = Date.now()): number | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || value.trim() === "") return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export class HttpClient {
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly deadlineMs: number;
  private readonly userAgent: string;
  private readonly onAttempt: HttpClientOptions["onAttempt"];
  private readonly pinCheck: NonNullable<HttpClientOptions["pinCheck"]>;
  private readonly onPin: HttpClientOptions["onPin"];
  private readonly random: () => number;
  /** Per-host promise chain: serialises requests and spaces them by minIntervalMs. */
  private readonly hostQueues = new Map<string, Promise<void>>();
  /** Per-`host:port` pin check, run once and remembered, failure included. */
  private readonly pins = new Map<string, Promise<void>>();
  private requestCount = 0;
  private readonly hostCounts = new Map<string, number>();

  constructor(options: HttpClientOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.deadlineMs = options.deadlineMs ?? 150_000;
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.onAttempt = options.onAttempt;
    this.pinCheck = options.pinCheck ?? checkPin;
    this.onPin = options.onPin;
    this.random = options.random ?? Math.random;
  }

  /** Every attempt sent, retries included: the number the hosts actually saw. */
  get count(): number {
    return this.requestCount;
  }

  /** The same count split by host, for the run summary. */
  get countByHost(): Record<string, number> {
    return Object.fromEntries([...this.hostCounts].sort(([a], [b]) => (a < b ? -1 : 1)));
  }

  private async paced<T>(host: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.hostQueues.get(host) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((r) => (release = r));
    this.hostQueues.set(
      host,
      previous.then(() => turn),
    );
    await previous;
    try {
      return await fn();
    } finally {
      setTimeout(release, this.minIntervalMs);
    }
  }

  /** Checks a host's pin once per process; a failure is remembered and rethrown to every caller. */
  private verifyPin(url: URL): Promise<void> {
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    const id = `${url.hostname}:${port}`;
    let pending = this.pins.get(id);
    if (!pending) {
      pending = (async () => {
        let check: PinCheck | null;
        try {
          check = await this.pinCheck(url.hostname, port);
        } catch (error) {
          throw new Error(`TLS pin check failed for ${id}: ${String(error).replace(/^Error: /, "")}`);
        }
        if (check) this.onPin?.(check);
      })();
      this.pins.set(id, pending);
    }
    return pending;
  }

  private backoff(attempt: number): number {
    return 2 ** attempt * this.retryBaseMs * (0.5 + this.random());
  }

  async fetch(spec: RequestSpec): Promise<FetchResult> {
    const url = new URL(spec.url);
    for (const [k, v] of Object.entries(spec.params ?? {})) url.searchParams.set(k, v);
    const method = spec.method ?? "GET";
    const allow = new Set(spec.allowStatus ?? []);

    await this.verifyPin(url);

    return this.paced(url.hostname, async () => {
      const started = Date.now();
      const deadline = started + this.deadlineMs;
      let lastError: unknown;
      let attempt = 0;

      while (attempt <= this.maxRetries) {
        attempt++;
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const timeout = Math.min(spec.timeoutMs ?? 45_000, remaining);
        let wait: number;
        try {
          this.requestCount++;
          this.hostCounts.set(url.hostname, (this.hostCounts.get(url.hostname) ?? 0) + 1);
          const response = await request(url, {
            method,
            dispatcher: dispatcherFor(url),
            headersTimeout: timeout,
            bodyTimeout: timeout,
            headers: {
              "user-agent": this.userAgent,
              accept: spec.jsonBody ? "application/json" : "*/*",
              ...(spec.jsonBody ? { "content-type": "application/json" } : {}),
            },
            ...(spec.jsonBody === undefined ? {} : { body: JSON.stringify(spec.jsonBody) }),
          });

          // The body must be drained even when the status is wrong, or the socket leaks.
          const buffer = Buffer.from(await response.body.arrayBuffer());
          const status = response.statusCode;
          this.onAttempt?.({ key: spec.key, attempt, status });

          wait = this.backoff(attempt);
          if (status === 429) wait = retryAfterMs(response.headers["retry-after"]) ?? wait;
          const retry =
            isRetryableStatus(status) && !allow.has(status) && attempt <= this.maxRetries && Date.now() + wait < deadline;
          if (!retry) {
            // A retryable status that is out of attempts or out of time is returned, not
            // thrown: the source archives the body and records the final status as its error.
            return {
              key: spec.key,
              url: url.toString(),
              method,
              status,
              // CENACE serves cp1252; the ORDS serves UTF-8. Decoding is the source's business,
              // so the raw bytes are handed over as latin1-safe text only when asked for.
              body: decodeBody(buffer, response.headers["content-type"]),
              fetchedAt: nowUtc(),
              durationMs: Date.now() - started,
              attempts: attempt,
            };
          }
        } catch (error) {
          // Transport failures, timeouts and truncated bodies all land here.
          lastError = error;
          this.onAttempt?.({ key: spec.key, attempt, error: String(error) });
          if (attempt > this.maxRetries) break;
          wait = this.backoff(attempt);
          if (Date.now() + wait >= deadline) break;
        }
        await sleep(wait);
      }
      throw new Error(
        `${spec.key}: gave up after ${attempt} attempt${attempt === 1 ? "" : "s"} in ${Date.now() - started} ms: ${String(lastError ?? "deadline passed")}`,
      );
    });
  }
}

/**
 * CENACE's JSP pages declare no charset and are Windows-1252 (`Hidráulica` arrives as
 * `Hidr\xe1ulica`). Decoding them as UTF-8 mangles every accented row label, so anything that
 * is not explicitly UTF-8 and does not decode cleanly as UTF-8 is read as cp1252.
 */
export function decodeBody(buffer: Buffer, contentType: string | string[] | undefined): string {
  const type = Array.isArray(contentType) ? contentType.join(";") : (contentType ?? "");
  if (/charset=utf-?8/i.test(type)) return buffer.toString("utf8");
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}
