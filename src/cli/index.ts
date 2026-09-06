import { Command } from "commander";
import { AGENTLINT_VERSION } from "../constants.ts";
import { runScan } from "../engine/scanner.ts";
import { readLatestReport } from "../engine/state.ts";
import { latestPaths } from "../engine/state.ts";
import { compareBaseline, readBaseline, saveBaseline } from "../engine/regression.ts";
import { renderRemediationPrompt } from "../reporters/prompt.ts";
import {
  renderAgentProtocol,
  renderExplain,
  renderFix,
  renderProgress,
  renderTerminal,
} from "../reporters/terminal.ts";
import { getTask, listTasks, resolveTask } from "./tasks.ts";
import { readAgentlintConfig } from "./config.ts";
import { initProject } from "./init.ts";
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
  $ agentlint init https://example.com
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
      .argument("[url]", "URL to scan (defaults to agentlint.config.json)")
      .action(async (url, opts) => {
        await executeScan(url, opts);
      }),
  );

  program
    .command("init")
    .description("Configure Agentlint in an existing website project")
    .argument("[url]", "deployed website URL (or package.json homepage)")
    .option("--force", "replace existing Agentlint-managed config and scaffolding", false)
    .option("--ci", "add a scheduled GitHub Actions scan", false)
    .option("--cursor-skill", "add a project-local Cursor Agentlint skill", false)
    .option("--allow-private", "include --allow-private in the generated npm script", false)
    .option("--cwd <path>", "project directory", process.cwd())
    .action(async (url: string | undefined, opts: { force: boolean; ci: boolean; cursorSkill: boolean; allowPrivate: boolean; cwd: string }) => {
      try {
        const result = await initProject({
          cwd: opts.cwd,
          target: url,
          force: opts.force,
          ci: opts.ci,
          cursorSkill: opts.cursorSkill,
          allowPrivate: opts.allowPrivate,
        });
        console.log(`Agentlint initialized for ${result.target}`);
        if (result.created.length) console.log(`Created: ${result.created.join(", ")}`);
        if (result.updated.length) console.log(`Updated: ${result.updated.join(", ")}`);
        if (result.skipped.length) console.log(`Skipped: ${result.skipped.join(", ")}`);
        console.log(`Next: ${result.runCommand}`);
      } catch (error) {
        console.error(`agentlint: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 2;
      }
    });

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

  program
    .command("prompt")
    .description("Print a self-contained remediation prompt for an external coding-agent loop")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (opts: { output: string }) => {
      const report = await readLatestReport(opts.output);
      if (!report) {
        console.error("No scan report found. Run `agentlint scan <url>` first.");
        process.exitCode = 2;
        return;
      }
      process.stdout.write(renderRemediationPrompt(report));
    });

  const baseline = program.command("baseline").description("Save or compare an agent-readiness regression baseline");
  baseline
    .command("save")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (opts: { output: string }) => {
      const report = await readLatestReport(opts.output);
      if (!report) {
        console.error("No scan report found. Run a scan first.");
        process.exitCode = 2;
        return;
      }
      const path = latestPaths(opts.output).baseline;
      await saveBaseline(path, report);
      console.log(`Saved baseline to ${path}.`);
    });
  baseline
    .command("compare")
    .option("--output <dir>", "report directory", ".agentlint")
    .action(async (opts: { output: string }) => {
      const report = await readLatestReport(opts.output);
      const saved = await readBaseline(latestPaths(opts.output).baseline);
      if (!report || !saved) {
        console.error("A latest report and baseline are required.");
        process.exitCode = 2;
        return;
      }
      const result = compareBaseline(saved, report);
      if (result.passed) console.log("No agent-readiness regressions.");
      else {
        console.log(`Agent-readiness regressions:\n- ${result.regressions.join("\n- ")}`);
        process.exitCode = 1;
      }
    });

  return program;
}

function addScanOptions(cmd: Command): Command {
  return cmd
    .option("--no-browser", "disable Playwright browser scanning")
    .option("--depth <n>", "maximum crawl depth", "2")
    .option("--max-pages <n>", "maximum pages to crawl", "20")
    .option("--format <fmt>", "terminal | json | markdown | html", "terminal")
    .option("--output <dir>", "report output directory", ".agentlint")
    .option("--verbose", "show per-check evidence in the terminal", false)
    .option("--agent", "print agent-native reasoning instructions", false)
    .option("--json", "machine-friendly JSON status output", false)
    .option("--allow-private", "allow localhost and private IP targets", false)
    .option("--ci", "compare the scan with .agentlint/baseline.json", false)
    .option("--missions", "add bounded evidence-only agent missions", false);
}

async function executeScan(url: string | undefined, raw: Record<string, unknown>): Promise<void> {
  try {
    const configured = url ? undefined : await readAgentlintConfig();
    const target = url ?? configured?.target;
    if (!target) throw new Error("No scan URL supplied and no agentlint.config.json target found. Run `agentlint init <url>`.");
    const options = parseScanOptions(target, raw);
    const { report } = await runScan(options);
    const pending = report.reasoningTasks.filter((t) => t.status === "pending");
    let regression: ReturnType<typeof compareBaseline> | undefined;
    if (options.ci) {
      const saved = await readBaseline(latestPaths(options.output).baseline);
      if (!saved) throw new Error(`No baseline found at ${latestPaths(options.output).baseline}. Run \`agentlint baseline save\` first.`);
      regression = compareBaseline(saved, report);
      if (!regression.passed) process.exitCode = 1;
    }

    if (options.json || options.format === "json") {
      const payload = {
        status: pending.length ? "reasoning_required" : "complete",
        scanId: report.scanId,
        score: report.score.overall,
        tasks: pending.map((t) => t.id),
        next: pending[0] ? `agentlint task get ${pending[0].id}` : undefined,
        regression,
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

    if (options.format === "html") {
      const { renderHtml } = await import("../reporters/html.ts");
      process.stdout.write(renderHtml(report));
      return;
    }

    process.stdout.write(renderProgress(report, options.output));
    process.stdout.write(renderTerminal(report, options.verbose, options.output));
    if (regression && !regression.passed) {
      process.stdout.write(`Regressions:\n- ${regression.regressions.join("\n- ")}\n\n`);
    }
    if (pending.length) {
      process.stdout.write(renderAgentProtocol(report));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (Boolean(raw.json)) {
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
    formatRaw === "json" || formatRaw === "markdown" || formatRaw === "html" || formatRaw === "terminal"
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
    missions: Boolean(raw.missions),
  };
}

const TOP_LEVEL_COMMANDS = new Set(["scan", "init", "tasks", "task", "explain", "fix", "prompt", "baseline", "help"]);

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
