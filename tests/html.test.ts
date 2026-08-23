import { describe, expect, it } from "vitest";
import { flattenJsonLd, jsonLdTypes, parseHtml } from "../src/engine/html.ts";

describe("HTML parsing", () => {
  it("extracts metadata, headings, and JSON-LD", () => {
    const html = `<!doctype html>
      <html lang="en">
        <head>
          <title>Tim Benniks</title>
          <meta name="description" content="Engineer">
          <link rel="canonical" href="https://timbenniks.dev/">
          <meta property="og:title" content="Tim Benniks">
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Person","name":"Tim Benniks"}
          </script>
        </head>
        <body>
          <main>
            <h1>Tim Benniks</h1>
            <p>Hello world, this is enough text to not look like a shell.</p>
            <a href="/docs">Docs</a>
          </main>
        </body>
      </html>`;
    const page = parseHtml(html, "https://timbenniks.dev/");
    expect(page.title).toBe("Tim Benniks");
    expect(page.language).toBe("en");
    expect(page.headings[0]?.text).toBe("Tim Benniks");
    expect(page.jsonLd[0]?.types).toContain("Person");
    expect(page.hasMain).toBe(true);
    expect(page.links.some((l) => l.href.endsWith("/docs"))).toBe(true);
  });

  it("flattens @graph JSON-LD", () => {
    const nodes = flattenJsonLd({
      "@graph": [{ "@type": "WebSite", name: "Example" }, { "@type": "Person", name: "Ada" }],
    });
    expect(nodes).toHaveLength(2);
    expect(jsonLdTypes(nodes[1]!)).toEqual(["Person"]);
  });
});
