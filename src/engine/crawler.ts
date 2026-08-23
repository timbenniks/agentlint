import type { PageEvidence, RobotsEvidence } from "../types.ts";
import { HTTP_CONCURRENCY } from "../constants.ts";
import type { HttpClient } from "./http.ts";
import { parseHtml } from "./html.ts";
import { isAllowedByRobots } from "../protocols/robots.ts";
import { sameOrigin } from "./url.ts";
import { mapLimit } from "./util.ts";

export async function crawlSite(options: {
  http: HttpClient;
  origin: string;
  homepage: PageEvidence;
  robots?: RobotsEvidence;
  sitemapUrls?: string[];
  depth: number;
  maxPages: number;
}): Promise<PageEvidence[]> {
  const { http, origin, homepage, robots, depth, maxPages } = options;
  const pages: PageEvidence[] = [homepage];
  const seen = new Set<string>([stripSlash(homepage.finalUrl)]);
  let frontier: { url: string; depth: number }[] = homepage.links
    .map((l) => l.href)
    .concat(options.sitemapUrls?.slice(0, 10) ?? [])
    .filter((url) => sameOrigin(url, origin))
    .map((url) => ({ url, depth: 1 }));

  while (pages.length < maxPages && frontier.length > 0) {
    const batch = frontier.splice(0, Math.min(HTTP_CONCURRENCY, maxPages - pages.length));
    const fetched = await mapLimit(batch, HTTP_CONCURRENCY, async (item) => {
      const key = stripSlash(item.url);
      if (seen.has(key)) return undefined;
      seen.add(key);
      if (isAllowedByRobots(robots, item.url, "Agentlint") === false) return undefined;
      const res = await http.get(item.url);
      if (!res.ok || !res.body) return undefined;
      if (!res.contentType.includes("html") && !res.body.trim().startsWith("<")) {
        return undefined;
      }
      const page = parseHtml(res.body, res.finalUrl);
      page.status = res.status;
      page.url = item.url;
      page.finalUrl = res.finalUrl;
      return { page, depth: item.depth };
    });

    for (const item of fetched) {
      if (!item) continue;
      pages.push(item.page);
      if (item.depth < depth) {
        for (const link of item.page.links) {
          if (!sameOrigin(link.href, origin)) continue;
          const key = stripSlash(link.href);
          if (seen.has(key)) continue;
          frontier.push({ url: link.href, depth: item.depth + 1 });
        }
      }
    }
  }

  return pages.slice(0, maxPages);
}

function stripSlash(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    if (u.pathname.endsWith("/") && u.pathname !== "/") {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return url;
  }
}
