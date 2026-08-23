import { randomBytes } from "node:crypto";
import type {
  BrowserEvidence,
  CapabilityMap,
  CrawlerAccessResult,
  DeveloperPortalEvidence,
  EntityResolution,
  MarkdownEvidence,
  McpEvidence,
  ScanContext,
  ScanOptions,
  TextResourceEvidence,
} from "../types.ts";
import {
  AGENT_DISCOVERY_PATHS,
  AI_CRAWLERS,
  DEVELOPER_PATHS,
  LLMS_PATHS,
  OPENAPI_PATHS,
} from "../constants.ts";
import { HttpClient } from "./http.ts";
import { parseHtml, jsonLdEvidenceList } from "./html.ts";
import { crawlSite } from "./crawler.ts";
import { collectRobots, collectSitemap, isAllowedByRobots } from "../protocols/robots.ts";
import { analyzeApiCapabilities, emptyApiCapabilities, parseOpenApi } from "../protocols/openapi.ts";
import { collectBrowserEvidence } from "../browser/playwright.ts";
import { header } from "./util.ts";
import { hostLabel, normalizeInputUrl, originOf, sameOrigin } from "./url.ts";
import { assertUrlAllowed } from "./ssrf.ts";

export async function collectContext(options: ScanOptions): Promise<ScanContext> {
  const inputUrl = normalizeInputUrl(options.url);
  await assertUrlAllowed(inputUrl, options.allowPrivate);

  const startedAt = new Date().toISOString();
  const http = new HttpClient(options.allowPrivate);
  const homepageRes = await http.get(inputUrl);
  if (homepageRes.error && homepageRes.status === 0) {
    throw new Error(`Failed to fetch ${inputUrl}: ${homepageRes.error}`);
  }

  const finalUrl = homepageRes.finalUrl || inputUrl;
  const origin = originOf(finalUrl);
  const homepage = parseHtml(homepageRes.body, finalUrl);
  homepage.status = homepageRes.status;
  homepage.url = inputUrl;
  homepage.finalUrl = finalUrl;
  homepage.canonical = homepage.canonical ?? finalUrl;

  const [robots, llmsTxt, agentsMd, mcp] = await Promise.all([
    collectRobots(http, origin),
    firstOkText(http, origin, LLMS_PATHS, "text/plain,text/markdown,*/*;q=0.8"),
    firstOkText(http, origin, AGENT_DISCOVERY_PATHS, "text/markdown,text/plain,*/*;q=0.8"),
    discoverMcp(http, origin),
  ]);

  const sitemap = await collectSitemap(http, origin, robots);

  const markdown: MarkdownEvidence[] = [];
  const negotiated = await http.get(finalUrl, {
    headers: { accept: "text/markdown, text/x-markdown;q=0.9, */*;q=0.1" },
  });
  markdown.push({
    url: negotiated.finalUrl,
    via: "negotiation",
    status: negotiated.status,
    contentType: negotiated.contentType,
    body: negotiated.body.slice(0, 4000),
  });

  if (homepage.alternateMarkdown) {
    const alt = await http.get(homepage.alternateMarkdown);
    markdown.push({
      url: alt.finalUrl,
      via: "alternate",
      status: alt.status,
      contentType: alt.contentType,
      body: alt.body.slice(0, 4000),
    });
  }

  const mdFallbacks = markdownFallbackUrls(finalUrl, homepage.canonical ?? finalUrl);
  for (const candidate of mdFallbacks) {
    const res = await http.get(candidate, {
      headers: { accept: "text/markdown,text/plain,*/*;q=0.8" },
    });
    markdown.push({
      url: res.finalUrl,
      via: "fallback",
      status: res.status,
      contentType: res.contentType,
      body: res.body.slice(0, 4000),
    });
  }

  const probeId = randomBytes(6).toString("hex");
  const notFound = await http.get(new URL(`/agentlint-probe-${probeId}`, origin).href);

  const developerPortals = await probeDeveloperPortals(http, origin, homepage);
  const openApi = await discoverOpenApi(http, origin, homepage, developerPortals);

  const pages = await crawlSite({
    http,
    origin,
    homepage,
    robots,
    sitemapUrls: sitemap?.urls,
    depth: options.depth,
    maxPages: options.maxPages,
  });

  const crawlerAccess = await Promise.all(
    AI_CRAWLERS.map(async (ua) => {
      const res = await http.get(finalUrl, {
        headers: { "user-agent": ua, accept: "text/html,*/*;q=0.8" },
        skipCache: true,
      });
      const robotsAllowed = isAllowedByRobots(robots, finalUrl, ua);
      const challenge = isChallenge(res.status, res.body);
      const blocked = res.status === 403 || res.status === 401 || challenge || robotsAllowed === false;
      return {
        userAgent: ua,
        status: res.status,
        finalUrl: res.finalUrl,
        blocked,
        challenge,
        robotsAllowed,
        bodyDiffers: normalizeBody(res.body) !== normalizeBody(homepageRes.body),
      } satisfies CrawlerAccessResult;
    }),
  );

  let browser: BrowserEvidence | undefined;
  if (options.browser) {
    browser = await collectBrowserEvidence(finalUrl, options.allowPrivate);
  }

  const jsonLd = jsonLdEvidenceList(pages);
  const entity = resolveEntityDeterministic(pages[0] ?? homepage, jsonLd);
  const api = openApi ? analyzeApiCapabilities(openApi.operations) : emptyApiCapabilities();

  const capabilities: CapabilityMap = {
    api,
    hasOpenApi: Boolean(openApi?.valid),
    hasMcp: Boolean(mcp?.valid),
    hasBrowser: Boolean(browser && !browser.error),
    hasLlmsTxt: Boolean(llmsTxt && llmsTxt.status >= 200 && llmsTxt.status < 300 && llmsTxt.body.trim()),
    hasDeveloperPortal: developerPortals.some((p) => p.status >= 200 && p.status < 400),
    jsRequired: homepage.textLength < 80 && homepage.scriptBytes > 500,
  };

  return {
    scanId: `scan_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    startedAt,
    target: {
      inputUrl: options.url,
      canonicalUrl: homepage.canonical,
      origin,
      finalUrl,
    },
    pages,
    homepage,
    http,
    browser,
    discovered: {
      robots,
      sitemap,
      llmsTxt,
      agentsMd,
      openApi,
      mcp,
      jsonLd,
      markdown,
      developerPortals,
      notFound,
      crawlerAccess,
    },
    entity,
    capabilities,
    options,
  };
}

async function discoverMcp(http: HttpClient, origin: string): Promise<McpEvidence | undefined> {
  const url = new URL("/.well-known/mcp", origin).href;
  const response = await http.get(url, { headers: { accept: "application/json,*/*;q=0.8" } });
  if (!response.ok || !response.body.trim()) return undefined;
  try {
    const document = JSON.parse(response.body) as Record<string, unknown>;
    const endpointValue = document.endpoint ?? document.url ?? document.transport;
    const endpoint = typeof endpointValue === "string" ? new URL(endpointValue, response.finalUrl).href : undefined;
    return {
      discoveredAt: new Date().toISOString(),
      url: response.finalUrl,
      status: response.status,
      valid: true,
      endpoint,
      transport: typeof document.transport === "string" ? document.transport : undefined,
      document,
    };
  } catch {
    return { discoveredAt: new Date().toISOString(), url: response.finalUrl, status: response.status, valid: false };
  }
}

async function firstOkText(
  http: HttpClient,
  origin: string,
  paths: string[],
  accept: string,
): Promise<TextResourceEvidence | undefined> {
  for (const path of paths) {
    const url = new URL(path, origin).href;
    const res = await http.get(url, { headers: { accept } });
    if (res.ok && res.body.trim()) {
      return {
        url: res.finalUrl,
        status: res.status,
        body: res.body,
        contentType: res.contentType,
      };
    }
  }
  const first = paths[0];
  if (!first) return undefined;
  const res = await http.get(new URL(first, origin).href, { headers: { accept } });
  return {
    url: res.finalUrl || new URL(first, origin).href,
    status: res.status,
    body: res.body,
    contentType: res.contentType,
  };
}

async function probeDeveloperPortals(
  http: HttpClient,
  origin: string,
  homepage: ReturnType<typeof parseHtml>,
) {
  const fromNav = homepage.links
    .filter((l) => sameOrigin(l.href, origin))
    .filter((l) => /dev|docs|api|reference|sdk|developer/i.test(l.href + l.text))
    .map((l) => l.href);

  const probes = [
    ...DEVELOPER_PATHS.map((p) => new URL(p, origin).href),
    ...fromNav,
  ];
  const unique = [...new Set(probes)].slice(0, 12);
  const results = [];
  for (const url of unique) {
    const res = await http.get(url);
    if (res.status === 0) continue;
    const parsed = res.ok ? parseHtml(res.body, res.finalUrl) : undefined;
    results.push({
      url: res.finalUrl,
      status: res.status,
      title: parsed?.title,
      description: parsed?.description,
      headings: parsed?.headings.slice(0, 30) ?? [],
      textSample: parsed?.text?.slice(0, 6000),
    } satisfies DeveloperPortalEvidence);
  }
  return results;
}

async function discoverOpenApi(
  http: HttpClient,
  origin: string,
  homepage: ReturnType<typeof parseHtml>,
  portals: { url: string; status: number }[],
) {
  const htmlRefs = homepage.links
    .map((l) => l.href)
    .filter((href) => /openapi|swagger/i.test(href));

  const candidates = [
    ...OPENAPI_PATHS.map((p) => new URL(p, origin).href),
    ...htmlRefs,
    ...portals.flatMap((p) =>
      OPENAPI_PATHS.slice(0, 5).map((path) => {
        try {
          return new URL(path, p.url).href;
        } catch {
          return undefined;
        }
      }),
    ),
  ].filter((u): u is string => Boolean(u));

  const unique = [...new Set(candidates)].slice(0, 20);
  for (const url of unique) {
    const res = await http.get(url, {
      headers: { accept: "application/json,application/yaml,text/yaml,*/*;q=0.8" },
    });
    if (!res.ok || !res.body.trim()) continue;
    const parsed = parseOpenApi(res.body, res.finalUrl);
    if (parsed.valid || parsed.specVersion) return parsed;
  }
  return undefined;
}

function markdownFallbackUrls(finalUrl: string, canonical: string): string[] {
  const urls = new Set<string>();
  for (const base of [finalUrl, canonical]) {
    try {
      const u = new URL(base);
      if (u.pathname === "/" || u.pathname === "") {
        urls.add(new URL("/index.md", u.origin).href);
      } else {
        const path = u.pathname.endsWith("/") ? u.pathname.slice(0, -1) : u.pathname;
        urls.add(new URL(`${path}.md`, u.origin).href);
        urls.add(new URL(`${path}/index.md`, u.origin).href);
      }
    } catch {
      /* ignore */
    }
  }
  return [...urls].slice(0, 4);
}

function isChallenge(status: number, body: string): boolean {
  if (status === 403 || status === 429 || status === 503) {
    return /captcha|cloudflare|access denied|just a moment|attention required/i.test(body);
  }
  return /<title>\s*(attention required|just a moment|access denied)/i.test(body);
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, " ").slice(0, 20_000);
}

export function resolveEntityDeterministic(
  homepage: ReturnType<typeof parseHtml>,
  jsonLd: ScanContext["discovered"]["jsonLd"],
): EntityResolution | undefined {
  const INFRA = /vercel|netlify|cloudflare|aws|google cloud|github pages|shopify|wix|squarespace|wordpress|next\.js|react/i;

  const rankedTypes = ["Person", "Organization", "Product", "SoftwareApplication", "WebSite"];
  const preferred = jsonLd
    .filter((item) => pickName(item.data) && item.types.some((type) => rankedTypes.includes(type)))
    .sort((a, b) => {
      const aRank = Math.min(...a.types.map((type) => rankedTypes.indexOf(type)).filter((rank) => rank >= 0));
      const bRank = Math.min(...b.types.map((type) => rankedTypes.indexOf(type)).filter((rank) => rank >= 0));
      return aRank - bRank;
    })[0];
  if (preferred) {
    const name = pickName(preferred.data);
    const type = mapType(preferred.types);
    if (name && !INFRA.test(name)) {
      const title = homepage.title ?? "";
      const h1 = homepage.headings.find((h) => h.level === 1)?.text ?? "";
      const confidence =
        name === title || name === h1 || title.includes(name) || h1.includes(name) ? 0.92 : 0.78;
      return {
        entity: name,
        entityType: type,
        confidence,
        evidence: [
          `JSON-LD ${preferred.types.join(", ")} name`,
          title ? `title: ${title}` : "",
          h1 ? `h1: ${h1}` : "",
        ].filter(Boolean),
        source: "jsonld",
      };
    }
  }

  const title = homepage.title?.replace(/\s*[|\-–].*$/, "").trim();
  const h1 = homepage.headings.find((h) => h.level === 1)?.text;
  const og = homepage.openGraph["og:site_name"] ?? homepage.openGraph["og:title"];
  const candidate = title || h1 || og;
  if (candidate && !INFRA.test(candidate)) {
    return {
      entity: candidate,
      entityType: "unknown",
      confidence: 0.45,
      evidence: [title ? `title: ${title}` : "", h1 ? `h1: ${h1}` : ""].filter(Boolean),
      source: "metadata",
    };
  }

  const host = hostLabel(homepage.finalUrl).replace(/^www\./, "");
  return {
    entity: host,
    entityType: "unknown",
    confidence: 0.2,
    evidence: [`canonical host: ${host}`],
    source: "metadata",
  };
}

function pickName(data: Record<string, unknown>): string | undefined {
  const name = data.name ?? data.legalName;
  return typeof name === "string" ? name.trim() : undefined;
}

function mapType(types: string[]): EntityResolution["entityType"] {
  if (types.includes("Person")) return "person";
  if (types.includes("Organization")) return "organization";
  if (types.includes("Product") || types.includes("SoftwareApplication")) return "product";
  if (types.includes("WebSite")) return "project";
  return "unknown";
}
