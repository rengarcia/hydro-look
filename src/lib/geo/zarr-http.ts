/**
 * `ZarrSource` over HTTP for GEOGLOWS' public buckets: undici's fetch (as everywhere else in the
 * pipeline), three attempts on a network error or a 5xx, a 404 or 403 read as "no such object"
 * (S3 answers 403 for a missing key in a bucket that does not allow listing), and the ETag of
 * every object read, so a report can say which bytes its numbers came from.
 */

import { fetch } from "undici";
import { USER_AGENT } from "../http/client.ts";
import type { ZarrSource } from "./zarr.ts";

export interface HttpZarrSource extends ZarrSource {
  /** Key → ETag of every object read whole or in part. */
  etags: Map<string, string>;
  /** Bytes received, for the log. */
  received(): number;
}

async function request(url: string, headers: Record<string, string>): Promise<Awaited<ReturnType<typeof fetch>>> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT, ...headers }, signal: AbortSignal.timeout(120_000) });
      if (response.status >= 500 && attempt < 3) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

export function httpZarrSource(base: string): HttpZarrSource {
  const etags = new Map<string, string>();
  let bytes = 0;
  const note = (key: string, etag: string | null, n: number) => {
    if (etag) etags.set(key, etag);
    bytes += n;
  };
  return {
    etags,
    received: () => bytes,
    async get(key) {
      const response = await request(`${base}/${key}`, {});
      if (response.status === 404 || response.status === 403) return null;
      if (!response.ok) throw new Error(`${base}/${key}: HTTP ${response.status}`);
      const out = new Uint8Array(await response.arrayBuffer());
      note(key, response.headers.get("etag"), out.length);
      return out;
    },
    async getRange(key, from, to) {
      const response = await request(`${base}/${key}`, { range: `bytes=${from}-${to - 1}` });
      if (response.status !== 206) throw new Error(`${base}/${key} [${from}, ${to}): HTTP ${response.status}, not a partial answer`);
      const out = new Uint8Array(await response.arrayBuffer());
      note(key, response.headers.get("etag"), out.length);
      return out;
    },
  };
}
