import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runScan } from "../src/engine/scanner.ts";
import { resolveTask } from "../src/cli/tasks.ts";

const html = `<!doctype html>
<html lang="en">
  <head>
    <title>Tim Benniks</title>
    <meta name="description" content="Developer and speaker">
    <link rel="canonical" href="http://127.0.0.1:PORT/">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Person","name":"Tim Benniks","url":"http://127.0.0.1:PORT/"}
    </script>
  </head>
  <body>
    <header><nav><a href="/docs">Docs</a><a href="/about">About</a></nav></header>
    <main>
      <h1>Tim Benniks</h1>
      <p>Personal website of Tim Benniks, a developer who talks about web technology and AI agents.</p>
      <p>This page has enough raw HTML for an agent to understand the offering without JavaScript.</p>
    </main>
    <footer><a href="/contact">Contact</a></footer>
  </body>
</html>`;

const robots = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

Sitemap: http://127.0.0.1:PORT/sitemap.xml
`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://127.0.0.1:PORT/</loc></url>
  <url><loc>http://127.0.0.1:PORT/docs</loc></url>
</urlset>`;

const docs = `<!doctype html><html lang="en"><head><title>Docs</title></head>
<body><main><h1>Docs</h1><p>Getting started with nothing in particular.</p></main></body></html>`;

const llms = `# Tim Benniks\n\n- [Home](http://127.0.0.1:PORT/)\n- [Docs](http://127.0.0.1:PORT/docs)\n`;

describe("local scan", () => {
  let port = 0;
  let close = async () => {};

  beforeAll(async () => {
    const server = createServer((req, res) => {
      const url = req.url ?? "/";
      const origin = `http://127.0.0.1:${port}`;
      const send = (code: number, type: string, body: string) => {
        res.writeHead(code, { "content-type": type });
        res.end(body);
      };
      if (url === "/robots.txt") return send(200, "text/plain", robots.replaceAll("PORT", String(port)));
      if (url === "/sitemap.xml") return send(200, "application/xml", sitemap.replaceAll("PORT", String(port)));
      if (url === "/llms.txt") return send(200, "text/plain", llms.replaceAll("PORT", String(port)));
      if (url === "/docs") return send(200, "text/html", docs);
      if (url === "/index.md") return send(200, "text/markdown", "# Tim Benniks\n");
      if (url?.startsWith("/agentlint-probe-")) return send(404, "text/plain", "Not found");
      if (url === "/" || url === "") {
        return send(200, "text/html", html.replaceAll("PORT", String(port)));
      }
      return send(404, "text/plain", "Not found");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    port = addr.port;
    close = () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
  });

  afterAll(async () => {
    await close();
  });

  it("scans a local site and writes reports", async () => {
    const output = await mkdtemp(join(tmpdir(), "agentlint-"));
    const { report } = await runScan({
      url: `http://127.0.0.1:${port}`,
      browser: false,
      depth: 1,
      maxPages: 5,
      format: "json",
      output,
      verbose: false,
      agent: false,
      json: true,
      allowPrivate: true,
      ci: false,
    });

    expect(report.schemaVersion).toBe("1");
    expect(report.score.overall).not.toBeNull();
    expect(report.checks.find((c) => c.id === "robots-txt")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "sitemap")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "llms-txt")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "raw-html-content")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "agent-friendly-404")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "idempotency")?.status).toBe("na");
    expect(report.reasoningTasks.some((t) => t.id === "offering-clarity")).toBe(true);

    const latest = JSON.parse(await readFile(join(output, "latest.json"), "utf8"));
    expect(latest.scanId).toBe(report.scanId);

    const resolved = await resolveTask(
      "offering-clarity",
      JSON.stringify({
        offering: "Personal developer site",
        audience: "Developers",
        primaryAction: "Read articles and talks",
        concrete: true,
        score: 90,
        confidence: 0.8,
        notes: ["Homepage copy describes the person and work"],
      }),
      output,
    );
    expect(resolved.task.status).toBe("resolved");
  });

  it("rejects invalid reasoning results", async () => {
    const output = await mkdtemp(join(tmpdir(), "agentlint-"));
    await runScan({
      url: `http://127.0.0.1:${port}`,
      browser: false,
      depth: 1,
      maxPages: 3,
      format: "json",
      output,
      verbose: false,
      agent: false,
      json: true,
      allowPrivate: true,
      ci: false,
    });
    await expect(resolveTask("offering-clarity", '{"nope":true}', output)).rejects.toThrow(/schema/);
  });
});
