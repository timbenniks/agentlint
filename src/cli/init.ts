import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CONFIG_FILENAME, readAgentlintConfig, validateTarget } from "./config.ts";

export interface InitOptions {
  cwd?: string;
  target?: string;
  force?: boolean;
  ci?: boolean;
  cursorSkill?: boolean;
  allowPrivate?: boolean;
}

export interface InitResult {
  target: string;
  runCommand: string;
  created: string[];
  updated: string[];
  skipped: string[];
}

const AGENTS_START = "<!-- agentlint:start -->";
const AGENTS_END = "<!-- agentlint:end -->";

export async function initProject(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd();
  const packagePath = join(cwd, "package.json");
  const packageJson = await readJson(packagePath);
  const existingConfig = await readAgentlintConfig(cwd);
  const inferred = typeof packageJson?.homepage === "string" ? validUrl(packageJson.homepage) : undefined;
  const target = options.target
    ? validateTarget(options.target)
    : existingConfig?.target ?? inferred;
  if (!target) {
    throw new Error("A deployed target URL is required. Run `agentlint init https://example.com`. ");
  }
  if (existingConfig && options.target && existingConfig.target !== target && !options.force) {
    throw new Error(`agentlint.config.json already targets ${existingConfig.target}. Use --force to replace it.`);
  }

  const packageManager = detectPackageManager(packageJson);
  const cliCommand = binaryCommand(packageManager);
  const result: InitResult = { target, runCommand: scriptCommand(packageManager), created: [], updated: [], skipped: [] };
  await writeManagedFile(
    join(cwd, CONFIG_FILENAME),
    `${JSON.stringify({ schemaVersion: "1", target }, null, 2)}\n`,
    options.force === true,
    result,
    CONFIG_FILENAME,
  );

  if (packageJson) {
    const scripts = packageJson.scripts && typeof packageJson.scripts === "object"
      ? packageJson.scripts as Record<string, unknown>
      : {};
    const command = `agentlint scan --agent --missions${options.allowPrivate ? " --allow-private" : ""}`;
    if (typeof scripts.agentlint !== "string" || options.force) {
      const existed = typeof scripts.agentlint === "string";
      scripts.agentlint = command;
      packageJson.scripts = scripts;
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      result[existed ? "updated" : "updated"].push("package.json#scripts.agentlint");
    } else if (scripts.agentlint !== command) {
      result.skipped.push("package.json#scripts.agentlint (already exists; use --force to replace)");
    }
  } else {
    result.skipped.push("package.json script (no package.json found)");
  }

  await ensureGitignore(cwd, result);
  await ensureAgents(cwd, result, result.runCommand, cliCommand);
  if (options.cursorSkill) await ensureCursorSkill(cwd, target, cliCommand, options.force === true, result);
  if (options.ci) await ensureCiWorkflow(cwd, options.force === true, packageManager, result);
  return result;
}

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

function detectPackageManager(packageJson: Record<string, unknown> | undefined): PackageManager {
  const declared = typeof packageJson?.packageManager === "string" ? packageJson.packageManager.split("@")[0] : undefined;
  return declared === "pnpm" || declared === "yarn" || declared === "bun" ? declared : "npm";
}

function scriptCommand(manager: PackageManager): string {
  if (manager === "pnpm") return "pnpm agentlint";
  if (manager === "yarn") return "yarn agentlint";
  if (manager === "bun") return "bun run agentlint";
  return "npm run agentlint";
}

function binaryCommand(manager: PackageManager): string {
  if (manager === "pnpm") return "pnpm exec agentlint";
  if (manager === "yarn") return "yarn exec agentlint";
  if (manager === "bun") return "bunx agentlint";
  return "npx @timbenniks/agentlint";
}

