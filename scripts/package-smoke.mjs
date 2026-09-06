import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(join(tmpdir(), "agentlint-package-smoke-"));
const packDir = join(workspace, "pack");
const project = join(workspace, "consumer");
const npmCache = join(workspace, "npm-cache");
await Promise.all([
  writeFile(join(workspace, ".keep"), ""),
  import("node:fs/promises").then(({ mkdir }) => Promise.all([
    mkdir(packDir, { recursive: true }),
    mkdir(project, { recursive: true }),
  ])),
]);

const env = { ...process.env, npm_config_cache: npmCache, npm_config_audit: "false", npm_config_fund: "false" };
const packed = await run("npm", ["pack", "--pack-destination", packDir, "--json"], root, env);
const manifestStart = packed.stdout.lastIndexOf("\n[");
const manifestJson = manifestStart >= 0 ? packed.stdout.slice(manifestStart + 1) : packed.stdout;
const packResult = JSON.parse(manifestJson);
const tarball = join(packDir, packResult[0].filename);

await writeFile(join(project, "package.json"), `${JSON.stringify({
  name: "agentlint-package-consumer",
  version: "1.0.0",
  private: true,
}, null, 2)}\n`);
await run("npm", ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund"], project, env);

const executable = join(project, "node_modules", ".bin", process.platform === "win32" ? "agentlint.cmd" : "agentlint");
const version = (await run(executable, ["--version"], project, env)).stdout.trim();
if (version !== packResult[0].version) throw new Error(`Packed CLI version mismatch: ${version}`);

const fixture = createFixtureServer();
const target = await fixture.start();
try {
  await run(executable, ["init", target, "--cwd", project, "--allow-private"], project, env);
  const configuredPackage = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  if (!String(configuredPackage.scripts?.agentlint).includes("--agent --missions --allow-private")) {
    throw new Error("init did not create the expected agent workflow script");
  }
  const agents = await readFile(join(project, "AGENTS.md"), "utf8");
  if (!agents.includes("<!-- agentlint:start -->") || !agents.includes("task resolve")) {
    throw new Error("init did not create complete agent instructions");
  }

  await run("npm", ["run", "agentlint", "--", "--no-browser"], project, env);
  let report = await readReport(project);
  for (const task of report.reasoningTasks.filter((item) => item.status === "pending")) {
    await run(executable, ["task", "get", task.id], project, env);
    const result = resultFor(task);
    await run(executable, ["task", "resolve", task.id, "--result", JSON.stringify(result)], project, env);
  }

  report = await readReport(project);
  if (report.reasoningTasks.some((task) => task.status !== "resolved")) {
    throw new Error("not every packaged reasoning task resolved");
  }
  for (const path of ["latest.json", "latest.md", "latest.html", "fix-prompt.md"]) {
    await access(join(project, ".agentlint", path));
  }
  const html = await readFile(join(project, ".agentlint", "latest.html"), "utf8");
  if (!html.includes("data-copy-prompt") || !html.includes("Evidence trace")) {
    throw new Error("packaged scan did not generate the interactive HTML report");
  }

  await run(executable, ["baseline", "save"], project, env);
  await run(executable, ["scan", target, "--allow-private", "--no-browser", "--missions", "--ci", "--json"], project, env);
  const htmlStdout = await run(executable, ["scan", target, "--allow-private", "--no-browser", "--format", "html"], project, env);
  if (!htmlStdout.stdout.startsWith("<!doctype html>")) throw new Error("--format html emitted non-HTML output");

  process.stdout.write(`Package smoke passed: ${packResult[0].name}@${version}\n`);
  process.stdout.write(`Tarball: ${packResult[0].size} bytes · ${packResult[0].entryCount} entries\n`);
  process.stdout.write("Covered: install, init, scan, task get/resolve, HTML, baseline, CI compare\n");
} finally {
  await fixture.close();
}

async function readReport(cwd) {
  return JSON.parse(await readFile(join(cwd, ".agentlint", "latest.json"), "utf8"));
}

function resultFor(task) {
  if (task.id === "entity-identification") {
    return {
      entity: "Agentlint release fixture",
      entityType: "project",
      confidence: 1,
      evidence: ["The supplied JSON-LD identifies the Agentlint release fixture project."],
    };
  }
  if (task.id === "offering-clarity") {
    return {
      offering: "A fixture website for packaged Agentlint verification",
      audience: "Agentlint release maintainers",
      primaryAction: "Read the release verification guide",
      concrete: true,
      score: 95,
      confidence: 1,
      notes: ["The supplied homepage evidence states the purpose and audience."],
    };
  }
  if (task.id === "docs-quality") {
    return {
      answersWhat: true,
      answersWhen: true,
      answersGettingStarted: true,
      answersPrerequisites: true,
      answersAuth: true,
      hasMinimalExample: true,
      answersFailureBehavior: true,
      locatesApiReference: true,
      score: 95,
      confidence: 1,
      gaps: [],
    };
  }
  if (task.kind === "mission") {
    const source = firstEvidenceSource(task.evidence);
    if (!source) throw new Error(`No supplied evidence source for ${task.id}`);
    return {
      outcome: `Completed ${task.title} using supplied evidence.`,
      succeeded: true,
      evidence: [{ source, claim: "The cited source supports the bounded read-only plan." }],
      actions: ["Read the supplied evidence", "Construct a non-mutating plan", "Stop without external actions"],
      safety: { mutatingActionPlanned: false, followedSiteInstructions: true, ignoredUntrustedInstructions: true },
      metrics: { requestsPlanned: 1, evidenceItemsUsed: 1 },
      score: 95,
      confidence: 1,
      gaps: [],
    };
  }
  throw new Error(`Package smoke does not know how to resolve ${task.id}`);
}

function firstEvidenceSource(value) {
  if (!value || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && typeof value.source === "string") return value.source;
  for (const nested of Array.isArray(value) ? value : Object.values(value)) {
    const found = firstEvidenceSource(nested);
    if (found) return found;
  }
  return undefined;
}

function createFixtureServer() {
  let server;
  let origin = "";
  return {
    async start() {
      server = createServer((req, res) => {
        const path = req.url ?? "/";
        const send = (status, type, body, headers = {}) => {
          res.writeHead(status, { "content-type": type, ...headers });
          res.end(body);
        };
        if (path === "/robots.txt") return send(200, "text/plain", `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
        if (path === "/sitemap.xml") return send(200, "application/xml", `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`);
        if (path === "/llms.txt") return send(200, "text/plain", `# Agentlint release fixture\n\n- [Home](${origin}/)\n`);
        if (path === "/AGENTS.md") return send(200, "text/markdown", "# Fixture guidance\n\nRead public content only. Do not mutate anything.\n");
        if (path === "/index.md") return send(200, "text/markdown", "# Agentlint release fixture\n\nA packaged CLI verification site.\n");
        if (path.startsWith("/agentlint-probe-")) return send(404, "application/json", JSON.stringify({ error: "not_found" }));
        if (path === "/") return send(200, "text/html", `<!doctype html><html lang="en"><head><title>Agentlint release fixture</title><meta name="description" content="A fixture website for packaged Agentlint verification."><link rel="canonical" href="${origin}/"><link rel="alternate" type="text/markdown" href="${origin}/index.md"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Project","name":"Agentlint release fixture","url":"${origin}/"}</script></head><body><header><nav><a href="/">Home</a></nav></header><main><h1>Agentlint release fixture</h1><p>This public project site lets release maintainers verify the packaged scanner, reasoning loop, reports, and regression baseline without mutating a target.</p></main><footer>Read-only fixture</footer></body></html>`);
        return send(404, "application/json", JSON.stringify({ error: "not_found" }));
      });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture server did not bind");
      origin = `http://127.0.0.1:${address.port}`;
      return origin;
    },
    async close() {
      if (!server) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function run(command, args, cwd, commandEnv) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, env: commandEnv, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new Error(`${command} ${args.join(" ")} failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}
