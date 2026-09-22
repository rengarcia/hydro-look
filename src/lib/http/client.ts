/**
 * The one place that talks to the network.
 *
 * Etiquette is enforced here rather than left to each source: an identified User-Agent with a
 * contact URL, at most one request per second per host, and retries only on 5xx or transport
 * errors. A 4xx is an answer, not a hiccup, so it is returned to the caller unretried.
 */

import { request } from "undici";
import { dispatcherFor } from "./tls.ts";
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
  timeoutMs?: number;
  /** Accept these statuses as a normal answer instead of throwing. */
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
  userAgent?: string;
  /** Called after every attempt; used by the CLI to print progress. */
  onAttempt?: (info: { key: string; attempt: number; status?: number; error?: string }) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export class HttpClient {
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private readonly onAttempt: HttpClientOptions["onAttempt"];
  /** Per-host promise chain: serialises requests and spaces them by minIntervalMs. */
  private readonly hostQueues = new Map<string, Promise<void>>();
  private requestCount = 0;

  constructor(options: HttpClientOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.onAttempt = options.onAttempt;
  }

  get count(): number {
    return this.requestCount;
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

  async fetch(spec: RequestSpec): Promise<FetchResult> {
    const url = new URL(spec.url);
    for (const [k, v] of Object.entries(spec.params ?? {})) url.searchParams.set(k, v);
    const method = spec.method ?? "GET";
    const allow = new Set(spec.allowStatus ?? []);

    return this.paced(url.hostname, async () => {
      const started = Date.now();
      let lastError: unknown;

      for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
        try {
          const response = await request(url, {
            method,
            dispatcher: dispatcherFor(url),
            headersTimeout: spec.timeoutMs ?? 45_000,
            bodyTimeout: spec.timeoutMs ?? 45_000,
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

          if (isRetryableStatus(status) && !allow.has(status) && attempt <= this.maxRetries) {
            await sleep(2 ** attempt * 500);
            continue;
          }

          this.requestCount++;
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
        } catch (error) {
          lastError = error;
          this.onAttempt?.({ key: spec.key, attempt, error: String(error) });
          if (attempt > this.maxRetries) break;
          await sleep(2 ** attempt * 500);
        }
      }
      throw new Error(`${spec.key}: ${this.maxRetries + 1} attempts failed: ${String(lastError)}`);
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
