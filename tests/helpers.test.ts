import { describe, expect, it } from "vitest";
import { parseSitemapXml } from "../src/protocols/robots.ts";
import { extractMarkdownLinks, looksLikeMarkdown } from "../src/engine/util.ts";
import { normalizeInputUrl } from "../src/engine/url.ts";

describe("robots and sitemap helpers", () => {
  it("parses a urlset", () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/docs</loc></url>
      </urlset>`;
    const parsed = parseSitemapXml(xml, "https://example.com");
    expect(parsed.valid).toBe(true);
    expect(parsed.kind).toBe("urlset");
    expect(parsed.urls).toHaveLength(2);
  });
});

describe("markdown helpers", () => {
  it("detects markdown and links", () => {
    const md = "# Site\n\n- [Docs](https://example.com/docs)\n";
    expect(looksLikeMarkdown(md)).toBe(true);
    expect(extractMarkdownLinks(md)).toContain("https://example.com/docs");
  });
});

describe("URL normalization", () => {
  it("adds https when protocol is missing", () => {
    expect(normalizeInputUrl("example.com/path")).toBe("https://example.com/path");
  });
});