function ciScanCommand(manager: PackageManager): string {
  if (manager === "pnpm") return "pnpm exec agentlint scan --no-browser --json";
  if (manager === "yarn") return "yarn exec agentlint scan --no-browser --json";
  if (manager === "bun") return "bunx agentlint scan --no-browser --json";
  return "npx @timbenniks/agentlint scan --no-browser --json";
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function validUrl(value: string): string | undefined {
  try { return validateTarget(value); } catch { return undefined; }
}

async function writeManagedFile(
  path: string,
  content: string,
  force: boolean,
  result: InitResult,
  label: string,
): Promise<void> {
  let exists = false;
  try { await readFile(path, "utf8"); exists = true; } catch { /* absent */ }
  if (exists && !force) {
    result.skipped.push(`${label} (already exists; use --force to replace)`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  result[exists ? "updated" : "created"].push(label);
}

async function ensureGitignore(cwd: string, result: InitResult): Promise<void> {
  const path = join(cwd, ".gitignore");
  let current = "";
  try { current = await readFile(path, "utf8"); } catch { /* create below */ }
  if (current.split(/\r?\n/).some((line) => /^\/?\.agentlint\/?$/.test(line.trim()))) {
    result.skipped.push(".gitignore (.agentlint already ignored)");
    return;
  }
  const prefix = current && !current.endsWith("\n") ? "\n" : "";
  await writeFile(path, `${current}${prefix}.agentlint/\n`);
  result[current ? "updated" : "created"].push(".gitignore");
}

async function ensureAgents(cwd: string, result: InitResult, runCommand: string, cliCommand: string): Promise<void> {
  const path = join(cwd, "AGENTS.md");
  let current = "";
  try { current = await readFile(path, "utf8"); } catch { /* create below */ }
  const block = agentsBlock(runCommand, cliCommand);
  const start = current.indexOf(AGENTS_START);
  const end = current.indexOf(AGENTS_END);
  if ((start >= 0 || end >= 0) && !(start >= 0 && end > start)) {
    throw new Error("AGENTS.md contains an incomplete Agentlint managed block; repair the markers before running init.");
  }
  if (start >= 0 && end > start) {
    const next = `${current.slice(0, start)}${block}${current.slice(end + AGENTS_END.length)}`;
    if (next === current) {
      result.skipped.push("AGENTS.md (Agentlint block is current)");
      return;
    }
    await writeFile(path, next);
    result.updated.push("AGENTS.md#agentlint");
    return;
  }
  const separator = current.trim() ? `${current.endsWith("\n") ? "" : "\n"}\n` : "";
  await writeFile(path, `${current}${separator}${block}\n`);
  result[current ? "updated" : "created"].push("AGENTS.md#agentlint");
}

function agentsBlock(runCommand: string, cliCommand: string): string {
  return `${AGENTS_START}
## Agentlint

This project uses Agentlint to test whether agents can find, understand, and safely use the deployed website.

1. Run \`${runCommand}\`.
2. If reasoning is required, run \`${cliCommand} task get <id>\` and answer using only its instructions and evidence.
3. Resolve with \`${cliCommand} task resolve <id> --result '<JSON>'\`; repeat until no tasks remain.
4. Run \`${cliCommand} fix\` and use \`.agentlint/fix-prompt.md\` in this repository.
5. Implement evidence-backed P0/P1 fixes, rescan, and repeat until no P0/P1 findings or failed missions remain.

Do not invent pages, APIs, entities, or tools. Do not fix N/A checks. Do not authenticate, submit forms, deploy, or mutate the scanned target.
${AGENTS_END}`;
}

async function ensureCursorSkill(cwd: string, target: string, cliCommand: string, force: boolean, result: InitResult): Promise<void> {
  const label = ".cursor/skills/agentlint/SKILL.md";
  const content = `---
name: agentlint
description: Scan this project's deployed website for agent readiness and apply evidence-backed fixes.
---

# Agentlint

Run \`${cliCommand} scan ${target} --agent --missions\`. Resolve every task using only its supplied instructions and evidence. Mission citations must use supplied sources and must not plan mutations. Run \`${cliCommand} fix\`, apply P0/P1 changes in this repository, and repeat. N/A is not a failure.
`;
  await writeManagedFile(join(cwd, label), content, force, result, label);
}

async function ensureCiWorkflow(cwd: string, force: boolean, manager: PackageManager, result: InitResult): Promise<void> {
  const label = ".github/workflows/agentlint.yml";
  const install = manager === "pnpm"
    ? "corepack enable && pnpm install --frozen-lockfile"
    : manager === "yarn"
      ? "corepack enable && yarn install --immutable"
      : manager === "bun"
        ? "npm install -g bun && bun install --frozen-lockfile"
        : "npm ci";
  const scan = ciScanCommand(manager);
  const content = `name: Agentlint

on:
  workflow_dispatch:
  schedule:
    - cron: "17 7 * * 1"

permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: ${install}
      - run: ${scan}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: agentlint-report
          path: .agentlint/
`;
  await writeManagedFile(join(cwd, label), content, force, result, label);
}
