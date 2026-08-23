import { createServer, type Server } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runScan } from "../src/engine/scanner.ts";

interface FixtureConfig {
  name: string;
  routes: Record<string, string>;
  expect: Record<string, string>;
  capabilities?: Record<string, boolean>;
  soft404?: boolean;
}

const root = join(import.meta.dirname, "fixtures", "sites");
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

describe("representative site matrix", () => {
  const servers: Server[] = [];

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  let fixtures: Array<{ directory: string; config: FixtureConfig }> = [];
  beforeAll(async () => {
    fixtures = await Promise.all((await readdir(root)).map(async (directory) => ({
      directory,
      config: JSON.parse(await readFile(join(root, directory, "site.json"), "utf8")) as FixtureConfig,
    })));
  });

  it("preserves expected scanner behavior for every site shape", async () => {
    expect(fixtures.map(({ directory }) => directory).sort()).toEqual(["broken", "js-heavy", "portfolio", "saas"]);

    for (const { directory, config } of fixtures) {
      let origin = "";
      const server = createServer(async (request, response) => {
        const path = new URL(request.url ?? "/", origin).pathname;
        const filename = config.routes[path];
        if (!filename) {
          if (config.soft404) {
            const body = (await readFile(join(root, directory, "index.html"), "utf8")).replaceAll("ORIGIN", origin);
            response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            response.end(body);
            return;
          }
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          response.end("Not found");
          return;
        }
        const body = (await readFile(join(root, directory, filename), "utf8")).replaceAll("ORIGIN", origin);
        response.writeHead(200, { "content-type": contentTypes[extname(filename)] ?? "application/octet-stream" });
        response.end(body);
      });
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error(`Could not bind ${config.name}`);
      origin = `http://127.0.0.1:${address.port}`;

      const { report } = await runScan({
        url: origin,
        browser: false,
        depth: 1,
        maxPages: 6,
        format: "json",
        output: join("/tmp", `agentlint-matrix-${directory}-${process.pid}`),
        verbose: false,
        agent: false,
        json: true,
        allowPrivate: true,
        ci: false,
        missions: false,
      });

      for (const [id, status] of Object.entries(config.expect)) {
        expect(report.checks.find((check) => check.id === id)?.status, `${config.name}: ${id}`).toBe(status);
      }
      for (const [capability, value] of Object.entries(config.capabilities ?? {})) {
        expect(report.capabilities[capability as keyof typeof report.capabilities], `${config.name}: ${capability}`).toBe(value);
      }
    }
  });
});
