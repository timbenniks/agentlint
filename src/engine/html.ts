import { load, type CheerioAPI } from "cheerio";
import type { HeadingNode, JsonLdEvidence, PageEvidence } from "../types.ts";
import { collapseWs, evidence } from "./util.ts";
import { resolveUrl } from "./url.ts";

const JSON_LD_TYPES = [
  "Person",
  "Organization",
  "Product",
  "SoftwareApplication",
  "WebSite",
  "Service",
  "Article",
  "FAQPage",
  "BreadcrumbList",
];

export function parseHtml(html: string, url: string): PageEvidence {
  const $ = load(html);
  const title = collapseWs($("title").first().text());
  const description =
    attr($, 'meta[name="description"]', "content") ??
    attr($, 'meta[property="og:description"]', "content");
  const canonical = abs($, url, attr($, 'link[rel="canonical"]', "href"));
  const language =
    attr($, "html", "lang") ?? attr($, 'meta[http-equiv="content-language"]', "content");

  const headings: HeadingNode[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const tag = el.tagName?.toLowerCase() ?? "h1";
    const level = Number(tag.slice(1));
    const text = collapseWs($(el).text());
    if (text) headings.push({ level, text });
  });

  const links: PageEvidence["links"] = [];
  $("a[href]").each((_, el) => {
    const href = resolveUrl($(el).attr("href") ?? "", url);
    if (!href) return;
    links.push({
      href,
      text: collapseWs($(el).text()).slice(0, 200),
      rel: $(el).attr("rel"),
    });
  });

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"], meta[name^="twitter:"]').each((_, el) => {
    const key = $(el).attr("property") ?? $(el).attr("name");
    const value = $(el).attr("content");
    if (key && value) openGraph[key] = value;
  });

  const meta: Record<string, string> = {};
  $("meta[name][content]").each((_, el) => {
    const name = $(el).attr("name");
    const content = $(el).attr("content");
    if (name && content) meta[name.toLowerCase()] = content;
  });

  const jsonLd = extractJsonLd($, url);
  const alternateMarkdown = abs(
    $,
    url,
    attr($, 'link[rel="alternate"][type="text/markdown"]', "href") ??
      attr($, 'link[rel="alternate"][type="text/x-markdown"]', "href"),
  );

  const $clone = load($.html());
  $clone("script,style,noscript,svg,template").remove();
  const text = collapseWs($clone("body").text() || $clone.root().text());
  const scriptBytes = $("script")
    .toArray()
    .reduce((sum, el) => sum + ($(el).html()?.length ?? 0) + ($(el).attr("src")?.length ?? 0), 0);

  return {
    url,
    finalUrl: url,
    status: 200,
    title: title || undefined,
    description,
    canonical,
    language,
    html,
    text,
    textLength: text.length,
    htmlLength: html.length,
    contentRatio: html.length === 0 ? 0 : text.length / html.length,
    headings,
    links,
    jsonLd,
    openGraph,
    meta,
    alternateMarkdown,
    hasMain: $("main, [role='main']").length > 0,
    scriptBytes,
  };
}

export function jsonLdEvidenceList(pages: PageEvidence[]): JsonLdEvidence[] {
  const seen = new Set<string>();
  const out: JsonLdEvidence[] = [];
  for (const page of pages) {
    for (const item of page.jsonLd) {
      const key = JSON.stringify(item.data);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function jsonLdTypes(item: Record<string, unknown>): string[] {
  const raw = item["@type"];
  if (typeof raw === "string") return [raw.replace(/^schema:/, "")];
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.replace(/^schema:/, ""));
  }
  return [];
}

export function recognizedJsonLd(item: JsonLdEvidence): boolean {
  return item.types.some((t) => JSON_LD_TYPES.includes(t));
}

export function asEvidence(page: PageEvidence) {
  return evidence("html", page.finalUrl, {
    title: page.title,
    description: page.description,
    headings: page.headings.slice(0, 12),
    textLength: page.textLength,
    contentRatio: Number(page.contentRatio.toFixed(3)),
  });
}

function attr($: CheerioAPI, selector: string, name: string): string | undefined {
  const value = $(selector).first().attr(name);
  return value?.trim() || undefined;
}

function abs($: CheerioAPI, base: string, href?: string): string | undefined {
  if (!href) return undefined;
  return resolveUrl(href, base);
}

function extractJsonLd($: CheerioAPI, source: string): JsonLdEvidence[] {
  const items: JsonLdEvidence[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed: unknown = JSON.parse(raw);
      for (const node of flattenJsonLd(parsed)) {
        items.push({
          source,
          types: jsonLdTypes(node),
          data: node,
        });
      }
    } catch {
      items.push({ source, types: [], data: { parseError: true, raw: raw.slice(0, 200) } });
    }
  });
  return items;
}

export function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) return flattenJsonLd(obj["@graph"]);
    return [obj];
  }
  return [];
}
