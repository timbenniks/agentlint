import type { HttpEvidenceStore, HttpResponse } from "../types.ts";
import {
  DEFAULT_USER_AGENT,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
} from "../constants.ts";
import { assertUrlAllowed, SsrfError } from "./ssrf.ts";
import { sanitizeText } from "./util.ts";

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

async function readLimited(res: Response): Promise<{ body: string; bytes: number; truncated: boolean }> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_RESPONSE_BYTES) {
    return { body: "", bytes: declared, truncated: true };
  }

  if (!res.body) {
    const text = await res.text();
    const bytes = Buffer.byteLength(text);
    if (bytes > MAX_RESPONSE_BYTES) {
      return {
        body: sanitizeText(text.slice(0, MAX_RESPONSE_BYTES)),
        bytes,
        truncated: true,
      };
    }
    return { body: sanitizeText(text), bytes, truncated: false };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      truncated = true;
      const remain = MAX_RESPONSE_BYTES - (bytes - value.byteLength);
      if (remain > 0) chunks.push(value.slice(0, remain));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { body: sanitizeText(buffer.toString("utf8")), bytes, truncated };
}

export class HttpClient implements HttpEvidenceStore {
  private cache = new Map<string, HttpResponse>();

  constructor(private readonly allowPrivate: boolean) {}

  async get(
    url: string,
    options?: { headers?: Record<string, string>; skipCache?: boolean },
  ): Promise<HttpResponse> {
    const headers = {
      "user-agent": DEFAULT_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...options?.headers,
    };
    const cacheKey = `${url}::${JSON.stringify(headers)}`;
    if (!options?.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const result = await this.fetchFollow(url, headers);
    this.cache.set(cacheKey, result);
    return result;
  }

  private async fetchFollow(
    startUrl: string,
    headers: Record<string, string>,
  ): Promise<HttpResponse> {
    const redirectChain: { url: string; status: number }[] = [];
    let current = startUrl;
    const started = Date.now();

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertUrlAllowed(current, this.allowPrivate);
        const res = await fetch(current, {
          method: "GET",
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          redirectChain.push({ url: current, status: res.status });
          if (!location) {
            return emptyResponse(startUrl, current, res.status, headersToObject(res.headers), redirectChain, started, "Redirect missing Location");
          }
          current = new URL(location, current).href;
          continue;
        }

        const { body, bytes, truncated } = await readLimited(res);
        const hdrs = headersToObject(res.headers);
        return {
          url: startUrl,
          finalUrl: res.url || current,
          status: res.status,
          ok: res.status >= 200 && res.status < 300,
          headers: hdrs,
          body,
          bodyBytes: bytes,
          truncated,
          contentType: hdrs["content-type"] ?? "",
          redirectChain,
          elapsedMs: Date.now() - started,
        };
      }

      return emptyResponse(
        startUrl,
        current,
        0,
        {},
        redirectChain,
        started,
        `Too many redirects (max ${MAX_REDIRECTS})`,
      );
    } catch (error) {
      const message =
        error instanceof SsrfError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Request failed";
      return emptyResponse(startUrl, current, 0, {}, redirectChain, started, message);
    }
  }
}

function emptyResponse(
  url: string,
  finalUrl: string,
  status: number,
  headers: Record<string, string>,
  redirectChain: { url: string; status: number }[],
  started: number,
  error: string,
): HttpResponse {
  return {
    url,
    finalUrl,
    status,
    ok: false,
    headers,
    body: "",
    bodyBytes: 0,
    truncated: false,
    contentType: headers["content-type"] ?? "",
    redirectChain,
    elapsedMs: Date.now() - started,
    error,
  };
}
