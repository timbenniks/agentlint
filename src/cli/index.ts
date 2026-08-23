import { Command } from "commander";
import { AGENTLINT_VERSION } from "../constants.ts";
import { runScan } from "../engine/scanner.ts";
import { readLatestReport } from "../engine/state.ts";
import {
  renderAgentProtocol,
  renderExplain,
  renderFix,
  renderProgress,
  renderTerminal,
} from "../reporters/terminal.ts";
import { getTask, listTasks, resolveTask } from "./tasks.ts";
import type { ScanOptions } from "../types.ts";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("agentlint")
    .description(
      "Deterministic-first website scanner for agent readiness. Coding agents: run `scan <url> --agent`, then `task get <id>` / `task resolve <id> --result` for any pending reasoning tasks. Do not call a model API. N/A checks are not failures.",
    )
    .version(AGENTLINT_VERSION)
    .addHelpText(
      "after",
      `
Agent workflow:
  $ agentlint scan https://example.com --agent
  $ agentlint task get <id>
  $ agentlint task resolve <id> --result '<json>'
  $ agentlint fix
`,
    );

  addScanOptions(
    program
      .command("scan")
      .description("Scan a website for agent readiness")
      .argument("<url>", "URL to scan")
      .action(async (url, opts) => {
        await executeScan(url, opts);
      }),
  );

  program
    .command("tasks")
    .description("List pending reasoning tasks from the latest scan")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (opts: { output: string }) => {
      const tasks = await listTasks(opts.output);
      if (tasks.length === 0) {
        console.log("No reasoning tasks. Run a scan first.");
        return;
      }
      const pending = tasks.filter((t) => t.status === "pending");
      console.log(`${pending.length} reasoning tasks\n`);
      tasks.forEach((task, i) => {
        console.log(`${i + 1}. ${task.id} (${task.status})`);
      });
    });

  const task = program.command("task").description("Inspect or resolve a reasoning task");

  task
    .command("get")
    .argument("<id>")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (id: string, opts: { output: string }) => {
      const item = await getTask(id, opts.output);
      console.log(JSON.stringify(item, null, 2));
    });

  task
    .command("resolve")
    .argument("<id>")
    .requiredOption("--result <json>", "JSON result matching the task output schema")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (id: string, opts: { result: string; output: string }) => {
      const { task: resolved } = await resolveTask(id, opts.result, opts.output);
      console.log(`Resolved ${resolved.id}.`);
    });

  program
    .command("explain")
    .argument("[category]", "category to explain")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (category: string | undefined, opts: { output: string }) => {
      const report = await readLatestReport(opts.output);
      if (!report) {
        console.error("No scan report found. Run `agentlint scan <url>` first.");
        process.exitCode = 2;
        return;
      }
      process.stdout.write(renderExplain(report, category));
    });

  program
    .command("fix")
    .description("Print prioritized recommendations from the latest scan")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (opts: { output: string }) => {
      const report = await readLatestReport(opts.output);
      if (!report) {
        console.error("No scan report found. Run `agentlint scan <url>` first.");
        process.exitCode = 2;
        return;
      }
      process.stdout.write(renderFix(report));
    });

  return program;
}

function addScanOptions(cmd: Command): Command {
  return cmd
    .option("--no-browser", "disable Playwright browser scanning")
    .option("--depth <n>", "maximum crawl depth", "2")
    .option("--max-pages <n>", "maximum pages to crawl", "20")
    .option("--format <fmt>", "terminal | json | markdown", "terminal")
    .option("--output <dir>", "report output directory", ".agentlint")
    .option("--verbose", "show per-check evidence in the terminal", false)
    .option("--agent", "print agent-native reasoning instructions", false)
    .option("--json", "machine-friendly JSON status output", false)
    .option("--allow-private", "allow localhost and private IP targets", false)
    .option("--ci", "CI mode (reserved)", false);
}

async function executeScan(url: string, raw: Record<string, unknown>): Promise<void> {
  const options = parseScanOptions(url, raw);
  try {
    const { report } = await runScan(options);
    const pending = report.reasoningTasks.filter((t) => t.status === "pending");

    if (options.json || options.format === "json") {
      const payload = {
        status: pending.length ? "reasoning_required" : "complete",
        scanId: report.scanId,
        score: report.score.overall,
        tasks: pending.map((t) => t.id),
        next: pending[0] ? `agentlint task get ${pending[0].id}` : undefined,
        report: options.format === "json" ? report : undefined,
      };
      console.log(JSON.stringify(options.format === "json" ? report : payload, null, 2));
      return;
    }

    if (options.format === "markdown") {
      const { renderMarkdown } = await import("../reporters/markdown.ts");
      process.stdout.write(renderMarkdown(report));
      return;
    }

    process.stdout.write(renderProgress(report));
    process.stdout.write(renderTerminal(report, options.verbose));
    if (pending.length) {
      process.stdout.write(renderAgentProtocol(report));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ status: "error", error: message }));
    } else {
      console.error(`agentlint: ${message}`);
    }
    process.exitCode = 2;
  }
}

export function parseScanOptions(url: string, raw: Record<string, unknown>): ScanOptions {
  const formatRaw = String(raw.format ?? "terminal");
  const format =
    formatRaw === "json" || formatRaw === "markdown" || formatRaw === "terminal"
      ? formatRaw
      : "terminal";
  return {
    url,
    browser: raw.browser !== false,
    depth: Number(raw.depth ?? 2),
    maxPages: Number(raw.maxPages ?? 20),
    format,
    output: String(raw.output ?? ".agentlint"),
    verbose: Boolean(raw.verbose),
    agent: Boolean(raw.agent),
    json: Boolean(raw.json),
    allowPrivate: Boolean(raw.allowPrivate),
    ci: Boolean(raw.ci),
  };
}

const TOP_LEVEL_COMMANDS = new Set(["scan", "tasks", "task", "explain", "fix", "help"]);

export function rewriteArgv(argv: string[]): string[] {
  const args = argv.slice(2);
  const first = args[0];
  if (!first || first.startsWith("-") || TOP_LEVEL_COMMANDS.has(first)) return argv;
  return [...argv.slice(0, 2), "scan", ...args];
}

export async function main(argv = process.argv): Promise<void> {
  await buildProgram().parseAsync(rewriteArgv(argv));
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const normalized = entry.replaceAll("\\", "/");
  return (
    normalized.endsWith("/cli/index.ts") ||
    normalized.endsWith("/cli/index.js") ||
    normalized.endsWith("/agentlint")
  );
}

if (isDirectRun()) {
  await main();
}
