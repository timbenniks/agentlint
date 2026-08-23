import robotsParser from "robots-parser";
import { XMLParser } from "fast-xml-parser";
import type { HttpClient } from "../engine/http.ts";
import type { RobotsEvidence, SitemapEvidence } from "../types.ts";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

export async function collectRobots(
  http: HttpClient,
  origin: string,
): Promise<RobotsEvidence | undefined> {
  const url = new URL("/robots.txt", origin).href;
  const res = await http.get(url, {
    headers: { accept: "text/plain,*/*;q=0.8" },
  });
  if (!res.ok && res.status !== 200) {
    return {
      url,
      status: res.status,
      body: res.body,
      valid: false,
      sitemaps: [],
      groups: [],
    };
  }

  const body = res.body;
  const parser = robotsParser(url, body);
  const sitemaps = parser.getSitemaps?.() ?? extractSitemaps(body);
  return {
    url: res.finalUrl,
    status: res.status,
    body,
    valid: isLikelyRobots(body),
    sitemaps,
    groups: parseGroups(body),
  };
}

export function isAllowedByRobots(
  robots: RobotsEvidence | undefined,
  targetUrl: string,
  userAgent: string,
): boolean | undefined {
  if (!robots?.body) return undefined;
  const parser = robotsParser(robots.url, robots.body);
  return parser.isAllowed(targetUrl, userAgent) !== false;
}

export async function collectSitemap(
  http: HttpClient,
  origin: string,
  robots?: RobotsEvidence,
): Promise<SitemapEvidence | undefined> {
  const candidates = [
    ...(robots?.sitemaps ?? []),
    new URL("/sitemap.xml", origin).href,
    new URL("/sitemap_index.xml", origin).href,
  ];
  const unique = [...new Set(candidates)];

  for (const candidate of unique) {
    const res = await http.get(candidate, {
      headers: { accept: "application/xml,text/xml,*/*;q=0.8" },
    });
    if (!res.ok || !res.body.trim()) continue;
    const parsed = parseSitemapXml(res.body, origin);
    if (parsed.urls.length || parsed.valid) {
      if (parsed.kind === "index") {
        const childUrls = parsed.urls.slice(0, 5);
        const nested: string[] = [];
        for (const child of childUrls) {
          const childRes = await http.get(child, {
            headers: { accept: "application/xml,text/xml,*/*;q=0.8" },
          });
          if (childRes.ok) {
            nested.push(...parseSitemapXml(childRes.body, origin).urls);
          }
        }
        return {
          url: res.finalUrl,
          status: res.status,
          kind: "index",
          urls: [...new Set([...parsed.urls, ...nested])].slice(0, 500),
          valid: true,
        };
      }
      return {
        url: res.finalUrl,
        status: res.status,
        kind: parsed.kind,
        urls: parsed.urls.slice(0, 500),
        valid: parsed.valid,
        error: parsed.error,
      };
    }
  }

  const first = unique[0];
  if (!first) return undefined;
  const res = await http.get(first);
  return {
    url: first,
    status: res.status,
    urls: [],
    valid: false,
    error: res.error ?? `HTTP ${res.status}`,
  };
}

export function parseSitemapXml(
  xml: string,
  origin: string,
): { kind?: "urlset" | "index"; urls: string[]; valid: boolean; error?: string } {
  try {
    const doc = xmlParser.parse(xml) as Record<string, unknown>;
    if (doc.sitemapindex) {
      const urls = collectLocs(doc.sitemapindex, "sitemap");
      return { kind: "index", urls, valid: urls.length > 0 };
    }
    if (doc.urlset) {
      const urls = collectLocs(doc.urlset, "url").filter((u) => {
        try {
          return new URL(u).origin === origin || true;
        } catch {
          return false;
        }
      });
      return { kind: "urlset", urls, valid: urls.length > 0 };
    }
    return { urls: [], valid: false, error: "Not a sitemap or sitemap index" };
  } catch (error) {
    return {
      urls: [],
      valid: false,
      error: error instanceof Error ? error.message : "Invalid XML",
    };
  }
}

function collectLocs(node: unknown, childKey: string): string[] {
  if (!node || typeof node !== "object") return [];
  const obj = node as Record<string, unknown>;
  const children = obj[childKey];
  const list = Array.isArray(children) ? children : children ? [children] : [];
  const urls: string[] = [];
  for (const child of list) {
    if (!child || typeof child !== "object") continue;
    const loc = (child as { loc?: unknown }).loc;
    if (typeof loc === "string") urls.push(loc);
    else if (loc && typeof loc === "object" && "#text" in loc) {
      const text = (loc as { "#text"?: unknown })["#text"];
      if (typeof text === "string") urls.push(text);
    }
  }
  return urls;
}

function isLikelyRobots(body: string): boolean {
  return /^\s*(user-agent|sitemap|allow|disallow|#)/im.test(body);
}

function extractSitemaps(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap:\s*/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
    .filter(Boolean);
}

function parseGroups(body: string): RobotsEvidence["groups"] {
  const groups: RobotsEvidence["groups"] = [];
  let current: RobotsEvidence["groups"][number] | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (!field) continue;
    if (field.toLowerCase() === "user-agent") {
      current = { userAgent: value, allows: [], disallows: [] };
      groups.push(current);
    } else if (current && field.toLowerCase() === "allow") {
      current.allows.push(value);
    } else if (current && field.toLowerCase() === "disallow") {
      current.disallows.push(value);
    }
  }
  return groups;
}
